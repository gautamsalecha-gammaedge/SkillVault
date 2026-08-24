import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, FullPageLoader, EmptyState, Badge, Card } from '../../components/ui';

export default function MyTips() {
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    api.myTips().then((r) => setTips(r.tips || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader label="Loading your tips…" />;

  return (
    <div>
      <PageHeader eyebrow="My tips" title="Everything you've shared." description="Track the status of every tip you've submitted, across every machine." />
      {tips.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tips yet" description="Tips you submit from Add a Tip will show up here with their review status." />
      ) : (
        <div className="space-y-3">
          {tips.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-muted">{t.machine_id}</span>
                  </div>
                  <p className="text-sm text-text/90 leading-relaxed">{t.text}</p>
                </div>
                {t.status === 'approved' ? (
                  <Badge tone="signal"><CheckCircle2 size={11} /> Approved</Badge>
                ) : (
                  <Badge tone="amber"><Clock size={11} /> Pending</Badge>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
