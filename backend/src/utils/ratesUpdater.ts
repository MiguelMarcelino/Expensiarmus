import { prisma } from "../prisma";

const BASE = "EUR";
const SUPPORTED = [
  "EUR", "USD", "GBP", "JPY", "AUD", "CAD", "BRL", "INR", "MXN", "CNY", "CHF",
];

function toUtcMidnight(d: Date): Date {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0, 0));
}

export async function fetchAndStoreRatesOnce(at: Date = new Date()): Promise<void> {
  try {
    const date = toUtcMidnight(at);
    const symbols = SUPPORTED.filter((c) => c !== BASE).join(",");
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(BASE)}&symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`FX daily fetch failed: ${res.status}`);
      return;
    }
    const data: any = await res.json();
    const rates: Record<string, number> = data?.rates || {};
    const entries = Object.entries(rates).filter(([, v]) => typeof v === "number" && v > 0);
    if (entries.length === 0) {
      console.warn("FX daily fetch returned no rates");
      return;
    }
    for (const [quote, rate] of entries) {
      // Upsert by composite unique (base, quote, date)
      try {
        await (prisma as any).currencyRate.upsert({
          where: { base_quote_date: { base: BASE, quote, date } },
          create: { base: BASE, quote, date, rate },
          update: { rate },
        });
      } catch (e) {
        // Fallback: try update or insert separately if upsert fails due to provider limitations
        try {
          const existing = await (prisma as any).currencyRate.findFirst({
            where: { base: BASE, quote, date },
          });
          if (existing) {
            await (prisma as any).currencyRate.update({ where: { id: existing.id }, data: { rate } });
          } else {
            await (prisma as any).currencyRate.create({ data: { base: BASE, quote, date, rate } });
          }
        } catch (inner) {
          console.warn("FX store failed for", quote, inner);
        }
      }
    }
  } catch (e) {
    console.warn("FX daily fetch threw", e);
  }
}

export function scheduleDailyRatesUpdate(): void {
  // Run once on startup
  fetchAndStoreRatesOnce().catch((e) => console.warn("FX initial fetch error", e));

  // Schedule next run at next UTC midnight, then every 24h
  try {
    const now = new Date();
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const delay = Math.max(1, nextMidnight.getTime() - now.getTime());
    setTimeout(() => {
      fetchAndStoreRatesOnce().catch((e) => console.warn("FX scheduled fetch error", e));
      setInterval(() => {
        fetchAndStoreRatesOnce().catch((e) => console.warn("FX scheduled fetch error", e));
      }, 24 * 60 * 60 * 1000);
    }, delay);
  } catch (e) {
    console.warn("FX scheduler setup failed", e);
  }
}

export { BASE as FX_BASE_CURRENCY, SUPPORTED as SUPPORTED_CURRENCIES };


