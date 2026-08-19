import { useEffect, useState } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Ticket, Clock } from 'lucide-react';

const statusColor = {
  Open: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'In Progress': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  Resolved: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  Closed: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

const priorityColor = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
};

export default function MyTickets() {
  const { push } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await Api.myTickets();
      setTickets(data);
    } catch (err) {
      push('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--sv-muted)' }}>Loading your tickets...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: 24 }}>My Tickets</h1>
        <p style={{ margin: 0, color: 'var(--sv-muted)', fontSize: 14 }}>
          Track the status of issues you reported
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="card" style={{
          padding: 48,
          textAlign: 'center',
          border: '1px dashed var(--sv-border, #e2e8f0)',
        }}>
          <Ticket size={40} style={{ color: 'var(--sv-muted)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px 0' }}>No tickets yet</h3>
          <p style={{ margin: 0, color: 'var(--sv-muted)', fontSize: 14 }}>
            When you raise a ticket, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tickets.map((t) => {
            const sc = statusColor[t.status] || statusColor.Open;
            return (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: 18,
                  borderLeft: `4px solid ${priorityColor[t.priority] || '#94a3b8'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
                    {t.title}
                  </h3>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: sc.bg,
                    color: sc.text,
                    border: `1px solid ${sc.border}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {t.status}
                  </span>
                </div>

                <p style={{
                  margin: '0 0 14px 0',
                  color: 'var(--sv-muted)',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}>
                  {t.description}
                </p>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  fontSize: 13,
                  color: 'var(--sv-muted)',
                  alignItems: 'center',
                }}>
                  {t.machine_id && (
                    <span style={{
                      background: 'var(--sv-bg-soft, #f1f5f9)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontWeight: 500,
                    }}>
                      {t.machine_id}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: priorityColor[t.priority] || '#94a3b8',
                    }} />
                    {t.priority}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} />
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}