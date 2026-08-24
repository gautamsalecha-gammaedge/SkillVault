import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, Select, Card, Badge, FullPageLoader, EmptyState } from '../../components/ui';
import { useToast } from '../../components/Toast';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const TONE = { Open: 'amber', 'In Progress': 'amber', Resolved: 'signal', Closed: 'default' };

export default function AdminTickets() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [tickets, setTickets] = useState([]);

  const load = () => { setLoading(true); api.adminTickets(filter || null).then(setTickets).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    try { await api.updateTicketStatus(id, status); setTickets((t) => t.map((x) => x.id === id ? { ...x, status } : x)); toast.success('Status updated.'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not update.'); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Floor issues"
        title="Tickets"
        description="Issues raised by workers, tracked through to resolution."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-w-[160px]">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        }
      />
      {loading ? <FullPageLoader label="Loading tickets…" /> : tickets.length === 0 ? (
        <EmptyState icon={Ticket} title="Nothing here" description="No tickets match this filter." />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
                <div>
                  <h3 className="font-display font-bold text-lg">{t.title}</h3>
                  <p className="font-mono text-xs text-muted">{t.worker_id} {t.machine_id ? `· ${t.machine_id}` : ''} · {t.priority} priority</p>
                </div>
                <Select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)} className="!py-1.5 !text-xs min-w-[140px]">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <p className="text-sm text-muted">{t.description}</p>
              <p className="text-[11px] font-mono text-muted mt-3">{new Date(t.created_at).toLocaleString()}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
