# DivvyUp

A simple, clean expense tracking app with Rule-based expense parsing. Built with Svelte (Vite) on the frontend and Express + Prisma (SQLite) on the backend.

## Tech Stack

- Frontend: Svelte + Vite + TypeScript, Tailwind CSS
- Backend: Node.js (Express + TypeScript), Prisma ORM, SQLite
- Auth: JWT (username + password)
- Rule-based Parsing: Enhanced rule-based parser for natural language expense parsing (fully local, no external APIs)

## Features

- Rule-based expense entry parsing: "Add two flights at 1500 each to my Japan trip" → parsed into category/type/qty/price/total
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
cd divvyup
cd backend && npm i && cd ..
cd frontend && npm i && cd ..
```

2) Configure environment

- Backend `backend/.env` (already created during scaffolding). If missing, create it:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev_secret_change_me"
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
divvyup/
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

## Rule-based Parsing

The app uses an enhanced rule-based parser that runs entirely locally to extract expense information from natural language input. No external APIs or internet connection required.

**What it extracts:**
- `tripName`: Destination or trip name ("Japan trip", "Paris vacation")
- `expenseType`: Category ("Flight", "Hotel", "Meal", "Transport", "Entertainment", "Shopping", "Other")
- `quantity`: Number of items (2 flights, 3 nights, 5 tickets)
- `unitPrice`: Price per item (150 each, 80 per night)
- `amount`: Total amount (calculated or explicitly stated)

**Supported input patterns:**
- "Flight to Tokyo for $450"
- "Hotel in Paris for 3 nights at 120 EUR each"
- "Two train tickets at 25 each for my Japan trip"
- "Museum tickets for 5 people at 15 each"
- "€200 for shopping in Rome trip"
- "My vacation in Bali - hotel cost 150 per night for 7 nights"

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
