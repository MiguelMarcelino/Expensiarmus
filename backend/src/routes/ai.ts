import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { config } from "../config";

const router = Router();

const inputSchema = z.object({ input: z.string().min(5) });

type ParsedExpense = {
  tripName?: string;
  expenseType?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

async function parseWithOpenAI(input: string) {
  if (!config.openaiApiKey) return null;
  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const system =
      "You are an information extraction engine for travel expenses. Extract fields as strict JSON: {tripName, expenseType, description, quantity, unitPrice, amount}. Use numbers, not strings. If missing, omit the field. If total mentioned like 'two flights at 1500 each', set quantity=2, unitPrice=1500, amount=3000. Trip name should be concise like 'Japan trip'. Output only JSON.";
    const userMsg = input;
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
    });
    const content = resp.choices[0]?.message?.content || "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const json = content.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(json) as ParsedExpense;
  } catch {
    return null;
  }
}

function naiveParse(input: string): ParsedExpense {
  const lower = input.toLowerCase();
  const tripMatch = /(trip to|my)\s+([a-zA-Z]+\s?[a-zA-Z]*)/i.exec(input);
  const tripName = tripMatch ? `${tripMatch[2].trim()} trip` : undefined;
  const qtyMatch = /(\d+)\s*(x|times|units|tickets|flights)/i.exec(lower);
  const eachMatch = /(\d+[\.,]?\d*)\s*(each|ea)/i.exec(lower);
  const atEachMatch = /at\s*(\d+[\.,]?\d*)\s*(each)?/i.exec(lower);
  const amountMatch = /(total|amount|for)\s*(\d+[\.,]?\d*)/i.exec(lower);
  const typeMatch = /(flight|hotel|meal|taxi|uber|train|ticket|accommodation)s?/i.exec(lower);

  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;
  const priceMatch = eachMatch ?? atEachMatch;
  const unitPrice = priceMatch ? parseFloat(priceMatch[1].replace(",", "")) : undefined;
  const amount = amountMatch
    ? parseFloat(amountMatch[2].replace(",", ""))
    : quantity && unitPrice
    ? quantity * unitPrice
    : undefined;

  return {
    tripName,
    expenseType: typeMatch ? (typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1)) : undefined,
    description: input,
    quantity,
    unitPrice,
    amount,
  };
}

router.post("/ai/parse", async (req: AuthenticatedRequest, res) => {
  const parse = inputSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { input } = parse.data;

  const ai = (await parseWithOpenAI(input)) || naiveParse(input);
  if (!ai.amount && ai.quantity && ai.unitPrice) {
    ai.amount = ai.quantity * ai.unitPrice;
  }
  if (!ai.amount) return res.status(400).json({ error: "Could not parse amount" });

  let trip = ai.tripName
    ? await prisma.trip.findFirst({
        where: {
          name: ai.tripName,
          OR: [{ ownerId: req.user!.id }, { members: { some: { userId: req.user!.id } } }],
        },
      })
    : null;
  if (!trip && ai.tripName) {
    trip = await prisma.trip.create({ data: { name: ai.tripName, ownerId: req.user!.id } });
  }
  if (!trip) return res.status(400).json({ error: "No trip specified or accessible" });

  const amountNum = ai.amount!;
  const expense = await prisma.expense.create({
    data: {
      tripId: trip.id,
      createdById: req.user!.id,
      description: ai.description || input,
      category: ai.tripName || undefined,
      expenseType: ai.expenseType,
      quantity: ai.quantity || 1,
      unitPriceCents: ai.unitPrice != null ? toCents(ai.unitPrice) : null,
      amountCents: toCents(amountNum),
    },
  });

  const incurredAt = new Date();
  const members = (await prisma.tripMember.findMany({
    where: { tripId: trip.id },
    select: { userId: true, joinedAt: true } as any,
  })) as any[];
  const memberIds = members
    .filter((m: any) => new Date(m.joinedAt) <= incurredAt)
    .map((m) => m.userId);
  const participants = memberIds.length > 0 ? memberIds : [req.user!.id];
  const per = amountNum / participants.length;
  await prisma.expenseSplit.createMany({
    data: participants.map((uid) => ({ expenseId: expense.id, userId: uid, amountCents: toCents(per) })),
  });

  // Record a default payment: creator covers full amount by default for AI-added expenses
  await prisma.expensePayment.create({
    data: { expenseId: expense.id, userId: req.user!.id, amountCents: toCents(amountNum) },
  });

  const withRelations = await prisma.expense.findUnique({
    where: { id: expense.id },
    include: { splits: true, payments: true, createdBy: { select: { id: true, username: true } } } as any,
  });

  res.json({ parsed: ai, trip, expense: withRelations });
});

export default router;
