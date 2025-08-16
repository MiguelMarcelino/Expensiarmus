import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth';
import { setupTestDatabase, cleanupTestDatabase, clearAllTables, testDb } from '../testSetup';
import { createTestUser } from '../testHelpers';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser123',
        password: 'password123',
        email: 'newuser@example.com'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify user was created in database
      const dbUser = await testDb.user.findUnique({
        where: { username: userData.username }
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(userData.email);
    });

    it('should register user without email', async () => {
      const userData = {
        username: 'userwithoutemail',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBeNull();
    });

    it('should reject registration with invalid data', async () => {
      const testCases = [
        {
          data: { username: 'ab', password: '123' },
          description: 'too short username and password'
        },
        {
          data: { username: '', password: 'password123' },
          description: 'empty username'
        },
        {
          data: { username: 'validuser', password: '' },
          description: 'empty password'
        },
        {
          data: { username: 'validuser', password: 'password123', email: 'invalid-email' },
          description: 'invalid email format'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/auth/register')
          .send(testCase.data)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'duplicateuser',
        password: 'password123'
      };

      // First registration
      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(200);

      // Second registration with same username
      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Username already taken');
    });

    it('should reject duplicate email', async () => {
      const email = 'duplicate@example.com';

      // First registration
      await request(app)
        .post('/auth/register')
        .send({
          username: 'user1',
          password: 'password123',
          email
        })
        .expect(200);

      // Second registration with same email
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'user2',
          password: 'password123',
          email
        })
        .expect(400);

      expect(response.body.error).toBe('Email already in use');
    });
  });

  describe('POST /auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'loginuser',
        email: 'login@example.com'
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'loginuser',
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('loginuser');
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with invalid username', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'testpassword123'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'loginuser',
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      const testCases = [
        { username: 'loginuser' }, // missing password
        { password: 'testpassword123' }, // missing username
        {} // missing both
      ];

      for (const credentials of testCases) {
        const response = await request(app)
          .post('/auth/login')
          .send(credentials)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject login with invalid data format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'ab', // too short
          password: '123' // too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
