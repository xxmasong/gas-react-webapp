import React, { type ReactNode } from 'react';

type Variant = 'ok' | 'bad' | 'warn' | 'muted' | 'default';

const CLASS: Record<Variant, string> = {
  ok:      'kyte-badge ok',
  bad:     'kyte-badge bad',
  warn:    'kyte-badge',
  muted:   'muted',
  default: 'kyte-badge',
};

type Props = {
  variant?: Variant;
  children: ReactNode;
  title?: string;
  style?: React.CSSProperties;
};

export const Badge: React.FC<Props> = ({ variant = 'default', children, title, style }) => (
  <span className={CLASS[variant]} title={title} style={style}>
    {children}
  </span>
);
