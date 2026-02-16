import SwiftUI

struct BudgetsView: View {
    @EnvironmentObject var dataManager: WatchDataManager

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                headerSection
                budgetRings
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Budgets")
    }

    // MARK: - Header

    @ViewBuilder
    private var headerSection: some View {
        if !dataManager.budgets.isEmpty {
            let totalSpent = dataManager.budgets.reduce(0) { $0 + $1.spent }
            let totalLimit = dataManager.budgets.reduce(0) { $0 + $1.limit }

            VStack(spacing: 4) {
                Text("Total Spent")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(totalSpent.asCurrency())
                    .font(.system(size: 20, weight: .bold, design: .rounded))

                Text("of \(totalLimit.asCurrency())")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
    }

    // MARK: - Budget Progress Rings

    @ViewBuilder
    private var budgetRings: some View {
        if dataManager.budgets.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "chart.pie")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("No budgets set")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Create budgets in the\niPhone app")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        } else {
            ForEach(Array(dataManager.budgets.prefix(5))) { budget in
                NavigationLink(destination: BudgetDetailView(budget: budget)) {
                    BudgetRingRow(budget: budget)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Budget Ring Row

struct BudgetRingRow: View {
    let budget: BudgetStatus

    var body: some View {
        HStack(spacing: 10) {
            // Progress Ring
            ZStack {
                Circle()
                    .stroke(lineWidth: 4)
                    .foregroundColor(colorForStatus(budget.status).opacity(0.2))

                Circle()
                    .trim(from: 0, to: budget.progress)
                    .stroke(
                        colorForStatus(budget.status),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.5), value: budget.progress)

                Text("\(Int(budget.percentUsed))%")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(budget.name)
                    .font(.caption)
                    .lineLimit(1)

                Text("\(budget.remaining.asCompactCurrency()) left")
                    .font(.system(size: 10))
                    .foregroundColor(colorForStatus(budget.status))
            }

            Spacer()
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(.ultraThinMaterial)
        )
    }

    private func colorForStatus(_ status: SpendingStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Budget Detail View

struct BudgetDetailView: View {
    let budget: BudgetStatus

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Large Ring
                ZStack {
                    Circle()
                        .stroke(lineWidth: 8)
                        .foregroundColor(colorForStatus(budget.status).opacity(0.2))

                    Circle()
                        .trim(from: 0, to: budget.progress)
                        .stroke(
                            colorForStatus(budget.status),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut(duration: 0.8), value: budget.progress)

                    VStack(spacing: 0) {
                        Text("\(Int(budget.percentUsed))%")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                        Text("used")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 80, height: 80)

                Text(budget.name)
                    .font(.headline)

                Divider()

                detailRow(label: "Spent", value: budget.spent.asCurrency())
                detailRow(label: "Limit", value: budget.limit.asCurrency())
                detailRow(
                    label: "Remaining",
                    value: budget.remaining.asCurrency(),
                    valueColor: colorForStatus(budget.status)
                )
                detailRow(label: "Category", value: budget.category)
                detailRow(label: "Period", value: budget.period.displayName)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(budget.name)
    }

    private func detailRow(
        label: String,
        value: String,
        valueColor: Color = .primary
    ) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(valueColor)
        }
    }

    private func colorForStatus(_ status: SpendingStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

#Preview {
    BudgetsView()
        .environmentObject(WatchDataManager())
}
