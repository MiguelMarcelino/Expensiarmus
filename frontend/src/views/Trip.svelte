<script lang="ts">
  import { onMount } from 'svelte';
  import { api, download, fetchAuthed, apiDelete } from '../lib/api';
  import { currentUser } from '../lib/auth';
  
  import ExpenseItem from '../lib/components/ExpenseItem.svelte';
  import BalancesCard from '../lib/components/BalancesCard.svelte';
  import ActivityList from '../lib/components/ActivityList.svelte';
  import AddMemberSpotlight from '../lib/components/AddMemberSpotlight.svelte';
  import type { Member, Expense, ActivityEvent, SplitMode, PaymentMode, User } from '../lib/types';
  import { centsToString } from '../lib/money';
  import { showError, showSuccess } from '../lib/alerts';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let members: Member[] = [];
  let expenses: Expense[] = [];
  let tripName = '';
  let ownerId: string = '';
  $: canEditTrip = !!me && ownerId && me.id === ownerId;
  let editingTripName = false;
  let editTripName = '';
  let baseCurrency: string = 'EUR';
  let serverBalances: Record<string, number> | null = null;
  let serverTransfers: { from: string; to: string; amountCents: number }[] | null = null;
  // Users to show in balances (members + me + expense creators)
  let balanceUsers: { id: string; username: string }[] = [];
  let settling = false;
  let myId: string = '';
  let importing = false;
  let showAddMember = false;
  let showFabMenu = false;
  let confirmDeleteTrip = false;

  // manual form
  let description = '';
  let amount = '';
  let category = '';
  let expenseType = '';
  let incurredAtInput = '';
  let payerUserId: string = '';
  let splitByUserId: Record<string, string> = {}; // userId -> amount string
  let paidByUserId: Record<string, string> = {};  // userId -> amount string
  let paidCurrencyByUserId: Record<string, string> = {}; // userId -> currency code
  let selectedSplitUserIdMap: Record<string, boolean> = {};
  let expenseCurrency: string = 'EUR';
  import { currencies } from '../lib/constants/currencies';
  import { categories as predefinedCategories } from '../lib/constants/categories';
  let incurredAtEl: HTMLInputElement | null = null;

  // Visualization helpers for compact allocation preview
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

  // Modes and percentage storage
  let splitMode: SplitMode = 'equal';
  let paymentMode: PaymentMode = 'payer';
  let splitPctByUserId: Record<string, string> = {};
  let paidPctByUserId: Record<string, string> = {};

  // AI form
  let aiInput = '';

  // money helper imported from ../lib/money
  function sumStrings(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  function sumPercents(obj: Record<string, string>): number {
    return Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
  }
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
  function uniqueById(list: Expense[]): Expense[] {
    const map = new Map<string, Expense>();
    for (const e of list) map.set(e.id, e);
    // Keep order: most recent first by incurredAt
    return Array.from(map.values()).sort((a, b) => +new Date(b.incurredAt) - +new Date(a.incurredAt));
  }
  function upsertExpense(e: Expense) {
    const idx = expenses.findIndex((x) => x.id === e.id);
    if (idx >= 0) {
      expenses[idx] = e;
      expenses = uniqueById([...expenses]);
    } else {
      expenses = uniqueById([e, ...expenses]);
    }
  }

  function inferPayerId(e: Expense): string | null {
    // If explicit payments exist, payer is whoever paid the most
    if (e.payments && e.payments.length > 0) {
      let top = e.payments[0];
      for (const p of e.payments) {
        if (p.amountCents > top.amountCents) top = p;
      }
      return top.userId;
    }
    // Otherwise, infer from default split rule: everyone except the payer owes
    const splitIds = new Set(e.splits.map((s) => s.userId));
    const candidates: string[] = [];
    for (const u of balanceUsers) {
      if (!splitIds.has(u.id)) candidates.push(u.id);
    }
    // De-duplicate just in case
    const unique = Array.from(new Set(candidates));
    return unique.length === 1 ? unique[0] : null;
  }

  function payerName(e: Expense): string {
    const pid = inferPayerId(e) || e.createdBy.id;
    return displayName(pid);
  }

  function myDeltaCents(e: Expense): number {
    const mySplit = e.splits.find((s) => s.userId === me?.id)?.amountCents || 0;
    let myPaid = 0;
    if (e.payments && e.payments.length > 0) {
      myPaid = e.payments
        .filter((p) => p.userId === (me?.id || ''))
        .reduce((sum, p) => sum + p.amountCents, 0);
    } else {
      const inferred = inferPayerId(e);
      if (inferred) {
        myPaid = inferred === (me?.id || '') ? e.amountCents : 0;
      } else {
        myPaid = e.createdBy.id === (me?.id || '') ? e.amountCents : 0;
      }
    }
    return myPaid - mySplit; // >0 you're owed, <0 you owe
  }

  $: netCents = me ? (balances[me.id] || 0) : 0;
  $: totalOwedCents = netCents > 0 ? netCents : 0;
  $: totalOweCents = netCents < 0 ? -netCents : 0;

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

  // ----- Activity feed -----
  let activeTab: 'expenses' | 'activity' = 'expenses';
  let activityEvents: ActivityEvent[] = [];
  
  async function loadActivity() {
    try {
      const activityRes = await api(`/trips/${tripId}/activity`);
      activityEvents = activityRes.activities || [];
    } catch (e: any) {
      console.error('Failed to load activity:', e);
      activityEvents = [];
    }
  }

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;
  $: payerOptions = (() => {
    const list = [...members.map((m) => m.user)];
    if (me && !list.find((u) => u.id === me!.id)) list.unshift({ id: me.id, username: me.username });
    return list;
  })();
  $: splitCandidates = (() => {
    // Everyone except the selected payer is eligible to owe
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

  async function load() {
    try {
      const [membersRes, expensesRes, balancesRes] = await Promise.all([
        api(`/trips/${tripId}/members`),
        api(`/trips/${tripId}/expenses`),
        api(`/trips/${tripId}/balances`).catch(() => ({ baseCurrency: 'EUR', balances: {}, transfers: [] })),
      ]);
      members = membersRes.members;
      baseCurrency = (membersRes.baseCurrency || balancesRes.baseCurrency || 'EUR').toUpperCase();
      // Keep expense currency default as EUR; do not override with base currency
      // Ensure owner is available as payer option even if not listed as a member
      if (membersRes.owner) {
        const ownerUser = membersRes.owner as { id: string; username: string };
        ownerId = ownerUser.id;
        if (!members.find((m) => m.user.id === ownerUser.id)) {
          members = [{ user: ownerUser }, ...members];
        }
      }
      expenses = uniqueById(expensesRes.expenses);
      if (!payerUserId) {
        payerUserId = me?.id || (members[0]?.user.id ?? '');
      }
      // Prefer server-provided trip name
      tripName = membersRes.tripName || tripName || '';
      // Initialize selected split participants (everyone except payer)
      const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
      const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
      selectedSplitUserIdMap = Object.fromEntries(participantIds.map((id) => [id, true]));
      if (participantIds.length > 0 && Number(amount) > 0) {
        const per = Number(amount) / participantIds.length;
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, per.toFixed(2)]));
      } else {
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
      }
      // Default payer covers full amount
      const idsForPayments = payerOptions.map((u) => u.id);
      paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? (Number(amount) || 0).toFixed(2) : '0']));
      paidCurrencyByUserId = Object.fromEntries(idsForPayments.map((id) => [id, expenseCurrency]));
      // Server balances and transfers (base currency) — ignore empty results
      serverBalances = (balancesRes && balancesRes.balances && Object.keys(balancesRes.balances || {}).length > 0)
        ? balancesRes.balances
        : null;
      serverTransfers = (balancesRes && Array.isArray(balancesRes.transfers) && balancesRes.transfers.length > 0)
        ? balancesRes.transfers
        : null;
      
      // Load activity feed
      await loadActivity();
      // After initial load, fetch server balances explicitly (base currency)
      try {
        const b = await api(`/trips/${tripId}/balances`);
        serverBalances = (b && b.balances && Object.keys(b.balances || {}).length > 0) ? b.balances : null;
        serverTransfers = (b && Array.isArray(b.transfers) && b.transfers.length > 0) ? b.transfers : null;
        baseCurrency = (b?.baseCurrency || baseCurrency).toUpperCase();
      } catch {}
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function importTripCsv(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const form = new FormData();
    form.append('file', file);
    importing = true;
    try {
      const res = await fetchAuthed(`/trips/${tripId}/expenses/import`, { method: 'POST', body: form });
      const text = await res.text().catch(() => '');
      let data: any = {};
      if (text) { try { data = JSON.parse(text); } catch {} }
      if (!res.ok) {
        const msg = data?.error || data?.message || `Import failed (${res.status})`;
        throw new Error(msg);
      }
      const imported = data.imported || 0;
      showSuccess(`Imported ${imported} expenses`);
      // Refresh expenses/activity
      await load();
    } catch (e: any) {
      showError(e.message);
    } finally {
      importing = false;
      input.value = '';
    }
  }

  function onAmountChange() {
    const total = Number(amount) || 0;
    const ids = splitParticipants.map((u) => u.id);
    if (ids.length > 0) {
      const per = total / ids.length || 0;
      splitByUserId = Object.fromEntries(ids.map((id) => [id, per.toFixed(2)]));
    }
    // Respect current payment mode when amount changes
    recalcPayments();
  }

  function onPayerChange() {
    // When payer changes, recalc both payments and splits (others owe the payer)
    recalcPayments();
    // Reset selection to all split candidates except the payer
    const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
    const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
    selectedSplitUserIdMap = Object.fromEntries(participantIds.map((id) => [id, true]));
    recalcSplits();
  }

  function validTotals(): string | null {
    const total = Number(amount) || 0;
    const splitSum = sumStrings(Object.fromEntries(Object.entries(splitByUserId).filter(([id]) => selectedSplitUserIdMap[id])));
    const paidSum = sumStrings(paidByUserId);
    if (Math.round(splitSum * 100) !== Math.round(total * 100)) return `Splits must sum to ${expenseCurrency} ${total.toFixed(2)}`;
    if (Math.round(paidSum * 100) !== Math.round(total * 100)) return `Payments must sum to ${expenseCurrency} ${total.toFixed(2)}`;
    return null;
  }

  async function addExpense() {
    const amountNum = Number(amount);
    if (!tripId) { showError('No trip selected.'); return; }
    if (!description.trim() || !(amountNum > 0)) { showError('Enter description and a positive amount.'); return; }
    // Ensure allocations reflect latest amount/payer/modes just before submit
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
      // Safety: if for any reason payments are empty, ensure selected payer covers all
      if (payments.length === 0 && payerUserId && amountNum > 0) {
        payments = [{ userId: payerUserId, amount: amountNum, currency: expenseCurrency.toUpperCase() }];
      }
      const res = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ tripId, description: description.trim(), amount: amountNum, category: category || undefined, expenseType: expenseType || undefined, incurredAt: incurredAtInput ? new Date(incurredAtInput).toISOString() : undefined, payerUserId, splits, payments, currency: expenseCurrency.toUpperCase() })
      });
      upsertExpense(res.expense as Expense);
      // Invalidate and refresh server balances so UI updates instantly
      serverBalances = null;
      serverTransfers = null;
      try {
        const b = await api(`/trips/${tripId}/balances`);
        serverBalances = (b && b.balances && Object.keys(b.balances || {}).length > 0) ? b.balances : null;
        serverTransfers = (b && Array.isArray(b.transfers) && b.transfers.length > 0) ? b.transfers : null;
        baseCurrency = (b?.baseCurrency || baseCurrency).toUpperCase();
      } catch {}
      description = ''; amount = ''; category = ''; expenseType = '';
      incurredAtInput = nowLocalDatetime();
      showSuccess('Expense added successfully.');
      
      // Refresh activity to show the new expense event
      await loadActivity();
    } catch (e: any) {
      showError(e.message);
    }
  }

  // ----- Delete expense -----
  // Delete confirmation banner state
  let confirmDeleteId: string | null = null;
  let confirmDeleteText: string = '';
  function requestDelete(expenseId: string, label: string) {
    confirmDeleteId = expenseId;
    confirmDeleteText = `Delete "${label}"? This cannot be undone.`;
  }
  async function performDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    confirmDeleteId = null;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      expenses = expenses.filter((e) => e.id !== id);
      // Invalidate and refresh server balances
      serverBalances = null;
      serverTransfers = null;
      try {
        const b = await api(`/trips/${tripId}/balances`);
        serverBalances = (b && b.balances && Object.keys(b.balances || {}).length > 0) ? b.balances : null;
        serverTransfers = (b && Array.isArray(b.transfers) && b.transfers.length > 0) ? b.transfers : null;
        baseCurrency = (b?.baseCurrency || baseCurrency).toUpperCase();
      } catch {}
      showSuccess('Expense deleted.');
      await loadActivity();
    } catch (e: any) {
      showError(e.message);
    }
  }
  function cancelDelete() { confirmDeleteId = null; }

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
    // Force deselected users to 0
    for (const u of payerOptions) {
      if (!selectedSplitUserIdMap[u.id]) {
        splitByUserId[u.id] = '0';
        splitPctByUserId[u.id] = '0';
      }
    }
  }

  function onToggleSplitUser(userId: string) {
    selectedSplitUserIdMap[userId] = !selectedSplitUserIdMap[userId];
    if (!selectedSplitUserIdMap[userId]) {
      splitByUserId[userId] = '0';
      splitPctByUserId[userId] = '0';
    }
    recalcSplits();
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
    for (const id of ids) { if (!paidCurrencyByUserId[id]) paidCurrencyByUserId[id] = expenseCurrency; }
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
    try {
      const res = await api('/ai/parse', { method: 'POST', body: JSON.stringify({ input: aiInput, tripId }) });
      if (res.expense?.tripId === tripId) {
        upsertExpense(res.expense as Expense);
        showSuccess('Expense added from AI.');
      }
      aiInput = '';
    } catch (e: any) {
      showError(e.message);
    }
  }

  // Member add handled by AddMember component

  // Balance summary (who owes whom) computed on client when server doesn't provide it
  function computeClientBalances(users: { id: string; username: string }[], exps: Expense[]) {
    const userIds = users.map((u) => u.id);
    const balances: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
    for (const e of exps) {
      const total = e.amountCents;
      const splitMap: Record<string, number> = {};
      for (const s of e.splits) splitMap[s.userId] = s.amountCents;
      const payMap: Record<string, number> = {};
      for (const p of e.payments || []) payMap[p.userId] = p.amountCents;
      if (Object.keys(payMap).length === 0) {
        const inferred = inferPayerId(e) || e.createdBy.id;
        payMap[inferred] = total;
      }
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

  // Make reactive dependencies explicit so updates occur when inputs change
  $: balances = serverBalances ? serverBalances : computeClientBalances(balanceUsers, expenses);
  $: transfers = serverTransfers ? serverTransfers : minimizeTransfers(balances);
  $: myId = me?.id || '';
  $: myDebts = (myId && Array.isArray(transfers)) ? transfers.filter((t) => t.from === myId && t.amountCents > 0) : [];
  $: canSettle = (myId ? ((balances[myId] || 0) < 0) : false) || myDebts.length > 0;
  let confirmSettle = false;

  async function settleUp() {
    if (!tripId || !me) return;
    settling = true;
    try {
      const res = await api(`/trips/${tripId}/settle`, { method: 'POST' });
      if (res.expense) {
        // Legacy single expense response
        upsertExpense(res.expense as Expense);
      } else if (res.expenses && Array.isArray(res.expenses)) {
        // New multi-currency settlement response
        for (const expense of res.expenses) {
          upsertExpense(expense as Expense);
        }
      }
      // Refresh server balances/transfers to reflect settlement
      serverBalances = null;
      serverTransfers = null;
      try {
        const b = await api(`/trips/${tripId}/balances`);
        serverBalances = (b && b.balances && Object.keys(b.balances || {}).length > 0) ? b.balances : null;
        serverTransfers = (b && Array.isArray(b.transfers) && b.transfers.length > 0) ? b.transfers : null;
        baseCurrency = (b?.baseCurrency || baseCurrency).toUpperCase();
      } catch {}
      showSuccess(res.message || 'Settlement recorded.');
      await loadActivity();
    } catch (e: any) {
      showError(e.message);
    } finally {
      settling = false;
    }
  }

  onMount(() => {
    incurredAtInput = nowLocalDatetime();
    if (tripId) load();
  });

  function displayName(userId: string): string {
    const u = balanceUsers.find((x) => x.id === userId);
    if (u) return u.username;
    if (me && userId === me.id) return me.username;
    return 'Unknown';
  }

  async function saveTripName() {
    const newName = (editTripName || '').trim();
    if (!newName) { cancelEditTripName(); return; }
    try {
      await api(`/trips/${tripId}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      tripName = newName;
      editingTripName = false;
      showSuccess('Trip renamed.');
    } catch (e: any) {
      showError(e.message);
    }
  }

  function cancelEditTripName() {
    editingTripName = false;
    editTripName = '';
  }

  async function deleteTrip() {
    if (!tripId) return;
    try {
      await apiDelete(`/trips/${tripId}`);
      showSuccess('Trip deleted');
      window.location.hash = '#/dashboard';
    } catch (e: any) {
      showError(e.message);
    } finally {
      confirmDeleteTrip = false;
    }
  }

  // Removed old inline expense editor; use dedicated page instead
</script>

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
              <div class="flex items-center gap-2">
                {#if editingTripName}
                  <input class="text-2xl md:text-3xl font-extrabold tracking-tight bg-transparent border-b border-black/20 dark:border-white/20 focus:outline-none focus:border-indigo-500 min-w-0" bind:value={editTripName} on:keydown={(e) => { const k = (e as KeyboardEvent).key; if (k === 'Enter') saveTripName(); if (k === 'Escape') cancelEditTripName(); }} />
                  <button class="px-2 py-1 rounded-md bg-indigo-600 text-white text-xs" on:click={saveTripName}>Save</button>
                  <button class="px-2 py-1 rounded-md border border-black/10 dark:border-white/10 text-xs" on:click={cancelEditTripName}>Cancel</button>
                {:else}
                  <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight truncate">{tripName || 'Trip details'}</h2>
                  {#if canEditTrip}
                    <button class="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10" title="Rename trip" aria-label="Rename trip" on:click={() => { editingTripName = true; editTripName = tripName; }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button class="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600" title="Delete trip" aria-label="Delete trip" on:click={() => { confirmDeleteTrip = true; }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                    </button>
                  {/if}
                {/if}
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {#if netCents === 0}
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-gray-700 dark:text-gray-200 border border-gray-500/20">
                    You're even
                  </span>
                {:else if netCents < 0}
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                    You owe <strong class="tabular-nums ml-1">{baseCurrency} ${centsToString(totalOweCents)}</strong>
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
                    You're owed <strong class="tabular-nums ml-1">{baseCurrency} ${centsToString(totalOwedCents)}</strong>
                  </span>
                {/if}
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
  <BalancesCard
    {balanceUsers}
    {balances}
    {transfers}
    {centsToString}
    {me}
    {displayName}
    currencyLabel={baseCurrency}
  />
</section>

<div class="grid md:grid-cols-4 lg:grid-cols-5 gap-6 mt-2">
  <div class="md:col-span-4 lg:col-span-5 space-y-4">
    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
      <div class="flex items-center justify-between border-b border-black/5 dark:border-white/10 mb-3">
        <div class="flex items-center gap-2">
          <button class="px-3 py-2 text-sm rounded-t-lg {activeTab==='expenses' ? 'bg-indigo-600 text-white' : ''}" on:click={() => activeTab='expenses'}>Expenses</button>
          <button class="px-3 py-2 text-sm rounded-t-lg {activeTab==='activity' ? 'bg-indigo-600 text-white' : ''}" on:click={() => activeTab='activity'}>Activity</button>
        </div>
      </div>
      {#if activeTab === 'expenses'}
        {#if expenses.length === 0}
          <div class="text-sm opacity-70">No expenses yet.</div>
        {:else}
          <div class="space-y-3">
            {#each expenses as e (e.id)}
              <ExpenseItem
                expense={e}
                {centsToString}
                {payerName}
                on:edit={(ev) => (window.location.hash = `#/trip/${tripId}/expense/${ev.detail.id}`)}
                on:delete={(ev) => requestDelete(ev.detail.id, ev.detail.label)}
              />
            {/each}
          </div>
        {/if}
      {:else}
        <ActivityList {activityEvents} />
      {/if}
    </div>
  </div>
  <div class="md:col-span-2 lg:col-span-2 space-y-4 hidden"></div>
</div>

<!-- Old inline expense editor removed; editing is done in dedicated page -->

{#if confirmDeleteTrip && canEditTrip}
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" role="button" tabindex="0" on:click={() => (confirmDeleteTrip = false)} on:keydown={(e) => ((e as KeyboardEvent).key === 'Escape') && (confirmDeleteTrip = false)}></div>
    <div class="relative z-50 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Delete trip</h3>
        <button class="px-2 py-1 text-sm rounded-md border border-black/5 dark:border-white/10" on:click={() => (confirmDeleteTrip = false)}>Close</button>
      </div>
      <p class="text-sm opacity-80 mb-4">This will permanently delete the trip and all its expenses. This action cannot be undone.</p>
      <div class="flex items-center justify-end gap-2">
        <button class="px-3 py-2 rounded-md border border-black/5 dark:border-white/10" on:click={() => (confirmDeleteTrip = false)}>Cancel</button>
        <button class="px-3 py-2 rounded-md bg-red-600 text-white" on:click={deleteTrip}>Delete</button>
      </div>
    </div>
  </div>
{/if}

{#if confirmDeleteId}
  <div class="fixed bottom-4 left-0 right-0 z-30 px-4">
    <div class="max-w-2xl mx-auto rounded-2xl border border-red-500/30 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-100 shadow backdrop-blur p-4 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
        <span class="text-sm">{confirmDeleteText}</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="px-3 py-1.5 rounded-md text-sm border border-black/5 dark:border-white/10" on:click={cancelDelete}>Cancel</button>
        <button class="px-3 py-1.5 rounded-md text-sm bg-red-600 text-white" on:click={performDelete}>Delete</button>
      </div>
    </div>
  </div>
{/if}

<!-- Floating Speed Dial -->
{#if showFabMenu}
  <button type="button" class="fixed inset-0 z-20" aria-label="Close actions" on:click={() => showFabMenu = false}></button>
{/if}
<div class="fixed bottom-6 right-6 z-30">
  {#if showFabMenu}
    <div class="flex flex-col items-end gap-3 mb-3">
      <!-- Settle up (only if actionable) -->
      {#if canSettle}
        <button type="button" class="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500" title="Settle up" aria-label="Settle up" on:click={() => { showFabMenu = false; confirmSettle = true; }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a4.5 4.5 0 0 0 0 9H14a4.5 4.5 0 0 1 0 9H6"/></svg>
        </button>
      {/if}
      <!-- Add member -->
      <button type="button" class="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100" title="Add member" aria-label="Add member" on:click={() => { showFabMenu = false; showAddMember = true; }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="16" y1="11" x2="22" y2="11"/>
        </svg>
      </button>
      <!-- Add expense -->
      <a href={`#/trip/${tripId}/add-expense`} class="inline-flex items-center justify-center h-14 w-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" title="Add expense" aria-label="Add expense" on:click={() => showFabMenu = false}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
          <line x1="6" y1="15" x2="10" y2="15"></line>
        </svg>
      </a>
    </div>
  {/if}
  <!-- Main FAB -->
  <button type="button" class="inline-flex items-center justify-center h-14 w-14 rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform {showFabMenu ? 'rotate-45' : ''}" aria-label="Actions" title="Actions" on:click={() => showFabMenu = !showFabMenu}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  </button>
</div>

<!-- Add Member Spotlight Overlay -->
<AddMemberSpotlight
  {tripId}
  open={showAddMember}
  on:added={async () => { try { const res = await api(`/trips/${tripId}/members`); members = res.members as Member[]; showSuccess('Member added.'); await loadActivity(); } catch (e: any) { showError(e.message); } finally { showAddMember = false; } }}
  on:close={() => showAddMember = false}
/>

{#if confirmSettle && canSettle}
  <!-- Confirm settle overlay -->
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" role="button" tabindex="0" on:click={() => confirmSettle = false} on:keydown={(e) => ((e as KeyboardEvent).key === 'Escape') && (confirmSettle = false)}></div>
    <div class="relative z-50 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Confirm settlement</h3>
        <button class="px-2 py-1 text-sm rounded-md border border-black/5 dark:border-white/10" on:click={() => confirmSettle = false}>Close</button>
      </div>
      <p class="text-sm opacity-80 mb-4">This will create a settlement entry to even out balances for this trip.</p>
      <div class="flex items-center justify-end gap-2">
        <button class="px-3 py-2 rounded-md border border-black/5 dark:border-white/10" on:click={() => confirmSettle = false}>Cancel</button>
        <button class="px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={async () => { await settleUp(); confirmSettle = false; }} disabled={settling}>{settling ? 'Settling…' : 'Confirm'}</button>
      </div>
    </div>
  </div>
{/if}
