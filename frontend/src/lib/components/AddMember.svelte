<script lang="ts">
  import { api } from '../api';
  import { createEventDispatcher } from 'svelte';

  export let tripId: string;

  let memberUsername = '';
  let userSuggestions: { id: string; username: string; email?: string | null }[] = [];
  let searchingUsers = false;
  let userSearchTimer: any = null;

  const dispatch = createEventDispatcher<{ added: void; error: string }>();

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

  async function addMember() {
    try {
      const res = await api(`/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ username: memberUsername }) });
      if (res?.members) {
        dispatch('added');
      }
      memberUsername = '';
      userSuggestions = [];
    } catch (e: any) {
      dispatch('error', e.message || 'Failed to add member');
    }
  }
</script>

<div class="space-y-3">
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



