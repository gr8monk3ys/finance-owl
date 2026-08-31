<script lang="ts">
  interface Props {
    plan?: 'premium' | 'family';
    size?: 'xs' | 'sm';
    class?: string;
  }

  let { plan = 'premium', size = 'xs', class: className = '' }: Props = $props();

  const colors: Record<string, string> = {
    premium: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    family: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  };

  const sizes: Record<string, string> = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
  };
</script>

<span
  class="inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider {colors[
    plan
  ]} {sizes[size]} {className}"
>
  <svg class="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fill-rule="evenodd"
      d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
      clip-rule="evenodd"
    />
  </svg>
  {plan === 'family' ? 'Family' : 'Premium'}
</span>
