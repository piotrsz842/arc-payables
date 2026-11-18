/**
 * Embeddings: turn text into 1024 numbers so that texts with similar MEANING
 * get similar numbers. pgvector then finds the closest ones in Postgres.
 *
 * Provider: Voyage AI (Anthropic's recommended embeddings partner; Claude's
 * API doesn't make embeddings). Model voyage-4-lite: tuned for speed and
 * cost, first 200M tokens free.
 *   input_type "document" for what we store, "query" for what we search with.
 * Docs: https://docs.voyageai.com/reference/embeddings-api
 */

const MODEL = "voyage-4-lite";
export const DIMENSIONS = 1024;

export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType, output_dimension: DIMENSIONS }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** pgvector's text format: "[0.1,0.2,...]" */
export const toVector = (v: number[]) => `[${v.join(",")}]`;

/** What we embed for a section: what it's about (title + preview) and what it says. */
export const sectionText = (s: { course: string; title: string; summary: string; content: string }) =>
  `${s.course}: ${s.title}\n${s.summary}\n\n${s.content}`;

/** Is meaning search set up? (key present). Without it we fall back to keyword search. */
export const embeddingsEnabled = () => !!process.env.VOYAGE_API_KEY;
