import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { testDb } from './testSetup';

export interface TestUser {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
}

export interface TestTrip {
  id: string;
  name: string;
  ownerId: string;
  baseCurrency: string;
}

export async function createTestUser(overrides: Partial<User> = {}): Promise<TestUser> {
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  
  const userData = {
    username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `test_${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    passwordHash,
    ...overrides,
  };

  return await testDb.user.create({
    data: userData,
  });
}

export function createAuthToken(userId: string): string {
  return jwt.sign(
    { id: userId, username: 'testuser' }, 
    process.env.JWT_SECRET || 'test_secret',
    { expiresIn: '24h' }
  );
}

export async function createTestTrip(ownerId: string, overrides: any = {}): Promise<TestTrip> {
  return await testDb.trip.create({
    data: {
      name: `Test Trip ${Date.now()}`,
      ownerId,
      baseCurrency: 'USD',
      ...overrides,
    },
  });
}

export async function addUserToTrip(tripId: string, userId: string, role: string = 'member') {
  return await testDb.tripMember.create({
    data: {
      tripId,
      userId,
      role,
    },
  });
}

export async function createTestExpense(tripId: string, createdById: string, overrides: any = {}) {
  return await testDb.expense.create({
    data: {
      tripId,
      createdById,
      description: 'Test Expense',
      amountCents: 2000, // $20.00
      currency: 'USD',
      category: 'food',
      quantity: 1,
      ...overrides,
    },
  });
}

export async function addExpenseSplit(expenseId: string, userId: string, amountCents: number) {
  return await testDb.expenseSplit.create({
    data: {
      expenseId,
      userId,
      amountCents,
    },
  });
}

export async function addExpensePayment(expenseId: string, userId: string, amountCents: number, currency: string = 'USD') {
  return await testDb.expensePayment.create({
    data: {
      expenseId,
      userId,
      amountCents,
      currency,
    },
  });
}
