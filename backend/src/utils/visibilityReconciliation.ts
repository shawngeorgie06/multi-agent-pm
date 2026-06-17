/**
 * reconcileVisibilityContract — a deterministic, LLM-free pass run at assembly time
 * that guarantees the generated CSS actually supports whatever show/hide behaviour
 * the generated JS performs.
 *
 * Why this exists: the generation pipeline is serial (Layout → Styling → Logic).
 * Styling runs before Logic, so it cannot know which elements Logic will toggle at
 * runtime, and Logic never sees the CSS. The result is "dead toggles": JS flips a
 * class that the CSS never defined, or reveals an element the CSS never hid. Rather
 * than force the agents to agree, this pass makes the CSS support what the JS does.
 *
 * It acts ONLY on strong evidence, so it can never break a correctly-styled page.
 */

export interface ReconcileInput {
  html: string;
  css: string;
  js: string;
}

export interface ReconcileResult {
  css: string;
  changes: string[];
}

/** Classes whose presence means "reveal this element". */
const SHOW_CLASSES = ['visible', 'show'];

/** Classes whose presence means "hide this element". */
const HIDE_CLASSES = ['hidden', 'hide', 'collapsed', 'is-hidden', 'd-none'];

/** A single `element.classList.add|remove|toggle('class')` call, resolved to a selector. */
interface Toggle {
  selector: string;
  className: string;
}

/**
 * Map JS variables to the CSS selector they reference, e.g.
 *   const x = document.getElementById('foo')  → x -> #foo
 *   const y = document.querySelector('.bar')   → y -> .bar
 */
function buildVarSelectorMap(js: string): Map<string, string> {
  const map = new Map<string, string>();
  const byId = /(?:const|let|var)\s+(\w+)\s*=\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of js.matchAll(byId)) map.set(m[1], `#${m[2]}`);
  const byQuery = /(?:const|let|var)\s+(\w+)\s*=\s*document\.querySelector\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of js.matchAll(byQuery)) map.set(m[1], m[2]);
  return map;
}

/** Collect every classList toggle in the JS, resolved to the selector it acts on. */
function collectToggles(js: string, varMap: Map<string, string>): Toggle[] {
  const toggles: Toggle[] = [];

  // variable.classList.add|remove|toggle('class')
  const viaVar = /(\w+)\.classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of js.matchAll(viaVar)) {
    const selector = varMap.get(m[1]);
    if (selector) toggles.push({ selector, className: m[2] });
  }

  // document.getElementById('id').classList.add|remove|toggle('class')
  const inline = /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\.classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of js.matchAll(inline)) {
    toggles.push({ selector: `#${m[1]}`, className: m[2] });
  }

  return toggles;
}

/** The opening tag for an id selector, or '' if not found. */
function openingTag(html: string, selector: string): string {
  if (!selector.startsWith('#')) return '';
  const id = selector.slice(1);
  const tag = new RegExp(`<[^>]*\\bid=["']${id}["'][^>]*>`).exec(html);
  return tag ? tag[0] : '';
}

/** Does the HTML element for this selector signal that it starts hidden? */
function htmlMarksHidden(html: string, selector: string): boolean {
  const tag = openingTag(html, selector);
  if (!tag) return false;
  return /\baria-hidden=["']true["']/.test(tag) || /\bhidden\b/.test(tag.replace(/aria-hidden/g, ''));
}

/** Class names on the element for an id selector. */
function elementClasses(html: string, selector: string): string[] {
  const tag = openingTag(html, selector);
  const m = /\bclass=["']([^"']+)["']/.exec(tag);
  return m ? m[1].trim().split(/\s+/) : [];
}

function hasDisplayNoneRule(css: string, selectorText: string): boolean {
  const esc = selectorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc}\\s*\\{[^}]*display:\\s*none`).test(css);
}

/**
 * Does the CSS already hide this element by default — whether through its id
 * selector OR any of the classes it carries in the HTML? Checking only the id
 * misses the common case where Styling hid the element via a shared class.
 */
function cssHidesByDefault(css: string, selector: string, html: string): boolean {
  if (hasDisplayNoneRule(css, selector)) return true;
  return elementClasses(html, selector).some(cls => hasDisplayNoneRule(css, `.${cls}`));
}

/** Does the CSS already define a `.className` rule that hides (display:none)? */
function cssDefinesHideClass(css: string, className: string): boolean {
  const esc = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.${esc}\\b[^{]*\\{[^}]*display:\\s*none`).test(css);
}

/** Is there a rule whose selector is exactly `sel` (possibly with trailing pseudo/compound)? */
function selectorPresent(css: string, sel: string): boolean {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Require a boundary before the selector so `.visible` does not match inside
  // `.error-message.visible` (which reveals a different element, not ours).
  return new RegExp(`(^|[\\s,>{}+~])${esc}([\\s.:#\\[][^,{}]*)?\\s*\\{`).test(css);
}

/**
 * Does the CSS reveal THIS element when the show class is present? Checks a rule
 * targeting the element by id+class, by one of its classes+class, or a standalone
 * `.className` rule. If none exists, the JS's show toggle can never reveal it.
 */
function cssRevealsWithClass(css: string, selector: string, className: string, html: string): boolean {
  const candidates = [
    `${selector}.${className}`,
    `.${className}`,
    ...elementClasses(html, selector).map(cls => `.${cls}.${className}`),
  ];
  return candidates.some(sel => selectorPresent(css, sel));
}

export function reconcileVisibilityContract({ html, css, js }: ReconcileInput): ReconcileResult {
  const changes: string[] = [];
  const additions: string[] = [];

  const varMap = buildVarSelectorMap(js);
  const toggles = collectToggles(js, varMap);

  // Rule 1: make every hide-intent class the JS toggles actually hide something.
  // If the JS flips e.g. `.hidden` but the CSS never declares it, the toggle is a
  // no-op. Define the class so the JS's intent works (one rule per distinct class).
  const handledHide = new Set<string>();
  for (const { className } of toggles) {
    if (!HIDE_CLASSES.includes(className)) continue;
    if (handledHide.has(className)) continue;
    handledHide.add(className);
    if (!cssDefinesHideClass(css, className)) {
      additions.push(`.${className} { display: none !important; }`);
      changes.push(`defined .${className} (toggled by JS but missing from CSS)`);
    }
  }

  // Rule 2: ensure the show/hide contract is complete for elements the JS reveals
  // with a show class. Two failure modes, both leaving a dead toggle:
  //   (a) element is hidden by default but has no reveal rule → stuck hidden;
  //   (b) element is NOT hidden but is meant to start hidden (aria-hidden/hidden) → always shown.
  // Act only on strong evidence; anything ambiguous is left untouched.
  const handledShow = new Set<string>();
  for (const { selector, className } of toggles) {
    if (!SHOW_CLASSES.includes(className)) continue;
    const key = `${selector}|${className}`;
    if (handledShow.has(key)) continue;

    if (cssRevealsWithClass(css, selector, className, html)) continue; // contract already complete

    if (cssHidesByDefault(css, selector, html)) {
      // (a) Hidden by default, no reveal → add the missing reveal only.
      additions.push(`${selector}.${className} { display: revert !important; }`);
      changes.push(`added reveal ${selector}.${className} (element was stuck hidden)`);
      handledShow.add(key);
    } else if (htmlMarksHidden(html, selector)) {
      // (b) Meant to start hidden but CSS never hid it → add hide + reveal.
      additions.push(`${selector} { display: none; }\n${selector}.${className} { display: revert !important; }`);
      changes.push(`hid ${selector} by default (revealed via .${className})`);
      handledShow.add(key);
    }
  }

  const reconciledCss = additions.length
    ? `${css}\n\n/* --- visibility-contract reconciliation (auto-generated) --- */\n${additions.join('\n')}\n`
    : css;

  return { css: reconciledCss, changes };
}
