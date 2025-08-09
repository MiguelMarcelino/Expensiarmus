import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";

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
  res.json({ members: transformedMembers });
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
    orderBy: { createdAt: "asc" },
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
    activities.push({
      id: `expense_${expense.id}`,
      kind: 'expense_created',
      at: expense.createdAt.toISOString(),
      text: `${expense.createdBy.username} added "${expense.description}" for $${(expense.amountCents / 100).toFixed(2)}`,
    });
  }

  // Sort by timestamp (oldest first for chronological order)
  activities.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  res.json({ activities });
});

router.post("/trips", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const schema = z.object({ name: z.string().min(1).max(100) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { name } = parse.data;

  const trip = await prisma.trip.create({ data: { name, ownerId: req.user.id } });
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

export default router;
