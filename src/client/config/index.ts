import storesJson           from './stores.json';
import rolesJson             from './roles.json';
import inventoryColumnsJson  from './inventoryColumns.json';
import inventoryItemFields   from './inventoryItemFields.json';

import type { Role } from '@shared/types';

export type StoreOption = {
  value: string;
  label: string;
};

export type RoleOption = {
  value: Role;
  label: string;
  headerLabel: string;
};

export type ColumnConfig = {
  id: string;
  accessor?: string;
  header: string;
  label: string;
  size?: number;
  align?: 'right';
  hidden?: boolean;
  enableGrouping?: boolean;
  enableHiding?: boolean;
  enableSorting?: boolean;
};

export type ItemFieldConfig = {
  key: string;
  label: string;
};

export const STORES           = storesJson           as StoreOption[];
export const ROLES_CONFIG     = rolesJson            as RoleOption[];
export const COLUMN_CONFIGS   = inventoryColumnsJson as ColumnConfig[];
export const QTY_FIELDS       = inventoryItemFields.qtyFields    as ItemFieldConfig[];
export const EXPIRY_FIELDS    = inventoryItemFields.expiryFields as ItemFieldConfig[];
export const DEFAULT_STORE    = inventoryItemFields.defaultStore as string;

export const ROLE_LABEL: Record<Role, string> = Object.fromEntries(
  ROLES_CONFIG.map((r) => [r.value, r.label]),
) as Record<Role, string>;

export const ROLE_HEADER_LABEL: Record<string, string> = Object.fromEntries(
  ROLES_CONFIG.map((r) => [r.value, r.headerLabel]),
);

export const ROLE_VALUES = ROLES_CONFIG.map((r) => r.value) as Role[];
