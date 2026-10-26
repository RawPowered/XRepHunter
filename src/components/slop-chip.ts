/** Legacy corner slop chip — timeline uses tweet-stats-badges in the action row. */
export function createSlopChip(score: number, signals: string[]): HTMLElement {
  const el = document.createElement('span');
  el.className = 'xrh-slop-chip';
  const tip =
    signals.length > 0
      ? `Heuristic slop ${score}: ${signals.join(', ')}`
      : `Heuristic slop score: ${score}`;
  el.title = tip;
  el.textContent = `Slop ${score}`;
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    color: #f97316;
    border: 1px solid #f97316;
    border-radius: 9999px;
    padding: 2px 8px;
    background: rgba(0,0,0,0.75);
    cursor: default;
    user-select: none;
    line-height: 1.2;
    z-index: 3;
  `;
  return el;
}
