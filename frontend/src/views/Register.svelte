<script lang="ts">
  import { register } from '../lib/auth';

  let username = '';
  let email = '';
  let password = '';
  let error: string | null = null;

  async function submit() {
    error = null;
    try {
      await register(username, password, email || undefined);
      window.location.hash = '#/dashboard';
    } catch (e: any) {
      error = e.message;
    }
  }
</script>

<div class="max-w-md mx-auto mt-10 bg-white dark:bg-gray-800 p-6 rounded shadow">
  <h1 class="text-xl font-semibold mb-4">Create account</h1>
  {#if error}<p class="text-sm text-red-600 mb-3">{error}</p>{/if}
  <form on:submit|preventDefault={submit} class="space-y-3">
    <div>
      <label for="username" class="block text-sm mb-1">Username</label>
      <input id="username" class="w-full border rounded p-2 bg-transparent dark:bg-transparent" bind:value={username} required />
    </div>
    <div>
      <label for="email" class="block text-sm mb-1">Email (optional)</label>
      <input id="email" type="email" class="w-full border rounded p-2 bg-transparent dark:bg-transparent" bind:value={email} />
    </div>
    <div>
      <label for="password" class="block text-sm mb-1">Password</label>
      <input id="password" type="password" class="w-full border rounded p-2 bg-transparent dark:bg-transparent" bind:value={password} required />
    </div>
    <button class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Register</button>
  </form>
</div>
