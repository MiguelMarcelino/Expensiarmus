<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { currentUser } from '../lib/auth';

  type Trip = { id: string; name: string; createdAt: string };
  let trips: Trip[] = [];
  let name = '';
  let error: string | null = null;
  let user: any;
  currentUser.subscribe((u) => (user = u));

  async function load() {
    if (!user) return;
    try {
      const res = await api('/trips');
      trips = res.trips;
    } catch (e: any) {
      error = e.message;
    }
  }

  async function createTrip() {
    try {
      const res = await api('/trips', { method: 'POST', body: JSON.stringify({ name }) });
      trips = [res.trip, ...trips];
      name = '';
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(load);
</script>

{#if !user}
  <div class="text-center mt-10">
    <p class="mb-4">Welcome! Please <a href="#/login" class="text-blue-600">login</a> or <a href="#/register" class="text-blue-600">register</a>.</p>
  </div>
{:else}
  <div class="flex items-center gap-3 mb-6">
    <input class="border rounded p-2 flex-1" placeholder="New trip name" bind:value={name} />
    <button class="px-4 py-2 rounded bg-blue-600 text-white" on:click={createTrip} disabled={!name}>Create</button>
  </div>

  {#if error}<p class="text-sm text-red-600 mb-3">{error}</p>{/if}

  <div class="grid gap-3">
    {#each trips as t}
      <a href={`#/trip/${t.id}`} class="block bg-white dark:bg-gray-800 rounded p-4 shadow hover:shadow-md">
        <div class="font-semibold">{t.name}</div>
        <div class="text-sm opacity-70">{new Date(t.createdAt).toLocaleString()}</div>
      </a>
    {/each}
  </div>
{/if}
