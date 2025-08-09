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
  // Users to show in balances (members + me + expense creators)
  let balanceUsers: { id: string; username: string }[] = [];

  // manual form
  let description = '';
  let amount = '';
  let category = '';
  let expenseType = '';
  let payerUserId: string = '';
  let splitByUserId: Record<string, string> = {}; // userId -> amount string
  let paidByUserId: Record<string, string> = {};  // userId -> amount string

  // Modes and percentage storage
  type SplitMode = 'equal' | 'custom_amounts' | 'custom_percentages';
  type PaymentMode = 'payer' | 'equal' | 'custom_amounts' | 'custom_percentages';
  let splitMode: SplitMode = 'equal';
  let paymentMode: PaymentMode = 'payer';
  let splitPctByUserId: Record<string, string> = {}; // userId -> percentage string (0-100)
  let paidPctByUserId: Record<string, string> = {};  // userId -> percentage string (0-100)

  // AI form
  let aiInput = '';

  // member form
  let memberUsername = '';
  let userSuggestions: { id: string; username: string; email?: string | null }[] = [];
  let searchingUsers = false;
  let userSearchTimer: any = null;

  function onMemberInput() {
    // Debounce search
    if (userSearchTimer) clearTimeout(userSearchTimer);
    const q = memberUsername.trim();
    if (!q) {
      userSuggestions = [];
      return;
    }
    userSearchTimer = setTimeout(async () => {
      try {
        searchingUsers = true;
        const res = await api(`/users/search?q=${encodeURIComponent(q)}&excludeTripId=${encodeURIComponent(tripId)}`);
        userSuggestions = (res.users || []) as { id: string; username: string; email?: string | null }[];
      } catch (e) {
        // ignore errors in suggest UI
      } finally {
        searchingUsers = false;
      }
    }, 250);
  }

  async function selectUserSuggestion(u: { id: string; username: string }) {
    memberUsername = u.username;
    userSuggestions = [];
    await addMember();
  }

  function centsToString(c: number) { return (c / 100).toFixed(2); }
  function sumStrings(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  function sumPercents(obj: Record<string, string>): number {
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

  // Enrich balances user list so section isn't empty when trip has no members yet
  $: balanceUsers = (() => {
    const byId = new Map<string, { id: string; username: string }>();
    for (const m of members) byId.set(m.user.id, m.user);
    if (me) byId.set(me.id, { id: me.id, username: me.username });
    for (const e of expenses) byId.set(e.createdBy.id, e.createdBy);
    return Array.from(byId.values());
  })();

  // Current user specific stats
  $: myPaidCents = (me && expenses.length)
    ? expenses.reduce((sum, e) => {
        if (e.payments && e.payments.length > 0) {
          const mine = e.payments.filter((p) => p.userId === me!.id).reduce((s, p) => s + p.amountCents, 0);
          return sum + mine;
        }
        return sum + (e.createdBy.id === me!.id ? e.amountCents : 0);
      }, 0)
    : 0;
  $: mySplitCents = (me && expenses.length)
    ? expenses.reduce((sum, e) => sum + (e.splits.find((s) => s.userId === me!.id)?.amountCents || 0), 0)
    : 0;
  $: myCreatedCount = (me && expenses.length)
    ? expenses.filter((e) => e.createdBy.id === me!.id).length
    : 0;
  $: myLargestExpense = (me && expenses.length)
    ? expenses
        .filter((e) => e.createdBy.id === me!.id)
        .reduce<{ amount: number; description: string } | null>((acc, e) => {
          if (!acc || e.amountCents > acc.amount) return { amount: e.amountCents, description: e.description };
          return acc;
        }, null)
    : null;
  $: myTopCategory = (me && expenses.length)
    ? (() => {
        const totals = new Map<string, number>();
        for (const e of expenses) {
          if (e.createdBy.id !== me!.id) continue;
          const key = e.expenseType || e.category || 'Uncategorized';
          totals.set(key, (totals.get(key) || 0) + e.amountCents);
        }
        let top: { key: string; amount: number } | null = null;
        for (const [key, amount] of totals.entries()) {
          if (!top || amount > top.amount) top = { key, amount };
        }
        return top?.key || null;
      })()
    : null;

  $: addDisabled = (
    !tripId ||
    description.trim().length === 0 ||
    Number(amount) <= 0 ||
    // split percentages validation removed since split UI is hidden
    (paymentMode === 'custom_percentages' && sumPercents(paidPctByUserId) < 99.999)
  );
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
      // Initialize equal split among splitParticipants and default payment by payer
      initializeAllocations();
    } catch (e: any) {
      error = e.message;
    }
  }

  function onAmountChange() {
    recalcSplits();
    recalcPayments();
  }

  function onPayerChange() {
    if (paymentMode === 'payer') {
      const total = Number(amount) || 0;
      const idsForPayments = payerOptions.map((u) => u.id);
      paidByUserId = Object.fromEntries(
        idsForPayments.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0'])
      );
    }
  }

  function validTotals(): string | null {
    const total = Number(amount) || 0;
    const splitSum = sumStrings(splitByUserId);
    const paidSum = sumStrings(paidByUserId);
    // split percentages validation removed since split UI is hidden
    if (paymentMode === 'custom_percentages' && sumPercents(paidPctByUserId) < 99.999) return `Payment percentages must sum to 100%`;
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

  // ----- Allocation helpers (amounts/percentages) -----
  function initializeAllocations() {
    const total = Number(amount) || 0;
    const participantIds = splitParticipants.map((u) => u.id);
    // Split equal by default
    if (participantIds.length > 0 && total > 0) {
      const equalPct = (100 / participantIds.length).toFixed(2);
      splitPctByUserId = Object.fromEntries(participantIds.map((id) => [id, equalPct]));
      splitMode = 'equal';
      splitByUserId = allocateByPercent(total, splitPctByUserId, participantIds);
    } else {
      splitPctByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
      splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
    }
    // Payments: default payer covers all
    const idsForPayments = payerOptions.map((u) => u.id);
    paidPctByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? '100' : '0']));
    paymentMode = 'payer';
    paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0']));
  }

  function allocateByPercent(totalAmount: number, pctMap: Record<string, string>, orderedUserIds: string[]): Record<string, string> {
    const totalCents = Math.round((totalAmount || 0) * 100);
    const entries = orderedUserIds.map((id) => {
      const pct = Math.max(0, Number(pctMap[id] || 0));
      const raw = (totalCents * pct) / 100;
      const floorCents = Math.floor(raw);
      const frac = raw - floorCents;
      return { id, floorCents, frac };
    });
    let allocated = entries.reduce((s, e) => s + e.floorCents, 0);
    let remainder = totalCents - allocated;
    // Distribute remaining cents to largest fractional parts
    entries.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < entries.length && remainder > 0; i++) {
      entries[i].floorCents += 1;
      remainder -= 1;
    }
    // Back to dollars strings
    const result: Record<string, string> = {};
    for (const e of entries) {
      result[e.id] = (e.floorCents / 100).toFixed(2);
    }
    return result;
  }

  function recalcSplits() {
    const total = Number(amount) || 0;
    const ids = splitParticipants.map((u) => u.id);
    if (splitMode === 'equal') {
      const equalPct = ids.length > 0 ? (100 / ids.length) : 0;
      splitPctByUserId = Object.fromEntries(ids.map((id) => [id, equalPct.toFixed(2)]));
      splitByUserId = allocateByPercent(total, splitPctByUserId, ids);
    } else if (splitMode === 'custom_percentages') {
      splitByUserId = allocateByPercent(total, splitPctByUserId, ids);
    } // custom_amounts: keep current splitByUserId as-is
  }

  function recalcPayments() {
    const total = Number(amount) || 0;
    const ids = payerOptions.map((u) => u.id);
    if (paymentMode === 'payer') {
      paidByUserId = Object.fromEntries(ids.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0']));
      paidPctByUserId = Object.fromEntries(ids.map((id) => [id, id === payerUserId ? '100' : '0']));
    } else if (paymentMode === 'equal') {
      const equalPct = ids.length > 0 ? (100 / ids.length) : 0;
      paidPctByUserId = Object.fromEntries(ids.map((id) => [id, equalPct.toFixed(2)]));
      paidByUserId = allocateByPercent(total, paidPctByUserId, ids);
    } else if (paymentMode === 'custom_percentages') {
      paidByUserId = allocateByPercent(total, paidPctByUserId, ids);
    } // custom_amounts: keep current paidByUserId as-is
  }

  function onSplitModeChange(e: Event) {
    splitMode = (e.target as HTMLSelectElement).value as SplitMode;
    recalcSplits();
  }

  function onPaymentModeChange(e: Event) {
    paymentMode = (e.target as HTMLSelectElement).value as PaymentMode;
    recalcPayments();
  }

  // Clamp and auto-balance percent entries so they never exceed 100 total. We only block submit on <100 per request.
  function clampPercent(value: string): string {
    const n = Number(value);
    if (!isFinite(n) || n < 0) return '0';
    return Math.min(100, n).toFixed(2);
  }

  function onSplitPercentInput(userId: string, value: string) {
    splitPctByUserId[userId] = clampPercent(value);
    // Optional: cap group sum to 100 by scaling down others if it exceeds
    const total = sumPercents(splitPctByUserId);
    if (total > 100.0001) {
      const ids = splitParticipants.map((u) => u.id);
      const over = total - 100;
      for (const id of ids) {
        if (id === userId) continue;
        const curr = Math.max(0, Number(splitPctByUserId[id] || 0));
        if (curr <= 0) continue;
        const reduceBy = Math.min(curr, over);
        splitPctByUserId[id] = (curr - reduceBy).toFixed(2);
        break;
      }
    }
    recalcSplits();
  }

  function onPaidPercentInput(userId: string, value: string) {
    paidPctByUserId[userId] = clampPercent(value);
    const total = sumPercents(paidPctByUserId);
    if (total > 100.0001) {
      const ids = payerOptions.map((u) => u.id);
      const over = total - 100;
      for (const id of ids) {
        if (id === userId) continue;
        const curr = Math.max(0, Number(paidPctByUserId[id] || 0));
        if (curr <= 0) continue;
        const reduceBy = Math.min(curr, over);
        paidPctByUserId[id] = (curr - reduceBy).toFixed(2);
        break;
      }
    }
    recalcPayments();
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
      const res = await api(`/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ username: memberUsername }) });
      if (res?.members) {
        members = res.members as Member[];
      }
      memberUsername = '';
      userSuggestions = [];
      success = 'Member added.';
      setTimeout(() => { success = null; }, 3000);
    } catch (e: any) {
      error = e.message;
    }
  }

  // Balance summary (who owes whom)
  function computeBalances() {
    const userIds = balanceUsers.map((u) => u.id);
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

  function displayName(userId: string): string {
    const u = balanceUsers.find((x) => x.id === userId);
    if (u) return u.username;
    if (me && userId === me.id) return me.username;
    return 'Unknown';
  }
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
    <div class="text-sm grid md:grid-cols-3 gap-6">
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
      <div>
        <div class="opacity-70 mb-1">Your activity</div>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span>Paid</span>
            <span class="tabular-nums">${centsToString(myPaidCents)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Your share</span>
            <span class="tabular-nums">${centsToString(mySplitCents)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Net</span>
            <span class="tabular-nums {myPaidCents - mySplitCents >= 0 ? 'text-green-600' : 'text-red-600'}">${centsToString(Math.abs(myPaidCents - mySplitCents))}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Created</span>
            <span class="tabular-nums">{myCreatedCount}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Largest expense</span>
            <span class="tabular-nums">{myLargestExpense ? `$${centsToString(myLargestExpense.amount)}` : '—'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Top category</span>
            <span>{myTopCategory || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="grid md:grid-cols-4 lg:grid-cols-5 gap-6 mt-2">
  <div class="md:col-span-2 lg:col-span-3 space-y-4">
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
  <div class="md:col-span-2 lg:col-span-2 space-y-4">
    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-4">
      <h3 class="font-semibold">Add expense (manual)</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Description" bind:value={description} />
        <input type="number" min="0" step="0.01" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Amount" bind:value={amount} on:change={onAmountChange} />
      </div>

      <div>
        <label class="text-xs opacity-70 block mb-1" for="payer-select">Payer</label>
        <select id="payer-select" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={payerUserId} on:change={onPayerChange}>
          {#each payerOptions as u}
            <option value={u.id}>{u.username}</option>
          {/each}
        </select>
      </div>

      <div class="mt-1">
        <div class="flex items-center justify-between mb-1">
          <div class="text-sm font-semibold">Who pays how much</div>
          <select class="text-xs p-1 rounded-md bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10" bind:value={paymentMode} on:change={onPaymentModeChange}>
            <option value="payer">Payer covers all</option>
            <option value="equal">Split equally</option>
            <option value="custom_percentages">Custom percentages</option>
            <option value="custom_amounts">Custom amounts</option>
          </select>
        </div>
        <div class="space-y-1.5">
        {#each payerOptions as u}
          <div class="flex items-center gap-2 py-0.5 min-w-0">
            <span class="w-28 text-sm opacity-80">{u.username}</span>
            {#if paymentMode === 'custom_percentages'}
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <input type="number" min="0" max="100" step="0.01" class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidPctByUserId[u.id]} on:input={(e) => onPaidPercentInput(u.id, (e.target as HTMLInputElement).value)} />
                <span class="text-sm opacity-70">%</span>
                <div class="w-full min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{paidByUserId[u.id]}</div>
              </div>
            {:else if paymentMode === 'equal' || paymentMode === 'payer'}
              <div class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{paidByUserId[u.id]}</div>
            {:else}
              <input type="number" min="0" step="0.01" class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidByUserId[u.id]} on:input={(e) => paidByUserId[u.id] = (e.target as HTMLInputElement).value} />
            {/if}
          </div>
        {/each}
        </div>
        <div class="text-xs opacity-70 mt-1">Total payments: ${sumStrings(paidByUserId).toFixed(2)}</div>
      </div>

      

      <button class="w-full py-2.5 rounded-lg bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addExpense} disabled={addDisabled}>Add</button>
    </div>

    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
      <h3 class="font-semibold">AI expense entry</h3>
      <textarea class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" rows="3" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
      <button class="w-full py-2 rounded-lg bg-purple-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={aiParse} disabled={!aiInput.trim()}>Parse & Add</button>
      <p class="text-xs opacity-70">Example: "I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip."</p>
    </div>

    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
      <h3 class="font-semibold">Add member</h3>
      <div class="relative">
        <div class="flex gap-2">
          <input class="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Search by username or email" bind:value={memberUsername} on:input={onMemberInput} />
          <button class="px-4 rounded-lg bg-gray-700 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addMember} disabled={!memberUsername.trim()}>Add</button>
        </div>
        {#if memberUsername.trim().length > 0}
          <div class="absolute left-0 right-0 mt-1 rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 shadow z-10">
            {#if searchingUsers}
              <div class="p-3 text-sm opacity-70">Searching…</div>
            {:else if userSuggestions.length === 0}
              <div class="p-3 text-sm opacity-70">No matches</div>
            {:else}
              <ul class="max-h-56 overflow-auto divide-y divide-gray-200/70 dark:divide-gray-700/50">
                {#each userSuggestions as u}
                  <li>
                    <button class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center justify-between gap-3" on:click={() => selectUserSuggestion(u)}>
                      <span class="truncate">
                        <span class="font-medium">{u.username}</span>
                        {#if u.email}
                          <span class="ml-2 text-xs opacity-70">{u.email}</span>
                        {/if}
                      </span>
                      <span class="text-xs rounded-full px-2 py-0.5 border border-black/5 dark:border-white/10">Add</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
