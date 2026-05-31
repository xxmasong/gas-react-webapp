import React, { type ReactNode } from 'react';
import { Header } from '../organisms';

type Props = {
  children: ReactNode;
};

export const AppShell: React.FC<Props> = ({ children }) => (
  <div className="app">
    <Header />
    <main>{children}</main>
  </div>
);
