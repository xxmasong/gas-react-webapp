import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Breakpoints: mobile < 640, tablet 640–1024, laptop ≥ 1024.
export type Breakpoint = 'mobile' | 'tablet' | 'laptop';

export function useBreakpoint(): Breakpoint {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'laptop';
}
