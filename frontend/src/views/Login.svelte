<script lang="ts">
  import { login } from '../lib/auth';

  let username = '';
  let password = '';
  let error: string | null = null;

  async function submit() {
    error = null;
    try {
      await login(username, password);
      window.location.hash = '#/dashboard';
    } catch (e: any) {
      error = e.message;
    }
  }
</script>

<div class="max-w-md mx-auto mt-10 bg-white dark:bg-gray-800 p-6 rounded shadow">
  <h1 class="text-xl font-semibold mb-4">Login</h1>
  {#if error}<p class="text-sm text-red-600 mb-3">{error}</p>{/if}
  <form on:submit|preventDefault={submit} class="space-y-3">
    <div>
      <label class="block text-sm mb-1">Username</label>
      <input class="w-full border rounded p-2 bg-transparent dark:bg-transparent" bind:value={username} required />
    </div>
    <div>
      <label class="block text-sm mb-1">Password</label>
      <input type="password" class="w-full border rounded p-2 bg-transparent dark:bg-transparent" bind:value={password} required />
    </div>
    <button class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Login</button>
  </form>
</div>
