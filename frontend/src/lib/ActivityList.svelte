<script lang="ts">
  import type { ActivityEvent } from './types';

  export let activityEvents: ActivityEvent[] = [];
</script>

{#if activityEvents.length === 0}
  <div class="text-sm opacity-70">No activity yet.</div>
{:else}
  <div class="space-y-3">
    {#each activityEvents as ev}
      <div class="rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-4 shadow-sm hover:shadow transition flex items-start justify-between">
        <div class="flex items-start gap-3 min-w-0">
          {#if ev.kind === 'member_joined'}
            <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
          {:else if ev.kind === 'expense_created'}
            <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7H8"/><path d="M20 11H8"/><path d="M14 15H8"/><path d="M4 6v12"/></svg>
            </div>
          {:else}
            <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
          {/if}
          <div class="min-w-0">
            <div class="text-sm">
              <span>{ev.text}</span>
            </div>
            <div class="mt-1 text-xs opacity-70">{new Date(ev.at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}


