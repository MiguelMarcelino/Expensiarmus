<script lang="ts">
  import ExpenseIcon from './ExpenseIcon.svelte';
  import type { Expense } from '../types';
  import { createEventDispatcher } from 'svelte';

  export let expense: Expense;
  export let centsToString: (c: number) => string;
  export let payerName: (e: Expense) => string;

  const dispatch = createEventDispatcher<{ edit: Expense; delete: { id: string; label: string } }>();

  function onEdit() {
    dispatch('edit', expense);
  }
  function onDelete() {
    dispatch('delete', { id: expense.id, label: expense.description });
  }
</script>

<div class="group rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur p-4 shadow-sm hover:shadow transition flex items-start justify-between">
  <div class="flex items-start gap-3 min-w-0">
    <ExpenseIcon description={expense.description} category={expense.category} expenseType={expense.expenseType} />
    <div class="min-w-0">
      <div class="font-medium truncate">{expense.description}</div>
      <div class="mt-1 text-xs opacity-70 flex flex-wrap items-center gap-2">
        {#if expense.expenseType || expense.category}
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-700 dark:text-gray-200 border border-gray-500/20">{expense.expenseType || expense.category}</span>
        {/if}
        <span class="truncate">paid by {payerName(expense)}</span>
        <span class="opacity-60">·</span>
        <span class="truncate">added by {expense.createdBy.username}</span>
        <span class="opacity-60">·</span>
        <span>{new Date(expense.incurredAt).toLocaleString()}</span>
      </div>
    </div>
  </div>
  <div class="text-right min-w-[160px]">
    <div class="font-semibold tabular-nums">{expense.currency || 'EUR'} ${centsToString(expense.amountCents)}</div>
    <div class="mt-2">
      <div class="inline-flex items-center gap-2">
        <button class="px-2 py-1 rounded-md text-xs border border-black/5 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-700/40" on:click={onEdit}>Edit</button>
        <button class="px-2 py-1 rounded-md text-xs border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" on:click={onDelete}>Delete</button>
      </div>
    </div>
  </div>
</div>



