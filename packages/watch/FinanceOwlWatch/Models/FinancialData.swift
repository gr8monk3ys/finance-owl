import Foundation

// MARK: - Daily Spending

struct DailySpending: Codable, Identifiable {
    let id: UUID
    let date: Date
    let amount: Double
    let category: String

    init(id: UUID = UUID(), date: Date, amount: Double, category: String) {
        self.id = id
        self.date = date
        self.amount = amount
        self.category = category
    }
}

// MARK: - Safe To Spend

struct SafeToSpend: Codable {
    let amount: Double
    let dailyAllowance: Double
    let daysRemaining: Int
    let percentUsed: Double
    let updatedAt: Date

    var status: SpendingStatus {
        if percentUsed >= 90 {
            return .critical
        } else if percentUsed >= 70 {
            return .warning
        } else {
            return .healthy
        }
    }
}

enum SpendingStatus: String, Codable {
    case healthy
    case warning
    case critical

    var colorName: String {
        switch self {
        case .healthy: return "safeGreen"
        case .warning: return "warningAmber"
        case .critical: return "dangerRed"
        }
    }
}

// MARK: - Account Balance

struct AccountBalance: Codable, Identifiable {
    let id: String
    let name: String
    let institutionName: String
    let balance: Double
    let accountType: AccountType
    let lastSynced: Date
}

enum AccountType: String, Codable {
    case checking
    case savings
    case credit
    case investment
    case loan
    case other

    var displayName: String {
        switch self {
        case .checking: return "Checking"
        case .savings: return "Savings"
        case .credit: return "Credit Card"
        case .investment: return "Investment"
        case .loan: return "Loan"
        case .other: return "Other"
        }
    }

    var iconName: String {
        switch self {
        case .checking: return "banknote"
        case .savings: return "building.columns"
        case .credit: return "creditcard"
        case .investment: return "chart.line.uptrend.xyaxis"
        case .loan: return "doc.text"
        case .other: return "dollarsign.circle"
        }
    }

    var colorName: String {
        switch self {
        case .checking: return "checkingBlue"
        case .savings: return "savingsGreen"
        case .credit: return "creditOrange"
        case .investment: return "investmentPurple"
        case .loan: return "loanRed"
        case .other: return "otherGray"
        }
    }
}

// MARK: - Budget Status

struct BudgetStatus: Codable, Identifiable {
    let id: String
    let name: String
    let category: String
    let spent: Double
    let limit: Double
    let period: BudgetPeriod

    var remaining: Double {
        return max(0, limit - spent)
    }

    var percentUsed: Double {
        guard limit > 0 else { return 0 }
        return min((spent / limit) * 100, 100)
    }

    var progress: Double {
        guard limit > 0 else { return 0 }
        return min(spent / limit, 1.0)
    }

    var status: SpendingStatus {
        if percentUsed >= 90 {
            return .critical
        } else if percentUsed >= 70 {
            return .warning
        } else {
            return .healthy
        }
    }
}

enum BudgetPeriod: String, Codable {
    case weekly
    case monthly
    case yearly

    var displayName: String {
        switch self {
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        case .yearly: return "Yearly"
        }
    }
}

// MARK: - Bill Reminder

struct BillReminder: Codable, Identifiable {
    let id: String
    let merchantName: String
    let amount: Double
    let dueDate: Date
    let isPaid: Bool
    let isRecurring: Bool

    var isOverdue: Bool {
        return !isPaid && dueDate < Date()
    }

    var daysUntilDue: Int {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: Date(), to: dueDate)
        return components.day ?? 0
    }

    var dueDateFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter.string(from: dueDate)
    }
}

// MARK: - Net Worth

struct NetWorth: Codable {
    let total: Double
    let assets: Double
    let liabilities: Double
    let changeAmount: Double
    let changePercent: Double
    let updatedAt: Date

    var isPositiveChange: Bool {
        return changeAmount >= 0
    }
}

// MARK: - Spending Chart Data Point

struct SpendingDataPoint: Codable, Identifiable {
    let id: UUID
    let date: Date
    let amount: Double

    init(id: UUID = UUID(), date: Date, amount: Double) {
        self.id = id
        self.date = date
        self.amount = amount
    }

    var dayLabel: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }
}

// MARK: - Watch Sync Payload

struct WatchSyncPayload: Codable {
    let safeToSpend: SafeToSpend?
    let accounts: [AccountBalance]?
    let budgets: [BudgetStatus]?
    let bills: [BillReminder]?
    let netWorth: NetWorth?
    let spendingHistory: [SpendingDataPoint]?
    let syncedAt: Date
}
