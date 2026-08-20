import { useEffect, useState } from 'react';
import {
  BarChart3,
  MessageCircle,
  Lightbulb,
  Ticket,
  Users,
  Cog,
  RefreshCw,
} from 'lucide-react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await Api.analytics();
      setData(res);
    } catch (err) {
      push(err.message || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <p style={{ color: 'var(--sv-muted)' }}>Loading analytics…</p>
      </div>
    );
  }

  const s = data?.summary || {};
  const qMax = Math.max(1, ...(data?.questions_by_machine || []).map((x) => x.count));
  const tMax = Math.max(1, ...(data?.tips_by_machine || []).map((x) => x.count));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 22, color: 'var(--sv-ink)', margin: 0 }}>
            Analytics
          </p>
          <p style={{ fontSize: 13, color: 'var(--sv-muted)', margin: '4px 0 0' }}>
            Simple view of questions, tips, tickets, and machines.
          </p>
        </div>
        <button
          onClick={load}
          className="sv-btn sv-btn--outline"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12,
          marginTop: 20,
          marginBottom: 28,
        }}
      >
        <StatCard icon={<MessageCircle size={18} />} label="Questions" value={s.total_questions ?? 0} color="#b8860b" />
        <StatCard icon={<Lightbulb size={18} />} label="Tips total" value={s.tips_total ?? 0} sub={`${s.tips_pending ?? 0} pending`} color="#0d9488" />
        <StatCard icon={<Ticket size={18} />} label="Open tickets" value={s.open_tickets ?? 0} color="#ef4444" />
        <StatCard icon={<Users size={18} />} label="Workers" value={s.total_workers ?? 0} sub={`${s.pending_workers ?? 0} pending`} color="#6366f1" />
        <StatCard icon={<Cog size={18} />} label="Machines" value={s.machines_count ?? 0} color="#64748b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Questions by machine */}
        <div className="sv-card" style={{ padding: 18, borderRadius: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--sv-ink)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} /> Questions by machine
          </p>
          <p style={{ fontSize: 12, color: 'var(--sv-muted)', margin: '0 0 14px' }}>
            Which machines workers ask about most
          </p>
          {(data?.questions_by_machine || []).length === 0 ? (
            <EmptyHint text="No questions logged yet. Ask from Ask or Hands-free to see data." />
          ) : (
            (data.questions_by_machine).map((row) => (
              <BarRow key={row.machine_id} label={row.machine_id} count={row.count} max={qMax} barColor="var(--sv-brass, #b8860b)" />
            ))
          )}
        </div>

        {/* Tips by machine */}
        <div className="sv-card" style={{ padding: 18, borderRadius: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--sv-ink)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb size={16} /> Tips by machine
          </p>
          <p style={{ fontSize: 12, color: 'var(--sv-muted)', margin: '0 0 14px' }}>
            Tip submissions (pending + approved)
          </p>
          {(data?.tips_by_machine || []).length === 0 ? (
            <EmptyHint text="No worker tips in the knowledge base yet." />
          ) : (
            (data.tips_by_machine).map((row) => (
              <BarRow key={row.machine_id} label={row.machine_id} count={row.count} max={tMax} barColor="var(--sv-teal, #0d9488)" />
            ))
          )}
        </div>
      </div>

      {/* Tickets + tip breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="sv-card" style={{ padding: 18, borderRadius: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--sv-ink)', margin: '0 0 14px' }}>
            Tickets by status
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data?.tickets_by_status || {}).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--sv-muted)' }}>{status}</span>
                <strong style={{ color: 'var(--sv-ink)' }}>{count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="sv-card" style={{ padding: 18, borderRadius: 14 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--sv-ink)', margin: '0 0 14px' }}>
            Tip pipeline
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--sv-muted)' }}>Pending review</span>
              <strong style={{ color: 'var(--sv-ink)' }}>{s.tips_pending ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--sv-muted)' }}>Approved</span>
              <strong style={{ color: 'var(--sv-ink)' }}>{s.tips_approved ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--sv-muted)' }}>Total tips</span>
              <strong style={{ color: 'var(--sv-ink)' }}>{s.tips_total ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div
      className="sv-card"
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sv-muted)', marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--sv-ink)', margin: 0, lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--sv-muted)', margin: '4px 0 0' }}>{sub}</p>
      )}
    </div>
  );
}

function BarRow({ label, count, max, barColor }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--sv-ink)', fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--sv-muted)' }}>{count}</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: 'var(--sv-border, #e5e5e5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--sv-muted)', margin: 0, lineHeight: 1.4 }}>
      {text}
    </p>
  );
}