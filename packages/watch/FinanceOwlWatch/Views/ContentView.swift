import SwiftUI

struct ContentView: View {
    @EnvironmentObject var dataManager: WatchDataManager
    @State private var selectedTab: Tab = .today

    enum Tab: String, CaseIterable {
        case today = "Today"
        case accounts = "Accounts"
        case budgets = "Budgets"

        var iconName: String {
            switch self {
            case .today: return "dollarsign.circle.fill"
            case .accounts: return "building.columns.fill"
            case .budgets: return "chart.pie.fill"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tag(Tab.today)

            AccountsView()
                .tag(Tab.accounts)

            BudgetsView()
                .tag(Tab.budgets)
        }
        .tabViewStyle(.verticalPage)
        .task {
            await dataManager.refreshData()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchDataManager())
}
