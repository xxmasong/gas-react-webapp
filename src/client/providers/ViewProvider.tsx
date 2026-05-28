import { createContext, useContext, useState, type ReactNode } from 'react';

export type View = 'dashboard' | 'inventory' | 'categories' | 'users';

type ViewContextValue = {
  view: View;
  setView: (view: View) => void;
};

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('dashboard');
  return <ViewContext.Provider value={{ view, setView }}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
