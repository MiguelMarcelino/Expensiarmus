<script lang="ts">
  import Router from 'svelte-spa-router';
  import routes from './routes';
  import { currentUser, loadFromStorage, logout } from './lib/auth';
  import type { User } from './lib/auth';
  import { onMount } from 'svelte';

  let user: User | null = null;
  const unsubscribe = currentUser.subscribe((u) => (user = u));
  onMount(() => {
    loadFromStorage();
    return () => unsubscribe();
  });
</script>

<nav class="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-10 dark:bg-gray-800/60">
  <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
    <a href="#/" class="font-semibold">ExpensiArmus</a>
    <div class="flex items-center gap-3">
      {#if user}
        <a href="#/dashboard" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">Dashboard</a>
        <span class="text-sm opacity-80">{user.username}</span>
        <button class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700" on:click={logout}>Logout</button>
      {:else}
        <a href="#/login" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">Login</a>
        <a href="#/register" class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">Register</a>
      {/if}
    </div>
  </div>
</nav>

<main class="mx-auto max-w-5xl p-4">
  <Router {routes} />
</main>

<style>
  :global(a) { text-decoration: none; }
</style>
