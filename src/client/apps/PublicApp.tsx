import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../components/pages';
import { ROUTES } from '../routes';
import { RequireGuest } from '../routes/guards';

export const PublicApp: React.FC = () => (
  <Routes>
    <Route element={<RequireGuest />}>
      <Route path={ROUTES.login} element={<LoginPage />} />
    </Route>
    <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
  </Routes>
);
