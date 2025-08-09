<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import { fade, fly } from 'svelte/transition';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

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
  let success: string | null = null;

  // manual form
  let description = '';
  let amount = '';
  let category = '';
  let expenseType = '';

  // AI form
  let aiInput = '';

  // member form
  let memberUsername = '';

  function centsToString(c: number) { return (c / 100).toFixed(2); }

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;

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
    error = null; success = null;
    const amountNum = Number(amount);
    if (!tripId) { error = 'No trip selected.'; return; }
    if (!description.trim() || !(amountNum > 0)) { error = 'Enter description and a positive amount.'; return; }
    try {
      const res = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ tripId, description: description.trim(), amount: amountNum, category: category || undefined, expenseType: expenseType || undefined })
      });
      expenses = [res.expense as Expense, ...expenses];
      description = ''; amount = ''; category = ''; expenseType = '';
      success = 'Expense added successfully.';
      setTimeout(() => { success = null; }, 3000);
    } catch (e: any) {
      error = e.message;
    }
  }

  async function aiParse() {
    error = null; success = null;
    try {
      const res = await api('/ai/parse', { method: 'POST', body: JSON.stringify({ input: aiInput }) });
      if (res.expense?.tripId === tripId) {
        expenses = [res.expense as Expense, ...expenses];
        success = 'Expense added from AI.';
        setTimeout(() => { success = null; }, 3000);
      }
      aiInput = '';
    } catch (e: any) {
      error = e.message;
    }
  }

  async function addMember() {
    error = null; success = null;
    try {
      await api(`/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ username: memberUsername }) });
      memberUsername = '';
      success = 'Member added.';
      setTimeout(() => { success = null; }, 3000);
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(() => {
    if (tripId) load();
  });
</script>

{#if error}
  <div class="sticky top-2 z-10">
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100 backdrop-blur-sm px-4 py-3 shadow">
      {error}
    </div>
  </div>
{/if}
{#if success}
  <div class="sticky top-2 z-10" in:fly={{ y: -8, duration: 250 }} out:fade={{ duration: 150 }}>
    <div class="rounded-xl border border-green-500/30 bg-green-500/15 text-green-800 dark:text-green-100 backdrop-blur-sm px-4 py-3 shadow flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      <span>{success}</span>
    </div>
  </div>
{/if}

<div class="grid md:grid-cols-3 gap-6 mt-2">
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
      <input class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Description" bind:value={description} />
      <input type="number" min="0" step="0.01" class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Amount" bind:value={amount} />
      <input class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Category (optional)" bind:value={category} />
      <input class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Type (optional)" bind:value={expenseType} />
      <button class="w-full py-2 rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addExpense} disabled={addDisabled}>Add</button>
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">AI expense entry</h3>
      <textarea class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" rows="3" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
      <button class="w-full py-2 rounded bg-purple-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={aiParse} disabled={!aiInput.trim()}>Parse & Add</button>
      <p class="text-xs opacity-70">Example: "I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip."</p>
    </div>

    <div class="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h3 class="font-semibold">Add member</h3>
      <div class="flex gap-2">
        <input class="flex-1 border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Username" bind:value={memberUsername} />
        <button class="px-4 rounded bg-gray-700 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addMember} disabled={!memberUsername.trim()}>Add</button>
      </div>
    </div>
  </div>
</div>
