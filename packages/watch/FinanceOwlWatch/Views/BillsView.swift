import SwiftUI

struct BillsView: View {
    @EnvironmentObject var dataManager: WatchDataManager

    private var upcomingBills: [BillReminder] {
        let sevenDaysFromNow = Calendar.current.date(
            byAdding: .day,
            value: 7,
            to: Date()
        ) ?? Date()

        return dataManager.bills
            .filter { !$0.isPaid && $0.dueDate <= sevenDaysFromNow }
            .sorted { $0.dueDate < $1.dueDate }
    }

    private var overdueBills: [BillReminder] {
        dataManager.bills.filter { $0.isOverdue }
    }

    private var pendingBills: [BillReminder] {
        upcomingBills.filter { !$0.isOverdue }
    }

    private var totalDue: Double {
        upcomingBills.reduce(0) { $0 + $1.amount }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                headerSection
                overdueSection
                upcomingSection
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Bills")
    }

    // MARK: - Header

    @ViewBuilder
    private var headerSection: some View {
        if !upcomingBills.isEmpty {
            VStack(spacing: 4) {
                Text("Due This Week")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(totalDue.asCurrency())
                    .font(.system(size: 22, weight: .bold, design: .rounded))

                Text("\(upcomingBills.count) bill\(upcomingBills.count == 1 ? "" : "s")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(.ultraThinMaterial)
            )
        }
    }

    // MARK: - Overdue Bills

    @ViewBuilder
    private var overdueSection: some View {
        if !overdueBills.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundColor(.red)
                    Text("Overdue")
                        .font(.caption2)
                        .foregroundColor(.red)
                        .fontWeight(.semibold)
                }

                ForEach(overdueBills) { bill in
                    BillRow(bill: bill, isOverdue: true)
                }
            }
        }
    }

    // MARK: - Upcoming Bills

    @ViewBuilder
    private var upcomingSection: some View {
        if pendingBills.isEmpty && overdueBills.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.green)
                Text("All clear!")
                    .font(.caption)
                    .fontWeight(.medium)
                Text("No bills due this week")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
        } else if !pendingBills.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Upcoming")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                ForEach(pendingBills) { bill in
                    BillRow(bill: bill, isOverdue: false)
                }
            }
        }
    }
}

// MARK: - Bill Row

struct BillRow: View {
    let bill: BillReminder
    let isOverdue: Bool

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(bill.merchantName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                    .foregroundColor(isOverdue ? .red : .primary)

                HStack(spacing: 4) {
                    if bill.isRecurring {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 8))
                    }
                    Text(dueDateText)
                        .font(.system(size: 10))
                }
                .foregroundStyle(isOverdue ? .red.opacity(0.8) : .secondary)
            }

            Spacer()

            Text(bill.amount.asCurrency())
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundColor(isOverdue ? .red : .primary)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isOverdue ? Color.red.opacity(0.15) : Color.clear)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.ultraThinMaterial)
                )
        )
    }

    private var dueDateText: String {
        if isOverdue {
            let days = abs(bill.daysUntilDue)
            return days == 1 ? "1 day overdue" : "\(days) days overdue"
        } else if bill.daysUntilDue == 0 {
            return "Due today"
        } else if bill.daysUntilDue == 1 {
            return "Due tomorrow"
        } else {
            return "Due \(bill.dueDateFormatted)"
        }
    }
}

#Preview {
    BillsView()
        .environmentObject(WatchDataManager())
}
