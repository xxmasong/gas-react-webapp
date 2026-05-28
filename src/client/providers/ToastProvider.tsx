import type { ReactNode } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';

export type ToastKind = 'error' | 'success' | 'info' | 'warning';

// Thin wrapper around notistack so the rest of the app keeps a stable
// useToast() API while notistack handles rendering, stacking, and dismissal.
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={5000}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      preventDuplicate
      dense
    >
      {children}
    </SnackbarProvider>
  );
}

export function useToast() {
  const { enqueueSnackbar } = useSnackbar();
  const notify = (message: string, kind: ToastKind = 'info') =>
    enqueueSnackbar(message, { variant: kind });
  return {
    notify,
    error: (m: string) => notify(m, 'error'),
    success: (m: string) => notify(m, 'success'),
    warning: (m: string) => notify(m, 'warning'),
    info: (m: string) => notify(m, 'info'),
  };
}
