<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { User } from '../lib/types';
  import ExpenseIcon from '../lib/ExpenseIcon.svelte';

  type Trip = { id: string; name: string; createdAt: string };
  type Expense = {
    id: string;
    description: string;
    category?: string;
    expenseType?: string;
    amountCents: number;
    incurredAt: string;
    createdBy: { id: string; username: string };
    splits: { userId: string; amountCents: number }[];
    // payments may be included by the API; when missing, assume creator paid full amount
    payments?: { userId: string; amountCents: number }[];
  } & { tripId?: string };

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let trips: Trip[] = [];
  let name = '';
  let error: string | null = null;

  // flattened expense feed across all trips
  let expenses: (Expense & { tripName: string })[] = [];

  // totals for the current user based on netting across all expenses
  $: netCents = expenses.reduce((sum, e) => sum + myDeltaCents(e), 0);
  $: totalOwedCents = netCents > 0 ? netCents : 0;
  $: totalOweCents = netCents < 0 ? -netCents : 0;

  function centsToString(c: number) {
    return (c / 100).toFixed(2);
  }

  function myDeltaCents(e: Expense): number {
    const mySplit = e.splits.find((s) => s.userId === me?.id)?.amountCents || 0;
    let myPaid = 0;
    if (e.payments && e.payments.length > 0) {
      myPaid = e.payments
        .filter((p) => p.userId === (me?.id || ''))
        .reduce((sum, p) => sum + p.amountCents, 0);
    } else {
      myPaid = e.createdBy.id === (me?.id || '') ? e.amountCents : 0;
    }
    return myPaid - mySplit; // >0 you're owed, <0 you owe
  }

  async function load() {
    if (!me) return;
    try {
      const { trips: fetched } = await api('/trips');
      trips = fetched;
      const nameById: Record<string, string> = Object.fromEntries(trips.map((t) => [t.id, t.name]));
      const perTrip = await Promise.all(
        trips.map((t) => api(`/trips/${t.id}/expenses`).then((r) => ({ tripId: t.id, name: t.name, expenses: r.expenses as Expense[] })))
      );
      const all = perTrip.flatMap(({ tripId, name, expenses }) =>
        expenses.map((e) => ({ ...e, tripId, tripName: name }))
      );
      // sort by incurredAt desc
      all.sort((a, b) => new Date(b.incurredAt).getTime() - new Date(a.incurredAt).getTime());
      expenses = all;
    } catch (e: any) {
      error = e.message;
    }
  }

  async function createTrip() {
    try {
      const res = await api('/trips', { method: 'POST', body: JSON.stringify({ name }) });
      trips = [res.trip, ...trips];
      name = '';
      // refresh expenses since trips changed
      await load();
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(() => {
    if (!me) {
      window.location.hash = '#/';
      return;
    }
    load();
  });
</script>

<!-- Hero summary -->
<section class="relative overflow-hidden rounded-3xl mb-8">
  <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900"></div>
  <div class="absolute -top-28 -right-28 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-purple-400 to-indigo-400 dark:from-purple-600 dark:to-indigo-600"></div>
  <div class="absolute -bottom-28 -left-28 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-blue-400 to-cyan-400 dark:from-blue-700 dark:to-cyan-700"></div>

  <div class="relative px-6 py-8 md:px-8 md:py-10">
    <div class="max-w-5xl mx-auto grid md:grid-cols-3 gap-4 items-stretch">
      <div class="md:col-span-2">
        <div class="relative h-full rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm opacity-70">Welcome back</div>
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">Your balances</h2>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                  You owe <strong class="tabular-nums ml-1">${centsToString(totalOweCents)}</strong>
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
                  You're owed <strong class="tabular-nums ml-1">${centsToString(totalOwedCents)}</strong>
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-gray-700 dark:text-gray-200 border border-gray-500/20">
                  Net
                  <strong class="tabular-nums ml-1 {netCents>=0 ? 'text-green-600' : 'text-red-600'}">${centsToString(Math.abs(netCents))}</strong>
                  <span class="opacity-70">{netCents>=0 ? 'in your favor' : 'to settle'}</span>
                </span>
              </div>
            </div>
            <div class="text-right hidden sm:block">
              <div class="text-xs opacity-70">Net across all trips</div>
              <div class="text-3xl font-bold tabular-nums {netCents>=0 ? 'text-green-600' : 'text-red-600'}">${centsToString(Math.abs(netCents))}</div>
              <div class="text-xs opacity-70">{netCents>=0 ? 'in your favor' : 'to settle'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4 h-full">
        <div class="h-full rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm overflow-hidden flex flex-col justify-between">
          <div class="text-sm opacity-70 mb-2">Quick action</div>
          <div class="flex items-center gap-2 min-w-0">
            <input class="flex-1 min-w-0 border rounded-lg p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500 border-gray-300 dark:border-gray-700" placeholder="New trip name" bind:value={name} />
            <button class="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={createTrip} disabled={!name}>Create</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{#if error}
  <p class="text-sm text-red-600 mb-3">{error}</p>
{/if}

<section class="mb-10">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-semibold">Trips</h3>
  </div>
  {#if trips.length === 0}
    <div class="text-sm opacity-70">No trips yet. Create one above to get started.</div>
  {:else}
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each trips as t}
        {#key t.id}
          <a href={`#/trip/${t.id}`} class="block rounded-xl border border-white/30 dark:border-gray-700/40 bg-white/60 dark:bg-gray-900/50 backdrop-blur shadow-sm hover:shadow-md transition p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold">{t.name}</div>
                <div class="text-xs opacity-70">Created {new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <div class="text-right text-xs opacity-60">View</div>
            </div>
          </a>
        {/key}
      {/each}
    </div>
  {/if}
  
</section>

<section>
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-semibold">Latest expenses</h3>
  </div>
  {#if expenses.length === 0}
    <div class="text-sm opacity-70">No expenses yet.</div>
  {:else}
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each expenses as e}
        {#key e.id}
          <a href={`#/trip/${e.tripId}`} class="block rounded-xl border border-white/30 dark:border-gray-700/40 bg-white/60 dark:bg-gray-900/50 backdrop-blur shadow-sm hover:shadow-md transition p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0">
                <ExpenseIcon description={e.description} category={e.category} expenseType={e.expenseType} />
                <div class="min-w-0">
                  <div class="font-semibold truncate">{e.description}</div>
                  <div class="text-xs opacity-70 flex flex-wrap items-center gap-2">
                    {#if e.expenseType || e.category}
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-700 dark:text-gray-200 border border-gray-500/20">{e.expenseType || e.category}</span>
                    {/if}
                    <span class="truncate">{e.tripName} · added by {e.createdBy.username}</span>
                    <span class="opacity-60">·</span>
                    <span>{new Date(e.incurredAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-semibold">${centsToString(e.amountCents)}</div>
                <!-- Per-expense badges removed to reflect global netting across expenses -->
              </div>
            </div>
          </a>
        {/key}
      {/each}
    </div>
  {/if}
</section>
