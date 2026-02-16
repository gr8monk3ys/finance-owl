import SwiftUI

@main
struct FinanceOwlWatchApp: App {
    @StateObject private var dataManager = WatchDataManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(dataManager)
        }
    }
}
