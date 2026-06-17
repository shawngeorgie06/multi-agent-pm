/**
 * Tests for reconcileVisibilityContract — a deterministic assembly-time pass that
 * guarantees the generated CSS actually supports whatever show/hide the generated
 * JS does. It closes the serial-pipeline contract gap: Styling runs before Logic,
 * so it can't know which elements Logic will toggle at runtime.
 *
 * Each case is a real failure mode observed in live generation output.
 */

import { describe, it, expect } from '@jest/globals';
import { reconcileVisibilityContract } from '../../src/utils/visibilityReconciliation';

describe('reconcileVisibilityContract', () => {
  it('hides an aria-hidden element that the JS reveals with .visible but the CSS never hides', () => {
    // The exact #custom-tip bug: Layout marked it aria-hidden, Logic toggles
    // .visible on it, but Styling gave it no display:none default → always shown.
    const html = `<input type="number" id="custom-tip" class="form-input" aria-hidden="true">`;
    const css = `#custom-tip { padding: 8px; }`;
    const js = `const customTipInput = document.getElementById('custom-tip');
      customTipInput.classList.add('visible');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.css).toMatch(/#custom-tip\s*\{[^}]*display:\s*none/);
    expect(result.css).toMatch(/#custom-tip\.visible\s*\{[^}]*display:\s*revert/);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('adds a reveal rule when an element is hidden by default but the show class has none (stuck hidden)', () => {
    // The real tip2 bug: Styling correctly hid #custom-tip, but never wrote a
    // #custom-tip.visible reveal, so the JS toggling .visible could never show it.
    const html = `<input id="custom-tip" class="form-input" aria-hidden="true">`;
    const css = `#custom-tip { display: none; padding: 8px; }`;
    const js = `const x = document.getElementById('custom-tip'); x.classList.add('visible');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.css).toMatch(/#custom-tip\.visible\s*\{[^}]*display:\s*(?!none)/);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('defines a .hidden rule when the JS toggles .hidden but the CSS never declares it', () => {
    // The Logic agent invented `.hidden` while Styling only defined `.visible`.
    // We support what the JS does: make `.hidden` actually hide.
    const html = `<div id="spinner" class="loading-indicator"></div>`;
    const css = `.loading-indicator { width: 24px; }`;
    const js = `document.getElementById('spinner').classList.add('hidden');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.css).toMatch(/\.hidden\s*\{[^}]*display:\s*none\s*!important/);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('leaves a correctly-styled element alone (already hidden + reveal rule)', () => {
    const html = `<span id="err" class="error-message" aria-hidden="true"></span>`;
    const css = `.error-message { display: none; } .error-message.visible { display: block; }`;
    const js = `const err = document.getElementById('err'); err.classList.add('visible');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.changes).toHaveLength(0);
    expect(result.css).toBe(css);
  });

  it('does NOT hide an element that has no start-hidden signal (ambiguous → untouched)', () => {
    // #panel is revealed via .visible but nothing says it starts hidden. Injecting
    // display:none here could wrongly hide content meant to show — so leave it.
    const html = `<div id="panel" class="panel"></div>`;
    const css = `.panel { padding: 16px; }`;
    const js = `const panel = document.getElementById('panel'); panel.classList.add('visible');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.changes).toHaveLength(0);
    expect(result.css).toBe(css);
  });

  it('does NOT redefine a hide class the CSS already declares', () => {
    const html = `<div id="box" class="box"></div>`;
    const css = `.hidden { display: none; } .box { color: red; }`;
    const js = `document.getElementById('box').classList.add('hidden');`;

    const result = reconcileVisibilityContract({ html, css, js });

    expect(result.changes).toHaveLength(0);
    expect(result.css).toBe(css);
  });
});
