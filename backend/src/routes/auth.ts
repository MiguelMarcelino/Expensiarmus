import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { config } from "../config";

const router = Router();

const credentialsSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

router.post("/register", async (req, res) => {
  const parse = credentialsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { username, password } = parse.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(400).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, passwordHash } });
  const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: "7d",
  });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

router.post("/login", async (req, res) => {
  const parse = credentialsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { username, password } = parse.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: "7d",
  });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

export default router;
