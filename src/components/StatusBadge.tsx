import React from 'react';
import type { ReportStatus } from '../types';

interface StatusBadgeProps {
  status: ReportStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let styleClasses = 'bg-stone-200 text-stone-800 border-stone-300';

  switch (status) {
    case 'Draft':
      // Draft → Gray
      styleClasses = 'bg-stone-200 text-stone-800 border-stone-300';
      break;
    case 'In Progress':
      // In Progress → Amber
      styleClasses = 'bg-amber-100 text-amber-900 border-amber-300 font-medium';
      break;
    case 'Awaiting Review':
      // Awaiting Review → Blue (clearly distinct non-green)
      styleClasses = 'bg-blue-100 text-blue-900 border-blue-300 font-medium';
      break;
    case 'Completed':
      // Completed → Green
      styleClasses = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-medium';
      break;
    case 'Sent to Client':
      // Sent to Client → Green
      styleClasses = 'bg-green-100 text-green-900 border-green-300 font-medium';
      break;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : size === 'lg'
      ? 'px-4 py-1.5 text-sm'
      : 'px-3 py-1 text-xs sm:text-sm';

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md border font-semibold tracking-wide uppercase shadow-xs ${sizeClasses} ${styleClasses}`}
    >
      {status}
    </span>
  );
};
