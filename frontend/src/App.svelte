<script lang="ts">
  import Router from 'svelte-spa-router';
  import routes from './routes';
  import { currentUser, loadFromStorage, logout } from './lib/auth';
  import type { User } from './lib/types';
  import { onMount } from 'svelte';
  import { alert } from './lib/alerts';
  import AlertBanner from './lib/components/AlertBanner.svelte';
  import { API_BASE } from './lib/api';

  let user: User | null = null;
  const unsubscribe = currentUser.subscribe((u) => (user = u));
  onMount(() => {
    loadFromStorage();
    return () => unsubscribe();
  });
</script>

<nav class="border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-20 dark:bg-gray-800/60">
  <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
    <a href={user ? '#/dashboard' : '#/'} class="font-semibold">Expensiarmus</a>
    <div class="flex items-center gap-3">
      {#if user}
        <a href="#/profile" class="flex items-center gap-2 group">
          {#if user.avatarUrl}
            <img
              src={(user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_BASE}${user.avatarUrl}`)}
              alt="Profile"
              class="h-7 w-7 rounded-full object-cover border border-black/10 dark:border-white/10"
            />
          {:else}
            <div class="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold">
              {user.username.charAt(0).toUpperCase()}
            </div>
          {/if}
          <span class="text-sm opacity-80 group-hover:underline">{user.username}</span>
        </a>
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

{#if $alert.visible && $alert.message}
  <AlertBanner show={$alert.visible} message={$alert.message} type={$alert.type} offsetTop={72} />
{/if}

<style>
  :global(a) { text-decoration: none; }
</style>
