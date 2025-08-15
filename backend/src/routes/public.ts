import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// Public avatar fetch: GET /avatars/:userId
router.get("/avatars/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarData: true, avatarMime: true },
    });
    if (!user || !user.avatarData || !user.avatarMime) {
      return res.status(404).json({ error: "Avatar not found" });
    }
    res.setHeader("Content-Type", user.avatarMime);
    // Optional cache headers (avatars change rarely)
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(user.avatarData));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to fetch avatar" });
  }
});

// Public receipt fetch: GET /receipts/:expenseId
router.get("/receipts/:expenseId", async (req, res) => {
  const expenseId = req.params.expenseId;
  if (!expenseId) return res.status(400).json({ error: "Missing expenseId" });
  try {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId }, select: { receiptData: true, receiptMime: true } });
    if (!expense || !expense.receiptData || !expense.receiptMime) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    res.setHeader("Content-Type", expense.receiptMime);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(expense.receiptData));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to fetch receipt" });
  }
});

export default router;


