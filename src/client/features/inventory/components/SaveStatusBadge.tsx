import type { SaveStatus } from '../hooks/useStockRow';

const LABEL: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'Saving…',
  saved: 'Saved ✓',
  error: 'Failed',
  mismatch: 'Out of sync',
};

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return <span className={`save-status save-status-${status}`}>{LABEL[status]}</span>;
}
