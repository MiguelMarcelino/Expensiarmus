import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { convertCents, normalizeCurrency } from "../utils/fx";

const router = Router();

router.get("/trips", async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: { members: { include: { user: { select: { id: true, username: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ trips });
});

router.get("/trips/:tripId/members", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const { tripId } = params.data;
  const userId = req.user!.id;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: { owner: { select: { id: true, username: true, email: true } } },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  const members = await prisma.tripMember.findMany({
    where: { tripId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { user: { username: "asc" } },
  });
  // Transform to include joinedAt at the user level for frontend compatibility
  const transformedMembers = members.map(member => ({
    user: {
      ...member.user,
      joinedAt: member.joinedAt
    }
  }));
  const owner = trip.owner ? { id: trip.owner.id, username: trip.owner.username, email: trip.owner.email } : null;
  res.json({ members: transformedMembers, owner, baseCurrency: trip.baseCurrency, tripName: trip.name });
});

router.get("/trips/:tripId/activity", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const { tripId } = params.data;
  const userId = req.user!.id;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  // Get members with joinedAt
  const members = await prisma.tripMember.findMany({
    where: { tripId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  // Get expenses
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: { createdBy: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Create activity events
  const activities = [];

  // Add member join events
  for (const member of members) {
    activities.push({
      id: `member_${member.user.id}`,
      kind: 'member_joined',
      at: member.joinedAt.toISOString(),
      text: `${member.user.username} joined the trip`,
    });
  }

  // Add expense events
  for (const expense of expenses) {
    if (!expense.deletedAt) {
      activities.push({
        id: `expense_${expense.id}`,
        kind: 'expense_created',
        at: expense.createdAt.toISOString(),
        text: `${expense.createdBy.username} added "${expense.description}" for ${expense.currency || 'EUR'} ${(expense.amountCents / 100).toFixed(2)}`,
      });
    } else {
      activities.push({
        id: `expense_deleted_${expense.id}`,
        kind: 'expense_deleted',
        at: expense.deletedAt.toISOString(),
        text: `${expense.createdBy.username}'s expense "${expense.description}" was deleted`,
      });
    }
  }

  // Sort by timestamp (newest first)
  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  res.json({ activities });
});

router.post("/trips", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const schema = z.object({ name: z.string().min(1).max(100), baseCurrency: z.string().length(3).optional() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { name, baseCurrency } = parse.data;
  const trip = await prisma.trip.create({ data: { name, ownerId: req.user.id, baseCurrency: baseCurrency ? baseCurrency.toUpperCase() : undefined } });
  res.json({ trip });
});

router.post("/trips/:tripId/members", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const bodySchema = z.object({ username: z.string().min(3) });
  const params = paramsSchema.safeParse(req.params);
  const body = bodySchema.safeParse(req.body);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { tripId } = params.data;
  const { username } = body.data;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.ownerId !== req.user!.id) return res.status(403).json({ error: "Only owner can add members" });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(404).json({ error: "User not found" });

  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId, userId: user.id } },
    create: { tripId, userId: user.id, role: "member" },
    update: {},
  });

  const members = await prisma.tripMember.findMany({
    where: { tripId },
    include: { user: { select: { id: true, username: true, email: true } } },
  });

  // Transform to include joinedAt at the user level for frontend compatibility
  const transformedMembers = members.map(member => ({
    user: {
      ...member.user,
      joinedAt: member.joinedAt
    }
  }));
  res.json({ members: transformedMembers });
});

// Update trip name (owner-only)
router.put("/trips/:tripId", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const bodySchema = z.object({ name: z.string().min(1).max(100) });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { tripId } = params.data;
  const { name } = body.data;
  const userId = req.user!.id;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.ownerId !== userId) return res.status(403).json({ error: "Only the owner can rename the trip" });

  const updated = await prisma.trip.update({ where: { id: tripId }, data: { name } });
  res.json({ trip: { id: updated.id, name: updated.name, baseCurrency: updated.baseCurrency } });
});

export default router;

// Additional balances endpoint
router.get("/trips/:tripId/balances", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const { tripId } = params.data;
  const userId = req.user!.id;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: { members: true, owner: true },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });
  const baseCurrency = normalizeCurrency(trip.baseCurrency || 'EUR');

  const expenses = await prisma.expense.findMany({
    where: { tripId, deletedAt: null },
    include: { payments: true, splits: true, createdBy: true },
    orderBy: { incurredAt: 'asc' },
  });

  const userIdsSet = new Set<string>();
  userIdsSet.add(trip.ownerId);
  for (const m of trip.members) userIdsSet.add(m.userId);
  for (const e of expenses) {
    userIdsSet.add(e.createdById);
    for (const s of e.splits) userIdsSet.add(s.userId);
    for (const p of e.payments) userIdsSet.add(p.userId);
  }
  const userIds = Array.from(userIdsSet.values());
  const balances: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));

  for (const e of expenses) {
    const incurredAt = e.incurredAt;
    const expenseCur = normalizeCurrency((e as any).currency || 'EUR');
    const totalBase = await convertCents(e.amountCents, expenseCur, baseCurrency, incurredAt);

    // Build split map in base currency
    const splitMap: Record<string, number> = {};
    for (const s of e.splits) {
      const sBase = await convertCents(s.amountCents, expenseCur, baseCurrency, incurredAt);
      splitMap[s.userId] = (splitMap[s.userId] || 0) + sBase;
    }

    // Build payment map in base currency
    const payMap: Record<string, number> = {};
    if (e.payments && e.payments.length > 0) {
      for (const p of e.payments) {
        const pCur = normalizeCurrency((p as any).currency || expenseCur);
        const pBase = await convertCents(p.amountCents, pCur, baseCurrency, incurredAt);
        payMap[p.userId] = (payMap[p.userId] || 0) + pBase;
      }
    } else {
      // Fallback: creator covers total
      payMap[e.createdById] = totalBase;
    }

    for (const id of userIds) {
      const owe = splitMap[id] || 0;
      const paid = payMap[id] || 0;
      balances[id] = (balances[id] || 0) + paid - owe;
    }
  }

  // Minimize transfers
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];
  for (const [id, cents] of Object.entries(balances)) {
    if (cents > 0) creditors.push({ id, amount: cents });
    else if (cents < 0) debtors.push({ id, amount: -cents });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  const transfers: { from: string; to: string; amountCents: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const x = Math.min(d.amount, c.amount);
    if (x > 0) transfers.push({ from: d.id, to: c.id, amountCents: x });
    d.amount -= x; c.amount -= x;
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  res.json({ baseCurrency, balances, transfers });
});

// Settle current user's balances within a trip by creating a settlement expense
router.post("/trips/:tripId/settle", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ tripId: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const { tripId } = params.data;
  const userId = req.user!.id;

  // Ensure user can access this trip
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: { members: true, owner: true },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });
  const baseCurrency = normalizeCurrency(trip.baseCurrency || 'EUR');

  // Compute balances and transfers (same logic as balances endpoint)
  const expenses = await prisma.expense.findMany({
    where: { tripId, deletedAt: null },
    include: { payments: true, splits: true, createdBy: true },
    orderBy: { incurredAt: 'asc' },
  });

  const userIdsSet = new Set<string>();
  userIdsSet.add(trip.ownerId);
  for (const m of trip.members) userIdsSet.add(m.userId);
  for (const e of expenses) {
    userIdsSet.add(e.createdById);
    for (const s of e.splits) userIdsSet.add(s.userId);
    for (const p of e.payments) userIdsSet.add(p.userId);
  }
  const userIds = Array.from(userIdsSet.values());
  const balances: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));

  for (const e of expenses) {
    const incurredAt = e.incurredAt;
    const expenseCur = normalizeCurrency((e as any).currency || 'EUR');
    const totalBase = await convertCents(e.amountCents, expenseCur, baseCurrency, incurredAt);

    const splitMap: Record<string, number> = {};
    for (const s of e.splits) {
      const sBase = await convertCents(s.amountCents, expenseCur, baseCurrency, incurredAt);
      splitMap[s.userId] = (splitMap[s.userId] || 0) + sBase;
    }

    const payMap: Record<string, number> = {};
    if (e.payments && e.payments.length > 0) {
      for (const p of e.payments) {
        const pCur = normalizeCurrency((p as any).currency || expenseCur);
        const pBase = await convertCents(p.amountCents, pCur, baseCurrency, incurredAt);
        payMap[p.userId] = (payMap[p.userId] || 0) + pBase;
      }
    } else {
      payMap[e.createdById] = totalBase;
    }

    for (const id of userIds) {
      const owe = splitMap[id] || 0;
      const paid = payMap[id] || 0;
      balances[id] = (balances[id] || 0) + paid - owe;
    }
  }

  // Build minimized transfers
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];
  for (const [id, cents] of Object.entries(balances)) {
    if (cents > 0) creditors.push({ id, amount: cents });
    else if (cents < 0) debtors.push({ id, amount: -cents });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  const transfers: { from: string; to: string; amountCents: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const x = Math.min(d.amount, c.amount);
    if (x > 0) transfers.push({ from: d.id, to: c.id, amountCents: x });
    d.amount -= x; c.amount -= x;
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  // Take only transfers where current user is the debtor
  const myTransfers = transfers.filter((t) => t.from === userId && t.amountCents > 0);
  if (myTransfers.length === 0) {
    return res.json({ message: 'Nothing to settle', created: [] });
  }

  // Create a single settlement expense aggregating all my transfers
  const totalAmountCents = myTransfers.reduce((s, t) => s + t.amountCents, 0);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        tripId,
        createdById: userId,
        description: 'Settlement',
        amountCents: Math.round(totalAmountCents),
        currency: baseCurrency,
        incurredAt: now,
      },
    });

    // Splits go to each creditor
    await tx.expenseSplit.createMany({
      data: myTransfers.map((t) => ({ expenseId: expense.id, userId: t.to, amountCents: Math.round(t.amountCents) })),
    });

    // Payment by current user covering full amount
    await (tx as any).expensePayment.create({
      data: { expenseId: expense.id, userId, amountCents: Math.round(totalAmountCents), currency: baseCurrency },
    });

    const withRelations = await tx.expense.findUnique({
      where: { id: expense.id },
      include: {
        splits: true,
        payments: true,
        createdBy: { select: { id: true, username: true } },
      } as any,
    });
    return withRelations!;
  });

  // Recompute balances after settlement for response convenience
  const b = await prisma.expense.findMany({
    where: { tripId, deletedAt: null },
    include: { payments: true, splits: true, createdBy: true },
    orderBy: { incurredAt: 'asc' },
  });
  const newBalances: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
  for (const e of b) {
    const incurredAt = e.incurredAt;
    const expenseCur = normalizeCurrency((e as any).currency || 'EUR');
    const totalBase = await convertCents(e.amountCents, expenseCur, baseCurrency, incurredAt);
    const splitMap: Record<string, number> = {};
    for (const s of e.splits) {
      const sBase = await convertCents(s.amountCents, expenseCur, baseCurrency, incurredAt);
      splitMap[s.userId] = (splitMap[s.userId] || 0) + sBase;
    }
    const payMap: Record<string, number> = {};
    if (e.payments && e.payments.length > 0) {
      for (const p of e.payments) {
        const pCur = normalizeCurrency((p as any).currency || expenseCur);
        const pBase = await convertCents(p.amountCents, pCur, baseCurrency, incurredAt);
        payMap[p.userId] = (payMap[p.userId] || 0) + pBase;
      }
    } else {
      payMap[e.createdById] = totalBase;
    }
    for (const id of userIds) {
      const owe = splitMap[id] || 0;
      const paid = payMap[id] || 0;
      newBalances[id] = (newBalances[id] || 0) + paid - owe;
    }
  }

  res.json({ expense: created, baseCurrency, balances: newBalances });
});
