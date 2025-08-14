<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { Member, User, SplitMode, PaymentMode } from '../lib/types';
  import { showError, showSuccess } from '../lib/alerts';
  import { currencies } from '../lib/constants/currencies';
  import { categories as predefinedCategories } from '../lib/constants/categories';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let members: Member[] = [];
  let baseCurrency: string = 'EUR';

  // form state
  let description = '';
  let amount = '';
  let category = '';
  let expenseCurrency: string = 'EUR';
  let incurredAtInput = '';
  let incurredAtEl: HTMLInputElement | null = null;

  let payerUserId: string = '';
  let splitMode: SplitMode = 'equal';
  let paymentMode: PaymentMode = 'payer';
  let splitByUserId: Record<string, string> = {};
  let paidByUserId: Record<string, string> = {};
  let paidPctByUserId: Record<string, string> = {};
  let splitPctByUserId: Record<string, string> = {};
  let paidCurrencyByUserId: Record<string, string> = {};
  let selectedSplitUserIdMap: Record<string, boolean> = {};
  let aiInput = '';

  // Visualization helpers for compact allocation preview (payments)
  const colorPalette: string[] = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f472b6', '#a855f7', '#f97316', '#22d3ee'];
  function userColor(userId: string): string {
    const idx = payerOptions.findIndex((u) => u.id === userId);
    const i = idx >= 0 ? idx : 0;
    return colorPalette[i % colorPalette.length];
  }
  type Segment = { id: string; name: string; pct: number; color: string };
  $: paysSegments = (() => {
    const total = Number(amount) || 0;
    const ids = payerOptions.map((u) => u.id);
    if (!total || ids.length === 0) return [] as Segment[];
    const list: Segment[] = [];
    for (const u of payerOptions) {
      const val = Math.max(0, Number(paidByUserId[u.id] || 0));
      if (val <= 0) continue;
      const pct = (val * 100) / total;
      list.push({ id: u.id, name: u.username, pct, color: userColor(u.id) });
    }
    const sum = list.reduce((s, x) => s + x.pct, 0);
    if (sum > 0 && Math.abs(sum - 100) > 0.01) {
      const factor = 100 / sum;
      for (const s of list) s.pct *= factor;
    }
    return list;
  })();

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;

  $: payerOptions = (() => {
    const list = [...members.map((m) => m.user)];
    if (me && !list.find((u) => u.id === me!.id)) list.unshift({ id: me.id, username: me.username });
    return list;
  })();

  $: splitCandidates = (() => {
    let users: { id: string; username: string }[] = [];
    if (members.length > 0) users = members.map((m) => m.user);
    else if (me) users = [{ id: me.id, username: me.username }];
    const filtered = users.filter((u) => u.id !== payerUserId);
    return (filtered.length > 0 ? filtered : (users.length > 0 ? [users[0]] : [])) as { id: string; username: string }[];
  })();

  $: splitParticipants = (() => {
    const selected = splitCandidates.filter((u) => selectedSplitUserIdMap[u.id]);
    return selected.length > 0 ? selected : splitCandidates;
  })();

  function nowLocalDatetime(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function sumStrings(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
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
    entries.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < entries.length && remainder > 0; i++) {
      entries[i].floorCents += 1;
      remainder -= 1;
    }
    const result: Record<string, string> = {};
    for (const e of entries) result[e.id] = (e.floorCents / 100).toFixed(2);
    return result;
  }

  function clampPercent(value: string): string {
    const n = Number(value);
    if (!isFinite(n) || n < 0) return '0';
    return Math.min(100, n).toFixed(2);
  }

  function onAmountChange() {
    const total = Number(amount) || 0;
    const ids = splitParticipants.map((u) => u.id);
    if (ids.length > 0) {
      const per = total / ids.length || 0;
      splitByUserId = Object.fromEntries(ids.map((id) => [id, per.toFixed(2)]));
    }
    recalcPayments();
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
      paidByUserId = allocateByPercent(Number(amount) || 0, paidPctByUserId, ids);
    } else if (paymentMode === 'custom_percentages') {
      paidByUserId = allocateByPercent(total, paidPctByUserId, ids);
    }
    for (const id of ids) { if (!paidCurrencyByUserId[id]) paidCurrencyByUserId[id] = expenseCurrency; }
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
    }
    for (const u of payerOptions) {
      if (!selectedSplitUserIdMap[u.id]) {
        splitByUserId[u.id] = '0';
        splitPctByUserId[u.id] = '0';
      }
    }
  }

  function onPayerChange() {
    recalcPayments();
    const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
    const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
    selectedSplitUserIdMap = Object.fromEntries(participantIds.map((id) => [id, true]));
    recalcSplits();
  }

  function onToggleSplitUser(userId: string) {
    selectedSplitUserIdMap[userId] = !selectedSplitUserIdMap[userId];
    if (!selectedSplitUserIdMap[userId]) {
      splitByUserId[userId] = '0';
      splitPctByUserId[userId] = '0';
    }
    recalcSplits();
  }

  function onSplitPercentInput(userId: string, value: string) {
    splitPctByUserId[userId] = clampPercent(value);
    const total = Object.values(splitPctByUserId).reduce((s, v) => s + (Number(v) || 0), 0);
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
    const total = Object.values(paidPctByUserId).reduce((s, v) => s + (Number(v) || 0), 0);
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

  function validTotals(): string | null {
    const total = Number(amount) || 0;
    const splitSum = sumStrings(Object.fromEntries(Object.entries(splitByUserId).filter(([id]) => selectedSplitUserIdMap[id])));
    const paidSum = sumStrings(paidByUserId);
    if (Math.round(splitSum * 100) !== Math.round(total * 100)) return `Splits must sum to ${total.toFixed(2)}`;
    if (Math.round(paidSum * 100) !== Math.round(total * 100)) return `Payments must sum to ${total.toFixed(2)}`;
    return null;
  }

  async function addExpense() {
    const amountNum = Number(amount);
    if (!tripId) { showError('No trip selected.'); return; }
    if (!description.trim() || !(amountNum > 0)) { showError('Enter description and a positive amount.'); return; }
    recalcSplits();
    recalcPayments();
    const totalsError = validTotals();
    if (totalsError) { showError(totalsError); return; }
    try {
      const splits = Object.entries(splitByUserId)
        .filter(([userId]) => selectedSplitUserIdMap[userId])
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((s) => s.amount > 0);
      let payments = Object.entries(paidByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0, currency: (paidCurrencyByUserId[userId] || expenseCurrency).toUpperCase() }))
        .filter((p) => p.amount > 0);
      if (payments.length === 0 && payerUserId && amountNum > 0) {
        payments = [{ userId: payerUserId, amount: amountNum, currency: expenseCurrency.toUpperCase() }];
      }
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          description: description.trim(),
          amount: amountNum,
          category: category || undefined,
          incurredAt: incurredAtInput ? new Date(incurredAtInput).toISOString() : undefined,
          payerUserId,
          splits,
          payments,
          currency: expenseCurrency.toUpperCase(),
        })
      });
      showSuccess('Expense added successfully.');
      window.location.hash = `#/trip/${tripId}`;
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function load() {
    try {
      const membersRes = await api(`/trips/${tripId}/members`);
      members = membersRes.members as Member[];
      baseCurrency = (membersRes.baseCurrency || 'EUR').toUpperCase();
      if (membersRes.owner) {
        const ownerUser = membersRes.owner as { id: string; username: string };
        if (!members.find((m) => m.user.id === ownerUser.id)) {
          members = [{ user: ownerUser }, ...members];
        }
      }
      payerUserId = me?.id || (members[0]?.user.id ?? '');
      const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
      const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
      selectedSplitUserIdMap = Object.fromEntries(participantIds.map((id) => [id, true]));
      if (participantIds.length > 0 && Number(amount) > 0) {
        const per = Number(amount) / participantIds.length;
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, per.toFixed(2)]));
      } else {
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
      }
      const idsForPayments = payerOptions.map((u) => u.id);
      paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? (Number(amount) || 0).toFixed(2) : '0']));
      paidCurrencyByUserId = Object.fromEntries(idsForPayments.map((id) => [id, expenseCurrency]));
    } catch (e: any) {
      showError(e.message);
    }
  }

  onMount(() => {
    incurredAtInput = nowLocalDatetime();
    if (tripId) load();
  });
</script>

<div class="mb-3">
  <a href={`#/trip/${tripId}`} class="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur px-3 py-1.5 shadow-sm hover:shadow transition">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>
    <span class="text-sm">Back to trip</span>
  </a>
</div>

<section class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold">Add expense</h2>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Description" bind:value={description} />
    <input type="number" min="0" step="0.01" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Amount" bind:value={amount} on:change={onAmountChange} />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div class="flex items-center gap-2">
      <input type="datetime-local" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={incurredAtInput} bind:this={incurredAtEl} />
      <button type="button" class="px-3 py-2 rounded-lg border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60" on:click={() => { try { (incurredAtEl as any)?.showPicker?.(); } catch {} incurredAtEl?.focus(); }} aria-label="Pick date and time">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </button>
    </div>
    <div>
      <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Category (optional)" bind:value={category} list="category-options" />
      <datalist id="category-options">
        {#each predefinedCategories as c}
          <option value={c}></option>
        {/each}
      </datalist>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="text-xs opacity-70 block mb-1" for="payer-select">Payer</label>
      <select id="payer-select" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={payerUserId} on:change={onPayerChange}>
        {#each payerOptions as u}
          <option value={u.id}>{u.username}</option>
        {/each}
      </select>
    </div>
    <div>
      <label class="text-xs opacity-70 block mb-1" for="expense-currency-select">Expense currency</label>
      <select id="expense-currency-select" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={expenseCurrency}>
        {#each currencies as c}
          <option value={c}>{c}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="mt-2">
    <div class="mb-2">
      <div class="text-sm font-semibold mb-1">Split among</div>
      <div class="flex flex-wrap gap-2">
        {#each splitCandidates as u}
          {#key selectedSplitUserIdMap[u.id]}
            <button type="button"
              aria-pressed={!!selectedSplitUserIdMap[u.id]}
              class={`inline-flex items-center gap-1 text-sm rounded-full px-3 py-1.5 transition border
                ${selectedSplitUserIdMap[u.id]
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                  : 'bg-white/80 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 border-black/5 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
              on:click={() => onToggleSplitUser(u.id)}>
              {#if selectedSplitUserIdMap[u.id]}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
              {/if}
              <span>{u.username}</span>
            </button>
          {/key}
        {/each}
      </div>
    </div>

    <div class="flex items-center justify-between mb-1">
      <div class="text-sm font-semibold">Who pays how much</div>
      <select class="text-xs p-1 rounded-md bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10" bind:value={paymentMode} on:change={() => recalcPayments()}>
        <option value="payer">Payer covers all</option>
        <option value="equal">Split equally</option>
        <option value="custom_percentages">Custom percentages</option>
        <option value="custom_amounts">Custom amounts</option>
      </select>
    </div>
    {#if paymentMode === 'custom_percentages' || paymentMode === 'custom_amounts'}
      <div class="space-y-1.5">
        {#each payerOptions as u}
          <div class="flex items-center gap-2 py-0.5 min-w-0">
            <span class="w-28 text-sm opacity-80">{u.username}</span>
            {#if paymentMode === 'custom_percentages'}
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <input type="number" min="0" max="100" step="0.01" class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidPctByUserId[u.id]} on:input={(e) => onPaidPercentInput(u.id, (e.target as HTMLInputElement).value)} />
                <span class="text-sm opacity-70">%</span>
                <div class="w-full min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{paidByUserId[u.id]}</div>
                <select class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidCurrencyByUserId[u.id]}>
                  {#each currencies as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </div>
            {:else}
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <input type="number" min="0" step="0.01" class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidByUserId[u.id]} on:input={(e) => paidByUserId[u.id] = (e.target as HTMLInputElement).value} />
                <select class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={paidCurrencyByUserId[u.id]}>
                  {#each currencies as c}
                    <option value={c}>{c}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    <div class="text-xs opacity-70 mt-1">Total payments: ${sumStrings(paidByUserId).toFixed(2)}</div>
    {#if Number(amount) > 0}
      <div class="mt-2 space-y-2">
        <div class="text-xs opacity-70">Who pays</div>
        <div class="w-full h-3 rounded-full overflow-hidden border border-black/5 dark:border-white/10 bg-white/60 dark:bg-gray-800/50">
          <div class="flex h-full w-full">
            {#each paysSegments as s}
              <div title={`${s.name} ${s.pct.toFixed(0)}%`} style={`width:${s.pct}%;background-color:${s.color}`}></div>
            {/each}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          {#each paysSegments as s}
            <div class="inline-flex items-center gap-1 text-xs opacity-80">
              <span class="inline-block w-2.5 h-2.5 rounded-sm" style={`background-color:${s.color}`}></span>
              <span class="truncate max-w-[8rem]">{s.name}</span>
              <span class="tabular-nums">{s.pct.toFixed(0)}%</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-end gap-2 pt-2">
    <a href={`#/trip/${tripId}`} class="px-3 py-2 rounded-lg border border-black/5 dark:border-white/10">Cancel</a>
    <button class="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addExpense} disabled={addDisabled}>Add expense</button>
  </div>
</section>

<section class="mt-4 rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-3">
  <h3 class="font-semibold">AI expense entry</h3>
  <textarea class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" rows="3" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
  <button class="w-full py-2 rounded-lg bg-purple-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={async () => {
    try {
      const res = await api('/ai/parse', { method: 'POST', body: JSON.stringify({ input: aiInput }) });
      if (res.expense?.tripId === tripId) {
        showSuccess('Expense added from AI.');
        window.location.hash = `#/trip/${tripId}`;
      } else {
        showSuccess('AI parsed. Check your trip expenses.');
        window.location.hash = `#/trip/${tripId}`;
      }
      aiInput = '';
    } catch (e: any) {
      showError(e.message);
    }
  }} disabled={!aiInput.trim()}>Parse & Add</button>
  <p class="text-xs opacity-70">Example: "I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip."</p>
</section>


