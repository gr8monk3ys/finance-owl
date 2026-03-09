# Mobile Release Guide

This project now includes a basic iOS TestFlight path for the Expo mobile app in `packages/mobile/`.

## One-time setup

1. Create the app in App Store Connect and note the Apple app record.
2. Link the Expo project from `packages/mobile/`:
   - `cd packages/mobile`
   - `npx eas-cli login`
   - `npx eas-cli init`
3. Create Expo environments named `development`, `preview`, and `production`.
4. Set the mobile environment variables in Expo:
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_WEB_URL`
   - `EXPO_OWNER`
   - `EXPO_PROJECT_ID`
   - `EXPO_ASC_APP_ID`
5. Create or connect an App Store Connect API key for EAS Submit.
6. Add the App Store Connect app identifier to the production submit profile in `packages/mobile/eas.json` once it exists.

## Local validation

Run these before any release:

```bash
pnpm --filter @finance-owl/mobile release:check
pnpm --filter @finance-owl/mobile typecheck
pnpm --filter @finance-owl/mobile lint
pnpm --filter @finance-owl/mobile run check:expo
pnpm --filter @finance-owl/mobile export:ios
```

## Build commands

From the repo root:

```bash
pnpm --filter @finance-owl/mobile build:preview:ios
pnpm --filter @finance-owl/mobile build:production:ios
pnpm --filter @finance-owl/mobile build:production:ios:ci
pnpm --filter @finance-owl/mobile submit:ios
pnpm --filter @finance-owl/mobile submit:ios:ci
pnpm --filter @finance-owl/mobile testflight
```

## EAS workflow

The file `packages/mobile/.eas/workflows/submit-ios.yml` builds and submits a production iOS build to TestFlight when a tag matching `ios/v*` is pushed.

Example:

```bash
git tag ios/v1.0.0
git push origin ios/v1.0.0
```

You can also run the workflow manually with EAS once the project is linked.

## App Store Connect checklist

Before inviting testers or submitting for review, confirm:

1. Beta App Description and What to Test are filled in.
2. Feedback Email is set.
3. Privacy answers are complete and match the app's behavior.
4. Age rating is set.
5. Export compliance is answered.
6. Support URL, privacy policy URL, and screenshots are ready.

## Notes

- The mobile CI job validates Expo config and exports an iOS bundle, but it does not produce a signed archive.
- The app still needs real production metadata and Apple credentials before it can be fully submitted end to end.
- `packages/mobile/app.config.js` injects `EXPO_OWNER`, `EXPO_PROJECT_ID`, and `EXPO_ASC_APP_ID` at build time so the repo does not need hardcoded account-specific identifiers.
