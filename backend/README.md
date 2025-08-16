# Backend (Express + Prisma + SQLite)

## Setup

1) Environment variables (create `.env` in `backend/`)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace_with_strong_secret"
PORT=4000
```

2) Install dependencies and generate Prisma client
```
npm i
npx prisma generate
```

3) Create and apply the initial migration
```
npx prisma migrate dev --name init
```

4) Run the API
```
npm run dev   # nodemon + ts-node
# or
npm run build && npm start
```

Health check: `GET /health` → `{ ok: true }`

## Models (simplified)

- `User`: id, username, passwordHash
- `Trip`: id, name, ownerId
- `TripMember`: (tripId, userId) unique
- `Expense`: id, tripId, createdById, description, quantity, unitPriceCents?, amountCents, expenseType?, category?, incurredAt
- `ExpenseSplit`: (expenseId, userId) unique, amountCents

Notes
- Money fields are integer cents for SQLite compatibility.

## Auth

- Register: `POST /auth/register` { username, password }
- Login: `POST /auth/login` { username, password }
- Use `Authorization: Bearer <token>` header for authenticated endpoints.

## Trips & Members

- List trips: `GET /trips`
- Create trip: `POST /trips` { name }
- Add member: `POST /trips/:tripId/members` { username } (owner-only)

## Expenses

- List expenses by trip: `GET /trips/:tripId/expenses`
- Create expense: `POST /expenses`
```
{
  "tripId": "...",
  "description": "Dinner",
  "amount": 120.50,
  "category": "Food",            // optional
  "expenseType": "Meal",         // optional
  "quantity": 2,                  // optional
  "unitPrice": 60.25,            // optional
  "incurredAt": "2025-08-09T10:00:00Z", // optional
  "splits": [                     // optional; defaults to equal split
    { "userId": "u1", "amount": 60.25 },
    { "userId": "u2", "amount": 60.25 }
  ]
}
```

## Rule-based Parsing

- Endpoint: `POST /ai/parse` { input, tripId? }
- Uses an enhanced rule-based parser that runs entirely locally (no external APIs required)
- Supports multiple currencies (USD, EUR, GBP, etc.) and various input patterns
- **Context-aware**: When `tripId` is provided, the parser uses current trip information for better accuracy
- The endpoint will:
  - Extract trip name, expense type, quantity, unit price, and total amount
  - Use trip context (name, member count) to improve parsing accuracy
  - Find or create a trip (if a trip name is present)
  - Create an expense on that trip
  - Create default equal splits among members (or creator if no members)

**Supported patterns:**
- "Flight to Tokyo for $450"
- "Hotel for 3 nights at 120 EUR each"
- "Two train tickets at 25 each for my Japan trip"
- "€200 for shopping"

**Context-aware features:**
- "Flight for $450" → automatically uses current trip name
- "Dinner for everyone" → uses actual member count for quantity
- "Taxi for the group total 45" → splits based on group size

Example input
```
I want to register an expense for my trip to Japan. I just bought two flights at 1500 each and need you to add that to my Japan trip.
```

## Dev Tips

- Use a strong `JWT_SECRET` in production
- Commit Prisma migrations; do not commit `dev.db`
- Change the database provider in `schema.prisma` if you move off SQLite

## Scripts

- `npm run dev` → start with nodemon (ts-node)
- `npm run build` → compile TypeScript
- `npm start` → run compiled server (dist)
- `npm run prisma:generate` → Prisma client
- `npm run prisma:migrate` → create/apply migration named `init`
