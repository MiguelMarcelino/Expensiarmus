import request from 'supertest';
import express from 'express';
import tripRoutes from '../../routes/trips';
import { requireAuth } from '../../middleware/auth';
import { setupTestDatabase, cleanupTestDatabase, clearAllTables } from '../testSetup';
import { createTestUser, createAuthToken, createTestTrip, addUserToTrip } from '../testHelpers';

const app = express();
app.use(express.json());
app.use(requireAuth);
app.use(tripRoutes);

describe('Trip Routes', () => {
  let testUser: any;
  let authToken: string;

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
  });

  describe('GET /trips', () => {
    it('should return empty trips list for new user', async () => {
      const response = await request(app)
        .get('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('trips');
      expect(response.body.trips).toEqual([]);
    });

    it('should return trips owned by user', async () => {
      const trip = await createTestTrip(testUser.id, { name: 'My Awesome Trip' });

      const response = await request(app)
        .get('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trips).toHaveLength(1);
      expect(response.body.trips[0]).toHaveProperty('id', trip.id);
      expect(response.body.trips[0]).toHaveProperty('name', 'My Awesome Trip');
      expect(response.body.trips[0]).toHaveProperty('members');
    });

    it('should return trips where user is a member', async () => {
      const otherUser = await createTestUser();
      const trip = await createTestTrip(otherUser.id, { name: 'Shared Trip' });
      
      // Add test user as member
      await addUserToTrip(trip.id, testUser.id);

      const response = await request(app)
        .get('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trips).toHaveLength(1);
      expect(response.body.trips[0]).toHaveProperty('id', trip.id);
      expect(response.body.trips[0]).toHaveProperty('name', 'Shared Trip');
    });

    it('should not return trips where user is not involved', async () => {
      const otherUser = await createTestUser();
      await createTestTrip(otherUser.id, { name: 'Private Trip' });

      const response = await request(app)
        .get('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.trips).toHaveLength(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/trips')
        .expect(401);
    });
  });

  describe('POST /trips', () => {
    it('should create a new trip', async () => {
      const tripData = {
        name: 'New Adventure',
        baseCurrency: 'EUR'
      };

      const response = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripData)
        .expect(200);

      expect(response.body).toHaveProperty('trip');
      expect(response.body.trip).toHaveProperty('id');
      expect(response.body.trip.name).toBe(tripData.name);
      expect(response.body.trip.baseCurrency).toBe(tripData.baseCurrency);
      expect(response.body.trip.ownerId).toBe(testUser.id);
    });

    it('should create trip with default currency', async () => {
      const tripData = {
        name: 'Default Currency Trip'
      };

      const response = await request(app)
        .post('/trips')
        .set('Authorization', `Bearer ${authToken}`)
        .send(tripData)
        .expect(200);

      expect(response.body.trip.baseCurrency).toBe('EUR'); // default
    });

    it('should reject trip with invalid data', async () => {
      const invalidData = [
        { name: '' }, // empty name
        { name: 'Valid', baseCurrency: 'INVALID' }, // invalid currency
        {} // missing name
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/trips')
          .set('Authorization', `Bearer ${authToken}`)
          .send(data)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/trips')
        .send({ name: 'Test Trip' })
        .expect(401);
    });
  });

  describe('GET /trips/:tripId/members', () => {
    let trip: any;

    beforeEach(async () => {
      trip = await createTestTrip(testUser.id);
    });

    it('should return trip members for owner', async () => {
      const response = await request(app)
        .get(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
    });

    it('should return trip members for member', async () => {
      const memberUser = await createTestUser();
      await addUserToTrip(trip.id, memberUser.id);
      const memberToken = createAuthToken(memberUser.id);

      const response = await request(app)
        .get(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('members');
    });

    it('should reject access for non-member', async () => {
      const otherUser = await createTestUser();
      const otherToken = createAuthToken(otherUser.id);

      await request(app)
        .get(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404); // Returns 404 for security reasons (not revealing if trip exists)
    });

    it('should return 404 for non-existent trip', async () => {
      await request(app)
        .get('/trips/nonexistent-id/members')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /trips/:tripId', () => {
    let trip: any;

    beforeEach(async () => {
      trip = await createTestTrip(testUser.id, { name: 'Original Name' });
    });

    it('should update trip as owner', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      const response = await request(app)
        .put(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.trip.name).toBe(updateData.name);
    });

    it('should reject update by non-owner member', async () => {
      const memberUser = await createTestUser();
      await addUserToTrip(trip.id, memberUser.id);
      const memberToken = createAuthToken(memberUser.id);

      await request(app)
        .put(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);
    });

    it('should reject invalid update data', async () => {
      await request(app)
        .put(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }) // empty name
        .expect(400);
    });
  });

  describe('DELETE /trips/:tripId', () => {
    let trip: any;

    beforeEach(async () => {
      trip = await createTestTrip(testUser.id);
    });

    it('should delete trip as owner', async () => {
      await request(app)
        .delete(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify trip is deleted by checking members endpoint
      await request(app)
        .get(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject delete by non-owner', async () => {
      const memberUser = await createTestUser();
      await addUserToTrip(trip.id, memberUser.id);
      const memberToken = createAuthToken(memberUser.id);

      await request(app)
        .delete(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent trip', async () => {
      await request(app)
        .delete('/trips/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
