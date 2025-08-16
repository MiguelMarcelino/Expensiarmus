import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Generate unique test database for each test run
const TEST_DB_PATH = path.join(__dirname, `../../test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.db`);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
process.env.JWT_SECRET = 'test_secret_for_testing_only';

// Import Prisma after environment setup
import { PrismaClient } from '@prisma/client';

export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: `file:${TEST_DB_PATH}`
    }
  }
});

let isSetup = false;

export async function setupTestDatabase() {
  if (isSetup) return;
  
  try {
    // Create new test database with schema
    execSync('npx prisma db push --force-reset', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` }
    });

    // Enable foreign key constraints
    await testDb.$executeRaw`PRAGMA foreign_keys = ON`;
    
    isSetup = true;
    console.log('✅ Test database setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  }
}

export async function cleanupTestDatabase() {
  try {
    await testDb.$disconnect();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch (error) {
    console.warn('Warning: Failed to cleanup test database:', error);
  }
}

export async function clearAllTables() {
  // Clear tables in order to avoid foreign key constraint issues
  const tables = [
    'ExpensePayment',
    'ExpenseSplit', 
    'Expense',
    'TripMember',
    'Trip',
    'CurrencyRate',
    'User'
  ];
  
  // Disable foreign keys temporarily for cleanup
  await testDb.$executeRaw`PRAGMA foreign_keys = OFF`;
  
  for (const table of tables) {
    try {
      await testDb.$executeRawUnsafe(`DELETE FROM ${table}`);
    } catch (error) {
      // Table might not exist or be empty, continue
    }
  }
  
  // Re-enable foreign keys
  await testDb.$executeRaw`PRAGMA foreign_keys = ON`;
}
