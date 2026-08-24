import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, FullPageLoader, EmptyState, Badge, Card } from '../../components/ui';

const TONE = { Open: 'amber', 'In Progress': 'amber', Resolved: 'signal', Closed: 'default' };

export default function MyTickets() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);

  useEffect(() => { api.myTickets().then(setTickets).finally(() => setLoading(false)); }, []);

  if (loading) return <FullPageLoader label="Loading tickets…" />;

  return (
    <div>
      <PageHeader eyebrow="Tickets" title="My tickets" description="Every issue you've raised, and where it stands." />
      {tickets.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets yet" description="Raise a ticket if something's not right with a machine." />
      ) : (
        <div className="space-y-3">
          {tickets.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-display font-bold text-lg">{t.title}</h3>
                  <Badge tone={TONE[t.status] || 'default'}>{t.status}</Badge>
                </div>
                <p className="text-sm text-muted mb-3">{t.description}</p>
                <div className="flex items-center gap-4 text-[11px] font-mono text-muted">
                  {t.machine_id && <span>{t.machine_id}</span>}
                  <span>{t.priority} priority</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
