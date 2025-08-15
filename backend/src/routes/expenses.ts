import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { convertCents, normalizeCurrency } from "../utils/fx";
import multer from "multer";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";

const router = Router();

// Multer configuration for CSV uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const isCsv = file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv");
    if (isCsv) cb(null, true);
    else cb(new Error("Only CSV files are allowed"));
  },
});

// Multer for receipts (images)
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

router.get("/trips/:tripId/expenses", async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  // Optional pagination via query params
  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const offsetRaw = Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset;
  const limitNum = limitRaw != null ? Number(limitRaw) : null;
  const offsetNum = offsetRaw != null ? Number(offsetRaw) : null;
  const hasPagination = Number.isFinite(limitNum) || Number.isFinite(offsetNum);

  if (hasPagination) {
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitNum as number) ? (limitNum as number) : 50));
    const offset = Math.max(0, Number.isFinite(offsetNum as number) ? (offsetNum as number) : 0);
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: { tripId, deletedAt: null },
        include: {
          splits: true,
          payments: true,
          createdBy: { select: { id: true, username: true } },
        } as any,
        orderBy: { incurredAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.expense.count({ where: { tripId, deletedAt: null } }),
    ]);
    return res.json({ expenses, total, limit, offset });
  } else {
    const expenses = await prisma.expense.findMany({
      where: { tripId, deletedAt: null },
      include: {
        splits: true,
        payments: true,
        createdBy: { select: { id: true, username: true } },
      } as any,
      orderBy: { incurredAt: "desc" },
    });
    return res.json({ expenses });
  }
});

// Export expenses of a trip to CSV (owner-only)
router.get("/trips/:tripId/expenses/export.csv", async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.ownerId !== userId) return res.status(403).json({ error: "Only the owner can export this trip" });

  const expenses = await prisma.expense.findMany({
    where: { tripId, deletedAt: null },
    include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
    orderBy: { incurredAt: "asc" },
  });

  const records = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    category: e.category || "",
    expenseType: e.expenseType || "",
    quantity: e.quantity ?? "",
    unitPrice: e.unitPriceCents != null ? (e.unitPriceCents / 100).toFixed(2) : "",
    amount: (e.amountCents / 100).toFixed(2),
    currency: (e as any).currency || "EUR",
    incurredAt: e.incurredAt.toISOString(),
    createdById: e.createdById,
    splits: JSON.stringify(e.splits.map((s) => ({ userId: s.userId, amount: (s.amountCents / 100) }))),
    payments: JSON.stringify((e.payments || []).map((p: any) => ({ userId: p.userId, amount: (p.amountCents / 100), currency: p.currency })) ),
  }));

  const header = [
    "id",
    "description",
    "category",
    "expenseType",
    "quantity",
    "unitPrice",
    "amount",
    "currency",
    "incurredAt",
    "createdById",
    "splits",
    "payments",
  ];
  const csv = stringifyCsv(records, { header: true, columns: header });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=trip-${tripId}-expenses.csv`);
  res.status(200).send(csv);
});

// Import expenses from CSV (owner-only)
router.post("/trips/:tripId/expenses/import", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  const tripId = req.params.tripId;
  const userId = req.user!.id;
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  if (trip.ownerId !== userId) return res.status(403).json({ error: "Only the owner can import into this trip" });
  if (!req.file || !req.file.buffer) return res.status(400).json({ error: "No CSV file uploaded" });

  try {
    // Import mode: "create" (create all rows as new) or "skip" (skip duplicates). Default: skip
    const modeRaw = (req.body as any)?.mode ? String((req.body as any).mode).toLowerCase() : "";
    const mode: "create" | "skip" = (modeRaw === "create" || modeRaw === "create_new") ? "create" : "skip";
    const text = req.file.buffer.toString("utf8");
    const rows: any[] = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true });
    const createdIds: string[] = [];
    const skipped: { row: number; reason: string; id?: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const description = String(row.description || "").trim();
        if (!description) continue;
        const category = row.category ? String(row.category).trim() : undefined;
        const expenseType = row.expenseType ? String(row.expenseType).trim() : undefined;
        const quantity = row.quantity ? Number(row.quantity) : undefined;
        const unitPrice = row.unitPrice ? Number(row.unitPrice) : undefined;
        const amount = Number(row.amount);
        const currency = row.currency ? String(row.currency).trim() : undefined;
        const incurredAt = row.incurredAt ? new Date(String(row.incurredAt)) : new Date();
        const createdById = String(row.createdById || userId);
        const csvId = row.id ? String(row.id).trim() : undefined;

        // Parse optional JSON columns
        let splits: { userId: string; amount: number }[] | undefined;
        try {
          if (row.splits) splits = JSON.parse(row.splits);
        } catch {}
        let payments: { userId: string; amount: number; currency?: string }[] | undefined;
        try {
          if (row.payments) payments = JSON.parse(row.payments);
        } catch {}

        // Duplicate detection (only in skip mode)
        if (mode === "skip") {
          if (csvId) {
            const existingById = await tx.expense.findFirst({ where: { id: csvId, tripId } });
            if (existingById) {
              skipped.push({ row: i + 2, reason: "Expense with same id already exists", id: csvId });
              continue;
            }
          }
          const fingerprintWhere: any = {
            tripId,
            description,
            amountCents: Math.round(amount * 100),
            incurredAt,
          };
          const existingByFingerprint = await tx.expense.findFirst({ where: fingerprintWhere });
          if (existingByFingerprint) {
            skipped.push({ row: i + 2, reason: "Expense with same content already exists", id: existingByFingerprint.id });
            continue;
          }
        }

        const expense = await tx.expense.create({
          data: {
            tripId,
            createdById,
            description,
            category,
            expenseType,
            quantity: quantity ?? 1,
            unitPriceCents: unitPrice != null ? Math.round(unitPrice * 100) : null,
            amountCents: Math.round(amount * 100),
            currency: normalizeCurrency(currency || trip.baseCurrency || "EUR"),
            incurredAt,
          },
        });

        // Splits
        let splitsPayload = splits;
        if (!splitsPayload || splitsPayload.length === 0) {
          // default: equal among participants (trip owner + members), payer is createdById
          const members = (await tx.tripMember.findMany({ where: { tripId }, select: { userId: true } })) as any[];
          const participantIds = Array.from(new Set([trip.ownerId, ...members.map((m) => m.userId)]));
          const oweIds = participantIds.filter((id) => id !== createdById);
          const participants = oweIds.length > 0 ? oweIds : [createdById];
          const per = amount / participants.length;
          splitsPayload = participants.map((uid) => ({ userId: uid, amount: per }));
        }
        const splitSum = Math.round(splitsPayload.reduce((s, sp) => s + Math.round(sp.amount * 100), 0));
        if (splitSum !== Math.round(amount * 100)) throw new Error("Split amounts must sum to total amount");
        await tx.expenseSplit.createMany({
          data: splitsPayload.map((sp) => ({ expenseId: expense.id, userId: sp.userId, amountCents: Math.round(sp.amount * 100) })),
        });

        // Payments
        let paymentsPayload = payments;
        if (!paymentsPayload || paymentsPayload.length === 0) {
          paymentsPayload = [{ userId: createdById, amount, currency: currency || trip.baseCurrency || "EUR" }];
        }
        await (tx as any).expensePayment.createMany({
          data: paymentsPayload.map((p) => ({ expenseId: expense.id, userId: p.userId, amountCents: Math.round(p.amount * 100), currency: normalizeCurrency(p.currency || currency || trip.baseCurrency || "EUR") })),
        });

        createdIds.push(expense.id);
      }
    });

    return res.json({ imported: createdIds.length, expenseIds: createdIds, warnings: mode === "skip" ? skipped : [] });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Failed to import CSV" });
  }
});

router.post("/expenses", async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    tripId: z.string(),
    description: z.string().min(1),
    category: z.string().optional(),
    expenseType: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.number().positive().optional(),
    amount: z.number().positive(),
    currency: z.string().length(3).optional(),
    incurredAt: z.string().datetime().optional(),
    payerUserId: z.string().optional(),
    splits: z
      .array(z.object({ userId: z.string(), amount: z.number().nonnegative() }))
      .optional(),
    payments: z
      .array(z.object({ userId: z.string(), amount: z.number().nonnegative(), currency: z.string().length(3).optional() }))
      .optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const data = parse.data;

  const trip = await prisma.trip.findFirst({
    where: { id: data.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  const amountCents = toCents(data.amount);
  const incurredAt = data.incurredAt ? new Date(data.incurredAt) : new Date();
  const expenseCurrency = normalizeCurrency(data.currency || "EUR");

  try {
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          tripId: data.tripId,
          createdById: req.user!.id,
          description: data.description,
          category: data.category,
          expenseType: data.expenseType,
          quantity: data.quantity ?? 1,
          unitPriceCents: data.unitPrice != null ? toCents(data.unitPrice) : null,
          amountCents,
          currency: expenseCurrency,
          incurredAt,
        },
      });

      // Splits: by default, everyone except the payer owes the payer
      let splitsPayload = data.splits;
      if (!splitsPayload || splitsPayload.length === 0) {
        const members = (await tx.tripMember.findMany({
          where: { tripId: data.tripId },
          select: { userId: true, joinedAt: true } as any,
        })) as any[];
        const eligibleMemberIds = members
          .filter((m: any) => !m.joinedAt || new Date(m.joinedAt) <= incurredAt)
          .map((m) => m.userId);
        // Include the trip owner as a participant even if they are not in TripMember
        const allParticipantIds = Array.from(new Set([trip.ownerId, ...eligibleMemberIds]));
        const payerId = data.payerUserId ?? req.user!.id;
        const oweIds = allParticipantIds.filter((id) => id !== payerId);
        // If no other participants, fall back to payer alone (no one owes anyone effectively)
        const participants = oweIds.length > 0 ? oweIds : [payerId];
        const per = data.amount / participants.length;
        splitsPayload = participants.map((uid) => ({ userId: uid, amount: per }));
      }
      const splitSum = Math.round(splitsPayload.reduce((sum, s) => sum + toCents(s.amount), 0));
      if (splitSum !== amountCents) {
        throw new Error("Split amounts must sum to total amount");
      }

      await tx.expenseSplit.createMany({
        data: splitsPayload.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amountCents: toCents(s.amount),
        })),
      });

      // Payments
      let paymentsPayload = data.payments;
      if (!paymentsPayload || paymentsPayload.length === 0) {
        const fallbackPayer = data.payerUserId ?? req.user!.id;
        paymentsPayload = [{ userId: fallbackPayer, amount: data.amount, currency: expenseCurrency }];
      }
      // Validate payments sum to total in the expense currency
      let convertedSum = 0;
      for (const p of paymentsPayload) {
        const fromCur = normalizeCurrency(p.currency || expenseCurrency);
        const cents = toCents(p.amount);
        const converted = await convertCents(cents, fromCur, expenseCurrency, incurredAt);
        convertedSum += converted;
      }
      if (convertedSum !== amountCents) throw new Error("Payment amounts must sum to total amount (after conversion)");

      await (tx as any).expensePayment.createMany({
        data: paymentsPayload.map((p) => ({
          expenseId: expense.id,
          userId: p.userId,
          amountCents: toCents(p.amount),
          currency: normalizeCurrency(p.currency || expenseCurrency),
        })),
      });

      const withRelations = await tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          splits: true,
          payments: true,
          createdBy: { select: { id: true, username: true } },
        } as any,
      });
      return withRelations;
    });

    res.json({ expense: created });
  } catch (e: any) {
    const message = e?.message || "Failed to create expense";
    const bad = message.includes("must sum to total amount");
    return res.status(bad ? 400 : 500).json({ error: message });
  }
});

// Fetch a single expense with relations
router.get("/expenses/:id", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const expenseId = params.data.id;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing || (existing as any).deletedAt) return res.status(404).json({ error: "Expense not found" });

  // Permission: must be owner or member of the trip
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
  });
  if (!expense) return res.status(404).json({ error: "Expense not found" });
  return res.json({ expense });
});

// Create expense with optional receipt upload via multipart/form-data
router.post("/expenses/with-receipt", receiptUpload.single("receipt"), async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    tripId: z.string(),
    description: z.string().min(1),
    category: z.string().optional(),
    expenseType: z.string().optional(),
    quantity: z.string().optional(),
    unitPrice: z.string().optional(),
    amount: z.string(),
    currency: z.string().length(3).optional(),
    incurredAt: z.string().datetime().optional(),
    payerUserId: z.string().optional(),
    splits: z.string().optional(), // JSON string
    payments: z.string().optional(), // JSON string
  });
  const bodyObj: any = req.body || {};
  const parse = schema.safeParse(bodyObj);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const form = parse.data;

  const trip = await prisma.trip.findFirst({
    where: { id: form.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found or access denied" });

  const amount = Number(form.amount);
  if (!(amount > 0)) return res.status(400).json({ error: "Amount must be positive" });
  const amountCents = Math.round(amount * 100);
  const incurredAt = form.incurredAt ? new Date(form.incurredAt) : new Date();
  const expenseCurrency = normalizeCurrency(form.currency || "EUR");
  let splits: { userId: string; amount: number }[] | undefined;
  let payments: { userId: string; amount: number; currency?: string }[] | undefined;
  try { if (form.splits) splits = JSON.parse(form.splits); } catch {}
  try { if (form.payments) payments = JSON.parse(form.payments); } catch {}

  const file = req.file;
  const receiptMime = file?.mimetype;
  const receiptData = file?.buffer;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          tripId: form.tripId,
          createdById: req.user!.id,
          description: form.description,
          category: form.category,
          expenseType: form.expenseType,
          quantity: form.quantity != null && form.quantity !== '' ? Number(form.quantity) : 1,
          unitPriceCents: form.unitPrice != null && form.unitPrice !== '' ? Math.round(Number(form.unitPrice) * 100) : null,
          amountCents,
          currency: expenseCurrency,
          incurredAt,
          ...(receiptData && receiptMime ? { receiptData, receiptMime } : {}),
        },
      });

      // Splits
      let splitsPayload = splits;
      if (!splitsPayload || splitsPayload.length === 0) {
        const members = (await tx.tripMember.findMany({ where: { tripId: form.tripId }, select: { userId: true, joinedAt: true } as any })) as any[];
        const eligibleMemberIds = members
          .filter((m: any) => !m.joinedAt || new Date(m.joinedAt) <= incurredAt)
          .map((m) => m.userId);
        const allParticipantIds = Array.from(new Set([trip.ownerId, ...eligibleMemberIds]));
        const payerId = form.payerUserId ?? req.user!.id;
        const oweIds = allParticipantIds.filter((id) => id !== payerId);
        const participants = oweIds.length > 0 ? oweIds : [payerId];
        const per = amount / participants.length;
        splitsPayload = participants.map((uid) => ({ userId: uid, amount: per }));
      }
      const splitSum = Math.round(splitsPayload.reduce((sum, s) => sum + Math.round(s.amount * 100), 0));
      if (splitSum !== amountCents) throw new Error("Split amounts must sum to total amount");
      await tx.expenseSplit.createMany({ data: splitsPayload.map((s) => ({ expenseId: expense.id, userId: s.userId, amountCents: Math.round(s.amount * 100) })) });

      // Payments
      let paymentsPayload = payments;
      if (!paymentsPayload || paymentsPayload.length === 0) {
        const fallbackPayer = form.payerUserId ?? req.user!.id;
        paymentsPayload = [{ userId: fallbackPayer, amount, currency: expenseCurrency }];
      }
      // Validate payments sum
      let convertedSum = 0;
      for (const p of paymentsPayload) {
        const fromCur = normalizeCurrency(p.currency || expenseCurrency);
        const cents = Math.round(p.amount * 100);
        const converted = await convertCents(cents, fromCur, expenseCurrency, incurredAt);
        convertedSum += converted;
      }
      if (convertedSum !== amountCents) throw new Error("Payment amounts must sum to total amount (after conversion)");
      await (tx as any).expensePayment.createMany({ data: paymentsPayload.map((p) => ({ expenseId: expense.id, userId: p.userId, amountCents: Math.round(p.amount * 100), currency: normalizeCurrency(p.currency || expenseCurrency) })) });

      const withRelations = await tx.expense.findUnique({ where: { id: expense.id }, include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any });
      return withRelations;
    });

    res.json({ expense: created });
  } catch (e: any) {
    const message = e?.message || "Failed to create expense";
    const bad = message.includes("must sum to total amount");
    return res.status(bad ? 400 : 500).json({ error: message });
  }
});

// Update expense splits/payments (and optional metadata)
router.put("/expenses/:id", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const bodySchema = z.object({
    description: z.string().min(1).optional(),
    category: z.string().optional(),
    expenseType: z.string().optional(),
    incurredAt: z.string().datetime().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    payerUserId: z.string().optional(),
    splits: z.array(z.object({ userId: z.string(), amount: z.number().nonnegative() })).optional(),
    payments: z.array(z.object({ userId: z.string(), amount: z.number().nonnegative(), currency: z.string().length(3).optional() })).optional(),
  });
  const params = paramsSchema.safeParse(req.params);
  const body = bodySchema.safeParse(req.body);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const expenseId = params.data.id;
  const data = body.data;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Prevent editing settlements
  if (existing.expenseType === 'settlement') {
    return res.status(400).json({ error: "Settlements cannot be edited. You can only delete them." });
  }

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  const newAmountCents = data.amount != null ? toCents(data.amount) : existing.amountCents;
  const newIncurredAt = data.incurredAt ? new Date(data.incurredAt) : existing.incurredAt;
  const newCurrency = normalizeCurrency(data.currency || existing.currency);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Update core fields
      const exp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description ?? existing.description,
          category: data.category ?? existing.category ?? undefined,
          expenseType: data.expenseType ?? existing.expenseType ?? undefined,
          incurredAt: newIncurredAt,
          amountCents: newAmountCents,
          currency: newCurrency,
        },
      });

      // Splits
      if (data.splits) {
        const splitSum = Math.round(data.splits.reduce((sum, s) => sum + toCents(s.amount), 0));
        if (splitSum !== newAmountCents) throw new Error("Split amounts must sum to total amount");
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseSplit.createMany({
          data: data.splits.map((s) => ({ expenseId, userId: s.userId, amountCents: toCents(s.amount) })),
        });
      }

      // Payments
      if (data.payments) {
        // Validate after conversion to expense currency
        let convertedSum = 0;
        for (const p of data.payments) {
          const fromCur = normalizeCurrency(p.currency || newCurrency);
          const cents = toCents(p.amount);
          const converted = await convertCents(cents, fromCur, newCurrency, newIncurredAt);
          convertedSum += converted;
        }
        if (convertedSum !== newAmountCents) throw new Error("Payment amounts must sum to total amount (after conversion)");
        await (tx as any).expensePayment.deleteMany({ where: { expenseId } });
        await (tx as any).expensePayment.createMany({
          data: data.payments.map((p) => ({ expenseId, userId: p.userId, amountCents: toCents(p.amount), currency: normalizeCurrency(p.currency || newCurrency) })),
        });
      } else if (data.payerUserId) {
        // If only payerUserId is provided without payments, set them to pay the full amount
        await (tx as any).expensePayment.deleteMany({ where: { expenseId } });
        await (tx as any).expensePayment.create({
          data: { expenseId, userId: data.payerUserId, amountCents: newAmountCents, currency: newCurrency },
        });
      }

      const withRelations = await tx.expense.findUnique({
        where: { id: expenseId },
        include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
      });
      return withRelations!;
    });

    res.json({ expense: updated });
  } catch (e: any) {
    const message = e?.message || "Failed to update expense";
    const bad = message.includes("must sum to total amount");
    return res.status(bad ? 400 : 500).json({ error: message });
  }
});

// Update receipt for an expense
router.put("/expenses/:id/receipt", receiptUpload.single("receipt"), async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const expenseId = params.data.id;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No receipt file provided" });

  const receiptMime = file.mimetype;
  const receiptData = file.buffer;

  try {
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        receiptData,
        receiptMime,
      },
      include: {
        splits: true,
        payments: true,
        createdBy: { select: { id: true, username: true } },
      } as any,
    });

    res.json({ expense: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to update receipt" });
  }
});

// Delete receipt for an expense
router.delete("/expenses/:id/receipt", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const expenseId = params.data.id;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  try {
    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        receiptData: null,
        receiptMime: null,
      },
    });

    res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to delete receipt" });
  }
});

// Delete an expense
router.delete("/expenses/:id", async (req: AuthenticatedRequest, res) => {
  const paramsSchema = z.object({ id: z.string() });
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: params.error.flatten() });
  const expenseId = params.data.id;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });

  // Permission: user must be owner or trip member
  const trip = await prisma.trip.findFirst({
    where: { id: existing.tripId, OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }] },
  });
  if (!trip) return res.status(403).json({ error: "Access denied" });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      await (tx as any).expensePayment.deleteMany({ where: { expenseId } });
      await tx.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } });
    });
    res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to delete expense" });
  }
});

export default router;
