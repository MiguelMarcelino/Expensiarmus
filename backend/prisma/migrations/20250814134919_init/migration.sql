-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "rate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "expenseType" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "unitPriceCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "incurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Expense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountCents", "category", "createdAt", "createdById", "currency", "deletedAt", "description", "expenseType", "id", "incurredAt", "quantity", "tripId", "unitPriceCents") SELECT "amountCents", "category", "createdAt", "createdById", "currency", "deletedAt", "description", "expenseType", "id", "incurredAt", "quantity", "tripId", "unitPriceCents" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE TABLE "new_ExpensePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpensePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExpensePayment" ("amountCents", "currency", "expenseId", "id", "userId") SELECT "amountCents", "currency", "expenseId", "id", "userId" FROM "ExpensePayment";
DROP TABLE "ExpensePayment";
ALTER TABLE "new_ExpensePayment" RENAME TO "ExpensePayment";
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");
CREATE UNIQUE INDEX "ExpensePayment_expenseId_userId_key" ON "ExpensePayment"("expenseId", "userId");
CREATE TABLE "new_Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseCurrency" TEXT NOT NULL DEFAULT 'EUR',
    CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("baseCurrency", "createdAt", "id", "name", "ownerId") SELECT "baseCurrency", "createdAt", "id", "name", "ownerId" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CurrencyRate_base_quote_date_idx" ON "CurrencyRate"("base", "quote", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_base_quote_date_key" ON "CurrencyRate"("base", "quote", "date");
