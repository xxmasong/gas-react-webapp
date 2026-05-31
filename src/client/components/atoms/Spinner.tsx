import React from 'react';

type Props = {
  size?: number;
};

export const Spinner: React.FC<Props> = ({ size = 14 }) => (
  <span
    className="spinner"
    style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 7)) }}
    aria-hidden="true"
  />
);
