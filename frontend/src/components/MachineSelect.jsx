import { Cog, ChevronDown } from 'lucide-react';

/**
 * Same component reused on Ask and Add Tip, so switching machines
 * behaves identically everywhere it appears (per design preview v3).
 *
 * `machines` should come from /worker/my-machines — the preview
 * hardcoded a demo list, but the real list is per-worker assignment.
 */
export default function MachineSelect({ value, onChange, machines = [] }) {
  return (
    <div className="sv-machine-select">
      <select
        className="sv-machine-select__control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {machines.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <Cog size={14} className="sv-machine-select__icon-left" />
      <ChevronDown size={14} className="sv-machine-select__icon-right" />
    </div>
  );
}
