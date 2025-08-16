import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { enhancedExpenseParser, toCents, type ParsedExpense } from "../utils/expenseParser";

const router = Router();

const inputSchema = z.object({ input: z.string().min(5) });





router.post("/ai/parse", async (req: AuthenticatedRequest, res) => {
  const parse = inputSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { input } = parse.data;

  const ai = enhancedExpenseParser(input);
  if (!ai.amount && ai.quantity && ai.unitPrice) {
    ai.amount = ai.quantity * ai.unitPrice;
  }
  if (!ai.amount) return res.status(400).json({ error: "Could not parse amount" });

  let trip = ai.tripName
    ? await prisma.trip.findFirst({
        where: {
          name: ai.tripName,
          OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }],
        },
      })
    : null;
  if (!trip && ai.tripName) {
    trip = await prisma.trip.create({ data: { name: ai.tripName, ownerId: req.user!.id } });
  }
  if (!trip) return res.status(400).json({ error: "No trip specified or accessible" });

  const amountNum = ai.amount!;
  const expense = await prisma.expense.create({
    data: {
      tripId: trip.id,
      createdById: req.user!.id,
      description: ai.description || input,
      category: ai.tripName || undefined,
      expenseType: ai.expenseType,
      quantity: ai.quantity || 1,
      unitPriceCents: ai.unitPrice != null ? toCents(ai.unitPrice) : null,
      amountCents: toCents(amountNum),
    },
  });

  const incurredAt = new Date();
  const members = (await prisma.tripMember.findMany({
    where: { tripId: trip.id },
    select: { userId: true, joinedAt: true } as any,
  })) as any[];
  const memberIds = members
    .filter((m: any) => new Date(m.joinedAt) <= incurredAt)
    .map((m) => m.userId);
  const participants = memberIds.length > 0 ? memberIds : [req.user!.id];
  const per = amountNum / participants.length;
  await prisma.expenseSplit.createMany({
    data: participants.map((uid) => ({ expenseId: expense.id, userId: uid, amountCents: toCents(per) })),
  });

  // Record a default payment: creator covers full amount by default for AI-added expenses
  await prisma.expensePayment.create({
    data: { expenseId: expense.id, userId: req.user!.id, amountCents: toCents(amountNum) },
  });

  const withRelations = await prisma.expense.findUnique({
    where: { id: expense.id },
    include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
  });

  res.json({ parsed: ai, trip, expense: withRelations });
});

export default router;
