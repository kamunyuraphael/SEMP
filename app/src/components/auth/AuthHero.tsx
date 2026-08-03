// components/auth/AuthHero.tsx
// Left-side hero panel for the split-screen auth layout (Login/Register).
// Borrows the *composition* of a stock "Welcome" sign-in template — a
// hero panel next to the form, with a tagline and soft decorative
// shapes in the background. The shapes are animated to give a sense of
// energy and motion, while the content is static and informative. The
// hero panel also includes a stats row at the bottom, which can be
// customized to show relevant metrics or information.

// components/auth/AuthHero.tsx
// Left-side hero panel for the split-screen auth layout (Login/Register).

type AuthHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function AuthHero({ eyebrow, title, subtitle }: AuthHeroProps) {
  return (
    <div className="auth-hero" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative background — Anchored safely at the bottom edge */}
      <svg
        aria-hidden="true"
        className="semp-bg-svg"
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <defs>
          <filter id="energy-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
            
        {/* Soft atmosphere lights tinted with your brand variables */}
        <circle cx="540" cy="700" r="140" fill="var(--accent-primary)" opacity="0.05" />
        <circle cx="80" cy="740" r="90" fill="var(--accent-amber)" opacity="0.04" />
            
        {/* House outline */}
        <g fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 230 570 L 375 460 L 520 570" />
          <path d="M 260 570 L 260 760 L 490 760 L 490 570" />
          <path d="M 345 760 L 345 655 L 405 655 L 405 760" />
          <rect x="295" y="600" width="50" height="50" rx="2" />
          <path d="M 295 625 L 345 625 M 320 600 L 320 650" />
          <path d="M 440 520 L 440 480 L 470 480 L 470 545" />
        </g>
            
        {/* Ambient Pulse Track (Background Glow linked to Amber Energy) */}
        <path
          d="M -20 660 L 150 660 L 200 600 L 240 710 L 280 570 L 330 660 L 620 660"
          fill="none"
          stroke="var(--accent-amber)"
          opacity="0.25"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#energy-glow)"
        />

        {/* Core Pulse Track */}
        <path
          d="M -20 660 L 150 660 L 200 600 L 240 710 L 280 570 L 330 660 L 620 660"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Live Moving Energy Particles (Uses your core system accent color) */}
        <path
          d="M -20 660 L 150 660 L 200 600 L 240 710 L 280 570 L 330 660 L 620 660"
          fill="none"
          stroke="var(--accent-amber)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animated-trace"
          filter="url(#energy-glow)"
        />

        {/* Active Pulsing Sensor Nodes */}
        <circle cx="375" cy="460" r="5" fill="var(--accent-amber)" className="pulsing-node" style={{ transformOrigin: '375px 460px' }} />
        <circle cx="240" cy="710" r="4" fill="var(--accent-primary)" className="pulsing-node node-delay-1" style={{ transformOrigin: '240px 710px' }} />
        <circle cx="490" cy="570" r="4" fill="var(--accent-amber)" className="pulsing-node node-delay-2" style={{ transformOrigin: '490px 570px' }} />
      </svg>
            
      {/* Content block: Sits safely on top */}
      <div className="auth-hero-content">
        <span className="auth-hero-eyebrow">
          {eyebrow}
        </span>
        <h1 className="auth-hero-title">{title}</h1>
        <p className="auth-hero-subtitle" style={{ marginBottom: '2.5rem' }}>{subtitle}</p>

        {/* Stats row directly under the subtitle block */}
        <div className="auth-hero-stat-row" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: '1.5rem' }}>
          <div>
            <div className="auth-hero-stat-value">6</div>
            <div className="auth-hero-stat-label">Categories tracked</div>
          </div>
          <div>
            <div className="auth-hero-stat-value">24/7</div>
            <div className="auth-hero-stat-label">Live monitoring</div>
          </div>
          <div>
            <div className="auth-hero-stat-value">EAT</div>
            <div className="auth-hero-stat-label">Nairobi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
