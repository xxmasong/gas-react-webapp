// Typed RPC bridge to the Apps Script backend.
//
// gas-client wraps google.script.run and returns promises. In production
// (running inside the GAS iframe) it calls the real server functions. During
// local `vite` dev there is no GAS host, so we fall back to an in-memory mock
// that mirrors the server behaviour — letting you build UI without deploying.

import { GASClient } from 'gas-client';
import type { Item, NewItem, ServerFunctions } from '@shared/types';

// True only when running inside the deployed GAS iframe.
const isGasHost = typeof google !== 'undefined' && typeof google?.script !== 'undefined';

function createMock(): ServerFunctions {
  let items: Item[] = [
    { id: 'demo-1', name: 'Sample widget', quantity: 3, updatedAt: new Date().toISOString() },
  ];
  const uuid = () => crypto.randomUUID();
  return {
    getItems: () => items,
    addItem: (item: NewItem) => {
      const created: Item = { id: uuid(), ...item, updatedAt: new Date().toISOString() };
      items = [...items, created];
      return created;
    },
    updateItem: (item: Item) => {
      const updated = { ...item, updatedAt: new Date().toISOString() };
      items = items.map((i) => (i.id === item.id ? updated : i));
      return updated;
    },
    deleteItem: (id: string) => {
      items = items.filter((i) => i.id !== id);
      return { id };
    },
  };
}

let real: ServerFunctions | null = null;
if (isGasHost) {
  real = new GASClient().serverFunctions as unknown as ServerFunctions;
}

const mock = isGasHost ? null : createMock();

// Every call is normalised to a Promise so the UI code is identical in both
// environments (the real gas-client functions already return promises).
function call<K extends keyof ServerFunctions>(
  name: K,
  ...args: Parameters<ServerFunctions[K]>
): Promise<ReturnType<ServerFunctions[K]>> {
  type Ret = Promise<ReturnType<ServerFunctions[K]>>;
  if (real) {
    const fn = real[name] as unknown as (...a: unknown[]) => Ret;
    return fn(...args);
  }
  const fn = mock![name] as unknown as (...a: unknown[]) => ReturnType<ServerFunctions[K]>;
  return Promise.resolve(fn(...args));
}

export const server = {
  getItems: () => call('getItems'),
  addItem: (item: NewItem) => call('addItem', item),
  updateItem: (item: Item) => call('updateItem', item),
  deleteItem: (id: string) => call('deleteItem', id),
};

export const runningInGas = isGasHost;
