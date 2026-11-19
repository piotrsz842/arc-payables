/**
 * PRICING: the platform sets every section's price; authors can't.
 *
 *   price = $0.002 × L × R, capped at $0.01, rounded to $0.0001
 *
 *   L (length)  = 1 + 0.5 × min(words, 300) / 300          → 1.0× to 1.5×
 *   R (rating), smoothed so a few votes can't swing it:
 *     n = up + down
 *     s = (up + 2) / (n + 4)        everyone starts at 0.5
 *     c = n / (n + 10)              confidence grows with ratings
 *     q = 0.5 + c × (s − 0.5)
 *     R = max(0.5, 2q)              if q < 0.5   → 0.5× to 1.0×
 *     R = 1 + (q − 0.5) × 4.67      if q ≥ 0.5   → 1.0× to ~3.33×
 *
 * Why authors can't set prices: the buyer is an AI agent with a budget, and
 * prices are part of what the checker trusts. Platform pricing stays
 * predictable, rewards what students actually rate helpful, and can't be
 * gamed by an author naming a price.
 *
 * Examples: new author, 300 words → $0.0030; 48 of 50 helpful → $0.0080;
 * 5 of 30 helpful → $0.0017 (npm run price-table).
 */
export const BASE_PRICE_USD = 0.002;
export const MAX_PRICE_USD = 0.01;

export const wordCount = (text: string) => (text.match(/\S+/g) ?? []).length;

export function lengthFactor(words: number): number {
  return 1 + (0.5 * Math.min(words, 300)) / 300;
}

export function ratingFactor(up: number, down: number): number {
  const n = up + down;
  const s = (up + 2) / (n + 4);
  const c = n / (n + 10);
  const q = 0.5 + c * (s - 0.5);
  return q < 0.5 ? Math.max(0.5, 2 * q) : 1 + (q - 0.5) * 4.67;
}

export type Price = { usd: string; base: number; length: number; rating: number };

export function priceSection(words: number, rating: { up: number; down: number } = { up: 0, down: 0 }): Price {
  const length = lengthFactor(words);
  const ratingX = ratingFactor(rating.up, rating.down);
  const raw = Math.min(BASE_PRICE_USD * length * ratingX, MAX_PRICE_USD);
  return { usd: (Math.round(raw * 10_000) / 10_000).toFixed(4), base: BASE_PRICE_USD, length, rating: ratingX };
}

/** "Base $0.002 · length ×1.25 · rating ×1.00 = $0.0025 per section" */
export function explainPrice(p: Price): string {
  return `Base $${p.base.toFixed(3)} · length ×${p.length.toFixed(2)} · rating ×${p.rating.toFixed(2)} = $${p.usd} per section`;
}

export const EARN_MORE = "Prices rise as students rate your guides helpful.";

/** Choices for the student's "ask me before any single purchase over $X" setting ($0.01 = the cap: never ask). */
export const APPROVAL_CHOICES = ["0.001", "0.002", "0.003", "0.005", "0.01"];
export const DEFAULT_APPROVAL_USD = "0.005";
