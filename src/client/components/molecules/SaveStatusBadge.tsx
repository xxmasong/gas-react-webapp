import React from 'react';
import type { SaveStatus } from '../../features/inventory/hooks/useStockRow';
import { Spinner } from '../atoms';

const LABEL: Record<Exclude<SaveStatus, 'idle' | 'saving'>, string> = {
  saved:    'Saved ✓',
  error:    'Failed',
  mismatch: 'Out of sync',
};

type Props = {
  status: SaveStatus;
};

export const SaveStatusBadge: React.FC<Props> = ({ status }) => {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return <span className="save-status save-status-saving"><Spinner size={11} /></span>;
  }
  return <span className={`save-status save-status-${status}`}>{LABEL[status]}</span>;
};
