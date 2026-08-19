import { useState, useEffect } from 'react';
import { Api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import MachineSelect from '../../components/MachineSelect';
import { Ticket } from 'lucide-react';

export default function RaiseTicket() {
  const { push } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [machineId, setMachineId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [machines, setMachines] = useState([]);

  // Load worker's machines
// Load worker's machines
    useEffect(() => {
        Api.myMachines()
            .then((data) => {
            console.log('Machines from API:', data);   // ← this line
            setMachines(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
            console.error('Failed to load machines:', err);
            setMachines([]);
            });
        }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      push('Please fill title and description', 'error');
      return;
    }

    setLoading(true);
    try {
      await Api.createTicket({
        title: title.trim(),
        description: description.trim(),
        machine_id: machineId || null,
        priority,
      });
      push('Ticket submitted successfully', 'success');
      setTitle('');
      setDescription('');
      setMachineId('');
      setPriority('Medium');
    } catch (err) {
      push(err.message || 'Failed to submit ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--sv-primary-soft, #e0f2fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Ticket size={22} color="var(--sv-primary, #0284c7)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Raise a Ticket</h1>
            <p style={{ margin: 0, color: 'var(--sv-muted)', fontSize: 14 }}>
              Report a problem or request help
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            What is the issue?
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Machine making unusual noise"
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--sv-border, #e2e8f0)',
              fontSize: 15,
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Describe the problem
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain what happened, when it started, and any other details..."
            rows={5}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--sv-border, #e2e8f0)',
              fontSize: 15,
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Which machine? <span style={{ fontWeight: 400, color: 'var(--sv-muted)' }}>(optional)</span>
          </label>
          <MachineSelect
            value={machineId}
            onChange={setMachineId}
            machines={machines}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
            How urgent is it?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['Low', 'Medium', 'High'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: priority === p ? '2px solid' : '1px solid var(--sv-border, #e2e8f0)',
                  borderColor: priority === p
                    ? p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#22c55e'
                    : undefined,
                  background: priority === p
                    ? p === 'High' ? '#fef2f2' : p === 'Medium' ? '#fffbeb' : '#f0fdf4'
                    : 'transparent',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  color: priority === p
                    ? p === 'High' ? '#b91c1c' : p === 'Medium' ? '#b45309' : '#15803d'
                    : 'var(--sv-text)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn primary"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 12,
          }}
        >
          {loading ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
}