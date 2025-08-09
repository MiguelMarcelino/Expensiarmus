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

router.post("/trips", async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(100) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { name } = parse.data;

  const trip = await prisma.trip.create({ data: { name, ownerId: req.user!.id } });
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
    include: { user: { select: { id: true, username: true } } },
  });

  res.json({ members });
});

export default router;
