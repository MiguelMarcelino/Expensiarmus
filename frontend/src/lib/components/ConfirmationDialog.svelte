<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = 'Confirm Action';
  export let message = 'Are you sure you want to proceed?';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let danger = false; // Use red styling for dangerous actions

  const dispatch = createEventDispatcher();

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleBackdropClick() {
    handleCancel();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div 
      class="absolute inset-0 bg-black/40" 
      role="button" 
      tabindex="0" 
      on:click={handleBackdropClick} 
      on:keydown={handleKeydown}
    ></div>
    <div class="relative z-50 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 shadow-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">{title}</h3>
        <button 
          class="px-2 py-1 text-sm rounded-md border border-black/5 dark:border-white/10" 
          on:click={handleCancel}
        >
          Close
        </button>
      </div>
      <p class="text-sm opacity-80 mb-4">
        {@html message}
      </p>
      <div class="flex items-center justify-end gap-2">
        <button 
          class="px-3 py-2 rounded-md border border-black/5 dark:border-white/10" 
          on:click={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="px-3 py-2 rounded-md {danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'} transition-colors" 
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
