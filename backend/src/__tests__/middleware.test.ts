import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Mock Express types
type MockRequest = Partial<Request> & {
  headers?: any;
  user?: any;
};

type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
};

const createMockResponse = (): MockResponse => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('Auth Middleware', () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = createMockResponse();
    mockNext = jest.fn();
    
    // Set test environment
    process.env.JWT_SECRET = 'test_secret';
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.JWT_SECRET;
  });

  it('should reject request without authorization header', async () => {
    // Import after setting environment
    const { requireAuth } = require('../middleware/auth');
    
    await requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid authorization format', async () => {
    const { requireAuth } = require('../middleware/auth');
    
    mockReq.headers.authorization = 'InvalidFormat';

    await requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token', async () => {
    const { requireAuth } = require('../middleware/auth');
    
    mockReq.headers.authorization = 'Bearer invalid_token';

    await requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept request with valid token', async () => {
    const { requireAuth } = require('../middleware/auth');
    
    const payload = { id: 'user123', username: 'testuser' };
    const token = jwt.sign(payload, 'test_secret');
    
    mockReq.headers.authorization = `Bearer ${token}`;

    await requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.user).toEqual(payload);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should handle JWT verification errors gracefully', async () => {
    const { requireAuth } = require('../middleware/auth');
    
    // Create token with different secret
    const token = jwt.sign({ id: 'user123' }, 'wrong_secret');
    mockReq.headers.authorization = `Bearer ${token}`;

    await requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
