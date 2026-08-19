import { Check, Clock, X } from 'lucide-react';

const CONFIG = {
  approved: { icon: Check, iconProps: { size: 12, strokeWidth: 3 }, label: 'Approved' },
  pending: { icon: Clock, iconProps: { size: 12, strokeWidth: 2.5 }, label: 'Pending review' },
  rejected: { icon: X, iconProps: { size: 12, strokeWidth: 3 }, label: 'Rejected' },
};

/**
 * The signature "stamp" status badge — pending (dashed brass),
 * approved (solid teal), rejected (solid danger). Used consistently
 * for tip status everywhere it appears: Ask sources, My Tips, Admin
 * Review.
 */
export default function Stamp({ status }) {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`sv-stamp sv-stamp--${status}`}>
      <Icon {...cfg.iconProps} />
      {cfg.label}
    </span>
  );
}
