import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

router.get("/trips/:tripId/expenses", async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      splits: true,
      createdBy: { select: { id: true, username: true } },
    } as any,
    orderBy: { incurredAt: "desc" },
  });
  res.json({ expenses });
});

router.post("/expenses", async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    tripId: z.string(),
    description: z.string().min(1),
    category: z.string().optional(),
    expenseType: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.number().positive().optional(),
    amount: z.number().positive(),
    incurredAt: z.string().datetime().optional(),
    splits: z
      .array(z.object({ userId: z.string(), amount: z.number().nonnegative() }))
      .optional(),
    payments: z
      .array(z.object({ userId: z.string(), amount: z.number().nonnegative() }))
      .optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const data = parse.data;

  const trip = await prisma.trip.findFirst({
    where: { id: data.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  const amountCents = toCents(data.amount);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          tripId: data.tripId,
          createdById: req.user!.id,
          description: data.description,
          category: data.category,
          expenseType: data.expenseType,
          quantity: data.quantity ?? 1,
          unitPriceCents: data.unitPrice != null ? toCents(data.unitPrice) : null,
          amountCents,
          incurredAt: data.incurredAt ? new Date(data.incurredAt) : new Date(),
        },
      });

      // Splits
      let splitsPayload = data.splits;
      if (!splitsPayload || splitsPayload.length === 0) {
        const memberIds = (
          await tx.tripMember.findMany({ where: { tripId: data.tripId }, select: { userId: true } })
        ).map((m) => m.userId);
        const participants = memberIds.length > 0 ? memberIds : [req.user!.id];
        const per = data.amount / participants.length;
        splitsPayload = participants.map((uid) => ({ userId: uid, amount: per }));
      }
      const splitSum = Math.round(splitsPayload.reduce((sum, s) => sum + toCents(s.amount), 0));
      if (splitSum !== amountCents) {
        throw new Error("Split amounts must sum to total amount");
      }

      await tx.expenseSplit.createMany({
        data: splitsPayload.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amountCents: toCents(s.amount),
        })),
      });

      // Payments
      let paymentsPayload = data.payments;
      if (!paymentsPayload || paymentsPayload.length === 0) {
        paymentsPayload = [{ userId: req.user!.id, amount: data.amount }];
      }
      const paymentsSum = Math.round(paymentsPayload.reduce((sum, p) => sum + toCents(p.amount), 0));
      if (paymentsSum !== amountCents) {
        throw new Error("Payment amounts must sum to total amount");
      }

      await (tx as any).expensePayment.createMany({
        data: paymentsPayload.map((p) => ({
          expenseId: expense.id,
          userId: p.userId,
          amountCents: toCents(p.amount),
        })),
      });

      const withRelations = await tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          splits: true,
          // payments: true,
          createdBy: { select: { id: true, username: true } },
        } as any,
      });
      return withRelations;
    });

    res.json({ expense: created });
  } catch (e: any) {
    const message = e?.message || "Failed to create expense";
    const bad = message.includes("must sum to total amount");
    return res.status(bad ? 400 : 500).json({ error: message });
  }
});

export default router;
