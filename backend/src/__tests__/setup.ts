import { execSync } from 'child_process';
import path from 'path';

// Set up test environment before any imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file::memory:?cache=shared';
process.env.JWT_SECRET = 'test_secret_for_testing';

// Import Prisma after environment setup
const { PrismaClient } = require('@prisma/client');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file::memory:?cache=shared'
    }
  }
});

beforeAll(async () => {
  try {
    // Deploy schema to in-memory database
    execSync('npx prisma db push --force-reset --accept-data-loss', { 
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: 'file::memory:?cache=shared' }
    });
    
    // Enable foreign key constraints for SQLite
    await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
  } catch (error) {
    console.error('Failed to set up test database:', error);
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean database between tests - only clean tables that exist
  const tableCleanupOrder = [
    'ExpensePayment',
    'ExpenseSplit', 
    'Expense',
    'TripMember',
    'Trip',
    'CurrencyRate',
    'User'
  ];
  
  for (const tableName of tableCleanupOrder) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ${tableName}`);
    } catch (error) {
      // Table might not exist, continue
    }
  }
});
