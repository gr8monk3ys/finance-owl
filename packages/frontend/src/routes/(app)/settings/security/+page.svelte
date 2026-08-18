<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { ActionData, PageData } from './$types';
  import { Button, Card, Input, Modal } from '$components/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // -- Password change state --
  let passwordSaving = $state(false);

  // -- Passkey state --
  let passkeyRegistering = $state(false);
  let passkeyDeleting = $state<string | null>(null);
  let deleteConfirmId = $state<string | null>(null);

  // -- TOTP state --
  let totpSetupLoading = $state(false);
  let totpEnabling = $state(false);
  let totpDisabling = $state(false);
  let totpSetupData = $state<{ secret: string; otpauth: string } | null>(null);
  let showDisableModal = $state(false);
  let totpCode = $state('');
  let totpDisableCode = $state('');

  // -- Sessions state --
  let logoutAllLoading = $state(false);

  // Restore TOTP setup data from form action
  $effect(() => {
    if (form?.totpSetup) {
      totpSetupData = form.totpSetup;
    }
    if (form?.totpEnableSuccess || form?.totpDisableSuccess) {
      totpSetupData = null;
      totpCode = '';
      totpDisableCode = '';
      showDisableModal = false;
    }
  });

  const isTotpEnabled = $derived(
    form?.totpEnableSuccess ? true : form?.totpDisableSuccess ? false : data.totpEnabled,
  );

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDeviceType(type: string | null | undefined): string {
    if (!type) return 'Unknown';
    if (type === 'singleDevice') return 'Single-device';
    if (type === 'multiDevice') return 'Multi-device (synced)';
    return type;
  }

  function parseUserAgent(ua: string | null | undefined): string {
    if (!ua) return 'Unknown device';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Browser';
  }

  // Base64URL encoding/decoding utilities for WebAuthn
  function base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function registerPasskey() {
    passkeyRegistering = true;
    try {
      // 1. Get registration options from backend (via SvelteKit API proxy)
      const optionsRes = await fetch('/api/auth/webauthn/register/options');
      if (!optionsRes.ok) throw new Error('Failed to get registration options');
      const options = await optionsRes.json();

      // 2. Convert options for the browser WebAuthn API
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64urlToBuffer(options.challenge),
        user: {
          ...options.user,
          id: base64urlToBuffer(options.user.id),
        },
        excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
          ...c,
          id: base64urlToBuffer(c.id),
        })),
      };

      // 3. Call the browser WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error('No credential returned');

      const response = credential.response as AuthenticatorAttestationResponse;

      // 4. Serialize the credential for the server
      const body = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64url(response.attestationObject),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          transports: response.getTransports ? response.getTransports() : undefined,
        },
      };

      // 5. Verify with backend
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!verifyRes.ok) throw new Error('Registration verification failed');

      await invalidateAll();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled the WebAuthn dialog - do nothing
      } else {
        console.error('Passkey registration failed:', err);
      }
    } finally {
      passkeyRegistering = false;
    }
  }
</script>

<svelte:head>
  <title>Security Settings - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <a
      href="/settings"
      class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition hover:bg-surface-700 hover:text-white"
      aria-label="Back to settings"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-2xl font-bold text-white">Security</h1>
  </div>

  <!-- ==================== CHANGE PASSWORD ==================== -->
  <Card padding="none">
    <form
      method="POST"
      action="?/changePassword"
      use:enhance={() => {
        passwordSaving = true;
        return async ({ update }) => {
          passwordSaving = false;
          await update();
        };
      }}
    >
      <div class="space-y-4 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">Change Password</h2>
          <p class="mt-1 text-sm text-surface-400">
            Update your password to keep your account secure.
          </p>
        </div>

        {#if form?.passwordSuccess}
          <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
            Password changed successfully. All sessions have been refreshed.
          </div>
        {/if}

        {#if form?.passwordError}
          <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
            {form.passwordError}
          </div>
        {/if}

        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          label="Current Password"
          required
          autocomplete="current-password"
        />

        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label="New Password"
          required
          autocomplete="new-password"
          minlength={8}
        />

        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm New Password"
          required
          autocomplete="new-password"
          minlength={8}
        />
      </div>

      <div class="border-t border-surface-700 px-6 py-4">
        <Button type="submit" loading={passwordSaving}>Update Password</Button>
      </div>
    </form>
  </Card>

  <!-- ==================== PASSKEYS / WEBAUTHN ==================== -->
  <Card padding="none">
    <div class="space-y-4 p-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold text-white">Passkeys</h2>
          <p class="mt-1 text-sm text-surface-400">
            Use biometrics or a hardware key to sign in without a password.
          </p>
        </div>
        <Button size="sm" onclick={registerPasskey} loading={passkeyRegistering}>
          <svg
            class="mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Passkey
        </Button>
      </div>

      {#if form?.passkeyError}
        <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
          {form.passkeyError}
        </div>
      {/if}

      {#if form?.passkeyDeleteSuccess}
        <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
          Passkey removed successfully.
        </div>
      {/if}

      {#if data.credentials.length === 0}
        <div class="rounded-lg border border-dashed border-surface-600 px-6 py-8 text-center">
          <svg
            class="mx-auto h-10 w-10 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <p class="mt-3 text-sm text-surface-400">No passkeys registered yet.</p>
          <p class="mt-1 text-xs text-surface-500">
            Add a passkey for faster, more secure sign-in.
          </p>
        </div>
      {:else}
        <div class="divide-y divide-surface-700 rounded-lg border border-surface-700">
          {#each data.credentials as credential (credential.id)}
            <div class="flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700">
                  <svg
                    class="h-5 w-5 text-primary-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-white">
                    {formatDeviceType(credential.deviceType)}
                    {#if credential.backedUp}
                      <span
                        class="ml-1.5 inline-flex items-center rounded-full bg-primary-600/20 px-1.5 py-0.5 text-xs text-primary-400"
                      >
                        Synced
                      </span>
                    {/if}
                  </p>
                  <p class="text-xs text-surface-400">
                    Added {formatDate(credential.createdAt)}
                  </p>
                </div>
              </div>

              {#if deleteConfirmId === credential.id}
                <div class="flex items-center gap-2">
                  <span class="text-xs text-surface-400">Delete?</span>
                  <form
                    method="POST"
                    action="?/deletePasskey"
                    use:enhance={() => {
                      passkeyDeleting = credential.id;
                      return async ({ update }) => {
                        passkeyDeleting = null;
                        deleteConfirmId = null;
                        await update();
                      };
                    }}
                  >
                    <input type="hidden" name="credentialId" value={credential.id} />
                    <Button
                      variant="danger"
                      size="sm"
                      type="submit"
                      loading={passkeyDeleting === credential.id}
                    >
                      Confirm
                    </Button>
                  </form>
                  <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = null)}>
                    Cancel
                  </Button>
                </div>
              {:else}
                <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = credential.id)}>
                  <svg
                    class="h-4 w-4 text-surface-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </Button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Card>

  <!-- ==================== TWO-FACTOR AUTH (TOTP) ==================== -->
  <Card padding="none">
    <div class="space-y-4 p-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold text-white">Two-Factor Authentication</h2>
          <p class="mt-1 text-sm text-surface-400">
            Add an extra layer of security using a time-based one-time password (TOTP) app.
          </p>
        </div>
        {#if isTotpEnabled}
          <span
            class="inline-flex items-center rounded-full bg-green-900/50 px-2.5 py-1 text-xs font-medium text-green-400"
          >
            <span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400"></span>
            Enabled
          </span>
        {:else}
          <span
            class="inline-flex items-center rounded-full bg-surface-700 px-2.5 py-1 text-xs font-medium text-surface-400"
          >
            <span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-surface-500"></span>
            Disabled
          </span>
        {/if}
      </div>

      {#if form?.totpError}
        <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
          {form.totpError}
        </div>
      {/if}

      {#if form?.totpEnableSuccess}
        <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
          Two-factor authentication has been enabled successfully.
        </div>
      {/if}

      {#if form?.totpDisableSuccess}
        <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
          Two-factor authentication has been disabled.
        </div>
      {/if}

      {#if isTotpEnabled}
        <!-- TOTP is enabled: show disable option -->
        <div class="rounded-lg border border-surface-700 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/30">
              <svg
                class="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-white">Authenticator app configured</p>
              <p class="text-xs text-surface-400">
                Your account is protected with a TOTP authenticator app.
              </p>
            </div>
            <Button variant="danger" size="sm" onclick={() => (showDisableModal = true)}>
              Disable 2FA
            </Button>
          </div>
        </div>

        <!-- Disable TOTP Modal -->
        <Modal
          open={showDisableModal}
          onclose={() => {
            showDisableModal = false;
            totpDisableCode = '';
          }}
          title="Disable Two-Factor Authentication"
        >
          <form
            method="POST"
            action="?/disableTotp"
            use:enhance={() => {
              totpDisabling = true;
              return async ({ update }) => {
                totpDisabling = false;
                await update();
              };
            }}
          >
            <div class="space-y-4">
              <p class="text-sm text-surface-300">
                Enter a code from your authenticator app to confirm disabling two-factor
                authentication.
              </p>

              <Input
                id="disableCode"
                name="code"
                type="text"
                label="Verification Code"
                placeholder="000000"
                required
                autocomplete="one-time-code"
                inputmode="numeric"
                maxlength={6}
                bind:value={totpDisableCode}
              />

              <div class="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onclick={() => {
                    showDisableModal = false;
                    totpDisableCode = '';
                  }}
                >
                  Cancel
                </Button>
                <Button variant="danger" type="submit" loading={totpDisabling}>Disable 2FA</Button>
              </div>
            </div>
          </form>
        </Modal>
      {:else}
        <!-- TOTP not enabled: show setup flow -->
        {#if totpSetupData}
          <!-- Step 2: QR code + verification code -->
          <div class="space-y-4 rounded-lg border border-surface-700 p-4">
            <div>
              <h3 class="text-sm font-medium text-white">1. Scan QR Code</h3>
              <p class="mt-1 text-xs text-surface-400">
                Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan
                the QR code below.
              </p>
            </div>

            <div class="flex justify-center rounded-lg bg-white p-4">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(
                  totpSetupData.otpauth,
                )}"
                alt="TOTP QR Code"
                class="h-48 w-48"
              />
            </div>

            <div>
              <h3 class="text-sm font-medium text-white">Or enter the key manually</h3>
              <div class="mt-2 rounded-lg bg-surface-900 px-3 py-2">
                <code class="break-all text-xs text-primary-400">{totpSetupData.secret}</code>
              </div>
            </div>

            <form
              method="POST"
              action="?/enableTotp"
              use:enhance={() => {
                totpEnabling = true;
                return async ({ update }) => {
                  totpEnabling = false;
                  await update();
                };
              }}
            >
              <div class="space-y-4">
                <div>
                  <h3 class="text-sm font-medium text-white">2. Enter Verification Code</h3>
                  <p class="mt-1 text-xs text-surface-400">
                    Enter the 6-digit code from your authenticator app to verify setup.
                  </p>
                </div>

                <Input
                  id="totpCode"
                  name="code"
                  type="text"
                  label="Verification Code"
                  placeholder="000000"
                  required
                  autocomplete="one-time-code"
                  inputmode="numeric"
                  maxlength={6}
                  bind:value={totpCode}
                />

                <div class="flex gap-3">
                  <Button type="submit" loading={totpEnabling}>Verify &amp; Enable</Button>
                  <Button variant="ghost" onclick={() => (totpSetupData = null)}>Cancel</Button>
                </div>
              </div>
            </form>
          </div>
        {:else}
          <!-- Step 1: Begin setup -->
          <form
            method="POST"
            action="?/setupTotp"
            use:enhance={() => {
              totpSetupLoading = true;
              return async ({ update }) => {
                totpSetupLoading = false;
                await update();
              };
            }}
          >
            <div class="rounded-lg border border-dashed border-surface-600 p-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700">
                  <svg
                    class="h-5 w-5 text-surface-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                    />
                  </svg>
                </div>
                <div class="flex-1">
                  <p class="text-sm font-medium text-white">Protect your account with 2FA</p>
                  <p class="text-xs text-surface-400">
                    Require a second form of verification when signing in.
                  </p>
                </div>
                <Button size="sm" type="submit" loading={totpSetupLoading}>Set Up 2FA</Button>
              </div>
            </div>
          </form>
        {/if}
      {/if}
    </div>
  </Card>

  <!-- ==================== ACTIVE SESSIONS ==================== -->
  <Card padding="none">
    <div class="space-y-4 p-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold text-white">Active Sessions</h2>
          <p class="mt-1 text-sm text-surface-400">
            Manage the devices and browsers signed in to your account.
          </p>
        </div>
        <form
          method="POST"
          action="?/logoutAll"
          use:enhance={() => {
            logoutAllLoading = true;
            return async ({ update }) => {
              logoutAllLoading = false;
              await update();
            };
          }}
        >
          <Button variant="danger" size="sm" type="submit" loading={logoutAllLoading}>
            Logout All
          </Button>
        </form>
      </div>

      {#if form?.logoutAllSuccess}
        <div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
          All sessions have been logged out.
        </div>
      {/if}

      {#if form?.logoutAllError}
        <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
          {form.logoutAllError}
        </div>
      {/if}

      {#if data.sessions.length === 0}
        <div class="rounded-lg border border-dashed border-surface-600 px-6 py-6 text-center">
          <p class="text-sm text-surface-400">No active sessions found.</p>
        </div>
      {:else}
        <div class="divide-y divide-surface-700 rounded-lg border border-surface-700">
          {#each data.sessions as session (session.id)}
            <div class="flex items-center gap-3 px-4 py-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700">
                <svg
                  class="h-5 w-5 text-surface-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
                  />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-white">
                  {parseUserAgent(session.userAgent)}
                </p>
                <p class="text-xs text-surface-400">
                  {session.ipAddress || 'Unknown IP'}
                  <span class="mx-1.5 text-surface-600">|</span>
                  Created {formatDate(session.createdAt)}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs text-surface-500">
                  Expires {formatDate(session.expiresAt)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Card>
</div>
