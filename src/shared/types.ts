// Shared data contracts between the React client and the Apps Script server.
// Imported by the client for type-safe RPC, and mirrored by the server logic.

export interface Item {
  /** Stable row id (uuid). */
  id: string;
  name: string;
  quantity: number;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Payload to create a new item (id + updatedAt are assigned server-side). */
export type NewItem = Pick<Item, 'name' | 'quantity'>;

/** Shape of the server functions callable from the client via gas-client. */
export interface ServerFunctions {
  getItems(): Item[];
  addItem(item: NewItem): Item;
  updateItem(item: Item): Item;
  deleteItem(id: string): { id: string };
}
