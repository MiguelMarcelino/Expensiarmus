<script lang="ts">
  import { onMount } from 'svelte';
  import { api, apiDelete } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import { showError, showSuccess } from '../lib/alerts';
  import AddMemberSpotlight from '../lib/components/AddMemberSpotlight.svelte';
  import ConfirmationDialog from '../lib/components/ConfirmationDialog.svelte';
  import type { Member, User } from '../lib/types';
  import { currencies } from '../lib/constants/currencies';

  export let params: { id: string };
  let tripId: string = '';
  $: tripId = params?.id || '';

  let me: User | null = null;
  currentUser.subscribe((u) => (me = u));

  let tripName = '';
  let baseCurrency = 'EUR';
  let members: Member[] = [];
  let owner: { id: string; username: string; email?: string | null } | null = null;
  let loading = true;
  let showAddMember = false;
  let editingTripName = false;
  let editTripName = '';
  let editingCurrency = false;
  let editCurrency = '';
  let showRemoveMemberDialog = false;
  let removeMemberData: { id: string; username: string } | null = null;
  let showDeleteTripDialog = false;

  $: canEdit = !!me && owner && me.id === owner.id;

  onMount(() => {
    loadTripData();
  });

  async function loadTripData() {
    try {
      loading = true;
      const response = await api(`/trips/${tripId}/members`);
      members = response.members || [];
      owner = response.owner || null;
      tripName = response.tripName || '';
      baseCurrency = response.baseCurrency || 'EUR';
      editTripName = tripName;
      editCurrency = baseCurrency;
    } catch (e: any) {
      showError(e.message || 'Failed to load trip data');
    } finally {
      loading = false;
    }
  }

  function showRemoveConfirmation(userId: string) {
    if (!canEdit) return;
    
    const member = members.find(m => m.user.id === userId);
    if (!member) return;

    removeMemberData = { id: userId, username: member.user.username };
    showRemoveMemberDialog = true;
  }

  async function confirmRemoveMember() {
    if (!removeMemberData) return;

    try {
      const response = await api(`/trips/${tripId}/members/${removeMemberData.id}`, { method: 'DELETE' });
      members = response.members || [];
      showSuccess(`${removeMemberData.username} has been removed from the trip`);
    } catch (e: any) {
      showError(e.message || 'Failed to remove member');
    } finally {
      showRemoveMemberDialog = false;
      removeMemberData = null;
    }
  }

  function cancelRemoveMember() {
    showRemoveMemberDialog = false;
    removeMemberData = null;
  }

  function showDeleteTripConfirmation() {
    if (!canEdit) return;
    showDeleteTripDialog = true;
  }

  async function confirmDeleteTrip() {
    if (!canEdit) return;
    try {
      await apiDelete(`/trips/${tripId}`);
      showSuccess('Trip deleted successfully');
      window.location.hash = '#/dashboard';
    } catch (e: any) {
      showError(e.message || 'Failed to delete trip');
    } finally {
      showDeleteTripDialog = false;
    }
  }

  function cancelDeleteTrip() {
    showDeleteTripDialog = false;
  }

  async function saveTripName() {
    if (!canEdit || !editTripName.trim()) return;
    
    try {
      await api(`/trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editTripName.trim() })
      });
      tripName = editTripName.trim();
      editingTripName = false;
      showSuccess('Trip name updated');
    } catch (e: any) {
      showError(e.message || 'Failed to update trip name');
    }
  }

  async function saveCurrency() {
    if (!canEdit || !editCurrency.trim()) return;
    
    try {
      await api(`/trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify({ baseCurrency: editCurrency.trim().toUpperCase() })
      });
      baseCurrency = editCurrency.trim().toUpperCase();
      editingCurrency = false;
      showSuccess('Base currency updated');
    } catch (e: any) {
      showError(e.message || 'Failed to update currency');
    }
  }

  function cancelTripNameEdit() {
    editTripName = tripName;
    editingTripName = false;
  }

  function cancelCurrencyEdit() {
    editCurrency = baseCurrency;
    editingCurrency = false;
  }

  function onMemberAdded() {
    showAddMember = false;
    loadTripData();
  }
</script>

<!-- Back to trip -->
<div class="mb-6">
  <a href="#/trip/{tripId}" class="inline-flex items-center gap-2 rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 backdrop-blur px-3 py-1.5 shadow-sm hover:shadow transition">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>
    <span class="text-sm">Back to trip</span>
  </a>
</div>

<!-- Header -->
<div class="mb-8">
  <div class="relative overflow-hidden rounded-3xl">
    <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900"></div>
    <div class="absolute -top-28 -right-28 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-purple-400 to-indigo-400 dark:from-purple-600 dark:to-indigo-600"></div>
    <div class="absolute -bottom-28 -left-28 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-blue-400 to-cyan-400 dark:from-blue-700 dark:to-cyan-700"></div>
    
    <div class="relative px-6 py-8 md:px-8 md:py-10">
      <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
        <div>
          <div class="text-sm opacity-70">Trip</div>
          <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight">Settings</h1>
          <p class="text-sm opacity-70 mt-2">Manage your trip details and members</p>
        </div>
      </div>
    </div>
  </div>
</div>

    {#if loading}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    {:else}
      <div class="space-y-8">
        <!-- Trip Information -->
        <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
          <h2 class="text-xl font-semibold mb-6">Trip Information</h2>
          
          <div class="space-y-6">
            <!-- Trip Name -->
            <div>
              <label for="trip-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trip Name</label>
              {#if editingTripName && canEdit}
                <div class="flex items-center space-x-3">
                  <input
                    id="trip-name"
                    type="text"
                    bind:value={editTripName}
                    class="flex-1 rounded-lg border-black/20 dark:border-white/20 bg-white/70 dark:bg-gray-800/60 backdrop-blur shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:bg-white/90 dark:focus:bg-gray-800/80"
                    placeholder="Enter trip name"
                  />
                  <button
                    on:click={saveTripName}
                    class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Save
                  </button>
                  <button
                    on:click={cancelTripNameEdit}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <div class="flex items-center justify-between">
                  <span class="font-medium">{tripName || 'Untitled Trip'}</span>
                  {#if canEdit}
                    <button
                      on:click={() => editingTripName = true}
                      class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Base Currency -->
            <div>
              <label for="base-currency" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base Currency</label>
              {#if editingCurrency && canEdit}
                <div class="flex items-center space-x-3">
                  <select
                    id="base-currency"
                    bind:value={editCurrency}
                    class="flex-1 rounded-lg border-black/20 dark:border-white/20 bg-white/70 dark:bg-gray-800/60 backdrop-blur shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:bg-white/90 dark:focus:bg-gray-800/80"
                  >
                    {#each currencies as currency}
                      <option value={currency}>{currency}</option>
                    {/each}
                  </select>
                  <button
                    on:click={saveCurrency}
                    class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Save
                  </button>
                  <button
                    on:click={cancelCurrencyEdit}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <div class="flex items-center justify-between">
                  <span class="font-medium">{baseCurrency}</span>
                  {#if canEdit}
                    <button
                      on:click={() => editingCurrency = true}
                      class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Trip Owner -->
            <div>
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trip Owner</span>
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span class="text-indigo-600 font-medium text-sm">
                    {owner?.username?.charAt(0).toUpperCase() || 'O'}
                  </span>
                </div>
                <div>
                  <p class="font-medium">{owner?.username || 'Unknown'}</p>
                  {#if owner?.email}
                    <p class="text-gray-500 text-sm">{owner.email}</p>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Members Management -->
        <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold">Trip Members</h2>
            {#if canEdit}
              <button
                on:click={() => showAddMember = true}
                class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Member
              </button>
            {/if}
          </div>

          <div class="space-y-3">
            {#if members.length === 0}
              <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.121M9 20H4v-2a3 3 0 015.196-2.121m4.804 0a3 3 0 010 4.242M12 14a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                <p class="text-sm">No members in this trip yet</p>
              </div>
            {:else}
              {#each members as member}
                <div class="flex items-center justify-between p-4 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span class="text-indigo-600 font-medium">
                        {member.user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p class="font-medium">{member.user.username}</p>
                      {#if 'email' in member.user && member.user.email}
                        <p class="text-gray-500 text-sm">{member.user.email}</p>
                      {/if}
                      {#if member.user.joinedAt}
                        <p class="text-gray-400 text-xs">
                          Joined {new Date(member.user.joinedAt).toLocaleDateString()}
                        </p>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="flex items-center space-x-2">
                    {#if member.user.id === owner?.id}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Owner
                      </span>
                    {:else}
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        Member
                      </span>
                      {#if canEdit}
                        <button
                          on:click={() => showRemoveConfirmation(member.user.id)}
                          class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Remove member"
                          aria-label="Remove member {member.user.username}"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      {/if}
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Danger Zone -->
        {#if canEdit}
          <div class="rounded-3xl border border-red-500/20 dark:border-red-500/30 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg p-4">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L5.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div class="flex-1">
                  <h3 class="text-red-900 dark:text-red-200 font-medium">Delete Trip</h3>
                  <p class="text-red-700 dark:text-red-300 text-sm mt-1">
                    Once you delete a trip, there is no going back. This will permanently delete the trip and all associated expenses.
                  </p>
                  <button
                    on:click={showDeleteTripConfirmation}
                    class="mt-3 inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-500/30 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 bg-white/70 dark:bg-gray-800/60 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Delete Trip
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

<!-- Delete Trip Confirmation Dialog -->
<ConfirmationDialog
  open={showDeleteTripDialog}
  title="Delete Trip"
  message="This will permanently delete <strong>{tripName}</strong> and all its expenses. This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  danger={true}
  on:confirm={confirmDeleteTrip}
  on:cancel={cancelDeleteTrip}
/>

<!-- Remove Member Confirmation Dialog -->
<ConfirmationDialog
  open={showRemoveMemberDialog}
  title="Remove Member"
  message="Are you sure you want to remove <strong>{removeMemberData?.username || ''}</strong> from this trip? This action cannot be undone."
  confirmText="Remove"
  cancelText="Cancel"
  danger={true}
  on:confirm={confirmRemoveMember}
  on:cancel={cancelRemoveMember}
/>

<!-- Add Member Modal -->
<AddMemberSpotlight
  {tripId}
  open={showAddMember}
  on:added={onMemberAdded}
  on:close={() => showAddMember = false}
/>
