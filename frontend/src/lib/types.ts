export type User = { id: string; username: string; email?: string | null };

export type Member = {
  user: { id: string; username: string; joinedAt?: string };
};

export type Expense = {
  id: string;
  description: string;
  category?: string;
  expenseType?: string;
  quantity?: number;
  unitPriceCents?: number | null;
  amountCents: number;
  currency?: string;
  incurredAt: string;
  createdAt?: string;
  createdBy: { id: string; username: string };
  splits: { userId: string; amountCents: number }[];
  payments?: { userId: string; amountCents: number; currency?: string }[];
};

export type ActivityEvent = {
  id: string;
  kind: 'member_joined' | 'expense_created' | 'expense_edited' | 'expense_deleted';
  at: string; // ISO date
  text: string;
};

export type SplitMode = 'equal' | 'custom_amounts' | 'custom_percentages';
export type PaymentMode = 'payer' | 'equal' | 'custom_amounts' | 'custom_percentages';
