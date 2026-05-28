import { createContext, useContext, type ReactNode } from 'react';
import { useBreakpoint, type Breakpoint } from '../hooks/useMediaQuery';

type LayoutContextValue = {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint();
  const value: LayoutContextValue = {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isLaptop: breakpoint === 'laptop',
  };
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
