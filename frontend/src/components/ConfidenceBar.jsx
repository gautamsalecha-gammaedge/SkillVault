/**
 * NOTE: /ask does not return a confidence value yet (see api.js
 * comment) — this component is ready for that field once the
 * backend contract is designed, but has no live data source today.
 */
export default function ConfidenceBar({ value }) {
  const color =
    value >= 80 ? 'var(--sv-teal)' : value >= 55 ? 'var(--sv-brass)' : 'var(--sv-danger)';
  return (
    <div className="sv-confidence">
      <div className="sv-confidence__track">
        <div className="sv-confidence__fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="sv-confidence__value" style={{ color }}>{value}%</span>
    </div>
  );
}
