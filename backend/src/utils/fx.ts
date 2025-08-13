import { prisma } from "../prisma";

type RateKey = `${string}_${string}`; // from_to

const cache = new Map<RateKey, number>();

export function normalizeCurrency(code: string | undefined | null, fallback = 'EUR'): string {
  const c = (code || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

function toUtcMidnight(d?: Date): Date {
  const dt = d ? new Date(d) : new Date();
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0, 0));
}

export async function getRate(from: string, to: string, at?: Date): Promise<number> {
  const f = normalizeCurrency(from, 'EUR');
  const t = normalizeCurrency(to, 'EUR');
  if (f === t) return 1;
  const key: RateKey = `${f}_${t}`;
  const cached = cache.get(key);
  if (cached && cached > 0) return cached;

  const date = toUtcMidnight(at);
  try {
    // Try direct rate f->t using last known rate at or before date
    const direct = await (prisma as any).currencyRate.findFirst({
      where: { base: f, quote: t, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
    if (direct && direct.rate > 0) {
      cache.set(key, direct.rate);
      return direct.rate;
    }
    // Try cross via EUR as common base (or via t->f) using last known rates
    const eurBaseToT = await (prisma as any).currencyRate.findFirst({
      where: { base: 'EUR', quote: t, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
    const eurBaseToF = await (prisma as any).currencyRate.findFirst({
      where: { base: 'EUR', quote: f, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
    if (eurBaseToT && eurBaseToT.rate > 0 && eurBaseToF && eurBaseToF.rate > 0) {
      const rate = eurBaseToT.rate / eurBaseToF.rate;
      cache.set(key, rate);
      return rate;
    }
    const tToF = await (prisma as any).currencyRate.findFirst({
      where: { base: t, quote: f, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
    if (tToF && tToF.rate > 0) {
      const rate = 1 / tToF.rate;
      cache.set(key, rate);
      return rate;
    }
  } catch (e) {
    console.warn('FX DB lookup failed', e);
  }
  // If nothing in DB, fallback to 1:1 to avoid hard failure; still log
  console.warn(`FX rate not found for ${f}->${t} at ${date.toISOString()}, using 1.0`);
  return 1;
}

export async function convertCents(amountCents: number, from: string, to: string, at?: Date): Promise<number> {
  const rate = await getRate(from, to, at);
  const value = (amountCents / 100) * rate;
  return Math.round(value * 100);
}

