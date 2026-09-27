<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();

  // Browser chrome should blend with what sits under it: the app's sticky
  // header (surface-800), the marketing page (gray-950), or the plain
  // surface-900 sheet of the auth, legal and error pages.
  const themeColor = $derived(
    page.route.id?.startsWith('/(app)') ? '#1e293b' : page.route.id === '/' ? '#030712' : '#0f172a',
  );
</script>

<svelte:head>
  <meta name="theme-color" content={themeColor} />
</svelte:head>

{@render children()}
