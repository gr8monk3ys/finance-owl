import Foundation
import Security

actor APIClient {

    // MARK: - Configuration

    private let baseURL: String
    private let session: URLSession
    private let keychainService = "com.financeowl.watch"
    private let keychainTokenKey = "authToken"

    init(baseURL: String = "https://api.financeowl.com/v1") {
        self.baseURL = baseURL

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    // MARK: - API Endpoints

    func fetchSafeToSpend() async throws -> SafeToSpend {
        return try await request(endpoint: "/analytics/safe-to-spend")
    }

    func fetchAccounts() async throws -> [AccountBalance] {
        let response: AccountsResponse = try await request(endpoint: "/accounts")
        return response.accounts
    }

    func fetchBudgets() async throws -> [BudgetStatus] {
        let response: BudgetsResponse = try await request(endpoint: "/budgets")
        return response.budgets
    }

    func fetchUpcomingBills() async throws -> [BillReminder] {
        let response: BillsResponse = try await request(endpoint: "/bills/upcoming")
        return response.bills
    }

    func fetchNetWorth() async throws -> NetWorth {
        return try await request(endpoint: "/analytics/net-worth")
    }

    func fetchSpendingHistory(days: Int = 7) async throws -> [SpendingDataPoint] {
        let response: SpendingHistoryResponse = try await request(
            endpoint: "/analytics/spending-history",
            queryItems: [URLQueryItem(name: "days", value: String(days))]
        )
        return response.dataPoints
    }

    // MARK: - Generic Request

    private func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var urlComponents = URLComponents(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        if let queryItems = queryItems {
            urlComponents.queryItems = queryItems
        }

        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("FinanceOwlWatch/1.0", forHTTPHeaderField: "User-Agent")

        if let token = getAuthToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            throw APIError.unauthorized
        }

        let (data, response) = try await session.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 429:
            throw APIError.rateLimited
        case 500...599:
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        default:
            throw APIError.unexpectedStatus(statusCode: httpResponse.statusCode)
        }
    }

    // MARK: - Keychain Auth Token

    func saveAuthToken(_ token: String) {
        let data = Data(token.utf8)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainTokenKey
        ]

        SecItemDelete(query as CFDictionary)

        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainTokenKey,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemAdd(attributes as CFDictionary, nil)
    }

    func getAuthToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainTokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    func deleteAuthToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainTokenKey
        ]

        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case serverError(statusCode: Int)
    case unexpectedStatus(statusCode: Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Please sign in on your iPhone"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .rateLimited:
            return "Too many requests. Please wait."
        case .serverError(let code):
            return "Server error (\(code))"
        case .unexpectedStatus(let code):
            return "Unexpected response (\(code))"
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Response Wrappers

struct AccountsResponse: Codable {
    let accounts: [AccountBalance]
}

struct BudgetsResponse: Codable {
    let budgets: [BudgetStatus]
}

struct BillsResponse: Codable {
    let bills: [BillReminder]
}

struct SpendingHistoryResponse: Codable {
    let dataPoints: [SpendingDataPoint]
}
