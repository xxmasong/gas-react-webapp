import React from 'react';
import { useAuth, useLayout } from './providers';
import { PublicApp, PrivateApp, MobileApp } from './apps';
import './styles.css';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const { isMobile } = useLayout();

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="reseed-spinner" />
      </div>
    );
  }

  if (!user) return <PublicApp />;
  return isMobile ? <MobileApp /> : <PrivateApp />;
};

export default App;
