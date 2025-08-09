import express from "express";
import cors from "cors";
import { config } from "./config";
import authRoutes from "./routes/auth";
import tripRoutes from "./routes/trips";
import expenseRoutes from "./routes/expenses";
import aiRoutes from "./routes/ai";
import userRoutes from "./routes/users";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use(requireAuth);
app.use(tripRoutes);
app.use(expenseRoutes);
app.use(aiRoutes);
app.use(userRoutes);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
