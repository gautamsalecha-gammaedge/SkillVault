import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, X, Plus, Pencil, Search, RefreshCw, Factory, Phone, MapPin,
  Check, UserCheck, UserX, Filter, ChevronRight, Save,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, FullPageLoader, Card, Badge, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function phoneLine(w) {
  const num = (w.phone_number || '').trim();
  if (!num) return null;
  return `${(w.phone_country_code || '+91').trim()} ${num}`;
}

export default function WorkersMachines() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [selectedId, setSelectedId] = useState(null); // drawer worker_id
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | approved | unapproved
  const [machineFilter, setMachineFilter] = useState('all'); // all | assigned | unassigned
  const [sortBy, setSortBy] = useState('name');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [w, m] = await Promise.all([api.allWorkers(), api.allMachines()]);
      const list = w.workers || [];
      setWorkers(list);
      setMachines(m.machine_ids || []);
      const entries = await Promise.all(
        list.map(async (wk) => {
          try {
            const r = await api.workerMachines(wk.worker_id);
            return [wk.worker_id, r.machine_ids || []];
          } catch {
            return [wk.worker_id, []];
          }
        }),
      );
      setAssignments(Object.fromEntries(entries));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load workers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedWorker = useMemo(
    () => workers.find((w) => w.worker_id === selectedId) || null,
    [workers, selectedId],
  );

  const stats = useMemo(() => {
    const approved = workers.filter((w) => w.is_approved).length;
    const unapproved = workers.length - approved;
    const unassigned = workers.filter((w) => !(assignments[w.worker_id] || []).length).length;
    return { total: workers.length, approved, unapproved, unassigned, machines: machines.length };
  }, [workers, assignments, machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = workers;
    if (statusFilter === 'approved') list = list.filter((w) => w.is_approved);
    if (statusFilter === 'unapproved') list = list.filter((w) => !w.is_approved);
    if (machineFilter === 'assigned') list = list.filter((w) => (assignments[w.worker_id] || []).length > 0);
    if (machineFilter === 'unassigned') list = list.filter((w) => !(assignments[w.worker_id] || []).length);
    if (q) {
      list = list.filter((w) => {
        const machinesStr = (assignments[w.worker_id] || []).join(' ');
        const hay = [w.name, w.worker_id, w.phone_number, w.address, machinesStr]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'id') return String(a.worker_id).localeCompare(String(b.worker_id));
      if (sortBy === 'machines') {
        const da = (assignments[a.worker_id] || []).length;
        const db = (assignments[b.worker_id] || []).length;
        return db - da || String(a.name).localeCompare(String(b.name));
      }
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
    return list;
  }, [workers, query, statusFilter, machineFilter, sortBy, assignments]);

  const assign = async (workerId, machineId) => {
    if (!machineId) return;
    try {
      await api.assignMachine(workerId, machineId);
      setAssignments((a) => ({
        ...a,
        [workerId]: [...new Set([...(a[workerId] || []), machineId])],
      }));
      toast.success(`Assigned ${machineId}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign.');
    }
  };

  const unassign = async (workerId, machineId) => {
    try {
      await api.unassignMachine(workerId, machineId);
      setAssignments((a) => ({
        ...a,
        [workerId]: (a[workerId] || []).filter((m) => m !== machineId),
      }));
      toast.info(`Removed ${machineId}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not unassign.');
    }
  };

  const onWorkerSaved = (updated) => {
    setWorkers((list) =>
      list.map((w) => {
        if (w.worker_id === selectedId || w.worker_id === updated.worker_id) {
          return { ...w, ...updated };
        }
        return w;
      }),
    );
    // If ID was renamed, move assignments key and selection
    if (updated.worker_id && updated.worker_id !== selectedId) {
      setAssignments((a) => {
        const next = { ...a };
        next[updated.worker_id] = next[selectedId] || [];
        delete next[selectedId];
        return next;
      });
      setSelectedId(updated.worker_id);
    }
  };

  if (loading) return <FullPageLoader label="Loading workers…" />;

  return (
    <div className="max-w-6xl relative">
      <PageHeader
        eyebrow="People & machines"
        title="Workers & machines"
        description="Manage who is on the floor and which machines they can access. Open a worker for full profile and assignment controls."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Workers', value: stats.total, icon: Users, tone: 'signal' },
          { label: 'Approved', value: stats.approved, icon: UserCheck, tone: 'signal' },
          { label: 'Unapproved', value: stats.unapproved, icon: UserX, tone: 'amber' },
          { label: 'No machines', value: stats.unassigned, icon: Factory, tone: 'muted' },
          { label: 'Machines', value: stats.machines, icon: Factory, tone: 'signal' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border-2 border-line bg-surface p-4 flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                s.tone === 'amber'
                  ? 'bg-amber/15 border-amber/30 text-amber'
                  : s.tone === 'muted'
                    ? 'bg-surface-2 border-line text-muted'
                    : 'bg-signal/15 border-signal/30 text-signal'
              }`}
            >
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-black leading-none">{s.value}</p>
              <p className="text-[11px] text-muted mt-1 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row gap-3 mb-5">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, phone, machine…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-line bg-surface text-sm outline-none focus:border-amber placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-amber"
          >
            <option value="all">All status</option>
            <option value="approved">Approved</option>
            <option value="unapproved">Unapproved</option>
          </select>
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-amber"
          >
            <option value="all">All assignments</option>
            <option value="assigned">Has machines</option>
            <option value="unassigned">No machines</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium outline-none focus:border-amber"
          >
            <option value="name">Sort by name</option>
            <option value="id">Sort by ID</option>
            <option value="machines">Sort by machine count</option>
          </select>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={() => load(true)} className="h-11">
            Refresh
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Filter size={28} className="mx-auto text-muted mb-3" />
          <p className="font-display font-bold text-lg">No workers match</p>
          <p className="text-sm text-muted mt-1">Adjust search or filters.</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
              setMachineFilter('all');
            }}
          >
            Reset filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((w, i) => {
            const assigned = assignments[w.worker_id] || [];
            const phone = phoneLine(w);
            const active = selectedId === w.worker_id;
            return (
              <motion.div
                key={w.worker_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(w.worker_id)}
                  className={`w-full text-left rounded-2xl border-2 bg-surface p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    active
                      ? 'border-signal ring-2 ring-signal/20 shadow-md'
                      : 'border-line hover:border-signal/40'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-signal/20 to-amber/10 border-2 border-line flex items-center justify-center font-display font-bold text-signal text-sm shrink-0">
                      {initials(w.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <p className="font-display font-bold text-lg leading-tight truncate">{w.name}</p>
                        {w.is_approved ? (
                          <Badge tone="signal">Approved</Badge>
                        ) : (
                          <Badge tone="amber">Unapproved</Badge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted">{w.worker_id}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        {phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} /> {phone}
                          </span>
                        )}
                        {w.address && (
                          <span className="inline-flex items-center gap-1 max-w-[240px] truncate">
                            <MapPin size={12} /> {w.address}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {assigned.length === 0 ? (
                          <span className="text-xs text-muted italic">No machines assigned</span>
                        ) : (
                          assigned.map((m) => (
                            <span
                              key={m}
                              className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-signal/10 text-signal border border-signal/25"
                            >
                              {m}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-muted">{assigned.length} machine{assigned.length === 1 ? '' : 's'}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-signal">
                        Manage <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Right-side workspace drawer — replaces center modal */}
      <AnimatePresence>
        {selectedWorker && (
          <WorkerDrawer
            worker={selectedWorker}
            machines={machines}
            assigned={assignments[selectedWorker.worker_id] || []}
            onClose={() => setSelectedId(null)}
            onAssign={(mid) => assign(selectedWorker.worker_id, mid)}
            onUnassign={(mid) => unassign(selectedWorker.worker_id, mid)}
            onSaved={onWorkerSaved}
            onApproved={async () => {
              try {
                await api.approveWorker(selectedWorker.worker_id);
                setWorkers((list) =>
                  list.map((w) =>
                    w.worker_id === selectedWorker.worker_id ? { ...w, is_approved: true } : w,
                  ),
                );
                toast.success(`${selectedWorker.name} approved.`);
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : 'Could not approve.');
              }
            }}
            toast={toast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkerDrawer({
  worker,
  machines,
  assigned,
  onClose,
  onAssign,
  onUnassign,
  onSaved,
  onApproved,
  toast,
}) {
  const [tab, setTab] = useState('profile'); // profile | machines
  const [name, setName] = useState(worker.name || '');
  const [workerId, setWorkerId] = useState(worker.worker_id || '');
  const [country, setCountry] = useState(worker.phone_country_code || '+91');
  const [phone, setPhone] = useState(worker.phone_number || '');
  const [address, setAddress] = useState(worker.address || '');
  const [saving, setSaving] = useState(false);
  const [machineQuery, setMachineQuery] = useState('');
  const [busyMachine, setBusyMachine] = useState(null);

  // Sync when switching workers
  useEffect(() => {
    setName(worker.name || '');
    setWorkerId(worker.worker_id || '');
    setCountry(worker.phone_country_code || '+91');
    setPhone(worker.phone_number || '');
    setAddress(worker.address || '');
    setTab('profile');
    setMachineQuery('');
  }, [worker.worker_id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        phone_country_code: country.trim() || '+91',
        phone_number: phone.trim() || null,
        address: address.trim() || null,
      };
      if (workerId.trim() && workerId.trim() !== worker.worker_id) {
        body.new_worker_id = workerId.trim();
      }
      const res = await api.updateWorker(worker.worker_id, body);
      const updated = {
        worker_id: res.worker_id || body.new_worker_id || worker.worker_id,
        name: body.name,
        phone_country_code: body.phone_country_code,
        phone_number: body.phone_number || '',
        address: body.address || '',
        is_approved: worker.is_approved,
      };
      onSaved(updated);
      toast.success('Worker profile saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const filteredMachines = machines.filter((m) =>
    m.toLowerCase().includes(machineQuery.trim().toLowerCase()),
  );

  const toggleMachine = async (mid) => {
    setBusyMachine(mid);
    try {
      if (assigned.includes(mid)) await onUnassign(mid);
      else await onAssign(mid);
    } finally {
      setBusyMachine(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[180] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="fixed top-0 right-0 z-[190] h-full w-full max-w-md sm:max-w-lg bg-surface border-l-2 border-line shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Worker details"
      >
        {/* Header */}
        <div className="shrink-0 px-5 sm:px-6 pt-5 pb-4 border-b-2 border-line bg-surface-2/50">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-signal/25 to-amber/15 border-2 border-line flex items-center justify-center font-display font-bold text-signal text-lg shrink-0">
              {initials(worker.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-xl leading-tight truncate">{worker.name}</h2>
                {worker.is_approved ? (
                  <Badge tone="signal">Approved</Badge>
                ) : (
                  <Badge tone="amber">Unapproved</Badge>
                )}
              </div>
              <p className="font-mono text-xs text-muted mt-0.5">{worker.worker_id}</p>
              <p className="text-xs text-muted mt-1">
                {assigned.length} machine{assigned.length === 1 ? '' : 's'} assigned
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl border-2 border-line flex items-center justify-center text-muted hover:text-text hover:border-signal/40 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {!worker.is_approved && (
            <Button size="sm" icon={Check} className="w-full mt-4" onClick={onApproved}>
              Approve this worker
            </Button>
          )}

          {/* Tabs */}
          <div className="mt-4 flex p-1 rounded-xl bg-surface border-2 border-line">
            {[
              { id: 'profile', label: 'Profile', icon: Pencil },
              { id: 'machines', label: 'Machines', icon: Factory },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? 'bg-signal text-white shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {tab === 'profile' ? (
            <form id="worker-edit-form" onSubmit={save} className="space-y-4">
              <Field label="Worker ID" hint="Renaming updates linked records across the system.">
                <input
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="field-input"
                />
              </Field>
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <Field label="Code">
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className="field-input" />
                </Field>
                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="field-input"
                  />
                </Field>
              </div>
              <Field label="Address">
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                  className="field-input resize-none"
                />
              </Field>
              <style>{`
                .field-input {
                  width: 100%;
                  border-radius: 0.75rem;
                  border: 2px solid var(--color-line, #e7e0d6);
                  background: var(--color-surface-2, #f7f4ef);
                  padding: 0.65rem 0.85rem;
                  font-size: 0.875rem;
                  color: inherit;
                  outline: none;
                }
                .field-input:focus {
                  border-color: var(--color-amber, #d97706);
                }
              `}</style>
            </form>
          ) : (
            <div>
              <p className="text-sm text-muted mb-3 leading-relaxed">
                Toggle machines this worker can access on the floor. Changes apply immediately.
              </p>
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={machineQuery}
                  onChange={(e) => setMachineQuery(e.target.value)}
                  placeholder="Filter machines…"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-line bg-surface-2 text-sm outline-none focus:border-amber"
                />
              </div>

              {assigned.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
                    Currently assigned ({assigned.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assigned.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMachine(m)}
                        disabled={busyMachine === m}
                        className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-full bg-signal/15 text-signal border border-signal/30 hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
                        title="Click to unassign"
                      >
                        {m}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
                All machines
              </p>
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredMachines.length === 0 ? (
                  <p className="text-sm text-muted py-6 text-center">No machines found.</p>
                ) : (
                  filteredMachines.map((m) => {
                    const on = assigned.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMachine(m)}
                        disabled={busyMachine === m}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                          on
                            ? 'border-signal/40 bg-signal/10'
                            : 'border-line bg-surface-2 hover:border-signal/30'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                            on ? 'bg-signal border-signal text-white' : 'border-line bg-surface'
                          }`}
                        >
                          {on && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="font-mono text-sm font-medium flex-1">{m}</span>
                        {on && <span className="text-[10px] font-mono uppercase text-signal">On</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'profile' && (
          <div className="shrink-0 px-5 sm:px-6 py-4 border-t-2 border-line bg-surface-2/40 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              form="worker-edit-form"
              type="submit"
              icon={Save}
              loading={saving}
              className="flex-1"
            >
              Save changes
            </Button>
          </div>
        )}
      </motion.aside>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted mt-1.5 leading-snug">{hint}</span>}
    </label>
  );
}