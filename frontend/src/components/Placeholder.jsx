export default function Placeholder({ title, note }) {
  return (
    <div style={{ padding: 32 }}>
      <p style={{ fontFamily: 'var(--sv-font-display)', fontWeight: 600, fontSize: 20, color: 'var(--sv-ink)' }}>
        {title}
      </p>
      {note && (
        <p style={{ fontSize: 13, color: 'var(--sv-muted)', marginTop: 6, maxWidth: 480 }}>{note}</p>
      )}
    </div>
  );
}
