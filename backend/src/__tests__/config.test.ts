describe('Configuration', () => {
  beforeEach(() => {
    // Clean up environment variables between tests
    delete process.env.PORT;
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  it('should use default port when not specified', () => {
    const { config } = require('../config');
    expect(config.port).toBe(4000);
  });

  it('should use environment port when specified', () => {
    process.env.PORT = '8080';
    
    // Re-import to get updated config
    delete require.cache[require.resolve('../config')];
    const { config } = require('../config');
    
    expect(config.port).toBe(8080);
  });

  it('should use default JWT secret when not specified', () => {
    const { config } = require('../config');
    expect(config.jwtSecret).toBe('dev_secret_change_me');
  });

  it('should use environment JWT secret when specified', () => {
    process.env.JWT_SECRET = 'test_secret_123';
    
    delete require.cache[require.resolve('../config')];
    const { config } = require('../config');
    
    expect(config.jwtSecret).toBe('test_secret_123');
  });

  it('should use default database URL when not specified', () => {
    const { config } = require('../config');
    expect(config.databaseUrl).toBe('file:./dev.db');
  });

  it('should use environment database URL when specified', () => {
    process.env.DATABASE_URL = 'file:./test.db';
    
    delete require.cache[require.resolve('../config')];
    const { config } = require('../config');
    
    expect(config.databaseUrl).toBe('file:./test.db');
  });
});
