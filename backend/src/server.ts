import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import tripRoutes from "./routes/trips";
import expenseRoutes from "./routes/expenses";
import aiRoutes from "./routes/ai";
import userRoutes from "./routes/users";
import { requireAuth } from "./middleware/auth";
import { scheduleDailyRatesUpdate } from "./utils/ratesUpdater";

const app = express();

// Configure CORS for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN || 'https://divvyup.vercel.app'
    : true, // Allow all origins in development
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
// Back-compat: serve existing uploaded files if any
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Public routes (no auth required)
app.use(publicRoutes);

app.use("/auth", authRoutes);
app.use(requireAuth);
app.use(tripRoutes);
app.use(expenseRoutes);
app.use(aiRoutes);
app.use(userRoutes);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

// Start background scheduler for currency rates (non-blocking)
scheduleDailyRatesUpdate();
