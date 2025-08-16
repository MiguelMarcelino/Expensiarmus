import request from 'supertest';
import express from 'express';
import expenseRoutes from '../../routes/expenses';
import { requireAuth } from '../../middleware/auth';
import { setupTestDatabase, cleanupTestDatabase, clearAllTables, testDb } from '../testSetup';
import { 
  createTestUser, 
  createAuthToken, 
  createTestTrip, 
  addUserToTrip, 
  createTestExpense,
  addExpenseSplit,
  addExpensePayment
} from '../testHelpers';

const app = express();
app.use(express.json());
app.use(requireAuth);
app.use(expenseRoutes);

describe('Expense Routes', () => {
  let testUser: any;
  let authToken: string;
  let trip: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables();
    testUser = await createTestUser();
    authToken = createAuthToken(testUser.id);
    trip = await createTestTrip(testUser.id);
  });

  describe('POST /expenses', () => {
    it('should create a new expense with splits', async () => {
      const expenseData = {
        tripId: trip.id,
        description: 'Dinner at restaurant',
        amount: 50.00, // $50.00
        currency: 'USD',
        category: 'food',
        splits: [
          { userId: testUser.id, amount: 50.00 }
        ]
      };

      const response = await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(expenseData)
        .expect(200);

      expect(response.body).toHaveProperty('expense');
      expect(response.body.expense.description).toBe(expenseData.description);
      expect(response.body.expense.amountCents).toBe(5000); // Converted to cents
      expect(response.body.expense.createdById).toBe(testUser.id);
      expect(response.body.expense.currency).toBe(expenseData.currency);
      expect(response.body.expense.category).toBe(expenseData.category);
    });

    it('should create expense with multiple splits', async () => {
      const otherUser = await createTestUser();
      await addUserToTrip(trip.id, otherUser.id);

      const expenseData = {
        tripId: trip.id,
        description: 'Shared meal',
        amount: 60.00, // $60.00
        currency: 'USD',
        splits: [
          { userId: testUser.id, amount: 30.00 },
          { userId: otherUser.id, amount: 30.00 }
        ]
      };

      const response = await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(expenseData)
        .expect(200);

      expect(response.body.expense.amountCents).toBe(6000);
      
      // Verify splits were created
      const expense = await testDb.expense.findUnique({
        where: { id: response.body.expense.id },
        include: { splits: true }
      });
      
      expect(expense?.splits).toHaveLength(2);
    });

    it('should reject expense with invalid data', async () => {
      const invalidData = [
        {
          tripId: trip.id,
          description: '', // empty description
          amount: 10.00,
        },
        {
          tripId: trip.id,
          description: 'Valid expense',
          amount: -10.00, // negative amount
        },
        {
          // missing tripId
          description: 'Valid expense',
          amount: 10.00,
        }
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/expenses')
          .set('Authorization', `Bearer ${authToken}`)
          .send(data)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject expense for non-member trip', async () => {
      const otherUser = await createTestUser();
      const otherTrip = await createTestTrip(otherUser.id);

      const response = await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tripId: otherTrip.id,
          description: 'Unauthorized expense',
          amount: 10.00,
        })
        .expect(404); // API returns 404 for security (not revealing trip existence)

      expect(response.body.error).toBe('Trip not found or access denied');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/expenses')
        .send({
          tripId: trip.id,
          description: 'Test expense',
          amount: 10.00,
        })
        .expect(401);
    });
  });

  describe('GET /trips/:tripId/expenses', () => {
    let expense: any;

    beforeEach(async () => {
      expense = await createTestExpense(trip.id, testUser.id);
      await addExpenseSplit(expense.id, testUser.id, 2000);
    });

    it('should return trip expenses for trip member', async () => {
      const response = await request(app)
        .get(`/trips/${trip.id}/expenses`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('expenses');
      expect(Array.isArray(response.body.expenses)).toBe(true);
      expect(response.body.expenses).toHaveLength(1);
      expect(response.body.expenses[0].id).toBe(expense.id);
    });

    it('should reject access for non-trip member', async () => {
      const otherUser = await createTestUser();
      const otherToken = createAuthToken(otherUser.id);

      await request(app)
        .get(`/trips/${trip.id}/expenses`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404); // Returns 404 for security
    });

    it('should return 404 for non-existent trip', async () => {
      await request(app)
        .get('/trips/nonexistent-id/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /expenses/:id', () => {
    let expense: any;

    beforeEach(async () => {
      expense = await createTestExpense(trip.id, testUser.id, {
        description: 'Original description'
      });
    });

    it('should update expense as trip member', async () => {
      const updateData = {
        description: 'Updated description',
        amount: 30.00,
        category: 'transport'
      };

      const response = await request(app)
        .put(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.expense.description).toBe(updateData.description);
      expect(response.body.expense.amountCents).toBe(3000); // Converted to cents
      expect(response.body.expense.category).toBe(updateData.category);
    });

    it('should allow update by trip member', async () => {
      const memberUser = await createTestUser();
      await addUserToTrip(trip.id, memberUser.id);
      const memberToken = createAuthToken(memberUser.id);

      const response = await request(app)
        .put(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ description: 'Member update' })
        .expect(200);

      expect(response.body.expense.description).toBe('Member update');
    });

    it('should reject update by non-trip member', async () => {
      const otherUser = await createTestUser();
      const otherToken = createAuthToken(otherUser.id);

      await request(app)
        .put(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ description: 'Unauthorized update' })
        .expect(403);
    });

    it('should reject invalid update data', async () => {
      await request(app)
        .put(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: -5.00 }) // negative amount
        .expect(400);
    });
  });

  describe('DELETE /expenses/:id', () => {
    let expense: any;

    beforeEach(async () => {
      expense = await createTestExpense(trip.id, testUser.id);
    });

    it('should delete expense as trip member', async () => {
      await request(app)
        .delete(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify expense is marked as deleted
      const deletedExpense = await testDb.expense.findUnique({
        where: { id: expense.id }
      });
      expect(deletedExpense?.deletedAt).not.toBeNull();
    });

    it('should allow delete by trip member', async () => {
      const memberUser = await createTestUser();
      await addUserToTrip(trip.id, memberUser.id);
      const memberToken = createAuthToken(memberUser.id);

      await request(app)
        .delete(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(204);
    });

    it('should reject delete by non-trip member', async () => {
      const otherUser = await createTestUser();
      const otherToken = createAuthToken(otherUser.id);

      await request(app)
        .delete(`/expenses/${expense.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent expense', async () => {
      await request(app)
        .delete('/expenses/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

});
