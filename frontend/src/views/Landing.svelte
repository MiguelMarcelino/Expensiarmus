<script lang="ts">
  import { currentUser } from '../lib/auth';
  let user: any;
  currentUser.subscribe((u) => (user = u));
</script>

<section class="mx-auto max-w-4xl text-center py-16">
  <h1 class="text-4xl font-bold mb-4">Track shared trip expenses with ease</h1>
  <p class="opacity-80 mb-8">Add expenses manually or via AI with natural language, split among participants, and keep balances clear.</p>

  {#if user}
    <a href="#/dashboard" class="inline-block px-6 py-3 rounded bg-blue-600 text-white hover:bg-blue-700">Go to Dashboard</a>
  {:else}
    <div class="space-x-3">
      <a href="#/login" class="inline-block px-6 py-3 rounded bg-gray-900 text-white hover:bg-black">Login</a>
      <a href="#/register" class="inline-block px-6 py-3 rounded bg-blue-600 text-white hover:bg-blue-700">Create account</a>
    </div>
  {/if}
</section>
