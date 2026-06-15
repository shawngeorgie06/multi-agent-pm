/**
 * Tests for stripCodeFences — the single source of truth for turning a raw LLM
 * response into clean code, used everywhere generated CSS/HTML/JS is assembled.
 *
 * Each case here is a real failure mode that previously leaked markdown fences
 * (e.g. ```css) straight into generated index.html files.
 */

import { describe, it, expect } from '@jest/globals';
import { stripCodeFences } from '../../src/utils/codeExtraction';

describe('stripCodeFences', () => {
  it('extracts the contents of a clean fenced block', () => {
    expect(stripCodeFences('```css\nbody { color: red; }\n```')).toBe('body { color: red; }');
  });

  it('returns plain code unchanged when there are no fences', () => {
    expect(stripCodeFences('body { color: red; }')).toBe('body { color: red; }');
  });

  it('strips an INDENTED fence (the bug that leaked ```css into <style>)', () => {
    const raw = '   ```css\n   body { color: red; }\n   ```';
    expect(stripCodeFences(raw)).toContain('body { color: red; }');
    expect(stripCodeFences(raw)).not.toContain('```');
  });

  it('handles CRLF line endings', () => {
    expect(stripCodeFences('```css\r\nbody {}\r\n```')).toBe('body {}');
  });

  it('strips an opening fence even when the closing fence is missing', () => {
    expect(stripCodeFences('```css\nbody {}')).toBe('body {}');
    expect(stripCodeFences('```css\nbody {}')).not.toContain('```');
  });

  it('drops prose surrounding a fenced block', () => {
    const raw = 'Here is the CSS:\n```css\nbody {}\n```\nHope this helps!';
    expect(stripCodeFences(raw)).toBe('body {}');
  });

  it('removes stray fence lines anywhere in the content (safety net)', () => {
    expect(stripCodeFences('body {}\n```\nh1 {}')).toBe('body {}\nh1 {}');
  });

  it('handles uppercase and spaced language tags', () => {
    expect(stripCodeFences('```CSS\nbody {}\n```')).toBe('body {}');
    expect(stripCodeFences('``` css\nbody {}\n```')).toBe('body {}');
  });

  it('handles a bare fence with no language', () => {
    expect(stripCodeFences('```\nbody {}\n```')).toBe('body {}');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(stripCodeFences('')).toBe('');
    expect(stripCodeFences('   \n  ')).toBe('');
  });

  it('preserves backticks that are part of the code, not fences', () => {
    // Template literals etc. should survive — only full fence lines are removed.
    const js = 'const s = `hello ${name}`;';
    expect(stripCodeFences('```js\n' + js + '\n```')).toBe(js);
  });

  it('never lets a fence delimiter survive in typical messy output', () => {
    const messy = 'Sure!\n```html\n<div>hi</div>\n```\n\nLet me know!';
    const out = stripCodeFences(messy);
    expect(out).toBe('<div>hi</div>');
    expect(out).not.toMatch(/```/);
  });
});
