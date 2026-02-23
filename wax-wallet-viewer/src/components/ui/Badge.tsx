import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'purple' | 'cyan' | 'green' | 'yellow' | 'red' | 'gray';
  className?: string;
}

const variants = {
  default: 'bg-white/10 text-white/80',
  purple: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  green: 'bg-green-500/20 text-green-300 border border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  red: 'bg-red-500/20 text-red-300 border border-red-500/30',
  gray: 'bg-white/5 text-white/50 border border-white/10',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
