import SwiftUI
import WidgetKit

// MARK: - Circular Complication: Safe-to-Spend Amount

struct CircularSafeToSpendView: View {
    let amount: Double
    let percentUsed: Double

    private var status: SpendingStatus {
        if percentUsed >= 90 {
            return .critical
        } else if percentUsed >= 70 {
            return .warning
        } else {
            return .healthy
        }
    }

    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(lineWidth: 4)
                .foregroundColor(colorForStatus(status).opacity(0.2))

            // Progress ring
            Circle()
                .trim(from: 0, to: min(percentUsed / 100, 1.0))
                .stroke(
                    colorForStatus(status),
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            // Amount text
            VStack(spacing: 0) {
                Text(amount.asCompactCurrency())
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)

                Text("safe")
                    .font(.system(size: 7))
                    .foregroundStyle(.secondary)
            }
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

// MARK: - Rectangular Complication: Daily Spending Mini Chart

struct RectangularSpendingChartView: View {
    let spendingHistory: [SpendingDataPoint]
    let safeToSpendAmount: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.cyan)

                Text("Finance Owl")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)

                Spacer()

                Text(safeToSpendAmount.asCompactCurrency())
                    .font(.system(size: 12, weight: .bold, design: .rounded))
            }

            if !spendingHistory.isEmpty {
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(spendingHistory.suffix(7)) { point in
                        let maxAmount = spendingHistory.map(\.amount).max() ?? 1
                        let normalizedHeight = point.amount / maxAmount

                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(
                                LinearGradient(
                                    colors: [.blue.opacity(0.6), .cyan],
                                    startPoint: .bottom,
                                    endPoint: .top
                                )
                            )
                            .frame(
                                maxWidth: .infinity,
                                minHeight: 2,
                                maxHeight: max(2, 20 * normalizedHeight)
                            )
                    }
                }
                .frame(height: 20)
            }

            Text("Safe to spend")
                .font(.system(size: 8))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Inline Complication: "Safe: $X"

struct InlineSafeToSpendView: View {
    let amount: Double

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "dollarsign.circle.fill")
            Text("Safe: \(amount.asCompactCurrency())")
                .font(.system(.body, design: .rounded, weight: .medium))
        }
    }
}

// MARK: - Corner Complication: Budget Gauge

struct CornerBudgetGaugeView: View {
    let percentUsed: Double
    let budgetName: String

    private var status: SpendingStatus {
        if percentUsed >= 90 {
            return .critical
        } else if percentUsed >= 70 {
            return .warning
        } else {
            return .healthy
        }
    }

    var body: some View {
        Gauge(value: min(percentUsed / 100, 1.0)) {
            Image(systemName: "chart.pie.fill")
                .font(.system(size: 10))
        } currentValueLabel: {
            Text("\(Int(percentUsed))%")
                .font(.system(size: 10, weight: .bold, design: .rounded))
        }
        .gaugeStyle(.accessoryCircular)
        .tint(colorForStatus(status))
    }

    private func colorForStatus(_ status: SpendingStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Complication Entry

struct FinanceOwlComplicationEntry: TimelineEntry {
    let date: Date
    let safeToSpendAmount: Double
    let percentUsed: Double
    let spendingHistory: [SpendingDataPoint]
    let topBudgetName: String
    let topBudgetPercentUsed: Double

    static var placeholder: FinanceOwlComplicationEntry {
        FinanceOwlComplicationEntry(
            date: Date(),
            safeToSpendAmount: 450.00,
            percentUsed: 35,
            spendingHistory: [],
            topBudgetName: "Food",
            topBudgetPercentUsed: 65
        )
    }
}

// MARK: - Complication Provider

struct FinanceOwlComplicationProvider: TimelineProvider {
    typealias Entry = FinanceOwlComplicationEntry

    func placeholder(in context: Context) -> Entry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let cachedData = loadCachedData()

        let entry = FinanceOwlComplicationEntry(
            date: Date(),
            safeToSpendAmount: cachedData?.safeToSpend?.amount ?? 0,
            percentUsed: cachedData?.safeToSpend?.percentUsed ?? 0,
            spendingHistory: cachedData?.spendingHistory ?? [],
            topBudgetName: cachedData?.budgets?.first?.name ?? "Budget",
            topBudgetPercentUsed: cachedData?.budgets?.first?.percentUsed ?? 0
        )

        let nextUpdate = Calendar.current.date(
            byAdding: .minute,
            value: 30,
            to: Date()
        ) ?? Date()

        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadCachedData() -> WatchSyncPayload? {
        guard let data = UserDefaults.standard.data(
            forKey: "com.financeowl.watch.cachedData"
        ) else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WatchSyncPayload.self, from: data)
    }
}

// MARK: - Previews

#Preview("Circular") {
    CircularSafeToSpendView(amount: 450.00, percentUsed: 35)
        .frame(width: 50, height: 50)
}

#Preview("Rectangular") {
    RectangularSpendingChartView(
        spendingHistory: [
            SpendingDataPoint(date: Date(), amount: 45),
            SpendingDataPoint(date: Date(), amount: 32),
            SpendingDataPoint(date: Date(), amount: 67),
            SpendingDataPoint(date: Date(), amount: 28),
            SpendingDataPoint(date: Date(), amount: 55),
            SpendingDataPoint(date: Date(), amount: 41),
            SpendingDataPoint(date: Date(), amount: 38)
        ],
        safeToSpendAmount: 450.00
    )
    .frame(width: 150, height: 50)
}

#Preview("Corner Gauge") {
    CornerBudgetGaugeView(percentUsed: 65, budgetName: "Food")
        .frame(width: 50, height: 50)
}
