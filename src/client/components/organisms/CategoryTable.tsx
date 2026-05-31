import React from 'react';
import type { SkuCategory } from '@shared/types';

type Props = {
  categories: SkuCategory[];
  onEdit: (cat: SkuCategory) => void;
  onDelete: (id: string) => void;
};

export const CategoryTable: React.FC<Props> = ({ categories, onEdit, onDelete }) => (
  <table className="grid">
    <thead>
      <tr>
        <th>Code</th>
        <th>Name</th>
        <th>Pack constraint</th>
        <th className="num">Order</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {categories.map((cat) => (
        <tr key={cat.id}>
          <td><code>{cat.code}</code></td>
          <td>{cat.name}</td>
          <td className="muted">{cat.packConstraint}</td>
          <td className="num">{cat.sortOrder}</td>
          <td className="actions">
            <button onClick={() => onEdit(cat)}>Edit</button>
            <button className="del" onClick={() => onDelete(cat.id)}>Delete</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
