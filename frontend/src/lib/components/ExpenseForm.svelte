<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Member, SplitMode, PaymentMode } from '../types';
  import { currencies } from '../constants/currencies';
  import { categories as predefinedCategories } from '../constants/categories';

  export let tripId: string;
  export let members: Member[] = [];
  export let me: { id: string; username: string } | null = null;

  // Form data
  export let description = '';
  export let amount = '';
  export let category = '';
  export let expenseCurrency: string = 'EUR';
  export let incurredAtInput = '';
  export let payerUserId: string = '';
  export let splitMode: SplitMode = 'equal';
  export let paymentMode: PaymentMode = 'payer';
  export let splitByUserId: Record<string, string> = {};
  export let paidByUserId: Record<string, string> = {};
  export let paidPctByUserId: Record<string, string> = {};
  export let splitPctByUserId: Record<string, string> = {};
  export let paidCurrencyByUserId: Record<string, string> = {};
  export let selectedSplitUserIdMap: Record<string, boolean> = {};

  // Receipt handling (optional)
  export let receiptPreviewUrl: string | null = null;
  export let receiptFile: File | null = null;
  export let showReceiptUpload = false;
  export let scanning = false;

  // Button labels
  export let submitLabel = 'Save';
  export let cancelHref = '';
  export let disabled = false;

  const dispatch = createEventDispatcher<{
    submit: void;
    receiptPick: void;
    receiptScan: void;
    receiptChange: Event;
  }>();

  let incurredAtEl: HTMLInputElement | null = null;
  let receiptInputEl: HTMLInputElement | null = null;

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

  function sumStrings(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  }

  function clampPercent(value: string): string {
    const n = Number(value);
    if (!isFinite(n) || n < 0) return '0';
    return Math.min(100, n).toFixed(2);
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
    for (const e of entries) {
      result[e.id] = (e.floorCents / 100).toFixed(2);
    }
    return result;
  }

  export function recalcPayments() {
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
    // Ensure all users have currency set
    for (const id of ids) { 
      if (!paidCurrencyByUserId[id]) paidCurrencyByUserId[id] = expenseCurrency; 
    }
  }

  export function recalcSplits() {
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

  function onAmountChange() {
    const total = Number(amount) || 0;
    
    // Recalculate payments based on current mode
    recalcPayments();
    
    // For splits, maintain existing distribution if in percentage mode
    // or equal distribution in equal mode, but recalculate for new total
    if (splitMode === 'equal') {
      recalcSplits();
    } else if (splitMode === 'custom_percentages') {
      // Keep existing percentages, recalculate amounts
      recalcSplits();
    } else {
      // For custom amounts, try to maintain proportions if possible
      const ids = splitParticipants.map((u) => u.id);
      const currentSum = sumStrings(Object.fromEntries(Object.entries(splitByUserId).filter(([id]) => selectedSplitUserIdMap[id])));
      
      if (currentSum > 0 && total > 0) {
        // Scale existing splits proportionally
        const scaleFactor = total / currentSum;
        for (const id of ids) {
          if (selectedSplitUserIdMap[id]) {
            const currentAmount = Number(splitByUserId[id] || '0');
            splitByUserId[id] = (currentAmount * scaleFactor).toFixed(2);
          }
        }
      } else {
        // Fall back to equal distribution
        if (ids.length > 0) {
          const per = total / ids.length || 0;
          splitByUserId = Object.fromEntries(ids.map((id) => [id, per.toFixed(2)]));
        }
      }
    }
  }

  function onPayerChange() {
    // Store current payment mode to maintain it after recalculation
    const currentMode = paymentMode;
    
    // If we're in payer mode, just recalculate normally
    if (currentMode === 'payer') {
      recalcPayments();
    } else {
      // For other modes, we need to maintain the same payment distribution
      // but adjust to ensure totals match
      const total = Number(amount) || 0;
      const ids = payerOptions.map((u) => u.id);
      
      // Keep existing percentages/amounts and just normalize to total
      if (currentMode === 'equal') {
        // Redistribute equally among all payers
        const equalPct = ids.length > 0 ? (100 / ids.length) : 0;
        paidPctByUserId = Object.fromEntries(ids.map((id) => [id, equalPct.toFixed(2)]));
        paidByUserId = allocateByPercent(total, paidPctByUserId, ids);
      } else if (currentMode === 'custom_percentages') {
        // Keep existing percentages and recalculate amounts
        paidByUserId = allocateByPercent(total, paidPctByUserId, ids);
      } else if (currentMode === 'custom_amounts') {
        // Normalize existing amounts to sum to total
        const currentSum = sumStrings(paidByUserId);
        if (currentSum > 0) {
          const scaleFactor = total / currentSum;
          for (const id of ids) {
            const currentAmount = Number(paidByUserId[id] || '0');
            paidByUserId[id] = (currentAmount * scaleFactor).toFixed(2);
          }
        } else {
          // Fall back to payer pays all if no existing amounts
          paidByUserId = Object.fromEntries(ids.map((id) => [id, id === payerUserId ? total.toFixed(2) : '0']));
        }
      }
      
      // Ensure all users have currency set after payment adjustments
      for (const id of ids) { 
        if (!paidCurrencyByUserId[id]) paidCurrencyByUserId[id] = expenseCurrency; 
      }
    }
    
    // Update split participants (exclude new payer from owing)
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

  function openDatePicker() {
    try {
      (incurredAtEl as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.();
    } catch (e) {}
    incurredAtEl?.focus();
  }

  function onPickReceipt() {
    dispatch('receiptPick');
    receiptInputEl?.click();
  }

  function onReceiptChange(e: Event) {
    dispatch('receiptChange', e);
  }

  function onScanReceipt() {
    dispatch('receiptScan');
  }

  function handleSubmit() {
    dispatch('submit');
  }
</script>

<div class="grid lg:grid-cols-4 gap-6 items-stretch">
  <div class="lg:col-span-3 space-y-4 h-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Description" bind:value={description} />
      <input type="number" min="0" step="0.01" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Amount" bind:value={amount} on:change={onAmountChange} />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="flex items-center gap-2">
        <input type="datetime-local" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={incurredAtInput} bind:this={incurredAtEl} />
        <button type="button" class="px-3 py-2 rounded-lg border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60" on:click={openDatePicker} aria-label="Pick date and time">
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
      <div class="text-xs opacity-70 mt-1">Total payments: {sumStrings(paidByUserId).toFixed(2)}</div>
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

      <!-- Hiding Who owes -how much for now -->
    
      <!-- 
      <div class="mt-3">
        <div class="text-sm font-semibold mb-1">Who owes how much</div>
        <select class="text-xs p-1 rounded-md bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 mb-2" bind:value={splitMode} on:change={() => recalcSplits()}>
          <option value="equal">Split equally</option>
          <option value="custom_percentages">Custom percentages</option>
          <option value="custom_amounts">Custom amounts</option>
        </select>
        {#if splitMode === 'custom_percentages' || splitMode === 'custom_amounts'}
          <div class="space-y-1.5">
            {#each payerOptions as u}
              {#if selectedSplitUserIdMap[u.id]}
                <div class="flex items-center gap-2 py-0.5 min-w-0">
                  <span class="w-28 text-sm opacity-80">{u.username}</span>
                  {#if splitMode === 'custom_percentages'}
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <input type="number" min="0" max="100" step="0.01" class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={splitPctByUserId[u.id]} on:input={(e) => onSplitPercentInput(u.id, (e.target as HTMLInputElement).value)} />
                      <span class="text-sm opacity-70">%</span>
                      <div class="w-full min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{splitByUserId[u.id] || '0.00'}</div>
                    </div>
                  {:else}
                    <input type="number" min="0" step="0.01" class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={splitByUserId[u.id]} />
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="space-y-1.5">
            {#each payerOptions as u}
              {#if selectedSplitUserIdMap[u.id]}
                <div class="flex items-center gap-2 py-0.5 min-w-0">
                  <span class="w-28 text-sm opacity-80">{u.username}</span>
                  <div class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{splitByUserId[u.id] || '0.00'}</div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        <div class="text-xs opacity-70 mt-1">Total splits: {sumStrings(Object.fromEntries(Object.entries(splitByUserId).filter(([id]) => selectedSplitUserIdMap[id]))).toFixed(2)}</div>
      </div> -->
    </div>
  </div>

  {#if showReceiptUpload}
  <div class="lg:col-span-1">
    <div class="h-full">
      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-gray-800/50 overflow-hidden h-full">
        <div class="relative w-full h-full group">
          {#if receiptPreviewUrl}
            <img src={receiptPreviewUrl} alt="Receipt preview" class="absolute inset-0 w-full h-full object-contain bg-white dark:bg-gray-900" />
            <button type="button" class="absolute top-2 right-2 px-3 py-1.5 text-xs rounded-full bg-white/90 dark:bg-gray-800/90 border border-black/5 dark:border-white/10 shadow hover:shadow" on:click={onScanReceipt} disabled={!receiptFile || scanning}>
              {#if scanning}<span>Scanning…</span>{:else}<span>Scan</span>{/if}
            </button>
          {:else}
            <button type="button" class="absolute inset-0 flex items-center justify-center" on:click={onPickReceipt} aria-label="Pick receipt">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-20">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
            </button>
          {/if}
          <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" bind:this={receiptInputEl} on:change={onReceiptChange} />
        </div>
      </div>
    </div>
  </div>
  {:else}
  <div class="lg:col-span-1">
    <div class="h-full">
      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-gray-800/50 overflow-hidden h-full relative">
        <slot name="receipt">
          <div class="absolute inset-0 flex items-center justify-center">
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-20">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="8" y1="21" x2="8" y2="15"></line>
              <line x1="16" y1="21" x2="16" y2="15"></line>
            </svg>
          </div>
        </slot>
      </div>
    </div>
  </div>
  {/if}
</div>

<div class="flex items-center justify-end gap-2 pt-3">
  <a href={cancelHref} class="px-3 py-2 rounded-lg border border-black/5 dark:border-white/10">Cancel</a>
  <button class="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={handleSubmit} {disabled}>{submitLabel}</button>
</div>
