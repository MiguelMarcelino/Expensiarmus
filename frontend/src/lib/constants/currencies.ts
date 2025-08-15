export const currencies = [
  'EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'BRL', 'INR', 'MXN', 'CNY', 'CHF'
] as const;

export type CurrencyCode = typeof currencies[number];



