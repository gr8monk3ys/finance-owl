import Foundation
import WatchConnectivity
import Combine

@MainActor
final class WatchDataManager: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published var safeToSpend: SafeToSpend?
    @Published var accounts: [AccountBalance] = []
    @Published var budgets: [BudgetStatus] = []
    @Published var bills: [BillReminder] = []
    @Published var netWorth: NetWorth?
    @Published var spendingHistory: [SpendingDataPoint] = []
    @Published var isLoading: Bool = false
    @Published var lastSynced: Date?
    @Published var connectionStatus: ConnectionStatus = .disconnected

    // MARK: - Private Properties

    private let session: WCSession
    private let apiClient = APIClient()
    private let cacheKey = "com.financeowl.watch.cachedData"
    private var refreshTask: Task<Void, Never>?

    enum ConnectionStatus {
        case connected
        case disconnected
        case unreachable

        var displayName: String {
            switch self {
            case .connected: return "Connected"
            case .disconnected: return "Disconnected"
            case .unreachable: return "Unreachable"
            }
        }
    }

    // MARK: - Initialization

    override init() {
        self.session = WCSession.default
        super.init()

        if WCSession.isSupported() {
            session.delegate = self
            session.activate()
        }

        loadCachedData()
    }

    // MARK: - Public Methods

    func refreshData() async {
        isLoading = true
        defer { isLoading = false }

        if session.isReachable {
            requestDataFromPhone()
        } else {
            await fetchDataFromAPI()
        }
    }

    func requestDataFromPhone() {
        guard session.isReachable else {
            connectionStatus = .unreachable
            return
        }

        let message: [String: Any] = [
            "type": "requestFinancialData",
            "timestamp": Date().timeIntervalSince1970
        ]

        session.sendMessage(message, replyHandler: { [weak self] response in
            Task { @MainActor in
                self?.handlePhoneResponse(response)
            }
        }, errorHandler: { [weak self] error in
            print("WatchDataManager: Error sending message to phone: \(error.localizedDescription)")
            Task { @MainActor in
                self?.connectionStatus = .unreachable
                await self?.fetchDataFromAPI()
            }
        })
    }

    // MARK: - API Fallback

    private func fetchDataFromAPI() async {
        do {
            async let safeToSpendResult = apiClient.fetchSafeToSpend()
            async let accountsResult = apiClient.fetchAccounts()
            async let budgetsResult = apiClient.fetchBudgets()
            async let billsResult = apiClient.fetchUpcomingBills()

            let (sts, accts, bdgts, bls) = try await (
                safeToSpendResult,
                accountsResult,
                budgetsResult,
                billsResult
            )

            self.safeToSpend = sts
            self.accounts = accts
            self.budgets = bdgts
            self.bills = bls
            self.lastSynced = Date()

            cacheData()
        } catch {
            print("WatchDataManager: API fetch error: \(error.localizedDescription)")
        }
    }

    // MARK: - Phone Response Handling

    private func handlePhoneResponse(_ response: [String: Any]) {
        guard let jsonData = response["payload"] as? Data else {
            print("WatchDataManager: Invalid response payload")
            return
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let payload = try decoder.decode(WatchSyncPayload.self, from: jsonData)

            if let sts = payload.safeToSpend {
                self.safeToSpend = sts
            }
            if let accts = payload.accounts {
                self.accounts = accts
            }
            if let bdgts = payload.budgets {
                self.budgets = bdgts
            }
            if let bls = payload.bills {
                self.bills = bls
            }
            if let nw = payload.netWorth {
                self.netWorth = nw
            }
            if let history = payload.spendingHistory {
                self.spendingHistory = history
            }

            self.lastSynced = payload.syncedAt
            cacheData()
        } catch {
            print("WatchDataManager: Decoding error: \(error.localizedDescription)")
        }
    }

    // MARK: - Caching

    private func cacheData() {
        let payload = WatchSyncPayload(
            safeToSpend: safeToSpend,
            accounts: accounts,
            budgets: budgets,
            bills: bills,
            netWorth: netWorth,
            spendingHistory: spendingHistory,
            syncedAt: lastSynced ?? Date()
        )

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(payload)
            UserDefaults.standard.set(data, forKey: cacheKey)
        } catch {
            print("WatchDataManager: Cache encoding error: \(error.localizedDescription)")
        }
    }

    private func loadCachedData() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let payload = try decoder.decode(WatchSyncPayload.self, from: data)

            self.safeToSpend = payload.safeToSpend
            self.accounts = payload.accounts ?? []
            self.budgets = payload.budgets ?? []
            self.bills = payload.bills ?? []
            self.netWorth = payload.netWorth
            self.spendingHistory = payload.spendingHistory ?? []
            self.lastSynced = payload.syncedAt
        } catch {
            print("WatchDataManager: Cache decoding error: \(error.localizedDescription)")
        }
    }

    // MARK: - Background Refresh

    func scheduleBackgroundRefresh() {
        let preferredDate = Date().addingTimeInterval(15 * 60) // 15 minutes
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: preferredDate,
            userInfo: nil
        ) { error in
            if let error = error {
                print("WatchDataManager: Background refresh scheduling error: \(error.localizedDescription)")
            }
        }
    }

    func handleBackgroundRefresh() async {
        await refreshData()
        scheduleBackgroundRefresh()
    }
}

// MARK: - WCSessionDelegate

extension WatchDataManager: WCSessionDelegate {

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in
            switch activationState {
            case .activated:
                connectionStatus = .connected
                await refreshData()
            case .inactive, .notActivated:
                connectionStatus = .disconnected
            @unknown default:
                connectionStatus = .disconnected
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in
            handlePhoneResponse(applicationContext)
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        Task { @MainActor in
            if let type = message["type"] as? String, type == "dataUpdate" {
                handlePhoneResponse(message)
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any]
    ) {
        Task { @MainActor in
            handlePhoneResponse(userInfo)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            connectionStatus = session.isReachable ? .connected : .unreachable
        }
    }
}
