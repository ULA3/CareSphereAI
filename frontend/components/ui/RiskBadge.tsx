import clsx from 'clsx';

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high';
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function RiskBadge({ level, score, size = 'md' }: RiskBadgeProps) {
  const styles = {
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-bold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
        styles[level],
        sizes[size]
      )}
    >
      <span className={clsx('w-2 h-2 rounded-full', {
        'bg-emerald-400': level === 'low',
        'bg-amber-400': level === 'medium',
        'bg-red-400': level === 'high',
      })} />
      {level} risk
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  );
}
