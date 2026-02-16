import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaidProvider } from './plaid.provider';
import { MxProvider } from './mx.provider';
import { FinicityProvider } from './finicity.provider';
import type {
  BankAggregatorProvider,
  AggregatorName,
} from './aggregator.interface';

/**
 * Factory that manages all registered bank aggregator providers.
 *
 * Responsibilities:
 * - Determine which providers are available based on configuration
 * - Resolve the default provider (configurable via BANK_AGGREGATOR_DEFAULT)
 * - Look up a provider by name
 * - Provide fallback chains for institution routing
 */
@Injectable()
export class AggregatorFactory implements OnModuleInit {
  private readonly logger = new Logger(AggregatorFactory.name);
  private readonly providers = new Map<AggregatorName, BankAggregatorProvider>();
  private defaultProviderName: AggregatorName;

  constructor(
    private readonly plaidProvider: PlaidProvider,
    private readonly mxProvider: MxProvider,
    private readonly finicityProvider: FinicityProvider,
    private readonly configService: ConfigService,
  ) {
    this.defaultProviderName = this.configService.get<AggregatorName>(
      'BANK_AGGREGATOR_DEFAULT',
      'plaid',
    );
  }

  onModuleInit() {
    // Plaid is always registered (it was the original, required provider)
    this.providers.set('plaid', this.plaidProvider);
    this.logger.log('Registered aggregator: plaid');

    // MX is optional
    if (this.mxProvider.available) {
      this.providers.set('mx', this.mxProvider);
      this.logger.log('Registered aggregator: mx');
    } else {
      this.logger.log('Skipped aggregator: mx (not configured)');
    }

    // Finicity is optional
    if (this.finicityProvider.available) {
      this.providers.set('finicity', this.finicityProvider);
      this.logger.log('Registered aggregator: finicity');
    } else {
      this.logger.log('Skipped aggregator: finicity (not configured)');
    }

    // Validate default provider is available
    if (!this.providers.has(this.defaultProviderName)) {
      this.logger.warn(
        `Configured default aggregator "${this.defaultProviderName}" is not available. Falling back to plaid.`,
      );
      this.defaultProviderName = 'plaid';
    }

    this.logger.log(
      `Aggregator factory ready. Default: ${this.defaultProviderName}. ` +
        `Available: [${[...this.providers.keys()].join(', ')}]`,
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get the default aggregator provider.
   * Controlled by the BANK_AGGREGATOR_DEFAULT env var (defaults to 'plaid').
   */
  getDefaultProvider(): BankAggregatorProvider {
    return this.providers.get(this.defaultProviderName)!;
  }

  /**
   * Get a specific provider by name.
   * @throws NotFoundException if the provider is not registered / configured.
   */
  getProvider(name: string): BankAggregatorProvider {
    const provider = this.providers.get(name as AggregatorName);
    if (!provider) {
      const available = [...this.providers.keys()].join(', ');
      throw new NotFoundException(
        `Aggregator "${name}" is not available. Configured providers: [${available}]`,
      );
    }
    return provider;
  }

  /**
   * Get all currently available (configured) providers.
   */
  getAvailableProviders(): BankAggregatorProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Get the names of all available providers.
   */
  getAvailableProviderNames(): AggregatorName[] {
    return [...this.providers.keys()];
  }

  /**
   * Determine the best provider for a given institution.
   *
   * Strategy:
   * 1. If only one provider is available, return it.
   * 2. Try the default provider first.
   * 3. Future enhancement: maintain a lookup table of institution->provider mappings.
   *
   * For now this returns the default provider, but the method signature supports
   * future routing logic (e.g. "Chase works best with Plaid", "Navy Federal
   * works best with Finicity").
   */
  getProviderForInstitution(institutionId: string): BankAggregatorProvider {
    // Future: look up institution-specific routing rules
    // For now, return the default
    return this.getDefaultProvider();
  }

  /**
   * Check if a specific provider is available.
   */
  isProviderAvailable(name: string): boolean {
    return this.providers.has(name as AggregatorName);
  }

  /**
   * Get the name of the default provider.
   */
  getDefaultProviderName(): AggregatorName {
    return this.defaultProviderName;
  }
}
