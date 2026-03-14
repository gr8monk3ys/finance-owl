function readEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

module.exports = () => {
  const owner = readEnv('EXPO_OWNER');
  const projectId = readEnv('EXPO_PROJECT_ID');
  const ascAppId = readEnv('EXPO_ASC_APP_ID');

  const extra = {};

  const easConfig = {};

  if (projectId) {
    easConfig.projectId = projectId;
  }

  if (Object.keys(easConfig).length > 0) {
    extra.eas = easConfig;
  }

  if (ascAppId) {
    extra.ascAppId = ascAppId;
  }

  return {
    name: 'Finance Owl',
    slug: 'finance-owl',
    version: '1.0.0',
    runtimeVersion: {
      policy: 'appVersion',
    },
    scheme: 'financeowl',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.financeowl.app',
      buildNumber: '1',
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.financeowl.app',
      versionCode: 1,
    },
    plugins: ['expo-router', 'expo-secure-store'],
    experiments: {
      typedRoutes: true,
    },
    ...(owner ? { owner } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
};
