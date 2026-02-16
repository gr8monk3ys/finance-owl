# FinanceOwl Mobile

Native iOS and Android app built with Capacitor wrapping the SvelteKit frontend.

## Setup

1. Install dependencies: `pnpm install`
2. Build the frontend: `pnpm build`
3. Sync Capacitor: `pnpm sync`
4. Open in Xcode: `pnpm open:ios`
5. Open in Android Studio: `pnpm open:android`

## Development

The mobile app wraps the SvelteKit frontend build output. To test changes:

1. Make changes in `packages/frontend`
2. Run `pnpm build` from this directory (builds the frontend)
3. Run `pnpm sync` to sync the web build to native projects
4. Run on device/simulator with `pnpm run:ios` or `pnpm run:android`
