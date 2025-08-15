<script lang="ts">
  import { onMount } from 'svelte';
  import { api, API_BASE, download, fetchAuthed } from '../lib/api';
  import { currentUser } from '../lib/auth';
  import type { User } from '../lib/types';
  import { showError, showSuccess } from '../lib/alerts';

  let me: User | null = null;
  const unsub = currentUser.subscribe((u) => (me = u));

  let email: string = '';
  let username: string = '';
  let avatarPreview: string | null = null;
  let uploading = false;
  let saving = false;
  let changingPw = false;
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  type OwnedTrip = { id: string; name: string; createdAt: string; baseCurrency?: string };
  let ownedTrips: OwnedTrip[] = [];
  let loadingOwned = false;
  let importingTrip = false;
  let showImportModal = false;
  let newTripName: string = '';
  let importFile: File | null = null;

  async function load() {
    try {
      const { user } = await api('/me');
      email = user.email ?? '';
      username = user.username;
      currentUser.set(user);
      localStorage.setItem('user', JSON.stringify(user));
      // Load owned trips
      loadingOwned = true;
      try {
        const { trips } = await api('/me/trips/owned');
        ownedTrips = trips;
      } catch (e: any) {
        showError(e.message);
      } finally {
        loadingOwned = false;
      }
    } catch (e: any) {
      showError(e.message);
      if (!me) {
        window.location.hash = '#/';
      }
    }
  }

  function onImportFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) { importFile = null; return; }
    importFile = input.files[0];
  }

  async function confirmImportTrip() {
    if (!importFile) { showError('Please choose a CSV file'); return; }
    const form = new FormData();
    form.append('file', importFile);
    if (newTripName && newTripName.trim()) form.append('name', newTripName.trim());
    importingTrip = true;
    try {
      const res = await fetchAuthed('/trips/import', { method: 'POST', body: form });
      const text = await res.text().catch(() => '');
      let data: any = {};
      if (text) { try { data = JSON.parse(text); } catch {} }
      if (!res.ok) {
        const msg = data?.error || data?.message || `Import failed (${res.status})`;
        throw new Error(msg);
      }
      const trip = data?.trip;
      if (trip?.id) {
        showSuccess(`Created trip "${trip.name}"`);
        ownedTrips = [trip, ...ownedTrips];
      } else {
        showSuccess('Trip created');
        await load();
      }
      newTripName = '';
      importFile = null;
      showImportModal = false;
    } catch (e: any) {
      showError(e.message);
    } finally {
      importingTrip = false;
    }
  }

  async function saveProfile() {
    saving = true;
    try {
      const { user } = await api('/me', { method: 'PATCH', body: JSON.stringify({ email: email || null, username }) });
      currentUser.set(user);
      localStorage.setItem('user', JSON.stringify(user));
      showSuccess('Profile updated');
    } catch (e: any) {
      showError(e.message);
    } finally {
      saving = false;
    }
  }

  async function exportTrip(tripId: string, tripName: string) {
    try {
      await download(`/trips/${tripId}/expenses/export.csv`, `${tripName.replace(/[^a-z0-9\-_]+/gi, '_')}-expenses.csv`);
      showSuccess('Export started');
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function importTripCsv(tripId: string, ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetchAuthed(`/trips/${tripId}/expenses/import`, { method: 'POST', body: form });
      const text = await res.text().catch(() => '');
      let data: any = {};
      if (text) {
        try { data = JSON.parse(text); } catch {}
      }
      if (!res.ok) {
        const msg = data?.error || data?.message || `Import failed (${res.status})`;
        throw new Error(msg);
      }
      const imported = data.imported || 0;
      showSuccess(`Imported ${imported} expenses`);
      input.value = '';
    } catch (e: any) {
      showError(e.message);
    }
  }

  async function changePassword() {
    changingPw = true;
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('New password and confirmation do not match');
      }
      await api('/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      showSuccess('Password updated');
    } catch (e: any) {
      showError(e.message);
    } finally {
      changingPw = false;
    }
  }

  async function onAvatarChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    avatarPreview = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append('avatar', file);
    uploading = true;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:4000'}/me/avatar`, {
        method: 'POST',
        headers: { ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Upload failed');
      }
      const { user } = await res.json();
      currentUser.set(user);
      localStorage.setItem('user', JSON.stringify(user));
      showSuccess('Avatar updated');
    } catch (e: any) {
      showError(e.message);
    } finally {
      uploading = false;
    }
  }

  onMount(() => {
    if (!me) {
      window.location.hash = '#/';
      return () => unsub();
    }
    load();
    return () => unsub();
  });
</script>

<section class="max-w-3xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">Your Profile</h1>
    <p class="text-sm opacity-70">Manage your account information</p>
  </div>

  <div class="grid md:grid-cols-3 gap-6">
    <div class="md:col-span-1">
      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
        <div class="flex flex-col items-center text-center gap-3">
          <div class="relative">
            {#if me?.avatarUrl}
              <img src={(me.avatarUrl.startsWith('http') ? me.avatarUrl : `${API_BASE}${me.avatarUrl}`)} alt="Avatar" class="h-24 w-24 rounded-full object-cover border" />
            {:else if avatarPreview}
              <img src={avatarPreview} alt="Avatar preview" class="h-24 w-24 rounded-full object-cover border" />
            {:else}
              <div class="h-24 w-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-3xl font-semibold">
                {me?.username?.charAt(0)?.toUpperCase()}
              </div>
            {/if}
          </div>
          <label class="text-sm">
            <span class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 inline-block cursor-pointer">{uploading ? 'Uploading…' : 'Change photo'}</span>
            <input type="file" accept="image/*" class="hidden" on:change={onAvatarChange} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>

    <div class="md:col-span-2 space-y-6">
      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
        <h2 class="font-semibold mb-4">Profile</h2>
        <div class="grid gap-3">
          <div>
            <label for="profile-username" class="block text-sm mb-1">Username</label>
            <input id="profile-username" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={username} />
          </div>
          <div>
            <label for="profile-email" class="block text-sm mb-1">Email</label>
            <input id="profile-email" type="email" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={email} />
          </div>
          <div class="flex justify-end">
            <button class="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" on:click={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
        <h2 class="font-semibold mb-4">Change password</h2>
        <div class="grid gap-3">
          <div>
            <label for="current-password" class="block text-sm mb-1">Current password</label>
            <input id="current-password" type="password" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={currentPassword} />
          </div>
          <div>
            <label for="new-password" class="block text-sm mb-1">New password</label>
            <input id="new-password" type="password" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={newPassword} />
          </div>
          <div>
            <label for="confirm-password" class="block text-sm mb-1">Confirm new password</label>
            <input id="confirm-password" type="password" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={confirmPassword} />
            {#if newPassword && confirmPassword && newPassword !== confirmPassword}
              <div class="text-xs text-red-600 mt-1">Passwords do not match</div>
            {/if}
          </div>
          <div class="flex justify-end">
            <button class="px-4 py-2 rounded bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed" on:click={changePassword} disabled={changingPw || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}>{changingPw ? 'Updating…' : 'Update password'}</button>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">Your trips</h2>
          <div class="flex items-center gap-2">
            {#if loadingOwned}
              <span class="text-xs opacity-70">Loading…</span>
            {/if}
            <button class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed" on:click={() => { showImportModal = true; }} disabled={importingTrip}>
              Import Trip CSV
            </button>
          </div>
        </div>
        {#if ownedTrips.length === 0 && !loadingOwned}
          <div class="text-sm opacity-70">You don't own any trips yet.</div>
        {:else}
          <div class="grid gap-3">
            {#each ownedTrips as t}
              <div class="flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-gray-800/50">
                <div class="min-w-0">
                  <div class="font-medium truncate">{t.name}</div>
                  <div class="text-xs opacity-70">{new Date(t.createdAt).toLocaleDateString()} • Base {t.baseCurrency || 'EUR'}</div>
                </div>
                <div class="flex items-center gap-2">
                  <button class="px-3 py-1.5 rounded bg-gray-900 text-white text-sm dark:bg-gray-200 dark:text-gray-900" on:click={() => exportTrip(t.id, t.name)} title="Export CSV">Export</button>
                  <label class="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-sm cursor-pointer" title="Import CSV to create expenses (duplicates are skipped)">
                    Import CSV<input type="file" accept=".csv,text/csv" class="hidden" on:change={(ev) => importTripCsv(t.id, ev)} />
                  </label>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  {#if showImportModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <button class="absolute inset-0 bg-black/50" on:click={() => !importingTrip && (showImportModal = false)} aria-label="Close import modal"></button>
      <div class="relative w-full max-w-md mx-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h3 id="import-modal-title" class="font-semibold mb-4">Import trip from CSV</h3>
        <div class="space-y-3">
          <div>
            <label for="new-trip-name" class="block text-sm mb-1">Trip name (optional)</label>
            <input id="new-trip-name" class="w-full border rounded p-2 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700" bind:value={newTripName} placeholder="e.g. Summer in Italy" />
          </div>
          <div>
            <label for="import-csv-file" class="block text-sm mb-1">CSV file</label>
            <input id="import-csv-file" type="file" accept=".csv,text/csv" on:change={onImportFileChange} />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button class="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-sm" on:click={() => { if (!importingTrip) { showImportModal = false; } }} disabled={importingTrip}>Cancel</button>
            <button class="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed" on:click={confirmImportTrip} disabled={importingTrip || !importFile}>{importingTrip ? 'Importing…' : 'Import'}</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  :global(input) { outline: none; }
  :global(img) { user-select: none; }
  :global(button) { transition: background-color .15s ease, opacity .15s ease; }
  :global(label span) { transition: background-color .15s ease; }
</style>


