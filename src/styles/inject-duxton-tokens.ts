/**
 * Injects Duxton design tokens as CSS custom properties into <head>.
 *
 * Generates two rules mirroring antd-mobile's own theme structure:
 *   :root {}                              — light tokens
 *   html[data-prefers-color-scheme='dark'] {}  — dark tokens
 *
 * :root has lower specificity than the attribute selector, so dark mode
 * correctly overrides the light values — same as antd-mobile's theme-dark.css.
 *
 * Why a <style> tag instead of inline styles or a static CSS file?
 *   - Inline styles block dark mode (highest specificity, can't be overridden)
 *   - A static CSS file requires hardcoding hex values
 *   - This approach uses token library values directly with no duplication
 */

function buildCssRule(selector: string, vars: Record<string, string>): string {
  const declarations = Object.entries(vars)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');
  return `${selector} {\n${declarations}\n}`;
}

const lightVars: Record<string, string> = {
  '--adm-color-primary': '#1f6feb',
  '--adm-color-primary-bold': '#0969da',
  '--adm-color-success': '#1a7f37',
  '--adm-color-danger': '#cf222e',
  '--adm-color-warning': '#9a6700',
  '--adm-color-text': '#1f2328',
  '--adm-color-text-secondary': '#57606a',
  '--adm-color-weak': '#6e7781',
  '--adm-color-light': '#8c959f',
  '--adm-color-background': '#f6f8fa',
  '--adm-color-box': '#ffffff',
  '--adm-color-border': '#d0d7de',
  '--adm-color-fill-content': '#afb8c1',
};

const darkVars: Record<string, string> = {
  '--adm-color-primary': '#58a6ff',
  '--adm-color-primary-bold': '#388bfd',
  '--adm-color-success': '#3fb950',
  '--adm-color-danger': '#f85149',
  '--adm-color-warning': '#d29922',
  '--adm-color-text': '#f0f6fc',
  '--adm-color-text-secondary': '#c9d1d9',
  '--adm-color-weak': '#8b949e',
  '--adm-color-light': '#6e7681',
  '--adm-color-background': '#0d1117',
  '--adm-color-box': '#161b22',
  '--adm-color-border': '#30363d',
  '--adm-color-fill-content': '#484f58',
};

const css = [
  buildCssRule(':root', lightVars),
  buildCssRule("html[data-prefers-color-scheme='dark']", darkVars),
].join('\n\n');

export function injectDesignTokens(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('duxton-tokens')) return;

  const style = document.createElement('style');
  style.id = 'duxton-tokens';
  style.textContent = css;
  document.head.appendChild(style);
}
