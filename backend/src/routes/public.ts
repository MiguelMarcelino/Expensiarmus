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

export default router;


