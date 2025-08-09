<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { User } from '../lib/auth';

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
    // payments are not included by the API for GET, we assume createdBy paid full amount when missing
  } & { tripId?: string };

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let trips: Trip[] = [];
  let name = '';
  let error: string | null = null;

  // flattened expense feed across all trips
  let expenses: (Expense & { tripName: string })[] = [];

  function centsToString(c: number) {
    return (c / 100).toFixed(2);
  }

  function myDeltaCents(e: Expense): number {
    const mySplit = e.splits.find((s) => s.userId === me?.id)?.amountCents || 0;
    const myPaid = e.createdBy.id === (me?.id || '') ? e.amountCents : 0;
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

<div class="flex items-center gap-3 mb-6">
  <input class="border rounded p-2 flex-1" placeholder="New trip name" bind:value={name} />
  <button class="px-4 py-2 rounded bg-blue-600 text-white" on:click={createTrip} disabled={!name}>Create</button>
</div>

{#if error}
  <p class="text-sm text-red-600 mb-3">{error}</p>
{/if}

<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each expenses as e}
    {#key e.id}
      <a href={`#/trip/${e.tripId}`} class="block rounded-xl border border-white/30 dark:border-gray-700/40 bg-white/60 dark:bg-gray-900/50 backdrop-blur shadow-sm hover:shadow-md transition p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold">{e.description}</div>
            <div class="text-xs opacity-70">{e.expenseType || e.category}</div>
            <div class="text-xs opacity-60">{e.tripName} · by {e.createdBy.username} · {new Date(e.incurredAt).toLocaleString()}</div>
          </div>
          <div class="text-right">
            <div class="font-semibold">${centsToString(e.amountCents)}</div>
            {#if me}
              {#if myDeltaCents(e) < 0}
                <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-700 dark:text-red-300">You owe ${centsToString(Math.abs(myDeltaCents(e)))}</div>
              {:else if myDeltaCents(e) > 0}
                <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-700 dark:text-green-300">You're owed ${centsToString(myDeltaCents(e))}</div>
              {:else}
                <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-gray-500/15 text-gray-700 dark:text-gray-300">Settled</div>
              {/if}
            {/if}
          </div>
        </div>
      </a>
    {/key}
  {/each}
</div>
