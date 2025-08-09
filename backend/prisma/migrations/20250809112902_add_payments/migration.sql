-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpensePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayment_expenseId_userId_key" ON "ExpensePayment"("expenseId", "userId");
