import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// GET /users/search?q=...&limit=10&excludeTripId=...
router.get("/users/search", async (req: AuthenticatedRequest, res) => {
  const querySchema = z.object({
    q: z.string().min(1),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : undefined))
      .pipe(z.number().int().min(1).max(50).optional()),
    excludeTripId: z.string().optional(),
  });
  const parse = querySchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { q, limit = 10, excludeTripId } = parse.data;

  // Optionally compute exclusion set: users already in the trip (members + owner)
  let excludedUserIds = new Set<string>();
  if (excludeTripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: excludeTripId },
      include: { members: true },
    });
    if (trip) {
      excludedUserIds.add(trip.ownerId);
      for (const m of trip.members) excludedUserIds.add(m.userId);
    }
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { username: { contains: q } },
            { email: { contains: q } },
          ],
        },
        excludedUserIds.size
          ? { id: { notIn: Array.from(excludedUserIds) } }
          : {},
      ],
    },
    select: { id: true, username: true, email: true },
    take: limit,
    orderBy: { username: "asc" },
  });

  res.json({ users });
});

export default router;


