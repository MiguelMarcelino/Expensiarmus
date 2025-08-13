import type { Expense } from './types';

export function centsToString(cents: number): string {
	return (cents / 100).toFixed(2);
}

// Computes the net effect of a single expense for the given user.
// Positive means money is owed to the user; negative means the user owes.
export function computeMyDeltaCents(expense: Expense, myUserId: string | null | undefined): number {
	if (!myUserId) return 0;
	const mySplit = expense.splits.find((s) => s.userId === myUserId)?.amountCents || 0;
	let myPaid = 0;
	if (expense.payments && expense.payments.length > 0) {
		myPaid = expense.payments
			.filter((p) => p.userId === myUserId)
			.reduce((sum, p) => sum + p.amountCents, 0);
	} else {
		// Fallback: assume creator paid full amount
		myPaid = expense.createdBy.id === myUserId ? expense.amountCents : 0;
	}
	return myPaid - mySplit;
}


