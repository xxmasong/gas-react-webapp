import React, { useMemo, type ReactNode } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';

export type ToastKind = 'error' | 'success' | 'info' | 'warning';

type Props = {
  children: ReactNode;
};

export const ToastProvider: React.FC<Props> = ({ children }) => (
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

export const useToast = () => {
  const { enqueueSnackbar } = useSnackbar();
  return useMemo(() => {
    const notify = (message: string, kind: ToastKind = 'info') =>
      enqueueSnackbar(message, { variant: kind });
    return {
      notify,
      error:   (m: string) => notify(m, 'error'),
      success: (m: string) => notify(m, 'success'),
      warning: (m: string) => notify(m, 'warning'),
      info:    (m: string) => notify(m, 'info'),
    };
  }, [enqueueSnackbar]);
};
