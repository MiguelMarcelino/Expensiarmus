<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { User } from '../lib/auth';
  import ExpenseIcon from '../lib/ExpenseIcon.svelte';
  import { fade, fly } from 'svelte/transition';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

  type Member = { user: { id: string; username: string; joinedAt?: string } };
  type Expense = {
    id: string;
    description: string;
    category?: string;
    expenseType?: string;
    quantity?: number;
    unitPriceCents?: number | null;
    amountCents: number;
    incurredAt: string;
    createdAt?: string;
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
  let incurredAtInput = '';
  let payerUserId: string = '';
  let splitByUserId: Record<string, string> = {}; // userId -> amount string
  let paidByUserId: Record<string, string> = {};  // userId -> amount string

  // Modes and percentage storage
  type SplitMode = 'equal' | 'custom_amounts' | 'custom_percentages';
  type PaymentMode = 'payer' | 'equal' | 'custom_amounts' | 'custom_percentages';
  let splitMode: SplitMode = 'equal';
  let paymentMode: PaymentMode = 'payer';
  let splitPctByUserId: Record<string, string> = {};
  let paidPctByUserId: Record<string, string> = {};

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

  // ----- Activity feed -----
  type ActivityEvent = {
    id: string;
    kind: 'member_joined' | 'expense_created' | 'expense_edited';
    at: string; // ISO date
    text: string;
  };
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
  $: splitParticipants = (() => {
    // Everyone except the selected payer owes the payer by default
    let users: { id: string; username: string }[] = [];
    if (members.length > 0) users = members.map((m) => m.user);
    else if (me) users = [{ id: me.id, username: me.username }];
    // Exclude the payer from owing side; if that empties the list, fall back to including the payer
    const filtered = users.filter((u) => u.id !== payerUserId);
    return (filtered.length > 0 ? filtered : (users.length > 0 ? [users[0]] : [])) as { id: string; username: string }[];
  })();

  async function load() {
    error = null;
    try {
      const [membersRes, expensesRes] = await Promise.all([
        api(`/trips/${tripId}/members`),
        api(`/trips/${tripId}/expenses`),
      ]);
      members = membersRes.members;
      // Ensure owner is available as payer option even if not listed as a member
      if (membersRes.owner) {
        const ownerUser = membersRes.owner as { id: string; username: string };
        if (!members.find((m) => m.user.id === ownerUser.id)) {
          members = [{ user: ownerUser }, ...members];
        }
      }
      expenses = uniqueById(expensesRes.expenses);
      if (!payerUserId) {
        payerUserId = me?.id || (members[0]?.user.id ?? '');
      }
      if (expenses.length > 0 && expenses[0].category) {
        tripName = expenses[0].category;
      }
      // Initialize equal split among participants excluding the payer
      const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
      const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
      if (participantIds.length > 0 && Number(amount) > 0) {
        const per = Number(amount) / participantIds.length;
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, per.toFixed(2)]));
      } else {
        splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
      }
      // Default payer covers full amount
      const idsForPayments = payerOptions.map((u) => u.id);
      paidByUserId = Object.fromEntries(idsForPayments.map((id) => [id, id === payerUserId ? (Number(amount) || 0).toFixed(2) : '0']));
      
      // Load activity feed
      await loadActivity();
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
    // Respect current payment mode when amount changes
    recalcPayments();
  }

  function onPayerChange() {
    // When payer changes, recalc both payments and splits (others owe the payer)
    recalcPayments();
    recalcSplits();
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
    // Ensure allocations reflect latest amount/payer/modes just before submit
    recalcSplits();
    recalcPayments();
    const totalsError = validTotals();
    if (totalsError) { error = totalsError; return; }
    try {
      const splits = Object.entries(splitByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((s) => s.amount > 0);
      let payments = Object.entries(paidByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((p) => p.amount > 0);
      // Safety: if for any reason payments are empty, ensure selected payer covers all
      if (payments.length === 0 && payerUserId && amountNum > 0) {
        payments = [{ userId: payerUserId, amount: amountNum }];
      }
      const res = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ tripId, description: description.trim(), amount: amountNum, category: category || undefined, expenseType: expenseType || undefined, incurredAt: incurredAtInput ? new Date(incurredAtInput).toISOString() : undefined, payerUserId, splits, payments })
      });
      upsertExpense(res.expense as Expense);
      description = ''; amount = ''; category = ''; expenseType = '';
      incurredAtInput = new Date().toISOString().slice(0, 16);
      success = 'Expense added successfully.';
      setTimeout(() => { success = null; }, 3000);
      
      // Refresh activity to show the new expense event
      await loadActivity();
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
        upsertExpense(res.expense as Expense);
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
      
      // Refresh activity to show the new member join event
      await loadActivity();
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

  // ----- Expense editor modal -----
  let showEditor = false;
  let editing: Expense | null = null;
  let editPaymentMode: PaymentMode = 'payer';
  let editPaidByUserId: Record<string, string> = {};
  let editPaidPctByUserId: Record<string, string> = {};
  let editPayerUserId: string = '';

  function openEditor(e: Expense) {
    editing = e;
    showEditor = true;
    const total = e.amountCents / 100;
    const ids = balanceUsers.map((u) => u.id);
    // Payments: prefer explicit payments; else creator covers all
    const payMap: Record<string, string> = {};
    for (const u of balanceUsers) payMap[u.id] = '0';
    if (e.payments && e.payments.length > 0) {
      for (const p of e.payments) payMap[p.userId] = (p.amountCents / 100).toFixed(2);
      // Infer mode
      const pvals = Object.values(payMap).map(Number).filter((v) => v > 0);
      const pAllEq = pvals.length > 1 && pvals.every((v) => Math.abs(v - pvals[0]) < 0.005);
      editPaymentMode = pAllEq ? 'equal' : 'custom_amounts';
    } else {
      payMap[e.createdBy.id] = total.toFixed(2);
      editPaymentMode = 'payer';
    }
    editPaidByUserId = payMap;
    editPayerUserId = e.createdBy.id;
    // Seed pay percentages
    const payPct: Record<string, string> = {};
    for (const id of ids) {
      const v = Number(payMap[id] || '0');
      payPct[id] = total > 0 ? ((v * 100) / total).toFixed(2) : '0';
    }
    editPaidPctByUserId = payPct;
    // Normalize amounts to total
    recalcEditPayments();
  }

  function closeEditor() {
    showEditor = false;
    editing = null;
  }

  function recalcEditPayments() {
    if (!editing) return;
    const total = editing.amountCents / 100;
    const ids = balanceUsers.map((u) => u.id);
    if (editPaymentMode === 'payer') {
      editPaidByUserId = Object.fromEntries(ids.map((id) => [id, id === editPayerUserId ? total.toFixed(2) : '0']));
      editPaidPctByUserId = Object.fromEntries(ids.map((id) => [id, id === editPayerUserId ? '100' : '0']));
    } else if (editPaymentMode === 'equal') {
      const equalPct = ids.length > 0 ? (100 / ids.length) : 0;
      editPaidPctByUserId = Object.fromEntries(ids.map((id) => [id, equalPct.toFixed(2)]));
      editPaidByUserId = allocateByPercent(total, editPaidPctByUserId, ids);
    } else if (editPaymentMode === 'custom_percentages') {
      editPaidByUserId = allocateByPercent(total, editPaidPctByUserId, ids);
    }
  }

  function editOnPaymentModeChange(e: Event) {
    editPaymentMode = (e.target as HTMLSelectElement).value as PaymentMode;
    recalcEditPayments();
  }

  function editorTotalsError(): string | null {
    if (!editing) return 'No expense';
    const total = editing.amountCents / 100;
    const paidSum = sumStrings(editPaidByUserId);
    if (Math.round(paidSum * 100) !== Math.round(total * 100)) return `Payments must sum to ${total.toFixed(2)}`;
    return null;
  }

  async function saveExpenseEdits() {
    error = null; success = null;
    const err = editorTotalsError();
    if (err) { error = err; return; }
    if (!editing) return;
    try {
      const payments = Object.entries(editPaidByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((p) => p.amount > 0);
      const res = await api(`/expenses/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ payments })
      });
      upsertExpense(res.expense as Expense);
      success = 'Expense updated.';
      setTimeout(() => { success = null; }, 2500);
      closeEditor();
      
      // Refresh activity to show the updated expense
      await loadActivity();
    } catch (e: any) {
      error = e.message;
    }
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
    <div class="text-sm grid md:grid-cols-2 gap-6">
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
      
    </div>
  </div>
</section>

<div class="grid md:grid-cols-4 lg:grid-cols-5 gap-6 mt-2">
  <div class="md:col-span-2 lg:col-span-3 space-y-4">
    <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
      <div class="flex items-center gap-2 border-b border-black/5 dark:border-white/10 mb-3">
        <button class="px-3 py-2 text-sm rounded-t-lg {activeTab==='expenses' ? 'bg-indigo-600 text-white' : ''}" on:click={() => activeTab='expenses'}>Expenses</button>
        <button class="px-3 py-2 text-sm rounded-t-lg {activeTab==='activity' ? 'bg-indigo-600 text-white' : ''}" on:click={() => activeTab='activity'}>Activity</button>
      </div>
      {#if activeTab === 'expenses'}
        {#if expenses.length === 0}
          <div class="text-sm opacity-70">No expenses yet.</div>
        {:else}
          <div class="space-y-3">
            {#each expenses as e (e.id)}
              <div class="group rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-4 shadow-sm hover:shadow transition flex items-start justify-between">
                <div class="flex items-start gap-3 min-w-0">
                  <ExpenseIcon description={e.description} category={e.category} expenseType={e.expenseType} />
                  <div class="min-w-0">
                    <div class="font-medium truncate">{e.description}</div>
                    <div class="mt-1 text-xs opacity-70 flex flex-wrap items-center gap-2">
                      {#if e.expenseType || e.category}
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-700 dark:text-gray-200 border border-gray-500/20">{e.expenseType || e.category}</span>
                      {/if}
                      <span class="truncate">by {e.createdBy.username}</span>
                      <span class="opacity-60">·</span>
                      <span>{new Date(e.incurredAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div class="text-right min-w-[160px]">
                  <div class="font-semibold tabular-nums">${centsToString(e.amountCents)}</div>
                  {#if me}
                    {#if myDeltaCents(e) < 0}
                      <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">You owe ${centsToString(Math.abs(myDeltaCents(e)))}</div>
                    {:else if myDeltaCents(e) > 0}
                      <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-700 dark:text-green-300 border border-green-500/20">You're owed ${centsToString(myDeltaCents(e))}</div>
                    {:else}
                      <div class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20">Settled</div>
                    {/if}
                  {/if}
                  <div class="mt-2">
                    <button class="px-2 py-1 rounded-md text-xs border border-black/5 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-700/40" on:click={() => openEditor(e)}>Edit</button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        {#if activityEvents.length === 0}
          <div class="text-sm opacity-70">No activity yet.</div>
        {:else}
          <div class="space-y-3">
            {#each activityEvents as ev}
              <div class="rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-4 shadow-sm hover:shadow transition flex items-start justify-between">
                <div class="flex items-start gap-3 min-w-0">
                  {#if ev.kind === 'member_joined'}
                    <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    </div>
                  {:else if ev.kind === 'expense_created'}
                    <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7H8"/><path d="M20 11H8"/><path d="M14 15H8"/><path d="M4 6v12"/></svg>
                    </div>
                  {:else}
                    <div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <div class="text-sm">
                      <span>{ev.text}</span>
                    </div>
                    <div class="mt-1 text-xs opacity-70">{new Date(ev.at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <input type="datetime-local" class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={incurredAtInput} />
        <input class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" placeholder="Category (optional)" bind:value={category} />
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

{#if showEditor && editing}
  <div class="fixed inset-0 z-20 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" role="button" tabindex="0" on:click={closeEditor} on:keydown={(e) => ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === 'Escape') && closeEditor()}></div>
    <div class="relative z-30 w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Edit expense</h3>
        <button class="px-2 py-1 text-sm rounded-md border border-black/5 dark:border-white/10" on:click={closeEditor}>Close</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div class="text-xs opacity-70 mb-1">Who paid how much</div>
          <select class="text-xs p-1 rounded-md bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 mb-2" bind:value={editPaymentMode} on:change={editOnPaymentModeChange}>
            <option value="payer">Payer covers all</option>
            <option value="equal">Split equally</option>
            <option value="custom_percentages">Custom percentages</option>
            <option value="custom_amounts">Custom amounts</option>
          </select>
          <div class="space-y-1.5">
            {#each balanceUsers as u}
              <div class="flex items-center gap-2 py-0.5 min-w-0">
                <span class="w-28 text-sm opacity-80">{u.username}</span>
                {#if editPaymentMode === 'custom_percentages'}
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="number" min="0" max="100" step="0.01" class="w-24 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={editPaidPctByUserId[u.id]} on:input={(e) => { editPaidPctByUserId[u.id] = clampPercent((e.target as HTMLInputElement).value); recalcEditPayments(); }} />
                    <span class="text-sm opacity-70">%</span>
                    <div class="w-full min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{editPaidByUserId[u.id] || '0.00'}</div>
                  </div>
                {:else if editPaymentMode === 'equal' || editPaymentMode === 'payer'}
                  <div class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums cursor-default">{editPaidByUserId[u.id] || '0.00'}</div>
                {:else}
                  <input type="number" min="0" step="0.01" class="flex-1 min-w-0 p-2 rounded-lg bg-white dark:bg-gray-800" bind:value={editPaidByUserId[u.id]} on:input={(e) => editPaidByUserId[u.id] = (e.target as HTMLInputElement).value} />
                {/if}
              </div>
            {/each}
          </div>
          <div class="text-xs opacity-70 mt-1">Total payments: ${sumStrings(editPaidByUserId).toFixed(2)}</div>
        </div>
        
      </div>
      <div class="flex items-center justify-end gap-2">
        <button class="px-3 py-2 rounded-md border border-black/5 dark:border-white/10" on:click={closeEditor}>Cancel</button>
        <button class="px-3 py-2 rounded-md bg-indigo-600 text-white" on:click={saveExpenseEdits}>Save</button>
      </div>
    </div>
  </div>
{/if}
