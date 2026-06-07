import React from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { Spinner } from '../atoms';

// Global "talking to Sheets" indicator. Shows whenever any query (read) or
// mutation (write) is in flight, so the user knows the backend is busy before
// any toast appears. Mutations take priority in the label since a write in
// progress is the more important thing to surface.
export const ActivityIndicator: React.FC = () => {
  const fetching = useIsFetching();
  const mutating = useIsMutating();

  if (!fetching && !mutating) return null;

  const label = mutating ? 'Saving…' : 'Loading…';

  return (
    <span className="activity-indicator" role="status" aria-live="polite" title={label}>
      <Spinner size={13} />
      <span className="activity-label">{label}</span>
    </span>
  );
};
