<script lang="ts">
  import { currentUser } from '../lib/auth';
  let user: any;
  currentUser.subscribe((u) => (user = u));

  // If already authenticated, skip the landing page
  $: if (user) {
    window.location.hash = '#/dashboard';
  }
</script>

<!-- Hero -->
<section class="relative overflow-hidden">
  <div class="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900"></div>
  <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-purple-400 to-indigo-400 dark:from-purple-600 dark:to-indigo-600"></div>
  <div class="absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-blue-400 to-cyan-400 dark:from-blue-700 dark:to-cyan-700"></div>

  <div class="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
    <div>
      <h1 class="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
        Track shared trip expenses with ease
      </h1>
      <p class="mt-5 text-lg opacity-80 leading-relaxed">
        Expensiarmus turns messy receipts and group IOUs into clear, shareable summaries. Add expenses
        in plain English with AI, split fairly, and keep everyone in sync.
      </p>
      <div class="mt-8 text-sm opacity-70">
        Already using Expensiarmus? Use the header to sign in and jump to your dashboard.
      </div>
    </div>

    <!-- Simple marketing illustration: people using phones -->
    <div class="relative mx-auto w-full max-w-md">
      <div class="absolute -inset-8 rounded-3xl bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-xl opacity-50 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800"></div>
      <div class="relative rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-xl">
        <svg viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
          <defs>
            <linearGradient id="grad" x1="0" x2="1">
              <stop offset="0%" stop-color="#6366f1"/>
              <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
          </defs>
          <!-- phones -->
          <g>
            <rect x="40" y="40" rx="28" ry="28" width="160" height="260" fill="#0ea5e9" opacity="0.1" stroke="#94a3b8"/>
            <rect x="50" y="60" rx="18" ry="18" width="140" height="220" fill="#ffffff"/>
            <rect x="320" y="20" rx="28" ry="28" width="160" height="280" fill="#a855f7" opacity="0.1" stroke="#94a3b8"/>
            <rect x="330" y="40" rx="18" ry="18" width="140" height="240" fill="#ffffff"/>
          </g>
          <!-- content mock -->
          <g>
            <rect x="65" y="80" width="110" height="14" rx="7" fill="#e2e8f0"/>
            <rect x="65" y="105" width="90" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="65" y="130" width="110" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="65" y="160" width="110" height="48" rx="8" fill="#f1f5f9"/>
            <rect x="65" y="220" width="110" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="65" y="240" width="80" height="10" rx="5" fill="#e2e8f0"/>

            <rect x="345" y="60" width="110" height="14" rx="7" fill="#e2e8f0"/>
            <rect x="345" y="85" width="90" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="345" y="110" width="110" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="345" y="140" width="110" height="80" rx="8" fill="#f1f5f9"/>
            <rect x="345" y="235" width="110" height="10" rx="5" fill="#e2e8f0"/>
            <rect x="345" y="255" width="80" height="10" rx="5" fill="#e2e8f0"/>
          </g>
          <!-- avatars -->
          <g>
            <circle cx="120" cy="208" r="12" fill="url(#grad)"/>
            <circle cx="400" cy="170" r="12" fill="#06b6d4"/>
            <circle cx="420" cy="170" r="12" fill="#f59e0b"/>
          </g>
        </svg>
      </div>
    </div>
  </div>
</section>

<!-- Features -->
<section class="mx-auto max-w-6xl px-6 py-16">
  <div class="grid md:grid-cols-3 gap-6">
    <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div class="text-indigo-600 dark:text-indigo-400 font-semibold">AI expense entry</div>
      <p class="mt-2 text-sm opacity-80">Type: "Two flights at 1500 each to my Japan trip" and let AI fill
 the details for you.</p>
    </div>
    <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div class="text-indigo-600 dark:text-indigo-400 font-semibold">Manual entry</div>
      <p class="mt-2 text-sm opacity-80">Prefer control? Add expenses the classic way with clear forms and editable splits.</p>
    </div>
    <div class="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div class="text-indigo-600 dark:text-indigo-400 font-semibold">Split & settle</div>
      <p class="mt-2 text-sm opacity-80">Automatically split between participants. See who owes whom at a glance.</p>
    </div>
  </div>
</section>

<!-- How it works -->
<section class="mx-auto max-w-6xl px-6 pb-16">
  <h2 class="text-2xl font-bold mb-6">How it works</h2>
  <div class="grid md:grid-cols-3 gap-6">
    <div class="rounded-xl bg-white dark:bg-gray-800 p-6 border border-black/5 dark:border-white/10">
      <div class="text-sm font-semibold opacity-70">Step 1</div>
      <div class="mt-1 font-semibold">Create a trip</div>
      <p class="mt-2 text-sm opacity-80">Invite your travel buddies and keep all expenses in one place.</p>
    </div>
    <div class="rounded-xl bg-white dark:bg-gray-800 p-6 border border-black/5 dark:border-white/10">
      <div class="text-sm font-semibold opacity-70">Step 2</div>
      <div class="mt-1 font-semibold">Add expenses</div>
      <p class="mt-2 text-sm opacity-80">Describe your expenses in natural language. Attach categories, types, amounts and split fairly.</p>
    </div>
    <div class="rounded-xl bg-white dark:bg-gray-800 p-6 border border-black/5 dark:border-white/10">
      <div class="text-sm font-semibold opacity-70">Step 3</div>
      <div class="mt-1 font-semibold">Share balances</div>
      <p class="mt-2 text-sm opacity-80">Everyone sees their share instantly—no spreadsheets, no headaches.</p>
    </div>
  </div>
</section>

<!-- People using it -->
<section class="mx-auto max-w-6xl px-6 pb-16">
  <div class="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-gray-800 p-8 grid md:grid-cols-2 gap-8 items-center">
    <div>
      <h3 class="text-xl font-bold">Made for groups on the go</h3>
      <p class="mt-2 text-sm opacity-80">Whether it's friends splitting a weekend getaway, colleagues on a business trip,
        or family holidays—Expensiarmus keeps everyone's costs transparent.
      </p>
      <ul class="mt-4 text-sm space-y-1 opacity-80 list-disc list-inside">
        <li>Mobile-friendly, works great on the go</li>
        <li>Fast entry, clear summaries</li>
        <li>Secure accounts with email + password</li>
      </ul>
    </div>
    <!-- phones row illustration -->
    <div class="relative mx-auto w-full max-w-lg">
      <div class="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-xl opacity-50 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800"></div>
      <div class="relative rounded-3xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 backdrop-blur p-6 shadow-xl">
        <svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
          <rect x="40" y="20" rx="24" ry="24" width="160" height="180" fill="#e5e7eb"/>
          <rect x="50" y="40" rx="14" ry="14" width="140" height="140" fill="#fff"/>
          <rect x="240" y="20" rx="24" ry="24" width="160" height="180" fill="#e5e7eb"/>
          <rect x="250" y="40" rx="14" ry="14" width="140" height="140" fill="#fff"/>
          <rect x="440" y="20" rx="24" ry="24" width="160" height="180" fill="#e5e7eb"/>
          <rect x="450" y="40" rx="14" ry="14" width="140" height="140" fill="#fff"/>
          <circle cx="120" cy="110" r="18" fill="#6366f1"/>
          <circle cx="320" cy="110" r="18" fill="#22c55e"/>
          <circle cx="520" cy="110" r="18" fill="#f97316"/>
          <rect x="90" y="140" width="60" height="10" rx="5" fill="#e5e7eb"/>
          <rect x="290" y="140" width="60" height="10" rx="5" fill="#e5e7eb"/>
          <rect x="490" y="140" width="60" height="10" rx="5" fill="#e5e7eb"/>
        </svg>
      </div>
    </div>
  </div>
</section>

<!-- Footer note -->
<section class="mx-auto max-w-6xl px-6 pb-24 text-center text-sm opacity-70">
  Use the header to sign in or create an account. Then open your dashboard to start tracking expenses.
</section>
