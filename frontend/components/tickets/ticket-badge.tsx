'use client';

import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils';

interface BadgeProps {
  value: string;
  className?: string;
}

export function StatusBadge({ value, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      STATUS_COLORS[value] || 'bg-gray-100 text-gray-800',
      className
    )}>
      {STATUS_LABELS[value] || value}
    </span>
  );
}

export function PriorityBadge({ value, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      PRIORITY_COLORS[value] || 'bg-gray-100 text-gray-800',
      className
    )}>
      {PRIORITY_LABELS[value] || value}
    </span>
  );
}
