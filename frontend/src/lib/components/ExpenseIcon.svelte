<script lang="ts">
  export let description: string = '';
  export let category: string | undefined;
  export let expenseType: string | undefined;
  function iconName(text: string): string {
    const t = text.toLowerCase();
    if (/flight|air|plane|airfare|airport/.test(t)) return 'plane';
    if (/(train|rail)/.test(t)) return 'train';
    if (/(bus|coach)/.test(t)) return 'bus';
    if (/(taxi|uber|lyft|cab|car|rental)/.test(t)) return 'car';
    if (/(fuel|gas|petrol)/.test(t)) return 'fuel';
    if (/(boat|ferry|ship)/.test(t)) return 'ferry';
    if (/(metro|subway|underground)/.test(t)) return 'subway';
    if (/(hotel|hostel|lodg|accom|stay|room|bnb)/.test(t)) return 'hotel';
    if (/(food|meal|dinner|lunch|breakfast|restaurant|eat|snack)/.test(t)) return 'food';
    if (/(drink|bar|beer|wine|cocktail)/.test(t)) return 'drinks';
    if (/(grocery|grocer|supermarket)/.test(t)) return 'grocery';
    if (/(shop|shopping|souvenir|gift)/.test(t)) return 'shopping';
    if (/(ticket|museum|show|concert|cinema|theatre|theater)/.test(t)) return 'ticket';
    if (/(tour|activity|excursion|experience|attraction)/.test(t)) return 'activity';
    if (/(wifi|internet|data|sim|phone)/.test(t)) return 'wifi';
    if (/(insurance|insur)/.test(t)) return 'shield';
    if (/(fee|misc|service|charge)/.test(t)) return 'receipt';
    if (/(laundry|wash)/.test(t)) return 'laundry';
    if (/(parking|park)/.test(t)) return 'parking';
    return 'wallet';
  }

  $: label = (expenseType || category || description || 'expense');
  $: name = iconName(`${expenseType || ''} ${category || ''} ${description || ''}`);
</script>

<div class="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20"
     aria-label={label}
     title={label}>
  {#if name === 'plane'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.18 9"/><path d="M10.18 9l-6.18 3 6.18 3v7l5-4 5 4v-7l3-1.5-3-1.5v-3l-5-4-5 4v3z"/></svg>
  {:else if name === 'train'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><line x1="8" y1="21" x2="12" y2="17"/><line x1="16" y1="21" x2="12" y2="17"/><line x1="8" y1="7" x2="16" y2="7"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/></svg>
  {:else if name === 'bus'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="13" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></svg>
  {:else if name === 'car'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5"/><path d="M5 16h14"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>
  {:else if name === 'fuel'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M13 6h3a2 2 0 0 1 2 2v7a3 3 0 0 0 6 0V8a2 2 0 0 0-2-2h-1"/><path d="M7 10h6"/></svg>
  {:else if name === 'ferry'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M4 12h16l-2-5h-8l-2 5z"/><path d="M8 7V3h4v4"/></svg>
  {:else if name === 'subway'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><line x1="9" y1="21" x2="12" y2="18"/><line x1="15" y1="21" x2="12" y2="18"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>
  {:else if name === 'hotel'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h14a4 4 0 0 1 4 4v6H3z"/><path d="M7 7v10"/><path d="M3 17h18"/><rect x="3" y="7" width="10" height="4"/></svg>
  {:else if name === 'food'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a2 2 0 0 0 2 2h2V3"/><path d="M10 3v10"/><path d="M14 7h6l-1 12h-4z"/></svg>
  {:else if name === 'drinks'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18l-2 7H5z"/><path d="M6 10v7a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-7"/></svg>
  {:else if name === 'grocery'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l3 12h10l2-7H6"/></svg>
  {:else if name === 'shopping'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7l1-3h10l1 3"/><path d="M6 7h12l-1 12H7z"/><path d="M9 11v-1a3 3 0 0 1 6 0v1"/></svg>
  {:else if name === 'ticket'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v6H3z"/><path d="M7 9v6"/><path d="M17 9v6"/></svg>
  {:else if name === 'activity'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 5-4 9-9 9S3 15 3 10 7 1 12 1s9 4 9 9z"/><path d="M12 5v6l4 2"/></svg>
  {:else if name === 'wifi'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12" y2="20"/></svg>
  {:else if name === 'shield'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  {:else if name === 'receipt'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h14l2 2v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2V4z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h6"/></svg>
  {:else if name === 'laundry'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="7" cy="7" r="1"/><circle cx="11" cy="7" r="1"/></svg>
  {:else if name === 'parking'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7a5 5 0 0 1 0 10H6z"/><line x1="6" y1="13" x2="6" y2="21"/></svg>
  {:else}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H8"/><path d="M20 11H8"/><path d="M14 15H8"/><path d="M4 6v12"/></svg>
  {/if}
</div>

<style>
  svg { display: block; }
  </style>



