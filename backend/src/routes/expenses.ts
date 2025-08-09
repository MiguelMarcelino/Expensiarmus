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
      payments: true,
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
    payerUserId: z.string().optional(),
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
  const incurredAt = data.incurredAt ? new Date(data.incurredAt) : new Date();

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
          incurredAt,
        },
      });

      // Splits: by default, everyone except the payer owes the payer
      let splitsPayload = data.splits;
      if (!splitsPayload || splitsPayload.length === 0) {
        const members = (await tx.tripMember.findMany({
          where: { tripId: data.tripId },
          select: { userId: true, joinedAt: true } as any,
        })) as any[];
        const eligibleMemberIds = members
          .filter((m: any) => !m.joinedAt || new Date(m.joinedAt) <= incurredAt)
          .map((m) => m.userId);
        // Include the trip owner as a participant even if they are not in TripMember
        const allParticipantIds = Array.from(new Set([trip.ownerId, ...eligibleMemberIds]));
        const payerId = data.payerUserId ?? req.user!.id;
        const oweIds = allParticipantIds.filter((id) => id !== payerId);
        // If no other participants, fall back to payer alone (no one owes anyone effectively)
        const participants = oweIds.length > 0 ? oweIds : [payerId];
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
        const fallbackPayer = data.payerUserId ?? req.user!.id;
        paymentsPayload = [{ userId: fallbackPayer, amount: data.amount }];
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
          payments: true,
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

// Update expense splits/payments (and optional metadata)
router.put("/expenses/:id", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const bodySchema = z.object({
    description: z.string().min(1).optional(),
    category: z.string().optional(),
    expenseType: z.string().optional(),
    incurredAt: z.string().datetime().optional(),
    amount: z.number().positive().optional(),
    splits: z.array(z.object({ userId: z.string(), amount: z.number().nonnegative() })).optional(),
    payments: z.array(z.object({ userId: z.string(), amount: z.number().nonnegative() })).optional(),
  });
  const params = paramsSchema.safeParse(req.params);
  const body = bodySchema.safeParse(req.body);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const expenseId = params.data.id;
  const data = body.data;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  const newAmountCents = data.amount != null ? toCents(data.amount) : existing.amountCents;
  const newIncurredAt = data.incurredAt ? new Date(data.incurredAt) : existing.incurredAt;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Update core fields
      const exp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description ?? existing.description,
          category: data.category ?? existing.category ?? undefined,
          expenseType: data.expenseType ?? existing.expenseType ?? undefined,
          incurredAt: newIncurredAt,
          amountCents: newAmountCents,
        },
      });

      // Splits
      if (data.splits) {
        const splitSum = Math.round(data.splits.reduce((sum, s) => sum + toCents(s.amount), 0));
        if (splitSum !== newAmountCents) throw new Error("Split amounts must sum to total amount");
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseSplit.createMany({
          data: data.splits.map((s) => ({ expenseId, userId: s.userId, amountCents: toCents(s.amount) })),
        });
      }

      // Payments
      if (data.payments) {
        const paymentsSum = Math.round(data.payments.reduce((sum, p) => sum + toCents(p.amount), 0));
        if (paymentsSum !== newAmountCents) throw new Error("Payment amounts must sum to total amount");
        await (tx as any).expensePayment.deleteMany({ where: { expenseId } });
        await (tx as any).expensePayment.createMany({
          data: data.payments.map((p) => ({ expenseId, userId: p.userId, amountCents: toCents(p.amount) })),
        });
      }

      const withRelations = await tx.expense.findUnique({
        where: { id: expenseId },
        include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
      });
      return withRelations!;
    });

    res.json({ expense: updated });
  } catch (e: any) {
    const message = e?.message || "Failed to update expense";
    const bad = message.includes("must sum to total amount");
    return res.status(bad ? 400 : 500).json({ error: message });
  }
});

// Delete an expense
router.delete("/expenses/:id", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const expenseId = params.data.id;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      await (tx as any).expensePayment.deleteMany({ where: { expenseId } });
      await tx.expense.delete({ where: { id: expenseId } });
    });
    res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to delete expense" });
  }
});

export default router;
