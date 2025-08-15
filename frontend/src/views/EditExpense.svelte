<script lang="ts">
  import { onMount } from 'svelte';
  import { api, API_BASE } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { Member, User, PaymentMode, SplitMode, Expense } from '../lib/types';
  import { showError, showSuccess } from '../lib/alerts';
  import ExpenseForm from '../lib/components/ExpenseForm.svelte';

  export let params: { id: string; expenseId: string };
  let tripId: string = '';
  let expenseId: string = '';
  $: tripId = params?.id || '';
  $: expenseId = params?.expenseId || '';

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  // Trip data
  let members: Member[] = [];
  let baseCurrency: string = 'EUR';

  // Expense being edited
  let loadedExpense: Expense | null = null;

  // Form state
  let description = '';
  let amount = '';
  let category = '';
  let expenseCurrency: string = 'EUR';
  let incurredAtInput = '';
  let incurredAtEl: HTMLInputElement | null = null;

  // Allocations
  let payerUserId: string = '';
  let paymentMode: PaymentMode = 'payer';
  let paidByUserId: Record<string, string> = {};
  let paidPctByUserId: Record<string, string> = {};
  let paidCurrencyByUserId: Record<string, string> = {};
  let splitMode: SplitMode = 'equal';
  let splitByUserId: Record<string, string> = {};
  let splitPctByUserId: Record<string, string> = {};
  let selectedSplitUserIdMap: Record<string, boolean> = {};

  // Receipt preview (read-only for now)
  $: receiptUrl = expenseId ? `${API_BASE}/receipts/${expenseId}` : '';
  let receiptFailed = false;

  // Component reference
  let expenseForm: ExpenseForm;

  // Derived
  $: saveDisabled = !tripId || !expenseId || description.trim().length === 0 || Number(amount) <= 0;

  function toDatetimeLocal(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
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

  function validTotals(): string | null {
    const total = Number(amount) || 0;
    const splitSum = sumStrings(Object.fromEntries(Object.entries(splitByUserId).filter(([id]) => selectedSplitUserIdMap[id])));
    const paidSum = sumStrings(paidByUserId);
    if (Math.round(splitSum * 100) !== Math.round(total * 100)) return `Splits must sum to ${total.toFixed(2)}`;
    if (Math.round(paidSum * 100) !== Math.round(total * 100)) return `Payments must sum to ${total.toFixed(2)}`;
    return null;
  }

  async function load() {
    try {
      const [membersRes, expenseRes] = await Promise.all([
        api(`/trips/${tripId}/members`),
        api(`/expenses/${expenseId}`),
      ]);
      members = membersRes.members as Member[];
      baseCurrency = (membersRes.baseCurrency || 'EUR').toUpperCase();
      if (membersRes.owner) {
        const ownerUser = membersRes.owner as { id: string; username: string };
        if (!members.find((m) => m.user.id === ownerUser.id)) { members = [{ user: ownerUser }, ...members]; }
      }
      const e = expenseRes.expense as Expense;
      loadedExpense = e;
      description = e.description || '';
      amount = (e.amountCents / 100).toFixed(2);
      category = e.category || '';
      expenseCurrency = (e.currency || baseCurrency).toUpperCase();
      incurredAtInput = toDatetimeLocal(e.incurredAt);

      // Seed allocations from expense
      const allUserIds = [...new Set([...members.map(m => m.user.id), ...(me ? [me.id] : [])])];
      // Payments
      paidByUserId = Object.fromEntries(allUserIds.map((id) => [id, '0']));
      if (e.payments && e.payments.length > 0) {
        for (const p of e.payments) paidByUserId[p.userId] = (p.amountCents / 100).toFixed(2);
        const values = Object.values(paidByUserId).map(Number).filter((v) => v > 0);
        const allEq = values.length > 1 && values.every((v) => Math.abs(v - values[0]) < 0.005);
        paymentMode = allEq ? 'equal' : 'custom_amounts';
      } else {
        // Fallback: creator paid all
        paidByUserId[e.createdBy.id] = (e.amountCents / 100).toFixed(2);
        paymentMode = 'payer';
      }
      payerUserId = e.createdBy.id;
      paidCurrencyByUserId = Object.fromEntries(allUserIds.map((id) => [id, (e.currency || baseCurrency).toUpperCase()]));
      // seed percents
      const total = Number(amount) || 0;
      paidPctByUserId = Object.fromEntries(allUserIds.map((id) => {
        const v = Number(paidByUserId[id] || '0');
        return [id, total > 0 ? ((v * 100) / total).toFixed(2) : '0'];
      }));
      // Normalize
      expenseForm?.recalcPayments();

      // Splits
      const splitIds = [...new Set([...members.map(m => m.user.id), ...(me ? [me.id] : [])])];
      splitByUserId = Object.fromEntries(splitIds.map((id) => [id, '0']));
      for (const s of e.splits) splitByUserId[s.userId] = (s.amountCents / 100).toFixed(2);
      selectedSplitUserIdMap = Object.fromEntries(splitIds.map((id) => [id, Number(splitByUserId[id]) > 0]));
      const selectedIds = splitIds.filter((id) => selectedSplitUserIdMap[id]);
      const values = selectedIds.map((id) => Number(splitByUserId[id] || '0'));
      const splitsAllEq = values.length > 1 && values.every((v) => Math.abs(v - values[0]) < 0.005);
      splitMode = splitsAllEq ? 'equal' : 'custom_amounts';
      splitPctByUserId = Object.fromEntries(splitIds.map((id) => {
        const v = Number(splitByUserId[id] || '0');
        return [id, total > 0 ? ((v * 100) / total).toFixed(2) : '0'];
      }));
      expenseForm?.recalcSplits();
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function save() {
    const totalsError = validTotals();
    if (totalsError) { showError(totalsError); return; }
    try {
      const payments = Object.entries(paidByUserId)
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0, currency: (paidCurrencyByUserId[userId] || expenseCurrency).toUpperCase() }))
        .filter((p) => p.amount > 0);
      const splits = Object.entries(splitByUserId)
        .filter(([userId]) => selectedSplitUserIdMap[userId])
        .map(([userId, v]) => ({ userId, amount: Number(v) || 0 }))
        .filter((s) => s.amount > 0);
      const body: any = {
        description: description.trim(),
        amount: Number(amount) || 0,
        category: category || undefined,
        incurredAt: incurredAtInput ? new Date(incurredAtInput).toISOString() : undefined,
        currency: expenseCurrency.toUpperCase(),
        payments,
        splits,
      };
      await api(`/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(body) });
      showSuccess('Expense updated.');
      window.location.hash = `#/trip/${tripId}`;
    } catch (e: any) {
      showError(e.message);
    }
  }

  onMount(() => { if (tripId && expenseId) load(); });
</script>

<div class="mb-3">
  <a href={`#/trip/${tripId}`} class="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur px-3 py-1.5 shadow-sm hover:shadow transition">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>
    <span class="text-sm">Back to trip</span>
  </a>
  
</div>

<section class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold">Edit expense</h2>
  </div>

  <ExpenseForm 
    bind:this={expenseForm}
    {tripId}
    {members}
    {me}
    bind:description
    bind:amount
    bind:category
    bind:expenseCurrency
    bind:incurredAtInput
    bind:payerUserId
    bind:splitMode
    bind:paymentMode
    bind:splitByUserId
    bind:paidByUserId
    bind:paidPctByUserId
    bind:splitPctByUserId
    bind:paidCurrencyByUserId
    bind:selectedSplitUserIdMap
    showReceiptUpload={false}
    submitLabel="Save changes"
    cancelHref={`#/trip/${tripId}`}
    disabled={saveDisabled}
    on:submit={save}
  >
    <svelte:fragment slot="receipt">
      {#if !receiptFailed}
        <img src={receiptUrl} alt="Receipt" class="absolute inset-0 w-full h-full object-contain bg-white dark:bg-gray-900" on:error={() => receiptFailed = true} />
      {:else}
        <div class="absolute inset-0 flex items-center justify-center">
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-20">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="8" y1="21" x2="8" y2="15"></line>
            <line x1="16" y1="21" x2="16" y2="15"></line>
          </svg>
        </div>
      {/if}
    </svelte:fragment>
  </ExpenseForm>
</section>


