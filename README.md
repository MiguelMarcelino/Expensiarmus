# ExpensiArmus

A simple, clean expense tracking app inspired by Expensify with AI-powered natural language entry. Built with Svelte (Vite) on the frontend and Express + Prisma (SQLite) on the backend.

## Tech Stack

- Frontend: Svelte + Vite + TypeScript, Tailwind CSS
- Backend: Node.js (Express + TypeScript), Prisma ORM, SQLite
- Auth: JWT (username + password)
- AI: Optional OpenAI model for natural language expense parsing (falls back to a lightweight parser)

## Features

- AI expense entry: "Add two flights at 1500 each to my Japan trip" → parsed into category/type/qty/price/total
- Manual expense entry form
- Trips and participants (shared expenses)
- Split expenses among members (default equal split)
- Authentication (register/login)

## Requirements

- Node.js 20.19+ (or 22.12+ / 24+). Recommended: Node 22 LTS
- npm 10+

## Quickstart

1) Clone and install dependencies

```
cd expensiarmus
cd backend && npm i && cd ..
cd frontend && npm i && cd ..
```

2) Configure environment

- Backend `backend/.env` (already created during scaffolding). If missing, create it:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev_secret_change_me"
OPENAI_API_KEY=""   # optional; set to use OpenAI parsing
PORT=4000
```
- Frontend `frontend/.env`:
```
VITE_API_BASE="http://localhost:4000"
```

3) Initialize database

```
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

4) Run the apps (two terminals)

- Backend
```
cd backend
npm run dev
```
API: http://localhost:4000

- Frontend
```
cd frontend
npm run dev
```
UI: http://localhost:5173

## Project Structure

```
expensiarmus/
  backend/
    prisma/
      schema.prisma
      migrations/
      dev.db                # SQLite DB (ignored by git)
    src/
      routes/               # auth, trips, expenses, ai
      middleware/
      server.ts
      prisma.ts
      config.ts
    package.json
  frontend/
    src/
      views/                # Login, Register, Dashboard, Trip
      lib/                  # api.ts, auth.ts
      App.svelte
      app.css
    index.html
    package.json
```

## API Overview

- POST `/auth/register` { username, password } → { token, user }
- POST `/auth/login` { username, password } → { token, user }
- GET `/trips` (auth)
- POST `/trips` { name } (auth)
- POST `/trips/:tripId/members` { username } (auth, owner)
- GET `/trips/:tripId/expenses` (auth)
- POST `/expenses` { tripId, description, amount, category?, expenseType?, quantity?, unitPrice?, incurredAt?, splits? } (auth)
- POST `/ai/parse` { input } (auth)

Notes
- Amounts are stored as integer cents in the DB (e.g., $12.34 → 1234).
- When `splits` is omitted, expenses default to equal split among members (or the creator if no members).

## AI Parsing

- If `OPENAI_API_KEY` is set, the backend uses `gpt-4o-mini` to extract: `tripName`, `expenseType`, `description`, `quantity`, `unitPrice`, `amount`.
- If no API key is set or the call fails, a lightweight parser tries to infer quantity/price/amount/type from the text.

Example input
> I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip.

Expected extraction
- tripName: "Japan trip"
- expenseType: "Flights"
- quantity: 2
- unitPrice: 1500
- amount: 3000

## Development Tips

- Use a strong `JWT_SECRET` in production.
- Commit Prisma migrations; do not commit the SQLite database file.
- The frontend uses hash-based routing; URLs start with `#/`.

## License

MIT
