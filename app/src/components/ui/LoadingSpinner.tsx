// components/ui/LoadingSpinner.tsx
// Lightweight reusable spinner using Bootstrap's spinner-border,

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  fullPage = false,
}: LoadingSpinnerProps) {
  const dimension = size === 'sm' ? '1.25rem' : size === 'lg' ? '3rem' : '2rem';

  const spinner = (
    <div className="d-flex flex-column align-items-center gap-2">
      <div
        className="spinner-border"
        role="status"
        style={{ width: dimension, height: dimension }}
      >
        <span className="visually-hidden">{label}</span>
      </div>
      {size !== 'sm' && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {label}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return <div className="loading-overlay">{spinner}</div>;
  }

  return spinner;
      }
