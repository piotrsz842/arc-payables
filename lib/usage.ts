/**
 * What each Claude call costs, measured from the API's own token counts.
 *
 * Prices are USD per million tokens (from the Claude API model reference,
 * 2026-11-18): Opus 5.5 $4 in / $20 out (cache read $0.20, 5-min cache
 * write 1.25x input); Haiku 5.5 $0.10 / $0.50 for prompts up to 100K tokens
 * (cache read 0.1x, write 1.25x). Thinking tokens are billed as output.
 */
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };
const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costUsd(model: string, u: TokenUsage): number {
  const p = PRICES[model];
  if (!p) return NaN;
  return (
    (u.input_tokens * p.input +
      u.output_tokens * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/** Collects every call in one tutor question. */
export class UsageMeter {
  calls: { label: string; model: string; usage: TokenUsage; usd: number }[] = [];
  add(label: string, model: string, usage: TokenUsage) {
    this.calls.push({ label, model, usage, usd: costUsd(model, usage) });
  }
  get totalUsd() {
    return this.calls.reduce((s, c) => s + c.usd, 0);
  }
  summary(): string {
    const lines = this.calls.map(
      (c) =>
        `  ${c.label.padEnd(18)} ${c.model.padEnd(17)} in ${String(c.usage.input_tokens).padStart(6)}` +
        `  cache r/w ${c.usage.cache_read_input_tokens ?? 0}/${c.usage.cache_creation_input_tokens ?? 0}` +
        `  out ${String(c.usage.output_tokens).padStart(5)}  $${c.usd.toFixed(4)}`,
    );
    return [...lines, `  TOTAL ${this.calls.length} calls: $${this.totalUsd.toFixed(4)}`].join("\n");
  }
}
