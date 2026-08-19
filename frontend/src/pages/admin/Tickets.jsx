import { useEffect, useState, useRef } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Ticket, ChevronDown } from 'lucide-react';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

const statusColor = {
  Open: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  'In Progress': { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
  Resolved: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
  Closed: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
};

const priorityColor = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#22c55e',
};

function StatusDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 140 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--sv-border)',
          background: 'var(--sv-card)',
          color: 'var(--sv-text)',
          fontSize: 13,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{value}</span>
        <ChevronDown size={16} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--sv-card)',
            border: '1px solid var(--sv-border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                background: s === value ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                color: 'var(--sv-text)',
                fontSize: 13,
                fontWeight: s === value ? 600 : 400,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (s !== value) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.12)';
              }}
              onMouseLeave={(e) => {
                if (s !== value) e.currentTarget.style.background = 'transparent';
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tickets() {
  const { push } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await Api.adminTickets(filter || null);
      setTickets(data);
    } catch (err) {
      push(err.message || 'Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdatingId(ticketId);
    try {
      await Api.updateTicketStatus(ticketId, newStatus);
      push('Status updated', 'success');
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      push(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = {
    all: tickets.length,
    Open: tickets.filter((t) => t.status === 'Open').length,
    'In Progress': tickets.filter((t) => t.status === 'In Progress').length,
    Resolved: tickets.filter((t) => t.status === 'Resolved').length,
    Closed: tickets.filter((t) => t.status === 'Closed').length,
  };

  return (
    <div className="page" style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: 26 }}>Tickets</h1>
        <p style={{ margin: 0, color: 'var(--sv-muted)' }}>
          Manage issues reported by workers
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('')}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: filter === '' ? 'none' : '1px solid var(--sv-border)',
            background: filter === '' 
              ? 'var(--sv-primary, #0284c7)' 
              : 'rgba(148, 163, 184, 0.12)',
            color: filter === '' ? '#fff' : 'var(--sv-text)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          All ({counts.all})
        </button>

        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: filter === s ? 'none' : '1px solid var(--sv-border)',
              background: filter === s 
                ? 'var(--sv-primary, #0284c7)' 
                : 'rgba(148, 163, 184, 0.12)',
              color: filter === s ? '#fff' : 'var(--sv-text)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: 'var(--sv-muted)' }}>Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <div className="card" style={{
          padding: 48,
          textAlign: 'center',
          border: '1px dashed var(--sv-border)',
        }}>
          <Ticket size={40} style={{ color: 'var(--sv-muted)', marginBottom: 12 }} />
          <p style={{ margin: 0, color: 'var(--sv-muted)' }}>No tickets found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map((t) => {
            const sc = statusColor[t.status] || statusColor.Open;
            return (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                {/* Priority bar */}
                <div style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 4,
                  background: priorityColor[t.priority] || '#94a3b8',
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                      {t.title}
                    </h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: sc.bg,
                      color: sc.text,
                      whiteSpace: 'nowrap',
                    }}>
                      {t.status}
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 12px 0',
                    color: 'var(--sv-muted)',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}>
                    {t.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    fontSize: 13,
                    color: 'var(--sv-muted)',
                  }}>
                    <span>Worker: <strong style={{ color: 'var(--sv-text)' }}>{t.worker_id}</strong></span>
                    {t.machine_id && (
                      <span>Machine: <strong style={{ color: 'var(--sv-text)' }}>{t.machine_id}</strong></span>
                    )}
                    <span>
                      Priority:{' '}
                      <strong style={{ color: priorityColor[t.priority] }}>
                        {t.priority}
                      </strong>
                    </span>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Custom Status Dropdown */}
                <div style={{ flexShrink: 0 }}>
                  <StatusDropdown
                    value={t.status}
                    disabled={updatingId === t.id}
                    onChange={(newStatus) => handleStatusChange(t.id, newStatus)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}