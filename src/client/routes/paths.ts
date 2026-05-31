import type { Role } from '@shared/types';

export const ROUTES = {
  login:      '/login',
  dashboard:  '/dashboard',
  analytics:  '/analytics',
  inventory:  '/inventory',
  categories: '/categories',
  users:      '/users',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

export type RouteMeta = {
  path: RoutePath;
  label: string;
  minRole?: Role;
};

export const NAV_ROUTES: RouteMeta[] = [
  { path: ROUTES.dashboard,  label: 'Dashboard' },
  { path: ROUTES.analytics,  label: 'Analytics' },
  { path: ROUTES.inventory,  label: 'Inventory' },
  { path: ROUTES.categories, label: 'Categories', minRole: 'supervisor' },
  { path: ROUTES.users,      label: 'Users',      minRole: 'admin' },
];
