import React from 'react';
import type { Role, User } from '@shared/types';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  inventory_staff: 'Inventory staff',
};

const ROLES: Role[] = ['inventory_staff', 'supervisor', 'admin'];

type Props = {
  users: User[];
  selfId: string;
  onSetRole: (id: string, role: Role) => void;
  onSetActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
};

export const UserTable: React.FC<Props> = ({ users, selfId, onSetRole, onSetActive, onDelete }) => (
  <table className="grid">
    <thead>
      <tr>
        <th>Username</th>
        <th>Role</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {users.map((u) => {
        const isSelf = u.id === selfId;
        return (
          <tr key={u.id}>
            <td>{u.username}{isSelf && <span className="muted"> (you)</span>}</td>
            <td>
              <select
                value={u.role}
                disabled={isSelf}
                onChange={(e) => onSetRole(u.id, e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </td>
            <td>
              {u.active
                ? <span className="kyte-badge ok">Active</span>
                : <span className="kyte-badge bad">Disabled</span>}
            </td>
            <td className="actions">
              {!isSelf && (
                <>
                  <button onClick={() => onSetActive(u.id, !u.active)}>
                    {u.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    className="del"
                    onClick={() => {
                      if (confirm(`Delete account "${u.username}"? This cannot be undone.`)) {
                        onDelete(u.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
