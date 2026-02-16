import SwiftUI

struct AccountsView: View {
    @EnvironmentObject var dataManager: WatchDataManager

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                netWorthHeader
                accountsList
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Accounts")
    }

    // MARK: - Net Worth Header

    @ViewBuilder
    private var netWorthHeader: some View {
        if let netWorth = dataManager.netWorth {
            VStack(spacing: 4) {
                Text("Net Worth")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(netWorth.total.asCurrency())
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: netWorth.isPositiveChange
                          ? "arrow.up.right"
                          : "arrow.down.right")
                        .font(.system(size: 10, weight: .bold))

                    Text(netWorth.changeAmount.asSignedCurrency())
                        .font(.caption2)

                    Text("(\(netWorth.changePercent.asPercentage()))")
                        .font(.caption2)
                }
                .foregroundColor(netWorth.isPositiveChange ? .green : .red)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Accounts List

    @ViewBuilder
    private var accountsList: some View {
        if dataManager.accounts.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "building.columns")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("No accounts linked")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Open Finance Owl on your\niPhone to add accounts")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        } else {
            let grouped = Dictionary(grouping: dataManager.accounts) { $0.accountType }
            let sortedTypes = grouped.keys.sorted { $0.rawValue < $1.rawValue }

            ForEach(sortedTypes, id: \.self) { accountType in
                if let accounts = grouped[accountType] {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(accountType.displayName)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)

                        ForEach(accounts) { account in
                            AccountRow(account: account)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Account Row

struct AccountRow: View {
    let account: AccountBalance

    var body: some View {
        NavigationLink(destination: AccountDetailView(account: account)) {
            HStack(spacing: 8) {
                Image(systemName: account.accountType.iconName)
                    .font(.caption)
                    .foregroundColor(colorForAccountType(account.accountType))
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 1) {
                    Text(account.name)
                        .font(.caption)
                        .lineLimit(1)
                    Text(account.institutionName)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                Text(account.balance.asCurrency())
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .foregroundColor(account.balance >= 0 ? .primary : .red)
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(.ultraThinMaterial)
            )
        }
        .buttonStyle(.plain)
    }

    private func colorForAccountType(_ type: AccountType) -> Color {
        switch type {
        case .checking: return .blue
        case .savings: return .green
        case .credit: return .orange
        case .investment: return .purple
        case .loan: return .red
        case .other: return .gray
        }
    }
}

// MARK: - Account Detail View

struct AccountDetailView: View {
    let account: AccountBalance

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: account.accountType.iconName)
                    .font(.title2)
                    .foregroundColor(colorForAccountType(account.accountType))

                Text(account.name)
                    .font(.headline)

                Text(account.institutionName)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(account.balance.asCurrency())
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(account.balance >= 0 ? .primary : .red)

                Divider()

                HStack {
                    Text("Type")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(account.accountType.displayName)
                        .font(.caption)
                }

                HStack {
                    Text("Last Synced")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(account.lastSynced, style: .relative)
                        .font(.caption)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(account.name)
    }

    private func colorForAccountType(_ type: AccountType) -> Color {
        switch type {
        case .checking: return .blue
        case .savings: return .green
        case .credit: return .orange
        case .investment: return .purple
        case .loan: return .red
        case .other: return .gray
        }
    }
}

#Preview {
    AccountsView()
        .environmentObject(WatchDataManager())
}
