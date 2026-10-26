export const BASE_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: #e7e9ea;
  --xrh-trusted: #00ba7c;
  --xrh-caution: #ffd400;
  --xrh-risk: #f4212e;
  --xrh-bg: #16181c;
  --xrh-border: #2f3336;
  --xrh-accent: #1d9bf0;
}
* { box-sizing: border-box; }
`;

export function bandColor(band: string): string {
  if (band === 'trusted') return 'var(--xrh-trusted)';
  if (band === 'caution') return 'var(--xrh-caution)';
  return 'var(--xrh-risk)';
}

export function bandLabel(band: string): string {
  if (band === 'trusted') return 'Trusted';
  if (band === 'caution') return 'Caution';
  return 'High risk';
}
