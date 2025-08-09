<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { User } from '../lib/auth';
  import { fade, fly } from 'svelte/transition';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

  type Member = { user: { id: string; username: string } };
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
    payments?: { userId: string; amountCents: number }[];
  };

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let members: Member[] = [];
  let expenses: Expense[] = [];
  let tripName = '';
  let error: string | null = null;
  let success: string | null = null;

  // manual form
  let description = '';
  let amount = '';
  let category = '';
  let expenseType = '';
  let payerUserId: string = '';
  let splitByUserId: Record<string, string> = {}; // userId -> amount string
  let paidByUserId: Record<string, string> = {};  // userId -> amount string

  // AI form
  let aiInput = '';

  // member form
  let memberUsername = '';

  function centsToString(c: number) { return (c / 100).toFixed(2); }
  function sumStrings(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  }

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;
  $: payerOptions = (() => {
    const list = [...members.map((m) => m.user)];
    if (me && !list.find((u) => u.id === me!.id)) list.unshift({ id: me.id, username: me.username });
    return list;
  })();

  async function load() {
    error = null;
    try {
      const [membersRes, expensesRes] = await Promise.all([
        api(`/trips/${tripId}/members`),
        api(`/trips/${tripId}/expenses`),
      ]);
      members = membersRes.members;
      expenses = expensesRes.expenses;
      if (!payerUserId) {
        payerUserId = me?.id || (members[0]?.user.id ?? '');
      }
      if (expenses.length > 0 && expenses[0].category) {
        tripName = expenses[0].category;
      }
      // Initialize equal split by default
      const participantIds = members.map((m) => m.user.id);
      if (participantIds.length > 0 && Number(amount) > 0) {
        const per = Number(amount) / participantIds.length;
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, per.toFixed(2)]));
      } else {
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
      }
      // Default payer covers full amount
      const idsForPayments = payerOptions.map((u) => u.id);
      paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? (Number(amount) || 0).toFixed(2) : '0']));
    } catch (e: any) {
      error = e.message;
    }
  }

  function onAmountChange() {
    const total = Number(amount) || 0;
    const ids = members.map((m) => m.user.id);
    if (ids.length > 0) {
      const per = total / ids.length || 0;
      splitByUserId = Object.fromEntries(ids.map((id) => [id, per.toFixed(2)]));
    }
    const idsForPayments = payerOptions.map((u) => u.id);
    paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0']));
  }

  function onPayerChange() {
    const total = Number(amount) || 0;
    const idsForPayments = payerOptions.map((u) => u.id);
    paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0']));
  }

  function validTotals(): string | null {
    const total = Number(amount) || 0;
    const splitSum = sumStrings(splitByUserId);
    const paidSum = sumStrings(paidByUserId);
    if (Math.round(splitSum * 100) !== Math.round(total * 100)) return `Splits must sum to ${total.toFixed(2)}`;
    if (Math.round(paidSum * 100) !== Math.round(total * 100)) return `Payments must sum to ${total.toFixed(2)}`;
    return null;
  }

  async function addExpense() {
    error = null; success = null;
    const amountNum = Number(amount);
    if (!tripId) { error = 'No trip selected.'; return; }
    if (!description.trim() || !(amountNum > 0)) { error = 'Enter description and a positive amount.'; return; }
    const totalsError = validTotals();
    if (totalsError) { error = totalsError; return; }
    try {
      const splits = Object.entries(splitByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((s) => s.amount > 0);
      const payments = Object.entries(paidByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((p) => p.amount > 0);
      const res = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ tripId, description: description.trim(), amount: amountNum, category: category || undefined, expenseType: expenseType || undefined, splits, payments })
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

  // Balance summary (who owes whom)
  function computeBalances() {
    const userIds = members.map((m) => m.user.id);
    const balances: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
    for (const e of expenses) {
      const total = e.amountCents;
      const splitMap: Record<string, number> = {};
      for (const s of e.splits) splitMap[s.userId] = s.amountCents;
      const payMap: Record<string, number> = {};
      for (const p of e.payments || []) payMap[p.userId] = p.amountCents;
      if (Object.keys(payMap).length === 0) payMap[e.createdBy.id] = total;
      for (const id of userIds) {
        const owe = splitMap[id] || 0;
        const paid = payMap[id] || 0;
        balances[id] += paid - owe;
      }
    }
    return balances;
  }

  function minimizeTransfers(balances: Record<string, number>) {
    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];
    for (const [id, cents] of Object.entries(balances)) {
      if (cents > 0) creditors.push({ id, amount: cents });
      else if (cents < 0) debtors.push({ id, amount: -cents });
    }
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transfers: { from: string; to: string; amountCents: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const x = Math.min(d.amount, c.amount);
      if (x > 0) transfers.push({ from: d.id, to: c.id, amountCents: x });
      d.amount -= x; c.amount -= x;
      if (d.amount === 0) i++;
      if (c.amount === 0) j++;
    }
    return transfers;
  }

  $: balances = computeBalances();
  $: transfers = minimizeTransfers(balances);

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

<!-- Summary -->
<section class="mb-4 bg-white dark:bg-gray-800 rounded shadow p-4">
  <h2 class="font-semibold mb-2">Balances</h2>
  <div class="text-sm grid md:grid-cols-2 gap-4">
    <div>
      {#each members as m}
        <div class="flex justify-between py-1">
          <span>{m.user.username}</span>
          <span class="tabular-nums {balances[m.user.id] >= 0 ? 'text-green-600' : 'text-red-600'}">
            ${centsToString(Math.abs(balances[m.user.id] || 0))}
            {balances[m.user.id] >= 0 ? ' owed' : ' owes'}
          </span>
        </div>
      {/each}
    </div>
    <div>
      <div class="opacity-70 mb-1">Suggested transfers</div>
      {#if transfers.length === 0}
        <div class="text-sm opacity-60">All settled</div>
      {:else}
        {#each transfers as t}
          <div class="py-1 text-sm">
            <span>{members.find(x => x.user.id === t.from)?.user.username}</span>
            <span class="opacity-70"> → </span>
            <span>{members.find(x => x.user.id === t.to)?.user.username}</span>
            <span class="opacity-70">: </span>
            <span class="tabular-nums">${centsToString(t.amountCents)}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

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
      <input type="number" min="0" step="0.01" class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" placeholder="Amount" bind:value={amount} on:change={onAmountChange} />

      <div>
        <label class="text-xs opacity-70 block mb-1">Payer</label>
        <select class="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100" bind:value={payerUserId} on:change={onPayerChange}>
          {#each payerOptions as u}
            <option value={u.id}>{u.username}</option>
          {/each}
        </select>
      </div>

      <div class="mt-2">
        <div class="text-sm font-semibold mb-1">Who pays how much</div>
        {#each payerOptions as u}
          <div class="flex items-center gap-2 py-1">
            <span class="w-28 text-sm opacity-80">{u.username}</span>
            <input type="number" min="0" step="0.01" class="flex-1 border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" bind:value={paidByUserId[u.id]} on:input={(e) => paidByUserId[u.id] = (e.target as HTMLInputElement).value} />
          </div>
        {/each}
        <div class="text-xs opacity-70 mt-1">Total payments: ${sumStrings(paidByUserId).toFixed(2)}</div>
      </div>

      <div class="mt-2">
        <div class="text-sm font-semibold mb-1">Who owes how much</div>
        {#each members as m}
          <div class="flex items-center gap-2 py-1">
            <span class="w-28 text-sm opacity-80">{m.user.username}</span>
            <input type="number" min="0" step="0.01" class="flex-1 border border-gray-300 dark:border-gray-600 rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500" bind:value={splitByUserId[m.user.id]} on:input={(e) => splitByUserId[m.user.id] = (e.target as HTMLInputElement).value} />
          </div>
        {/each}
        <div class="text-xs opacity-70 mt-1">Total splits: ${sumStrings(splitByUserId).toFixed(2)}</div>
      </div>

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
