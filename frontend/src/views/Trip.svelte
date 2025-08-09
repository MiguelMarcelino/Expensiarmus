<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import { location } from 'svelte-spa-router';

  let tripId = '';
  $: tripId = ($location as any)?.routeParams?.id || '';

  type Expense = {
    id: string;
    description: string;
    category?: string;
    expenseType?: string;
    quantity?: number;
    unitPriceCents?: number | null;
    amountCents: number;
    incurredAt: string;
    createdBy: { id: string; username: string };
    splits: { userId: string; amountCents: number }[];
  };

  let expenses: Expense[] = [];
  let tripName = '';
  let error: string | null = null;

  // manual form
  let description = '';
  let amount = 0;
  let category = '';
  let expenseType = '';

  // AI form
  let aiInput = '';

  // member form
  let memberUsername = '';

  function centsToString(c: number) { return (c / 100).toFixed(2); }

  async function load() {
    error = null;
    try {
      const res = await api(`/trips/${tripId}/expenses`);
      expenses = res.expenses;
      if (expenses.length > 0 && expenses[0].category) {
        tripName = expenses[0].category;
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function addExpense() {
    error = null;
    try {
      const res = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ tripId, description, amount, category: category || undefined, expenseType: expenseType || undefined })
      });
      expenses = [res.expense, ...expenses];
      description = ''; amount = 0; category = ''; expenseType = '';
    } catch (e: any) {
      error = e.message;
    }
  }

  async function aiParse() {
    error = null;
    try {
      const res = await api('/ai/parse', { method: 'POST', body: JSON.stringify({ input: aiInput }) });
      if (res.expense?.tripId === tripId) {
        expenses = [res.expense, ...expenses];
      }
      aiInput = '';
    } catch (e: any) {
      error = e.message;
    }
  }

  async function addMember() {
    error = null;
    try {
      await api(`/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ username: memberUsername }) });
      memberUsername = '';
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(load);
</script>

{#if error}<p class="text-sm text-red-600 mb-3">{error}</p>{/if}

<div class="grid md:grid-cols-3 gap-6">
  <div class="md:col-span-2 space-y-4">
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h2 class="font-semibold mb-3">Expenses</h2>
      <div class="divide-y">
        {#each expenses as e}
          <div class="py-3 flex items-start justify-between">
            <div>
              <div class="font-medium">{e.description}</div>
              <div class="text-xs opacity-70">{e.expenseType || e.category}</div>
              <div class="text-xs opacity-60">by {e.createdBy.username} · {new Date(e.incurredAt).toLocaleString()}</div>
            </div>
            <div class="font-semibold">${centsToString(e.amountCents)}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  <div class="space-y-4">
    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Add expense (manual)</h3>
      <input class="w-full border rounded p-2" placeholder="Description" bind:value={description} />
      <input type="number" min="0" step="0.01" class="w-full border rounded p-2" placeholder="Amount" bind:value={amount} />
      <input class="w-full border rounded p-2" placeholder="Category (optional)" bind:value={category} />
      <input class="w-full border rounded p-2" placeholder="Type (optional)" bind:value={expenseType} />
      <button class="w-full py-2 rounded bg-blue-600 text-white" on:click={addExpense} disabled={!description || !amount}>Add</button>
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">AI expense entry</h3>
      <textarea class="w-full border rounded p-2" rows="3" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
      <button class="w-full py-2 rounded bg-purple-600 text-white" on:click={aiParse} disabled={!aiInput}>Parse & Add</button>
      <p class="text-xs opacity-70">Example: "I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip."</p>
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Add member</h3>
      <div class="flex gap-2">
        <input class="flex-1 border rounded p-2" placeholder="Username" bind:value={memberUsername} />
        <button class="px-4 rounded bg-gray-700 text-white" on:click={addMember} disabled={!memberUsername}>Add</button>
      </div>
    </div>
  </div>
</div>
