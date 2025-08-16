# Frontend (Svelte + Vite + Tailwind)

## Setup

1) Install deps
```
npm i
```

2) Environment

Create `.env`:
```
VITE_API_BASE="http://localhost:4000"
```

3) Run dev server
```
npm run dev
```
App will run at http://localhost:5173

## What’s included

- Tailwind CSS v3 configured (`tailwind.config.cjs`, `postcss.config.js`, `src/app.css`)
- Simple SPA router (hash-based)
- Pages
  - `Login.svelte`, `Register.svelte`
  - `Dashboard.svelte`: list/create trips
  - `Trip.svelte`: list expenses, add manual expense, parsed expenses, add member
- Helpers
  - `lib/api.ts`: fetch wrapper with auth headers
  - `lib/auth.ts`: auth store (currentUser) and login/register/logout

## Usage flow

- Register or login
- Create a trip
- Add members by username
- Add expenses:
  - Manual: enter description and amount
  - Rule-based parsing: describe in natural language (fully local parsing, no external APIs required)

## Notes

- For production, point `VITE_API_BASE` to your deployed API
- Hash routing keeps things simple to host on static servers
- Styles are minimal; feel free to customize Tailwind theme
