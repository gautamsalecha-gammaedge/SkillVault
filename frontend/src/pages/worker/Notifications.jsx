import { BellOff } from 'lucide-react';

/**
 * Scope for notifications was explicitly left open in the handoff
 * brief ("only nav placeholders exist so far, not designed") and
 * there's no backend support. Real empty state rather than a fake list.
 */
export default function Notifications() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>Notifications</p>
      <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginBottom: 24 }}>
        Nothing here yet.
      </p>
      <div className="sv-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--sv-muted)' }}>
        <BellOff size={28} style={{ marginBottom: 12, opacity: 0.6 }} />
        <p style={{ fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
          Notifications haven't been scoped yet for SkillVault — what should trigger one
          (a tip approved, a tip rejected, a new manual) is still an open decision.
        </p>
      </div>
    </div>
  );
}
