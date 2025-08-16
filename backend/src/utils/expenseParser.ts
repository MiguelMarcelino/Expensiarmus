export type ParsedExpense = {
  tripName?: string;
  expenseType?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

/**
 * Enhanced rule-based expense parser that extracts structured data from natural language input.
 * Runs entirely locally without requiring external APIs.
 * 
 * @param input - Natural language description of an expense
 * @returns ParsedExpense object with extracted fields
 * 
 * @example
 * ```typescript
 * const result = enhancedExpenseParser("Flight to Tokyo for $450");
 * // Returns: { expenseType: "Flight", amount: 450, quantity: 1, unitPrice: 450, description: "..." }
 * ```
 */
export function enhancedExpenseParser(input: string): ParsedExpense {
  const lower = input.toLowerCase();
  const original = input;

  // Enhanced trip name extraction
  const tripPatterns = [
    /(trip to|traveling to|visiting)\s+([a-zA-Z\s]{2,15})/i,
    /(my|our)\s+([a-zA-Z\s]{2,15})\s+(trip|vacation|holiday)/i,
    /(vacation in|holiday in)\s+([a-zA-Z\s]{2,15})/i,
  ];
  
  let tripName: string | undefined;
  for (const pattern of tripPatterns) {
    const match = pattern.exec(original);
    if (match) {
      const extracted = (match[2] || match[4])?.trim();
      if (extracted && extracted.length > 1 && !/(cost|for|at|total|amount|restaurant|hotel)/i.test(extracted)) {
        tripName = `${extracted.charAt(0).toUpperCase() + extracted.slice(1)} trip`;
        break;
      }
    }
  }

  // Enhanced expense type detection
  const expenseTypePatterns = [
    { pattern: /(flight|flights|airplane|plane|airline|airfare)/i, type: "Flight" },
    { pattern: /(hotel|accommodation|lodging|stay|room|booking)/i, type: "Hotel" },
    { pattern: /(meal|food|restaurant|dinner|lunch|breakfast|dining|cafe|coffee)/i, type: "Meal" },
    { pattern: /(taxi|uber|lyft|cab|ride|transport|bus|train|metro|subway)/i, type: "Transport" },
    { pattern: /(gas|fuel|petrol|gasoline)/i, type: "Transport" },
    { pattern: /(ticket|tickets|entry|admission|museum|attraction)/i, type: "Entertainment" },
    { pattern: /(shopping|souvenir|gift|purchase|buy|bought)/i, type: "Shopping" },
    { pattern: /(parking|toll|fee)/i, type: "Transport" },
    { pattern: /(insurance|visa|document)/i, type: "Other" }
  ];

  let expenseType: string | undefined;
  for (const { pattern, type } of expenseTypePatterns) {
    if (pattern.test(lower)) {
      expenseType = type;
      break;
    }
  }

  // Enhanced quantity extraction
  const quantityPatterns = [
    /(\d+)\s*(x|times|units|tickets|flights|rooms|nights|people|persons)/i,
    /(two|three|four|five|six|seven|eight|nine|ten)\s*(x|times|units|tickets|flights|rooms|nights|people|persons)/i,
    /for\s+(\d+)\s*(people|persons|travelers)/i,
    /(two|three|four|five|six|seven|eight|nine|ten)\s+(tickets|flights|rooms|nights)/i
  ];

  let quantity: number | undefined;
  for (const pattern of quantityPatterns) {
    const match = pattern.exec(lower);
    if (match) {
      const qtyStr = match[1];
      if (/^\d+$/.test(qtyStr)) {
        quantity = parseInt(qtyStr, 10);
      } else {
        // Convert word numbers to digits
        const wordToNum: { [key: string]: number } = {
          two: 2, three: 3, four: 4, five: 5, six: 6,
          seven: 7, eight: 8, nine: 9, ten: 10
        };
        quantity = wordToNum[qtyStr.toLowerCase()] || undefined;
      }
      break;
    }
  }

  // Enhanced price extraction with better patterns
  const pricePatterns = [
    // Unit prices: "at 150 each", "150 per person", "50 USD each"
    /(at|@)\s*([€$£¥₹]?\s*\d+[\.,]?\d*)\s*(each|per|ea)/i,
    /(\d+[\.,]?\d*)\s*([€$£¥₹]?)\s*(each|per|ea)/i,
    // Total amounts: "total 300", "amount 450", "for 200 EUR"
    /(total|amount|cost|price|paid|for)\s*([€$£¥₹]?\s*\d+[\.,]?\d*)/i,
    /([€$£¥₹])\s*(\d+[\.,]?\d*)/i,
    // Standalone numbers with context
    /(\d+[\.,]?\d*)\s*([€$£¥₹]|dollars?|euros?|pounds?|USD|EUR|GBP)/i,
    // Just numbers (fallback)
    /(\d+[\.,]?\d*)/i
  ];

  let unitPrice: number | undefined;
  let amount: number | undefined;

  // Look for unit prices first (patterns with "each", "per")
  for (const pattern of pricePatterns.slice(0, 2)) {
    const match = pattern.exec(original);
    if (match) {
      const priceStr = match[2] || match[1];
      const cleanPrice = priceStr.replace(/[€$£¥₹\s]/g, '').replace(',', '.');
      if (/^\d+\.?\d*$/.test(cleanPrice)) {
        unitPrice = parseFloat(cleanPrice);
        break;
      }
    }
  }

  // Look for total amounts
  for (const pattern of pricePatterns) {
    const match = pattern.exec(original);
    if (match) {
      const priceStr = match[2] || match[1];
      const cleanPrice = priceStr.replace(/[€$£¥₹\s]/g, '').replace(',', '.');
      if (/^\d+\.?\d*$/.test(cleanPrice)) {
        const parsedAmount = parseFloat(cleanPrice);
        // Prefer larger amounts as totals, unless we have a clear unit price context
        if (!amount || (parsedAmount >= (amount || 0))) {
          amount = parsedAmount;
        }
        break;
      }
    }
  }

  // Calculate missing values
  if (!amount && quantity && unitPrice) {
    amount = quantity * unitPrice;
  } else if (!quantity && amount && unitPrice && unitPrice > 0) {
    quantity = Math.round(amount / unitPrice);
  } else if (!unitPrice && amount && quantity && quantity > 0) {
    unitPrice = amount / quantity;
  }

  // If no quantity was specified but we have prices, assume quantity = 1
  if (!quantity && (amount || unitPrice)) {
    quantity = 1;
  }

  // Use amount as unitPrice if we only have one price
  if (!unitPrice && amount && quantity === 1) {
    unitPrice = amount;
  }

  return {
    tripName,
    expenseType,
    description: original,
    quantity,
    unitPrice,
    amount,
  };
}

/**
 * Utility function to convert amount to cents for database storage
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
