# Finance Owl - Apple Watch Companion App

A SwiftUI-based WatchOS 10+ companion app for Finance Owl. Provides at-a-glance financial data including safe-to-spend amounts, account balances, budget progress, and upcoming bills directly on your wrist.

## Prerequisites

- macOS 14.0+ (Sonoma)
- Xcode 15.0+
- watchOS 10.0+ target
- An Apple Developer account (for device deployment)
- The Finance Owl iOS app installed on a paired iPhone

## Project Structure

```
packages/watch/
  FinanceOwlWatch/
    FinanceOwlWatchApp.swift          # App entry point
    Models/
      FinancialData.swift             # Data models (Codable structs)
    Services/
      WatchDataManager.swift          # WatchConnectivity + data management
      APIClient.swift                 # REST client for direct API access
    Views/
      ContentView.swift               # Tab-based root view
      TodayView.swift                 # Safe-to-spend, daily allowance, chart
      AccountsView.swift              # Account balances, net worth
      BudgetsView.swift               # Budget progress rings
      BillsView.swift                 # Upcoming/overdue bills
    Complications/
      ComplicationViews.swift         # Watch face complications
    Extensions/
      NumberFormatting.swift           # Currency/number formatting helpers
```

## Setup Instructions

### 1. Open in Xcode

```bash
# From the monorepo root
cd packages/watch
open FinanceOwlWatch.xcodeproj
```

Or use the package script:

```bash
pnpm --filter @finance-owl/watch open
```

### 2. Create the Xcode Project (First Time)

If the `.xcodeproj` does not exist yet, create a new watchOS project in Xcode:

1. Open Xcode and select **File > New > Project**
2. Choose **watchOS > App**
3. Configure the project:
   - **Product Name:** FinanceOwlWatch
   - **Team:** Your Apple Developer Team
   - **Organization Identifier:** com.financeowl
   - **Bundle Identifier:** com.financeowl.app.watchkitapp
   - **Interface:** SwiftUI
   - **Language:** Swift
   - **Watch-only App:** No (companion app)
4. Save the project into `packages/watch/`
5. Replace the generated Swift files with the files from this package

### 3. Configure the WatchOS Target

In the Xcode project settings:

- **Deployment Target:** watchOS 10.0
- **Swift Language Version:** Swift 5.9+
- **Frameworks:** SwiftUI, WatchConnectivity, WidgetKit, Charts, Security

### 4. Configure Signing

1. Select the WatchKit App target
2. Go to **Signing & Capabilities**
3. Select your Development Team
4. Ensure the bundle identifier is `com.financeowl.app.watchkitapp`
5. Enable **App Groups** with group `group.com.financeowl.shared`

### 5. Add Required Capabilities

Under **Signing & Capabilities**, add:

- **App Groups** - `group.com.financeowl.shared` (for shared data with iPhone app)
- **Background Modes** - Enable "Background App Refresh"

## Building and Deploying

### Simulator

1. Select the **FinanceOwlWatch** scheme in Xcode
2. Choose a watchOS Simulator (e.g., Apple Watch Series 9 - 45mm)
3. Press **Cmd + R** to build and run

### Physical Device

1. Pair your Apple Watch with your iPhone
2. Connect the iPhone to your Mac via USB or ensure both are on the same network
3. Select your physical watch as the run destination
4. Press **Cmd + R** to build and deploy

## Connecting with the iOS App

The watch app communicates with the iPhone app via **WatchConnectivity**. For this to work:

### On the iPhone App Side

The iOS (Capacitor) app needs a native WatchConnectivity module. Add the following to the iOS native project:

1. Import `WatchConnectivity` in the iOS app delegate or a dedicated manager
2. Activate a `WCSession` and set a delegate
3. Handle `requestFinancialData` messages from the watch
4. Send data updates to the watch via `transferUserInfo` or `sendMessage`

### Data Flow

```
Watch App                          iPhone App
    |                                  |
    |--- requestFinancialData -------->|
    |                                  |--- Fetch from API/Cache
    |<-------- WatchSyncPayload -------|
    |                                  |
    |   (if iPhone unreachable)        |
    |--- Direct API call ------------->| API Server
    |<-------- JSON response ----------|
```

### Authentication

- Auth tokens are synced from the iPhone app to the watch via WatchConnectivity
- Tokens are stored securely in the watch Keychain
- If the token expires, the watch prompts the user to open the iPhone app

## Complication Setup

The app provides four complication styles for watch faces:

### Circular Complication

- **Shows:** Safe-to-spend amount with a progress ring
- **Best for:** Infograph, Modular Compact
- **Color coding:** Green (healthy), Orange (warning), Red (critical)

### Rectangular Complication

- **Shows:** Mini spending bar chart for the last 7 days with safe-to-spend amount
- **Best for:** Infograph Modular (large), Modular (large)

### Inline Complication

- **Shows:** Text reading "Safe: $X" with a dollar sign icon
- **Best for:** Utility, Simple, Modular (small)

### Corner Complication (Gauge)

- **Shows:** Budget usage as a circular gauge
- **Best for:** Infograph corners

### Adding a Complication to Your Watch Face

1. Long-press on your watch face
2. Tap **Edit**
3. Swipe to the complications page
4. Tap a complication slot
5. Scroll to find **Finance Owl**
6. Select your preferred complication style
7. Press the Digital Crown to save

## Data Refresh

- **Active:** Data refreshes when the app opens and when the watch receives messages from the iPhone
- **Background:** Background app refresh runs every 15 minutes
- **Complications:** Timeline updates every 30 minutes
- **Cache:** Data is cached in UserDefaults for offline access

## API Endpoints Used

When the iPhone is not reachable, the watch can call these endpoints directly:

| Endpoint                                    | Description                  |
| ------------------------------------------- | ---------------------------- |
| `GET /v1/analytics/safe-to-spend`           | Current safe-to-spend amount |
| `GET /v1/accounts`                          | All linked account balances  |
| `GET /v1/budgets`                           | Budget statuses and limits   |
| `GET /v1/bills/upcoming`                    | Bills due in the next 7 days |
| `GET /v1/analytics/net-worth`               | Net worth summary            |
| `GET /v1/analytics/spending-history?days=7` | Daily spending for chart     |

## Troubleshooting

### Watch app shows "Loading..."

- Ensure the iPhone app is installed and running
- Check that both devices are paired and nearby
- Try opening the iPhone app to trigger a data sync

### "Please sign in on your iPhone"

- The auth token has not been synced or has expired
- Open the Finance Owl app on your iPhone and sign in
- The token will automatically sync to the watch

### Complications not updating

- Check that background app refresh is enabled on the watch
- Go to **Settings > General > Background App Refresh** on the watch
- Ensure Finance Owl is listed and enabled

### Build errors

- Ensure you are targeting watchOS 10.0+
- Clean the build folder: **Product > Clean Build Folder** (Cmd + Shift + K)
- Delete derived data if issues persist
