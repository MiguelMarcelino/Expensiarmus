import { normalizeCurrency } from '../utils/fx';

describe('Basic Tests', () => {
  describe('FX Utils', () => {
    it('should normalize currency codes', () => {
      expect(normalizeCurrency('usd')).toBe('USD');
      expect(normalizeCurrency('eur')).toBe('EUR');
      expect(normalizeCurrency('GBP')).toBe('GBP');
      expect(normalizeCurrency(' eur ')).toBe('EUR');
    });

    it('should return fallback for invalid codes', () => {
      expect(normalizeCurrency('')).toBe('EUR');
      expect(normalizeCurrency(null)).toBe('EUR');
      expect(normalizeCurrency(undefined)).toBe('EUR');
      expect(normalizeCurrency('invalid')).toBe('EUR');
      expect(normalizeCurrency('USDA')).toBe('EUR');
    });

    it('should use custom fallback', () => {
      expect(normalizeCurrency('', 'USD')).toBe('USD');
      expect(normalizeCurrency(null, 'GBP')).toBe('GBP');
    });
  });

  describe('Basic functionality', () => {
    it('should pass basic arithmetic', () => {
      expect(2 + 2).toBe(4);
    });

    it('should handle string operations', () => {
      expect('hello'.toUpperCase()).toBe('HELLO');
    });
  });
});
