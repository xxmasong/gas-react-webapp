import React, { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'ghost' | 'danger' | 'default';

const CLASS: Record<Variant, string> = {
  primary: 'primary',
  ghost:   'ghost',
  danger:  'del',
  default: '',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
};

export const Button: React.FC<Props> = ({
  variant = 'default',
  loading = false,
  children,
  disabled,
  className = '',
  ...rest
}) => (
  <button
    className={`${CLASS[variant]} ${className}`.trim() || undefined}
    disabled={disabled ?? loading}
    {...rest}
  >
    {loading && <Spinner size={14} />}
    {children}
  </button>
);
