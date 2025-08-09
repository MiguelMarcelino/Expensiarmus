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

  $: totalOweCents = expenses.reduce((sum, e) => {
    const d = myDeltaCents(e);
    return sum + (d < 0 ? -d : 0);
  }, 0);
  $: totalOwedCents = expenses.reduce((sum, e) => {
    const d = myDeltaCents(e);
    return sum + (d > 0 ? d : 0);
  }, 0);
  $: netCents = totalOwedCents - totalOweCents;

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;
  $: payerOptions = (() => {
    const list = [...members.map((m) => m.user)];
    if (me && !list.find((u) => u.id === me!.id)) list.unshift({ id: me.id, username: me.username });
    return list;
  })();
  $: splitParticipants = (() => {
    if (members.length > 0) return members.map((m) => m.user);
    if (me) return [{ id: me.id, username: me.username }];
    return [] as { id: string; username: string }[];
  })();

  async function load() {
    error = null;
    try {
      const [membersRes, expensesRes, tripsRes] = await Promise.all([
        api(`/trips/${tripId}/members`),
        api(`/trips/${tripId}/expenses`),
        api(`/trips`),
      ]);
      members = membersRes.members;
      expenses = expensesRes.expenses;
      // derive trip name from trips list
      if (tripsRes?.trips) {
        const t = (tripsRes.trips as { id: string; name: string }[]).find((x) => x.id === tripId);
        if (t) tripName = t.name;
      }
      if (!payerUserId) {
        payerUserId = me?.id || (members[0]?.user.id ?? '');
      }
      // Initialize equal split among splitParticipants
      const participantIds = splitParticipants.map((u) => u.id);
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
    const ids = splitParticipants.map((u) => u.id);
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

<!-- Back to dashboard -->
<div class="mb-3">
  <a href="#/dashboard" class="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur px-3 py-1.5 shadow-sm hover:shadow transition">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>
    <span class="text-sm">Back to dashboard</span>
  </a>
  
</div>

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
              <div class="text-sm opacity-70">Trip</div>
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">{tripName || 'Trip details'}</h2>
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
              <div class="text-xs opacity-70">Members</div>
              <div class="text-3xl font-bold tabular-nums">{members.length}</div>
              <div class="text-xs opacity-70">in this trip</div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4 h-full">
        <div class="h-full rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm overflow-hidden flex flex-col justify-between">
          <div class="text-sm opacity-70 mb-2">Quick note</div>
          <div class="text-xs opacity-70">Keep expenses up to date to get accurate balances and transfer suggestions.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Summary -->
<section class="mb-6">
  <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
    <h2 class="font-semibold mb-3">Balances</h2>
    <div class="text-sm grid md:grid-cols-2 gap-6">
      <div>
        {#each members as m}
          <div class="flex justify-between py-1.5">
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
          <div class="space-y-1">
            {#each transfers as t}
              <div class="flex items-center justify-between py-1.5">
                <div class="text-sm">
                  <span>{members.find(x => x.user.id === t.from)?.user.username}</span>
                  <span class="opacity-70"> → </span>
                  <span>{members.find(x => x.user.id === t.to)?.user.username}</span>
                </div>
                <span class="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20 tabular-nums">${centsToString(t.amountCents)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>

<div class="grid md:grid-cols-3 gap-6 mt-2">
  <div class="md:col-span-2 space-y-4">
    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
      <h2 class="font-semibold mb-3">Expenses</h2>
      {#if expenses.length === 0}
        <div class="text-sm opacity-70">No expenses yet.</div>
      {:else}
        <div class="divide-y divide-gray-200/70 dark:divide-gray-700/50">
          {#each expenses as e}
            <div class="py-3 flex items-start justify-between">
              <div>
                <div class="font-medium">{e.description}</div>
                <div class="text-xs opacity-70">{e.expenseType || e.category}</div>
                <div class="text-xs opacity-60">by {e.createdBy.username} · {new Date(e.incurredAt).toLocaleString()}</div>
              </div>
              <div class="text-right">
                <div class="font-semibold">${centsToString(e.amountCents)}</div>
                {#if me}
                  {#if myDeltaCents(e) < 0}
                    <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">You owe ${centsToString(Math.abs(myDeltaCents(e)))}</div>
                  {:else if myDeltaCents(e) > 0}
                    <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/20">You're owed ${centsToString(myDeltaCents(e))}</div>
                  {:else}
                    <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20">Settled</div>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <div class="space-y-4">
    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
      <h3 class="font-semibold">Add expense (manual)</h3>
      <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Description" bind:value={description} />
      <input type="number" min="0" step="0.01" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Amount" bind:value={amount} on:change={onAmountChange} />

      <div>
        <label class="text-xs opacity-70 block mb-1" for="payer-select">Payer</label>
        <select id="payer-select" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={payerUserId} on:change={onPayerChange}>
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
            <input type="number" min="0" step="0.01" class="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidByUserId[u.id]} on:input={(e) => paidByUserId[u.id] = (e.target as HTMLInputElement).value} />
          </div>
        {/each}
        <div class="text-xs opacity-70 mt-1">Total payments: ${sumStrings(paidByUserId).toFixed(2)}</div>
      </div>

      <div class="mt-2">
        <div class="text-sm font-semibold mb-1">Who owes how much</div>
        {#each splitParticipants as u}
          <div class="flex items-center gap-2 py-1">
            <span class="w-28 text-sm opacity-80">{u.username}</span>
            <input type="number" min="0" step="0.01" class="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={splitByUserId[u.id]} on:input={(e) => splitByUserId[u.id] = (e.target as HTMLInputElement).value} />
          </div>
        {/each}
        <div class="text-xs opacity-70 mt-1">Total splits: ${sumStrings(splitByUserId).toFixed(2)}</div>
      </div>

      <button class="w-full py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addExpense} disabled={addDisabled}>Add</button>
    </div>

    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
      <h3 class="font-semibold">AI expense entry</h3>
      <textarea class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" rows="3" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
      <button class="w-full py-2 rounded-lg bg-purple-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={aiParse} disabled={!aiInput.trim()}>Parse & Add</button>
      <p class="text-xs opacity-70">Example: "I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip."</p>
    </div>

    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
      <h3 class="font-semibold">Add member</h3>
      <div class="flex gap-2">
        <input class="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Username" bind:value={memberUsername} />
        <button class="px-4 rounded-lg bg-gray-700 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addMember} disabled={!memberUsername.trim()}>Add</button>
      </div>
    </div>
  </div>
</div>
