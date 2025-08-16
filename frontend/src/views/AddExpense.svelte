<script lang="ts">
  import { onMount } from 'svelte';
  import { api, fetchAuthed } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { Member, User, SplitMode, PaymentMode } from '../lib/types';
  import { showError, showSuccess } from '../lib/alerts';
  import { ocrReceipt } from '../lib/receipt';
  import ExpenseForm from '../lib/components/ExpenseForm.svelte';

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
  let addActiveTab: 'manual' | 'ai' = 'manual';
  let receiptFile: File | null = null;
  let receiptPreviewUrl: string | null = null;
  let receiptInputEl: HTMLInputElement | null = null;
  let scanning = false;
  let scanStatus = '';

  // Component reference
  let expenseForm: ExpenseForm;

  // Derived properties for form validation

  $: addDisabled = !tripId || description.trim().length === 0 || Number(amount) <= 0;

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

  async function onScanReceipt() {
    if (!receiptFile) { showError('Select a receipt image first.'); return; }
    if (receiptFile.type && receiptFile.type.toLowerCase().includes('pdf')) {
      showError('PDF is not supported yet. Please upload an image (JPG/PNG).');
      return;
    }
    try {
      scanning = true;
      scanStatus = 'Recognizing text...';
      const parsed = await ocrReceipt(receiptFile);
      if (parsed.description && !description) description = parsed.description;
      if (parsed.amount && !amount) { 
        amount = parsed.amount.toFixed(2); 
        expenseForm?.recalcPayments();
      }
      if (parsed.currency) {
        const cur = parsed.currency.toUpperCase();
        const currencies = ['EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK'];
        if (currencies.includes(cur)) expenseCurrency = cur;
      }
      if (parsed.incurredAt) {
        const dt = toDatetimeLocal(parsed.incurredAt);
        if (dt) incurredAtInput = dt;
      }
      showSuccess('Receipt parsed. Review and submit.');
    } catch (e: any) {
      showError(e?.message || 'Failed to scan receipt');
    } finally {
      scanning = false;
      scanStatus = '';
    }
  }

  function onPickReceipt() {
    receiptInputEl?.click();
  }
  function onReceiptChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    setReceiptFile(f);
  }
  function setReceiptFile(f: File | null) {
    receiptFile = f;
    if (receiptPreviewUrl) { URL.revokeObjectURL(receiptPreviewUrl); receiptPreviewUrl = null; }
    if (receiptFile) { receiptPreviewUrl = URL.createObjectURL(receiptFile); }
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
    expenseForm?.recalcSplits();
    expenseForm?.recalcPayments();
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
      if (receiptFile) {
        const form = new FormData();
        form.append('tripId', tripId);
        form.append('description', description.trim());
        form.append('amount', String(amountNum));
        if (category) form.append('category', category);
        if (incurredAtInput) form.append('incurredAt', new Date(incurredAtInput).toISOString());
        if (payerUserId) form.append('payerUserId', payerUserId);
        form.append('currency', expenseCurrency.toUpperCase());
        form.append('splits', JSON.stringify(splits));
        form.append('payments', JSON.stringify(payments));
        form.append('receipt', receiptFile);
        const res = await fetchAuthed('/expenses/with-receipt', { method: 'POST', body: form });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let msg = `Request failed: ${res.status}`;
          try { if (text) { const j = JSON.parse(text); msg = (j?.error || j?.message || msg); } } catch {}
          throw new Error(msg);
        }
      } else {
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
      }
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
      // Initialize form state
      initializeForm();
    } catch (e: any) {
      showError(e.message);
    }
  }

  function initializeForm() {
    const allUsers = members.length > 0 ? members.map((m) => m.user) : (me ? [{ id: me.id, username: me.username }] : []);
    const participantIds = allUsers.filter((u) => u.id !== payerUserId).map((u) => u.id);
    selectedSplitUserIdMap = Object.fromEntries(participantIds.map((id) => [id, true]));
    splitByUserId = Object.fromEntries(participantIds.map((id) => [id, '0']));
    const payerIds = allUsers.map((u) => u.id);
    paidByUserId = Object.fromEntries(payerIds.map((id) => [id, id === payerUserId ? '0' : '0']));
    paidCurrencyByUserId = Object.fromEntries(payerIds.map((id) => [id, expenseCurrency]));
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
  <div class="flex items-center gap-2 border-b border-black/5 dark:border-white/10 -mx-6 px-6 pb-3">
    <button class="px-3 py-2 text-sm rounded-t-lg {addActiveTab==='manual' ? 'bg-indigo-600 text-white' : ''}"
      on:click={() => addActiveTab='manual'}>Manual</button>
    <button class="px-3 py-2 text-sm rounded-t-lg {addActiveTab==='ai' ? 'bg-indigo-600 text-white' : ''}"
      on:click={() => addActiveTab='ai'}>
      <span class="inline-flex items-center gap-1">
        <span>Describe</span>
        <span aria-hidden="true">✨</span>
      </span>
    </button>
  </div>

  {#if addActiveTab === 'manual'}
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
    bind:receiptPreviewUrl
    bind:receiptFile
    showReceiptUpload={true}
    {scanning}
    submitLabel="Add expense"
    cancelHref={`#/trip/${tripId}`}
    disabled={addDisabled}
    on:submit={addExpense}
    on:receiptPick={onPickReceipt}
    on:receiptScan={onScanReceipt}
    on:receiptChange={onReceiptChange}
  />
  {:else}
  <div class="space-y-3 pt-2">
    <div class="text-sm opacity-80">Describe the expense or paste a receipt summary. We’ll parse and add it.</div>
    <textarea class="w-full p-2 rounded-lg bg-white dark:bg-gray-800" rows="5" placeholder="Describe the expense..." bind:value={aiInput}></textarea>
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
  </div>
  {/if}
</section>

