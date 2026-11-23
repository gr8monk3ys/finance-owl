import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  PUBLIC_SITE_URL: { public: true, schema: (input) => input },
  PUBLIC_COMPANY_NAME: { public: true, schema: (input) => input },
  PUBLIC_LEGAL_ENTITY_NAME: { public: true, schema: (input) => input },
  PUBLIC_COMPANY_ADDRESS: { public: true, schema: (input) => input },
  PUBLIC_SUPPORT_EMAIL: { public: true, schema: (input) => input },
  PUBLIC_PRIVACY_EMAIL: { public: true, schema: (input) => input },
  PUBLIC_LEGAL_EMAIL: { public: true, schema: (input) => input },
  PUBLIC_SECURITY_EMAIL: { public: true, schema: (input) => input },
});
