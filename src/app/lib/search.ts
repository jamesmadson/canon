/** Ranking for the search palette. Every word has to match somewhere; a name beats a tag, a tag beats the rest. */
import type { Card } from './home';

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** How well one word fits one field: 0 for no match. */
function fit(word: string, text: string, weights: { exact: number; prefix: number; wordPrefix: number; contains: number }): number {
  const t = text.toLowerCase();
  if (!t || !t.includes(word)) return 0;
  if (t === word) return weights.exact;
  if (t.startsWith(word)) return weights.prefix;
  if (words(t).some((w) => w.startsWith(word))) return weights.wordPrefix;
  return weights.contains;
}

const NAME = { exact: 100, prefix: 80, wordPrefix: 60, contains: 40 };
const TAG = { exact: 35, prefix: 28, wordPrefix: 24, contains: 16 };
const TEXT = (n: number) => ({ exact: n, prefix: n, wordPrefix: n, contains: n - 2 });

function scoreWord(word: string, card: Card, projectName: string): number {
  const tags = Math.max(0, ...card.tags.map((t) => fit(word, t, TAG)));
  return Math.max(
    fit(word, card.name, NAME), tags,
    fit(word, card.summary, TEXT(15)), fit(word, card.source, TEXT(12)), fit(word, projectName, TEXT(12)),
    fit(word, card.note, TEXT(8)), card.frame.url ? fit(word, card.frame.url, TEXT(10)) : 0,
  );
}

export function searchCards(
  cards: Card[], query: string, projectName: (projectId: string) => string, limit = 12, opts: { archived?: boolean } = {},
): Card[] {
  const pool = cards.filter((c) => !!c.archived === !!opts.archived);
  const terms = words(query);
  if (!terms.length) return [...pool].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  const scored: { card: Card; score: number }[] = [];
  for (const card of pool) {
    const name = projectName(card.projectId);
    let total = 0;
    for (const term of terms) {
      const s = scoreWord(term, card, name);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push({ card, score: total });
  }
  return scored.sort((a, b) => b.score - a.score || b.card.updatedAt - a.card.updatedAt).slice(0, limit).map((s) => s.card);
}
