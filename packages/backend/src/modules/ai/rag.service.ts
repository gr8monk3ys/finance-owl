import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { OllamaClient } from './ollama.client';
import { ChromaDBService } from './chromadb.service';
import * as schema from '../../database/schema';

export interface RagQueryResult {
  answer: string;
  sources: Array<{
    transactionId: string;
    text: string;
    distance: number;
  }>;
}

interface SqlQueryResult {
  answer: string;
  data: Record<string, unknown>[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private chromaDBService: ChromaDBService,
    private ollamaClient: OllamaClient,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {}

  formatTransaction(tx: {
    date: string;
    merchantName: string | null;
    name: string;
    amount: number;
    categoryName?: string | null;
  }): string {
    const merchant = tx.merchantName || tx.name;
    const category = tx.categoryName ? ` for ${tx.categoryName}` : '';
    return `On ${tx.date}, ${merchant} charged $${Math.abs(tx.amount).toFixed(2)}${category}`;
  }

  async embedTransactions(
    userId: string,
    transactionIds: string[],
  ): Promise<void> {
    if (!this.chromaDBService.isAvailable()) {
      this.logger.debug(
        'ChromaDB unavailable, skipping transaction embedding',
      );
      return;
    }

    if (transactionIds.length === 0) return;

    // Fetch transactions with category names
    const txRows = await this.db
      .select({
        id: schema.transactions.id,
        date: schema.transactions.date,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        categoryName: schema.categories.name,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          inArray(schema.transactions.id, transactionIds),
        ),
      );

    if (txRows.length === 0) return;

    const docs = txRows.map((tx) => ({
      id: tx.id,
      text: this.formatTransaction(tx),
      metadata: {
        userId,
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchantName || tx.name,
        category: tx.categoryName || 'Uncategorized',
      },
    }));

    this.logger.debug(
      `Embedding ${docs.length} transactions for user ${userId}`,
    );
    await this.chromaDBService.addDocuments(docs);
  }

  async query(userId: string, question: string): Promise<RagQueryResult> {
    const unavailableResult: RagQueryResult = {
      answer:
        'AI features are currently unavailable. Please ensure Ollama is running and try again.',
      sources: [],
    };

    if (!this.ollamaClient.isAvailable()) {
      return unavailableResult;
    }

    // If ChromaDB is available, use RAG. Otherwise, fall back to SQL-based context.
    let context: string;
    let sources: RagQueryResult['sources'] = [];

    if (this.chromaDBService.isAvailable()) {
      // Embed the question and search ChromaDB for relevant transactions
      const results = await this.chromaDBService.query(question, 10);

      // Filter results to only include this user's transactions
      const userResults = results.filter(
        (r) => r.metadata?.userId === userId,
      );

      if (userResults.length > 0) {
        context = userResults.map((r) => r.document).join('\n');
        sources = userResults.map((r) => ({
          transactionId: r.id,
          text: r.document,
          distance: r.distance,
        }));
      } else {
        context = await this.buildSqlContext(userId);
      }
    } else {
      context = await this.buildSqlContext(userId);
    }

    const prompt = `You are a helpful personal finance assistant for FinanceOwl. Answer the user's question based on their transaction data below.

Be concise, specific, and helpful. If you cannot determine the answer from the data, say so honestly. Format currency values as dollars. Do not make up transactions or data that is not in the context.

Transaction data:
${context || 'No relevant transaction data found.'}

User question: ${question}

Answer:`;

    const answer = await this.ollamaClient.generate(prompt, {
      temperature: 0.3,
    });

    if (!answer) {
      return unavailableResult;
    }

    return { answer, sources };
  }

  async queryWithSQL(
    userId: string,
    question: string,
  ): Promise<SqlQueryResult> {
    if (!this.ollamaClient.isAvailable()) {
      return {
        answer:
          'AI features are currently unavailable. Please ensure Ollama is running and try again.',
        data: [],
      };
    }

    // Instruct the LLM to use ? as a placeholder for user_id instead of the actual value
    const sqlPrompt = `You are a SQL query generator for a personal finance app. Generate a SQLite SELECT query to answer the user's question.

Rules:
- ONLY generate SELECT statements, nothing else
- Always filter by user_id = ? (use ? as a parameter placeholder for the user's ID)
- Only use these tables: transactions, categories, accounts
- transactions columns: id, user_id, account_id, category_id, amount, name, merchant_name, description, date, categorization_source
- categories columns: id, user_id, parent_id, name, icon, color, is_system
- accounts columns: id, user_id, name, type, balance_current
- You may JOIN transactions with categories ON transactions.category_id = categories.id
- You may JOIN transactions with accounts ON transactions.account_id = accounts.id
- No subqueries, no UNION, no CTEs
- Use ? for the user_id parameter — do NOT embed actual values
- Respond with ONLY the SQL query, nothing else

User question: ${question}

SQL:`;

    const sqlResponse = await this.ollamaClient.generate(sqlPrompt, {
      temperature: 0.1,
    });

    if (!sqlResponse) {
      return { answer: 'Failed to generate query.', data: [] };
    }

    // Validate the generated SQL
    const sql = sqlResponse.replace(/```sql\n?/g, '').replace(/```/g, '').trim();
    const validationError = this.validateSql(sql);
    if (validationError) {
      this.logger.warn(`Generated SQL failed validation: ${validationError}`);
      return {
        answer: `I could not safely process that question. ${validationError}`,
        data: [],
      };
    }

    // Count the number of ? placeholders to bind userId for each one
    const paramCount = (sql.match(/\?/g) || []).length;
    if (paramCount === 0) {
      return {
        answer: 'Query must filter by your user ID.',
        data: [],
      };
    }
    const params = Array(paramCount).fill(userId);

    // Execute with parameterized query and a timeout
    try {
      const rawDb = (this.db as unknown as { _: { session: { client: { prepare: (sql: string) => { all: (...params: unknown[]) => Record<string, unknown>[]; }; interrupt: () => void } } } })._.session.client;
      const stmt = rawDb.prepare(sql);

      // Set execution timeout (5 seconds)
      const timeoutMs = 5000;
      const timer = setTimeout(() => {
        rawDb.interrupt();
      }, timeoutMs);

      let rows: Record<string, unknown>[];
      try {
        rows = stmt.all(...params) as Record<string, unknown>[];
      } finally {
        clearTimeout(timer);
      }

      if (rows.length === 0) {
        return {
          answer: 'No results found for your query.',
          data: [],
        };
      }

      // Summarize results via Ollama
      const summaryPrompt = `Summarize the following financial data as a helpful answer to the user's question. Be concise and format currency as dollars.

Question: ${question}

Data (${rows.length} rows):
${JSON.stringify(rows.slice(0, 50), null, 2)}

Summary:`;

      const summary = await this.ollamaClient.generate(summaryPrompt, {
        temperature: 0.3,
      });

      return {
        answer: summary || 'Here are the results.',
        data: rows.slice(0, 100),
      };
    } catch (error) {
      this.logger.warn(`SQL execution failed: ${error}`);
      return {
        answer: 'I had trouble processing that query. Please try rephrasing your question.',
        data: [],
      };
    }
  }

  private validateSql(sql: string): string | null {
    const upper = sql.toUpperCase().trim();

    if (!upper.startsWith('SELECT')) {
      return 'Only SELECT queries are allowed.';
    }

    const forbidden = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'ALTER',
      'CREATE',
      'TRUNCATE',
      'EXEC',
      'EXECUTE',
      'PRAGMA',
      'ATTACH',
      'DETACH',
    ];

    for (const keyword of forbidden) {
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(sql)) {
        return `Forbidden keyword detected: ${keyword}`;
      }
    }

    // Block subqueries
    const selectCount = (upper.match(/\bSELECT\b/g) || []).length;
    if (selectCount > 1) {
      return 'Subqueries are not allowed.';
    }

    // Block UNION
    if (/\bUNION\b/i.test(sql)) {
      return 'UNION queries are not allowed.';
    }

    // Block semicolons (prevent statement chaining)
    if (sql.includes(';')) {
      return 'Multiple statements are not allowed.';
    }

    // Block comments (prevent comment-based injection)
    if (/--/.test(sql) || /\/\*/.test(sql)) {
      return 'SQL comments are not allowed.';
    }

    return null;
  }

  private async buildSqlContext(userId: string): Promise<string> {
    // Fetch recent transactions as fallback context
    const recentTx = await this.db
      .select({
        id: schema.transactions.id,
        date: schema.transactions.date,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        categoryName: schema.categories.name,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(eq(schema.transactions.userId, userId))
      .orderBy(desc(schema.transactions.date))
      .limit(50);

    if (recentTx.length === 0) {
      return 'No transactions found for this user.';
    }

    return recentTx.map((tx) => this.formatTransaction(tx)).join('\n');
  }
}
