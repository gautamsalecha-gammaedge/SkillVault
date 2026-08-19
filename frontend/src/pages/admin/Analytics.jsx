import { BarChart3 } from 'lucide-react';

/**
 * No backend aggregation endpoint exists (see handoff brief —
 * "Analytics aggregates" is in the NOT-yet-implemented list). The
 * design preview shows total tips, approval rate, most-asked
 * questions, and per-machine coverage as fabricated demo numbers —
 * deliberately not reproducing those here as if they were real.
 */
export default function Analytics() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>Analytics</p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 24 }}>
        How the vault is being used, at a glance.
      </p>
      <div className="sv-card" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--sv-muted)' }}>
        <BarChart3 size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--sv-ink)', marginBottom: 6 }}>
          Analytics isn't available yet
        </p>
        <p style={{ fontSize: 13, maxWidth: 420, margin: '0 auto' }}>
          This needs a backend endpoint that aggregates totals, approval rate, most-asked
          questions, active workers/machines, and per-machine coverage — none of that exists
          server-side yet. Once it does, this page renders those numbers directly rather than
          estimating them from what the frontend can already see.
        </p>
      </div>
    </div>
  );
}
