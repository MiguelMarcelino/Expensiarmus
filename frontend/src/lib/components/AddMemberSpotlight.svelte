<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { api } from '../api';
  import { fade, scale } from 'svelte/transition';

  export let tripId: string;
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{ added: void; close: void }>();

  let memberUsername = '';
  let userSuggestions: { id: string; username: string; email?: string | null }[] = [];
  let searchingUsers = false;
  let userSearchTimer: any = null;
  let inputEl: HTMLInputElement | null = null;

  function close() {
    memberUsername = '';
    userSuggestions = [];
    dispatch('close');
  }

  onMount(() => {
    const focusTimer = setTimeout(() => inputEl?.focus(), 0);
    return () => clearTimeout(focusTimer);
  });

  function onMemberInput() {
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

  async function addMember() {
    if (!memberUsername.trim()) return;
    try {
      const res = await api(`/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ username: memberUsername }) });
      if (res?.members) {
        dispatch('added');
      }
      memberUsername = '';
      userSuggestions = [];
      close();
    } catch (e) {
      // bubble up? keep overlay open to let retry
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-40">
    <button type="button" class="absolute inset-0" aria-label="Close" tabindex="0" on:click={close} on:keydown={(e) => { if ((e as KeyboardEvent).key === 'Escape') close(); }} in:fade={{ duration: 150 }} out:fade={{ duration: 120 }} style="background-color: rgba(0,0,0,0.45);"></button>
    <div class="absolute inset-0 flex items-start justify-center pt-24 px-4">
      <div class="w-full max-w-5xl" in:scale={{ duration: 180, start: 0.98 }} out:scale={{ duration: 120 }}>
        <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/90 dark:bg-gray-800/80 backdrop-blur shadow-xl">
          <div class="p-4 sm:p-5 flex items-center gap-3 border-b border-black/5 dark:border-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="opacity-70"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input bind:this={inputEl} class="flex-1 bg-transparent outline-none p-1 text-base" placeholder="Add a member by username or email" bind:value={memberUsername} on:input={onMemberInput} on:keydown={(e) => { const k = (e as any).key; if (k === 'Enter') addMember(); if (k === 'Escape') close(); }} />
            <button class="px-3 py-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={addMember} disabled={!memberUsername.trim()}>Add</button>
            <button class="px-2 py-1.5 rounded-md border border-black/5 dark:border-white/10" on:click={close} aria-label="Close">Close</button>
          </div>
          <div class="max-h-80 overflow-auto">
            {#if memberUsername.trim().length === 0}
              <div class="p-4 text-sm opacity-70">Type to search for users…</div>
            {:else if searchingUsers}
              <div class="p-4 text-sm opacity-70">Searching…</div>
            {:else if userSuggestions.length === 0}
              <div class="p-4 text-sm opacity-70">No matches</div>
            {:else}
              <ul class="divide-y divide-black/5 dark:divide-white/10">
                {#each userSuggestions as u}
                  <li>
                    <button type="button" class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center justify-between gap-3" on:click={() => selectUserSuggestion(u)}>
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
        </div>
      </div>
    </div>
  </div>
{/if}


