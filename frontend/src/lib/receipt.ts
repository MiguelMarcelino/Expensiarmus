import Tesseract from 'tesseract.js';

export type ParsedReceipt = {
	description?: string;
	amount?: number;
	currency?: string;
	incurredAt?: string; // ISO string
	category?: string;
};

// Try to parse currency codes or symbols and numbers like: 12.34, 12,34, $12.34, EUR 12.34
function extractAmountAndCurrency(text: string): { amount?: number; currency?: string } {
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	const currencySymbols: Record<string, string[]> = {
		'EUR': ['€', 'eur'],
		'USD': ['$', 'usd', 'us$'],
		'GBP': ['£', 'gbp'],
		'JPY': ['¥', 'jpy'],
	};
	const codeSet = new Set(Object.keys(currencySymbols));

	let best: { amount: number; currency?: string } | null = null;

	for (const line of lines.slice(-8)) {
		// Normalize separators: convert commas used as decimal to dot if seems like a price
		const normalized = line.replace(/,(\d{2})(?!\d)/g, '.$1');
		// Capture currency and amount in either order
		const regexes = [
			/(?:(EUR|USD|GBP|JPY)\s*)?([€$£¥])?\s*([0-9]+(?:[\.,][0-9]{2})?)/i,
			/([€$£¥])\s*([0-9]+(?:[\.,][0-9]{2})?)/,
			/([0-9]+(?:[\.,][0-9]{2})?)\s*(EUR|USD|GBP|JPY)/i,
		];
		for (const r of regexes) {
			const m = normalized.match(r);
			if (m) {
				let currency: string | undefined;
				let amountStr: string | undefined;
				if (m[1] && codeSet.has(m[1].toUpperCase())) {
					currency = m[1].toUpperCase();
					amountStr = m[2] || m[3];
				} else if (m[2] && codeSet.has((m[2] as string).toUpperCase())) {
					currency = (m[2] as string).toUpperCase();
					amountStr = m[1];
				} else {
					const symbol = m[1] && !/[0-9]/.test(m[1]) ? m[1] : m[2];
					amountStr = m[3] || m[2] || m[1];
					if (symbol === '€') currency = 'EUR';
					else if (symbol === '$') currency = 'USD';
					else if (symbol === '£') currency = 'GBP';
					else if (symbol === '¥') currency = 'JPY';
				}
				const amount = amountStr ? Number(amountStr.replace(/[^0-9.]/g, '')) : NaN;
				if (!isFinite(amount)) continue;
				if (!best || amount > best.amount) best = { amount, currency };
			}
		}
	}
	return best || {};
}

function extractDate(text: string): string | undefined {
	// Try formats like 2024-08-15, 15/08/2024, 15-08-2024, 08/15/2024
	const iso = text.match(/(20\d{2})[-\.\/]?(\d{2})[-\.\/]?(\d{2})/);
	if (iso) {
		const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
		if (!isNaN(d.getTime())) return d.toISOString();
	}
	const dmy = text.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](20\d{2})/);
	if (dmy) {
		const dd = dmy[1].padStart(2, '0');
		const mm = dmy[2].padStart(2, '0');
		const yyyy = dmy[3];
		const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
		if (!isNaN(d.getTime())) return d.toISOString();
	}
	const mdy = text.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](20\d{2})/);
	if (mdy) {
		const mm = mdy[1].padStart(2, '0');
		const dd = mdy[2].padStart(2, '0');
		const yyyy = mdy[3];
		const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
		if (!isNaN(d.getTime())) return d.toISOString();
	}
	return undefined;
}

function extractDescription(text: string): string | undefined {
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	// Heuristic: first non-header line without VAT/Tax/Total keywords
	for (const line of lines) {
		const lower = line.toLowerCase();
		if (/(total|subtotal|vat|tax|receipt|invoice|amount)/.test(lower)) continue;
		if (line.length >= 3 && line.length <= 80) return line;
	}
	return lines[0] || undefined;
}

export async function ocrReceipt(file: File): Promise<ParsedReceipt> {
	let worker: any;
	let initialized = false;
	try {
		worker = await Tesseract.createWorker({ langPath: '/tesseract' });
		await worker.load();
		await worker.loadLanguage('eng');
		await worker.initialize('eng');
		initialized = true;
	} catch (_err) {
		// Fallback: try default worker (may fetch language remotely during development)
		if (worker && worker.terminate) { try { await worker.terminate(); } catch {} }
		worker = await Tesseract.createWorker();
		await worker.load();
		await worker.loadLanguage('eng');
		await worker.initialize('eng');
		initialized = true;
	}
	try {
		const { data } = await worker.recognize(file);
		const text = data.text || '';
		const { amount, currency } = extractAmountAndCurrency(text);
		const incurredAt = extractDate(text);
		const description = extractDescription(text);
		return { amount, currency, incurredAt, description };
	} finally {
		if (initialized && worker) { try { await worker.terminate(); } catch {} }
	}
}


