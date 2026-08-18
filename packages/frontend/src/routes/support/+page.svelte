<script lang="ts">
  import { publicMailto, publicRoutes, publicSite } from '$lib/config/public';

  const contactCards = [
    {
      title: 'General Support',
      description: 'Billing questions, login issues, bugs, and feature requests.',
      label: publicSite.supportEmail,
      href: publicMailto.support,
    },
    {
      title: 'Security',
      description: 'Report security issues or suspicious activity affecting your account.',
      label: publicSite.securityEmail,
      href: publicMailto.security,
    },
    {
      title: 'Privacy',
      description: 'Data access, deletion, consent, and privacy-rights requests.',
      label: publicSite.privacyEmail,
      href: publicMailto.privacy,
    },
    {
      title: 'Legal',
      description: 'Terms, enterprise reviews, and other legal inquiries.',
      label: publicSite.legalEmail,
      href: publicMailto.legal,
    },
  ];

  const selfServeLinks = [
    { title: 'Privacy Policy', href: publicRoutes.privacy },
    { title: 'Terms of Service', href: publicRoutes.terms },
    { title: 'Security Overview', href: publicRoutes.security },
    { title: 'Sign In', href: '/auth/login' },
  ];

  const supportChecklist = [
    'The email address on your account',
    'Your device, browser, or app version',
    'Exact steps to reproduce the problem',
    'Screenshots or the full error message when possible',
  ];
</script>

<svelte:head>
  <title>Support - Finance Owl</title>
  <meta
    name="description"
    content="Contact Finance Owl support, security, privacy, or legal. Find the right contact path and self-serve resources."
  />
</svelte:head>

<main class="min-h-screen bg-surface-900">
  <div class="border-b border-surface-700/50 bg-surface-800/60 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <a href="/" class="text-surface-400 transition hover:text-white" aria-label="Back to home">
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </a>
        <div>
          <h1 class="text-2xl font-bold text-white">Support</h1>
          <p class="mt-1 text-sm text-surface-400">
            Get help with accounts, billing, bugs, privacy, and security.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
    <section class="grid gap-4 sm:grid-cols-2">
      {#each contactCards as card}
        <a
          href={card.href}
          class="rounded-2xl border border-surface-700/60 bg-surface-800/70 p-5 transition hover:border-surface-600 hover:bg-surface-800"
        >
          <h2 class="text-base font-semibold text-white">{card.title}</h2>
          <p class="mt-2 text-sm leading-relaxed text-surface-400">{card.description}</p>
          <p class="mt-4 text-sm font-medium text-primary-400">{card.label}</p>
        </a>
      {/each}
    </section>

    <section class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div class="rounded-2xl border border-surface-700/60 bg-surface-800/70 p-6">
        <h2 class="text-lg font-semibold text-white">Before you email us</h2>
        <p class="mt-2 text-sm leading-relaxed text-surface-400">
          Include enough detail for us to reproduce the issue without a long back-and-forth.
        </p>
        <ul class="mt-5 space-y-3">
          {#each supportChecklist as item}
            <li class="flex items-start gap-3 text-sm text-surface-300">
              <svg
                class="mt-0.5 h-4 w-4 shrink-0 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{item}</span>
            </li>
          {/each}
        </ul>
        <p class="mt-5 text-sm text-surface-400">
          For account deletion or data export, sign in and use <a
            href="/settings/privacy"
            class="text-primary-400 underline hover:text-primary-300">Settings &gt; Privacy</a
          >.
        </p>
      </div>

      <div class="rounded-2xl border border-surface-700/60 bg-surface-800/70 p-6">
        <h2 class="text-lg font-semibold text-white">Self-serve resources</h2>
        <p class="mt-2 text-sm leading-relaxed text-surface-400">
          These pages answer most launch, policy, and account questions.
        </p>
        <div class="mt-5 grid gap-3">
          {#each selfServeLinks as link}
            <a
              href={link.href}
              class="rounded-xl border border-surface-700/60 px-4 py-3 text-sm font-medium text-surface-200 transition hover:border-surface-500 hover:bg-surface-700 hover:text-white"
            >
              {link.title}
            </a>
          {/each}
        </div>
        <div class="mt-6 rounded-xl border border-surface-700/60 bg-surface-900/60 p-4">
          <p class="text-xs uppercase tracking-wide text-surface-400">Company</p>
          <p class="mt-2 text-sm text-surface-300">{publicSite.legalEntityName}</p>
          {#if publicSite.companyAddress}
            <p class="mt-1 text-sm text-surface-400">{publicSite.companyAddress}</p>
          {/if}
        </div>
      </div>
    </section>
  </div>
</main>
