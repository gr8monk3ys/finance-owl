<script lang="ts">
  import { publicRoutes, publicMailto } from '$lib/config/public';
  import { page } from '$app/stores';

  const statusCode = $derived($page.status);
  const errorMessage = $derived($page.error?.message ?? 'Something went wrong');

  interface ErrorInfo {
    title: string;
    description: string;
    icon: 'not-found' | 'forbidden' | 'server-error' | 'generic';
  }

  const errorInfo: Record<number, ErrorInfo> = {
    404: {
      title: 'Page Not Found',
      description:
        'The page you are looking for does not exist or has been moved. Check the URL or navigate back to safety.',
      icon: 'not-found',
    },
    403: {
      title: 'Access Denied',
      description:
        'You do not have permission to view this page. If you believe this is a mistake, please sign in or contact support.',
      icon: 'forbidden',
    },
    500: {
      title: 'Server Error',
      description:
        'Something went wrong on our end. Our team has been notified and is working to fix the issue. Please try again in a few minutes.',
      icon: 'server-error',
    },
  };

  const info = $derived(
    errorInfo[statusCode] ?? {
      title: 'Something Went Wrong',
      description:
        errorMessage ||
        'An unexpected error occurred. Please try again or contact support if the issue persists.',
      icon: 'generic' as const,
    },
  );

  function goBack() {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }
</script>

<svelte:head>
  <title>{statusCode} - {info.title} | Finance Owl</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-900 px-4">
  <!-- Background effects -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      class="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500/5 blur-[120px]"
    ></div>
    <div
      class="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-red-500/5 blur-[100px]"
    ></div>
  </div>

  <div class="relative mx-auto max-w-lg text-center">
    <!-- Error Icon -->
    <div
      class="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-surface-800 border border-surface-700/50 shadow-lg"
    >
      {#if info.icon === 'not-found'}
        <svg
          class="h-12 w-12 text-surface-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
          />
        </svg>
      {:else if info.icon === 'forbidden'}
        <svg
          class="h-12 w-12 text-red-400/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      {:else if info.icon === 'server-error'}
        <svg
          class="h-12 w-12 text-accent-400/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      {:else}
        <svg
          class="h-12 w-12 text-surface-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      {/if}
    </div>

    <!-- Status Code -->
    <p class="text-6xl font-extrabold tracking-tight text-white/10">{statusCode}</p>

    <!-- Title -->
    <h1 class="mt-4 text-2xl font-bold text-white">{info.title}</h1>

    <!-- Description -->
    <p class="mt-3 text-sm leading-relaxed text-surface-400">{info.description}</p>

    <!-- Action Buttons -->
    <div class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <a
        href="/"
        class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:shadow-xl hover:-translate-y-0.5"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
        Go Home
      </a>
      <button
        onclick={goBack}
        class="inline-flex items-center gap-2 rounded-xl border border-surface-600 bg-surface-800 px-6 py-3 text-sm font-semibold text-surface-200 transition-all hover:border-surface-500 hover:bg-surface-700 hover:text-white"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Go Back
      </button>
    </div>

    <!-- Help links -->
    <div class="mt-10 flex items-center justify-center gap-4 text-xs text-surface-500">
      <a href={publicRoutes.support} class="transition hover:text-surface-300">Help Center</a>
      <span class="text-surface-700">|</span>
      <a href={publicMailto.support} class="transition hover:text-surface-300">Contact Support</a>
    </div>
  </div>
</div>
