/**
 * Code extraction helpers.
 *
 * LLMs almost always wrap generated code in markdown fences (```css … ```),
 * sometimes with surrounding prose, sometimes indented, sometimes with CRLF
 * line endings, and sometimes without a closing fence. If any of that leaks
 * into the assembled index.html (e.g. a literal ```css inside a <style> tag)
 * the generated app is broken.
 *
 * This module is the single source of truth for cleaning that output. It is
 * deliberately forgiving: it extracts the first fenced block when present, and
 * — critically — always strips any remaining fence-delimiter lines as a safety
 * net so a stray fence can never survive into the output.
 */

/** Matches a line that is nothing but a code-fence delimiter (optionally
 *  indented, optional language tag). Used to remove stray fences. */
const FENCE_LINE = /^[ \t]*```[ \t]*[\w+\-.#]*[ \t]*$/;

/** Matches the first complete fenced block, capturing its inner content.
 *  `m` so ^/$ work per-line (handles indentation and surrounding prose),
 *  non-greedy body so we take the first block. */
const FENCED_BLOCK = /^[ \t]*```[ \t]*[\w+\-.#]*[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/m;

/**
 * Turn a raw LLM response into clean code.
 *
 * - Normalises CRLF to LF.
 * - If a complete fenced block is present, returns its inner content (dropping
 *   any surrounding prose).
 * - Otherwise returns the text as-is.
 * - In all cases, removes any leftover standalone fence-delimiter lines so a
 *   fence can never reach the output (covers indented fences, a missing closing
 *   fence, and stray fences between blocks).
 *
 * @param raw the raw model response
 * @returns the cleaned code, trimmed
 */
export function stripCodeFences(raw: string): string {
  if (!raw) return '';

  const normalized = raw.replace(/\r\n/g, '\n');

  const block = normalized.match(FENCED_BLOCK);
  const content = block ? block[1] : normalized;

  const cleaned = content
    .split('\n')
    .filter((line) => !FENCE_LINE.test(line))
    .join('\n');

  return cleaned.trim();
}
