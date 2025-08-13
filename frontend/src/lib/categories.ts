export const categories = [
  'Food & Drinks',
  'Groceries',
  'Transport',
  'Lodging',
  'Flights',
  'Entertainment',
  'Activities',
  'Shopping',
  'Fees',
  'Tips',
  'Utilities',
  'Gas',
  'Gifts',
  'Health',
  'Insurance',
  'Misc'
] as const;

export type Category = typeof categories[number];


