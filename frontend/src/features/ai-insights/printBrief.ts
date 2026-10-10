import type { Insight, InsightsOverview } from '@/types/insights';
import { categoryMeta, priorityMeta, stripMarkup } from './insightMeta';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Client-side "PDF brief": opens a print-ready brief of the insight in a new window and triggers the
 * browser print dialog (choose "Save as PDF"). Server-side PDF generation needs the backend.
 * Returns false when the popup was blocked.
 */
export function printInsightBrief(insight: Insight, disclaimer: InsightsOverview['disclaimer']): boolean {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  const d = insight.detail;
  const rows = d?.telemetry?.rows
    .map(
      (r) =>
        `<tr><td>${esc(r.label)}</td><td><b>${esc(r.primary)}</b> ${esc(r.primaryNote ?? '')}</td><td>${esc(r.comparison)} ${esc(r.comparisonNote ?? '')}</td><td>${esc(r.delta)}</td></tr>`,
    )
    .join('');
  const steps = d?.steps
    ?.map((s) => `<li><b>${esc(s.title)}</b> <i>${esc(s.tag)}</i>${insight.completedStepIds.includes(s.id) ? ' ✓ done' : ''}<br/>${esc(s.description)}</li>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(insight.title)} — Eko InstaBoard brief</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#0F172A;margin:32px;font-size:13px;line-height:1.5}
h1{font-size:20px;margin:4px 0 8px}h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #E2E8F0;padding-bottom:4px}
.meta{color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.note{background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:4px;color:#475569}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #E2E8F0;padding:5px 8px;text-align:left;vertical-align:top}th{background:#F8FAFC;font-size:11px}
.demo{display:inline-block;border:1px solid #CBD5E1;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;color:#475569}
</style></head><body>
<div class="meta">Eko InstaBoard · AI Insight Brief · <span class="demo">DEMO DATA</span></div>
<h1>${esc(insight.title)}</h1>
<div class="meta">${priorityMeta[insight.priority].label} · AI-confidence ${insight.confidence}% · ${categoryMeta[insight.category].label} · Generated ${esc(insight.generatedAt)} · Status: ${insight.status}</div>
<p class="note">${esc(disclaimer)}</p>
<h2>Observed data</h2><p>${esc(stripMarkup(insight.observed))}</p>
<h2>AI interpretation</h2><p>${esc(insight.interpretation)}</p>
<h2>Expected impact</h2><p>${esc(insight.impact.text)}</p>
${rows ? `<h2>${esc(d?.telemetry?.title ?? 'Telemetry')}</h2><table><tr><th>Metric</th><th>${esc(d?.telemetry?.primaryLabel ?? '')}</th><th>${esc(d?.telemetry?.comparisonLabel ?? '')}</th><th>Delta</th></tr>${rows}</table>` : ''}
${d?.reasoning ? `<h2>AI reasoning</h2><ul>${d.reasoning.factors.map((f) => `<li><b>${esc(f.title)}:</b> ${esc(stripMarkup(f.text))}</li>`).join('')}</ul><p>${esc(d.reasoning.confidenceNote)}</p>` : ''}
${steps ? `<h2>Recommended plan</h2><ol>${steps}</ol>` : ''}
<p class="meta" style="margin-top:24px">Printed from the InstaBoard prototype. Use your browser's "Save as PDF" to keep a copy.</p>
<script>window.onload=function(){window.focus();window.print();}</script>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
