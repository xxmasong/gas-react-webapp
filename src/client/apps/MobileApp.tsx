import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  DashboardPage,
  AnalyticsPage,
  InventoryPage,
  CategoriesPage,
  UsersPage,
} from '../components/pages';
import { ROUTES } from '../routes';
import { RequireAuth, RequireRole } from '../routes/guards';

// Mobile route tree mirrors PrivateApp. Layout differences (bottom nav vs.
// top tabs) are handled by CSS in AppShell/Header — keeping a separate
// component preserves the option of a divergent mobile UX later without
// touching the desktop tree.
export const MobileApp: React.FC = () => (
  <Routes>
    <Route element={<RequireAuth />}>
      <Route path={ROUTES.dashboard} element={<DashboardPage />} />
      <Route path={ROUTES.analytics} element={<AnalyticsPage />} />
      <Route path={ROUTES.inventory} element={<InventoryPage />} />

      <Route element={<RequireRole role="supervisor" />}>
        <Route path={ROUTES.categories} element={<CategoriesPage />} />
      </Route>

      <Route element={<RequireRole role="admin" />}>
        <Route path={ROUTES.users} element={<UsersPage />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Route>
  </Routes>
);
