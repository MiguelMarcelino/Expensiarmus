import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import type { AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcrypt";
import multer from "multer";

const router = Router();

// Multer setup: in-memory for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

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

// GET /me - current user profile
router.get("/me", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, avatarUrl: true, firstName: true, lastName: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user });
});

// PATCH /me - update profile fields
router.patch("/me", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const bodySchema = z.object({
    email: z.string().email().max(200).nullable().optional(),
    username: z.string().min(3).max(50).optional(),
    firstName: z.string().min(1).max(100).nullable().optional(),
    lastName: z.string().min(1).max(100).nullable().optional(),
  });
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { email, username, firstName, lastName } = parse.data;

  try {
    // Ensure unique constraints manually to give friendly messages
    if (email !== undefined && email !== null) {
      const taken = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      if (taken && taken.id !== req.user.id) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }
    if (username !== undefined) {
      const takenU = await prisma.user.findUnique({ where: { username } }).catch(() => null);
      if (takenU && takenU.id !== req.user.id) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(email !== undefined ? { email } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
      },
      select: { id: true, username: true, email: true, avatarUrl: true, firstName: true, lastName: true },
    });
    return res.json({ user: updated });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Failed to update profile" });
  }
});

// POST /me/password - change password
router.post("/me/password", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const bodySchema = z.object({
    currentPassword: z.string().min(6).max(100),
    newPassword: z.string().min(6).max(100),
  });
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { currentPassword, newPassword } = parse.data;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.status(204).send();
});

// POST /me/avatar - upload avatar image
router.post("/me/avatar", upload.single("avatar"), async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // Save into DB: bytes + mime, and set avatarUrl to public DB-backed endpoint
  const userId = req.user.id;
  const mime = req.file.mimetype || "application/octet-stream";
  const buffer = req.file.buffer;
  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ error: "Empty file" });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarMime: mime,
      avatarData: buffer,
      avatarUrl: `/avatars/${userId}`,
    },
    select: { id: true, username: true, email: true, avatarUrl: true, firstName: true, lastName: true },
  });
  return res.json({ user: updated });
});

export default router;


