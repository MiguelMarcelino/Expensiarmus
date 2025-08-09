<script lang="ts">
  export let balanceUsers: { id: string; username: string }[] = [];
  export let balances: Record<string, number> = {};
  export let transfers: { from: string; to: string; amountCents: number }[] = [];
  export let me: { id: string; username: string } | null = null;
  export let centsToString: (c: number) => string;
  export let displayName: (id: string) => string;
</script>

<div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
  <h2 class="font-semibold mb-3">Balances</h2>
  <div class="text-sm grid md:grid-cols-2 gap-6">
    <div>
      {#if balanceUsers.length === 0}
        <div class="text-sm opacity-60">No participants yet.</div>
      {:else}
        {#each balanceUsers as u}
          <div class="flex justify-between py-1.5">
            <span>{u.username}{#if me && u.id === me.id}<span class="ml-1 text-xs opacity-60">(you)</span>{/if}</span>
            <span class="tabular-nums {balances[u.id] >= 0 ? 'text-green-600' : 'text-red-600'}">
              ${centsToString(Math.abs(balances[u.id] || 0))}
              {balances[u.id] >= 0 ? ' owed' : ' owes'}
            </span>
          </div>
        {/each}
      {/if}
    </div>
    <div>
      <div class="opacity-70 mb-1">Suggested transfers</div>
      {#if transfers.length === 0}
        <div class="text-sm opacity-60">All settled</div>
      {:else}
        <div class="space-y-1">
          {#each transfers as t}
            <div class="flex items-center justify-between py-1.5">
              <div class="text-sm">
                <span>{displayName(t.from)}</span>
                <span class="opacity-70"> → </span>
                <span>{displayName(t.to)}</span>
              </div>
              <span class="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20 tabular-nums">${centsToString(t.amountCents)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>


