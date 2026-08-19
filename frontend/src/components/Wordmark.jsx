export default function Wordmark({ size = 22 }) {
  const badgeSize = size + 12;
  return (
    <div className="sv-wordmark">
      <div
        className="sv-wordmark__badge"
        style={{ width: badgeSize, height: badgeSize }}
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"
            stroke="var(--sv-brass)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="var(--sv-brass)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="sv-wordmark__text" style={{ fontSize: size }}>
        SkillVault
      </span>
    </div>
  );
}
