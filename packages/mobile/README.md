# FinanceOwl Mobile

Native iOS and Android app built with Expo and `expo-router`.

## Setup

1. Install dependencies from the monorepo root: `pnpm install`
2. Copy `packages/mobile/.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`
3. Start the app: `pnpm --filter @finance-owl/mobile start`
4. Run on a simulator or emulator with `pnpm --filter @finance-owl/mobile ios` or `pnpm --filter @finance-owl/mobile android`

## Release Checks

- Validate the project config: `pnpm --filter @finance-owl/mobile run check:expo`
- Create native projects when needed: `pnpm --filter @finance-owl/mobile prebuild`
- Export a production bundle for iOS: `pnpm --filter @finance-owl/mobile export:ios`
- Export a production bundle for Android: `pnpm --filter @finance-owl/mobile export:android`

## Notes

- The mobile app talks directly to the backend API; it does not wrap the web app.
- Use an HTTPS API URL for physical devices and production builds.
