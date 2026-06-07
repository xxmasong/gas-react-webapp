import React from 'react';
import type { SaveStatus } from '../../features/inventory/hooks/useStockRow';

const LABEL: Record<Exclude<SaveStatus, 'idle' | 'saving'>, string> = {
  saved:    'Saved ✓',
  error:    'Failed',
  mismatch: 'Out of sync',
};

type Props = {
  status: SaveStatus;
};

export const SaveStatusBadge: React.FC<Props> = ({ status }) => {
  // The in-progress ("saving") state is shown by the single global activity
  // indicator in the header — no per-row spinner here. Only show terminal
  // states (saved / error / mismatch).
  if (status === 'idle' || status === 'saving') return null;
  return <span className={`save-status save-status-${status}`}>{LABEL[status]}</span>;
};
