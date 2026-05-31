import React from 'react';

type Props = {
  store: string;
};

export const StoreBadge: React.FC<Props> = ({ store }) => (
  <span className={`store-badge store-${store.toLowerCase()}`}>{store}</span>
);
