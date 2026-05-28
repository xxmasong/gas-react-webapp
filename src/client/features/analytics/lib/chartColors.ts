import { useEffect, useState } from 'react';
import { useTheme } from '../../../providers';

// Resolve a CSS custom property to its computed value (charts need real colors,
// not var() strings). Re-reads when the theme changes.
function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export interface ChartTheme {
  text: string;
  muted: string;
  grid: string;
  surface: string;
  border: string;
  accent: string;
  danger: string;
  warn: string;
  success: string;
  palette: string[];
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [t, setT] = useState<ChartTheme>(() => build());

  useEffect(() => {
    // Defer a tick so the [data-theme] attribute is applied before reading.
    const id = window.setTimeout(() => setT(build()), 0);
    return () => window.clearTimeout(id);
  }, [theme]);

  return t;
}

function build(): ChartTheme {
  const accent = readVar('--color-accent', '#1f883d');
  const danger = readVar('--color-danger', '#cf222e');
  const warn = readVar('--color-warn-text', '#bc4c00');
  const success = readVar('--color-success', '#1a7f37');
  return {
    text: readVar('--color-text', '#1f2328'),
    muted: readVar('--color-text-muted', '#656d76'),
    grid: readVar('--color-border-soft', '#eaeef2'),
    surface: readVar('--color-surface', '#ffffff'),
    border: readVar('--color-border', '#d0d7de'),
    accent, danger, warn, success,
    // Categorical palette for pies/bars — distinct, theme-agnostic hues.
    palette: ['#1f883d', '#0969da', '#8250df', '#bf8700', '#cf222e', '#1a7f37',
              '#bc4c00', '#0550ae', '#a475f9', '#953800', '#116329', '#54aeff'],
  };
}
