import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Check, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, FullPageLoader, EmptyState, Card, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function PendingWorkers() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = () => api.pendingWorkers().then((r) => setWorkers(r.pending_workers || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setBusyId(id);
    try { await api.approveWorker(id); setWorkers((w) => w.filter((x) => x.worker_id !== id)); toast.success(`${id} approved.`); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not approve.'); }
    finally { setBusyId(null); }
  };
  const reject = async (id) => {
    setBusyId(id);
    try { await api.rejectWorker(id); setWorkers((w) => w.filter((x) => x.worker_id !== id)); toast.info(`${id} rejected.`); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not reject.'); }
    finally { setBusyId(null); }
  };

  if (loading) return <FullPageLoader label="Loading approvals…" />;

  return (
    <div>
      <PageHeader eyebrow="Approvals" title="Pending workers" description="New registrations waiting to be let onto the floor." />
      {workers.length === 0 ? (
        <EmptyState icon={UserCheck} title="Nothing pending" description="Every registered worker has been reviewed." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {workers.map((w) => (
              <motion.div key={w.worker_id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card className="p-5">
                  <p className="font-display font-bold text-lg">{w.name}</p>
                  <p className="font-mono text-xs text-muted mb-4">{w.worker_id}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" icon={Check} onClick={() => approve(w.worker_id)} loading={busyId === w.worker_id} className="flex-1">Approve</Button>
                    <Button size="sm" variant="danger" icon={X} onClick={() => reject(w.worker_id)} loading={busyId === w.worker_id}>Reject</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
