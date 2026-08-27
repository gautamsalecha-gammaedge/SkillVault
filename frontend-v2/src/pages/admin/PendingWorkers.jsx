import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck, Check, X, Search, Phone, MapPin, Users,
  CheckCheck, Trash2, RefreshCw, Filter, AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { PageHeader, FullPageLoader, EmptyState, Card, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { markPendingWorkersSeen } from '../../components/AdminLayout';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function phoneDisplay(w) {
  const num = (w.phone_number || '').trim();
  if (!num) return null;
  const cc = (w.phone_country_code || '+91').trim();
  return `${cc} ${num}`;
}

export default function PendingWorkers() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [confirmReject, setConfirmReject] = useState(null); // worker | 'bulk'
  const [sortBy, setSortBy] = useState('name'); // name | id

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await api.pendingWorkers();
      const list = r.pending_workers || [];
      setWorkers(list);
      setSelected(new Set());
      // Visiting this page clears the sidebar alert for the current queue
      markPendingWorkersSeen(list.map((w) => w.worker_id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load pending workers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = workers;
    if (q) {
      list = list.filter((w) => {
        const hay = [
          w.name,
          w.worker_id,
          w.phone_number,
          w.address,
          w.phone_country_code,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'id') return String(a.worker_id).localeCompare(String(b.worker_id));
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
    return list;
  }, [workers, query, sortBy]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((w) => selected.has(w.worker_id));

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((w) => next.delete(w.worker_id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((w) => next.add(w.worker_id));
        return next;
      });
    }
  };

  const approve = async (id, name) => {
    setBusyId(id);
    try {
      await api.approveWorker(id);
      setWorkers((w) => w.filter((x) => x.worker_id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success(`${name || id} approved — they can sign in now.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not approve.');
    } finally {
      setBusyId(null);
    }
  };

  const rejectOne = async (id, name) => {
    setBusyId(id);
    try {
      await api.rejectWorker(id);
      setWorkers((w) => w.filter((x) => x.worker_id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.info(`${name || id} rejected and removed.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reject.');
    } finally {
      setBusyId(null);
      setConfirmReject(null);
    }
  };

  const bulkApprove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await api.approveWorker(id);
        ok += 1;
      } catch {
        /* continue others */
      }
    }
    setWorkers((w) => w.filter((x) => !ids.includes(x.worker_id) || !selected.has(x.worker_id)));
    // reload to stay accurate
    await load(true);
    toast.success(ok === ids.length ? `${ok} workers approved.` : `${ok} of ${ids.length} approved.`);
    setBulkBusy(false);
  };

  const bulkReject = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await api.rejectWorker(id);
        ok += 1;
      } catch {
        /* continue */
      }
    }
    await load(true);
    toast.info(ok === ids.length ? `${ok} registrations removed.` : `${ok} of ${ids.length} removed.`);
    setBulkBusy(false);
    setConfirmReject(null);
  };

  if (loading) return <FullPageLoader label="Loading approvals…" />;

  return (
    <div className="max-w-6xl">
      <PageHeader
        eyebrow="Approvals"
        title="Pending workers"
        description="Review new registrations before they get floor access. Approve to unlock login, or reject to remove the account."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border-2 border-line bg-surface p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber/15 border border-amber/30 flex items-center justify-center text-amber shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="font-display text-2xl font-black text-text leading-none">{workers.length}</p>
            <p className="text-xs text-muted mt-1">Waiting for review</p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-line bg-surface p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-signal/15 border border-signal/30 flex items-center justify-center text-signal shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="font-display text-2xl font-black text-text leading-none">{selected.size}</p>
            <p className="text-xs text-muted mt-1">Selected</p>
          </div>
        </div>
        <div className="hidden sm:flex rounded-2xl border-2 border-line bg-surface p-4 items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-muted shrink-0">
            <Filter size={20} />
          </div>
          <div>
            <p className="font-display text-2xl font-black text-text leading-none">{filtered.length}</p>
            <p className="text-xs text-muted mt-1">Showing</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, phone, or address…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-line bg-surface text-sm text-text outline-none focus:border-amber placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-11 px-3 rounded-xl border-2 border-line bg-surface text-sm font-medium text-text outline-none focus:border-amber"
          >
            <option value="name">Sort by name</option>
            <option value="id">Sort by ID</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            icon={RefreshCw}
            onClick={() => load(true)}
            loading={refreshing}
            className="h-11"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      {workers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-2xl border-2 border-line bg-surface-2/80">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-text cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-line accent-[var(--color-signal)]"
            />
            Select {filtered.length === workers.length ? 'all' : 'visible'}
          </label>
          <div className="flex-1" />
          <Button
            size="sm"
            icon={CheckCheck}
            disabled={!selected.size || bulkBusy}
            loading={bulkBusy}
            onClick={bulkApprove}
          >
            Approve selected ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            disabled={!selected.size || bulkBusy}
            onClick={() => setConfirmReject('bulk')}
          >
            Reject selected
          </Button>
        </div>
      )}

      {workers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Nothing pending"
          description="Every registered worker has been reviewed. New sign-ups will appear here."
        />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-display font-bold text-lg mb-1">No matches</p>
          <p className="text-sm text-muted">Try a different search for “{query}”.</p>
          <Button size="sm" variant="ghost" className="mt-4" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((w) => {
              const phone = phoneDisplay(w);
              const isBusy = busyId === w.worker_id || bulkBusy;
              const isSel = selected.has(w.worker_id);
              return (
                <motion.div
                  key={w.worker_id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                >
                  <Card
                    className={`p-5 h-full flex flex-col transition-all ${
                      isSel ? 'ring-2 ring-[var(--color-signal)] border-[var(--color-signal)]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <label className="mt-1 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(w.worker_id)}
                          className="w-4 h-4 rounded border-line accent-[var(--color-signal)]"
                        />
                      </label>
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-signal/20 to-amber/15 border-2 border-line flex items-center justify-center font-display font-bold text-signal text-sm shrink-0">
                        {initials(w.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-lg leading-tight truncate">{w.name}</p>
                        <p className="font-mono text-xs text-muted mt-0.5">{w.worker_id}</p>
                        <span className="inline-flex mt-2 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/25">
                          Pending approval
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-5 flex-1">
                      {phone ? (
                        <div className="flex items-start gap-2 text-sm text-text/90">
                          <Phone size={14} className="text-muted mt-0.5 shrink-0" />
                          <span>{phone}</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm text-muted">
                          <Phone size={14} className="mt-0.5 shrink-0 opacity-50" />
                          <span>No phone provided</span>
                        </div>
                      )}
                      {w.address ? (
                        <div className="flex items-start gap-2 text-sm text-text/90">
                          <MapPin size={14} className="text-muted mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{w.address}</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm text-muted">
                          <MapPin size={14} className="mt-0.5 shrink-0 opacity-50" />
                          <span>No address provided</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-line">
                      <Button
                        size="sm"
                        icon={Check}
                        onClick={() => approve(w.worker_id, w.name)}
                        loading={busyId === w.worker_id}
                        disabled={isBusy}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={X}
                        disabled={isBusy}
                        onClick={() => setConfirmReject(w)}
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Confirm reject modal */}
      <AnimatePresence>
        {confirmReject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !bulkBusy && !busyId && setConfirmReject(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border-2 border-line bg-surface p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">
                    {confirmReject === 'bulk'
                      ? `Reject ${selected.size} registration${selected.size === 1 ? '' : 's'}?`
                      : `Reject ${confirmReject.name}?`}
                  </h3>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    {confirmReject === 'bulk'
                      ? 'These accounts will be permanently deleted. They will need to register again to re-apply.'
                      : (
                        <>
                          This removes <span className="font-mono text-text">{confirmReject.worker_id}</span> permanently.
                          They will need to register again to re-apply.
                        </>
                      )}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busyId || bulkBusy}
                  onClick={() => setConfirmReject(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={Trash2}
                  loading={!!busyId || bulkBusy}
                  onClick={() => {
                    if (confirmReject === 'bulk') bulkReject();
                    else rejectOne(confirmReject.worker_id, confirmReject.name);
                  }}
                >
                  Reject
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}