type RateKey = `${string}_${string}_${string}`; // from_to_YYYY-MM-DD

const cache = new Map<RateKey, number>();

function dateKey(d?: Date): string {
  const dt = d ? new Date(d) : new Date();
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeCurrency(code: string | undefined | null, fallback = 'USD'): string {
  const c = (code || fallback).trim().toUpperCase();
  // Simple guard: three letters
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

export async function getRate(from: string, to: string, at?: Date): Promise<number> {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (f === t) return 1;
  const key: RateKey = `${f}_${t}_${dateKey(at)}`;
  const cached = cache.get(key);
  if (cached && cached > 0) return cached;
  // Use exchangerate.host free API, which does not require a key
  const date = dateKey(at);
  const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const data: any = await res.json();
  const rate = Number(data?.result);
  if (!(rate > 0)) throw new Error('FX rate unavailable');
  cache.set(key, rate);
  return rate;
}

export async function convertCents(amountCents: number, from: string, to: string, at?: Date): Promise<number> {
  const rate = await getRate(from, to, at);
  const value = (amountCents / 100) * rate;
  return Math.round(value * 100);
}


