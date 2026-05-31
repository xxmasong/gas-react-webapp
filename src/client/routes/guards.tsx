import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@shared/types';
import { useAuth } from '../providers';
import { ROUTES } from './paths';

export const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  return <Outlet />;
};

export const RequireGuest: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
};

type RequireRoleProps = { role: Role };

export const RequireRole: React.FC<RequireRoleProps> = ({ role }) => {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
};
