<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  export let show: boolean = false;
  export let message: string | null = null;
  export let type: 'success' | 'error' | 'info' = 'info';
  export let offsetTop: number | null = null;

  $: borderClass = type === 'success'
    ? 'border-green-500/30'
    : type === 'error'
    ? 'border-red-500/30'
    : 'border-blue-500/30';
  $: bgClass = type === 'success'
    ? 'bg-green-500/15'
    : type === 'error'
    ? 'bg-red-500/10'
    : 'bg-blue-500/10';
  $: textClass = type === 'success'
    ? 'text-green-800 dark:text-green-100'
    : type === 'error'
    ? 'text-red-800 dark:text-red-100'
    : 'text-blue-800 dark:text-blue-100';
</script>

{#if show && message}
  <div class="fixed left-0 right-0 z-30 px-4" style={`top:${(offsetTop ?? 16)}px`} in:fly={{ y: -8, duration: 250 }} out:fade={{ duration: 150 }}>
    <div class={`max-w-2xl mx-auto rounded-xl border ${borderClass} ${bgClass} ${textClass} backdrop-blur-sm p-4 shadow flex items-center gap-2`}>
      {#if type === 'success'}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      {:else if type === 'error'}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="16"></line><path d="M12 12v-4"/></svg>
      {/if}
      <span>{message}</span>
    </div>
  </div>
{/if}


