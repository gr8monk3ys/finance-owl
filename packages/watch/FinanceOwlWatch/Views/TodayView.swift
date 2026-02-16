import SwiftUI
import Charts

struct TodayView: View {
    @EnvironmentObject var dataManager: WatchDataManager
    @State private var showBreakdown = false

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                safeToSpendSection
                dailyAllowanceSection
                spendingChartSection
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Today")
        .sheet(isPresented: $showBreakdown) {
            SpendingBreakdownView()
                .environmentObject(dataManager)
        }
    }

    // MARK: - Safe To Spend

    @ViewBuilder
    private var safeToSpendSection: some View {
        if let safeToSpend = dataManager.safeToSpend {
            VStack(spacing: 4) {
                Text("Safe to Spend")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(safeToSpend.amount.asCurrency())
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(colorForStatus(safeToSpend.status))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)

                Text("\(safeToSpend.daysRemaining) days left")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(colorForStatus(safeToSpend.status).opacity(0.15))
            )
            .onTapGesture {
                showBreakdown = true
            }
        } else {
            VStack(spacing: 8) {
                ProgressView()
                Text("Loading...")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
    }

    // MARK: - Daily Allowance

    @ViewBuilder
    private var dailyAllowanceSection: some View {
        if let safeToSpend = dataManager.safeToSpend {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Daily Allowance")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(safeToSpend.dailyAllowance.asCurrency())
                        .font(.system(.body, design: .rounded, weight: .semibold))
                }

                Spacer()

                Image(systemName: "calendar.badge.clock")
                    .foregroundStyle(.secondary)
                    .font(.title3)
            }
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Spending Chart (Last 7 Days)

    @ViewBuilder
    private var spendingChartSection: some View {
        if !dataManager.spendingHistory.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Last 7 Days")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Chart(dataManager.spendingHistory) { point in
                    BarMark(
                        x: .value("Day", point.dayLabel),
                        y: .value("Amount", point.amount)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .cyan],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .cornerRadius(3)
                }
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel()
                            .font(.system(size: 8))
                    }
                }
                .frame(height: 60)
            }
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Helpers

    private func colorForStatus(_ status: SpendingStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Spending Breakdown Sheet

struct SpendingBreakdownView: View {
    @EnvironmentObject var dataManager: WatchDataManager

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let safeToSpend = dataManager.safeToSpend {
                    VStack(spacing: 4) {
                        Text("Spending Breakdown")
                            .font(.headline)

                        ProgressView(value: safeToSpend.percentUsed / 100)
                            .tint(colorForStatus(safeToSpend.status))

                        HStack {
                            Text("\(Int(safeToSpend.percentUsed))% used")
                                .font(.caption2)
                            Spacer()
                            Text("\(safeToSpend.daysRemaining) days left")
                                .font(.caption2)
                        }
                        .foregroundStyle(.secondary)
                    }
                }

                if !dataManager.bills.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Upcoming Bills")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        ForEach(dataManager.bills.prefix(3)) { bill in
                            HStack {
                                Text(bill.merchantName)
                                    .font(.caption)
                                    .lineLimit(1)
                                Spacer()
                                Text(bill.amount.asCurrency())
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
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
    TodayView()
        .environmentObject(WatchDataManager())
}
