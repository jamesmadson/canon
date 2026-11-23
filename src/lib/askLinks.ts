import { MARKS } from './brandMarks';
import { REPO_URL } from './site';

/**
 * Links that open a visitor's own assistant with a question about Canon
 * already typed in. The question names the repository so the assistant reads
 * the real thing instead of guessing which Canon is meant. Nothing is sent
 * until the visitor presses send in their assistant.
 */
export const ASK_QUESTION = `Read ${REPO_URL} and explain what Canon does for a design team that prototypes in code, and how I would try it with my agent.`;

export interface AskLink {
  name: string;
  /** The assistant's address, ending in the parameter that takes the question. */
  base: string;
  /** A one-colour mark on a 24 by 24 grid, or null to show the name alone. */
  path: string | null;
}

// Perplexity's mark is from Simple Icons, like the others in brandMarks.
const PERPLEXITY =
  'M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z';

// Simple Icons has no OpenAI mark, so ChatGPT shows its name alone.
export const ASK_LINKS: AskLink[] = [
  { name: 'Claude', base: 'https://claude.ai/new?q=', path: MARKS.claude.path },
  { name: 'ChatGPT', base: 'https://chatgpt.com/?q=', path: null },
  { name: 'Perplexity', base: 'https://www.perplexity.ai/search?q=', path: PERPLEXITY },
];

export const askHref = (link: AskLink): string => link.base + encodeURIComponent(ASK_QUESTION);
