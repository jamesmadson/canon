function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the tiny subset of inline Markdown used in kit digests — `code`,
 * **bold**, and *italic* — as real HTML elements, so quoted excerpt strings
 * don't show their literal backticks/asterisks on screen.
 *
 * HTML-escapes the input first, then substitutes, so the result is safe to
 * pass to `set:html` even though the source strings are quoted verbatim
 * from digest files rather than authored here. This is not a Markdown
 * parser: only these three inline forms are recognized, matching what
 * DEMO_CASES excerpts actually contain.
 */
export function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
