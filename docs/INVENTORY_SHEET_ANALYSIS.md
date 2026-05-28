# Product Info Google Sheet → GAS Web App: Full Analysis & Implementation Plan

**Document scope:** Analysis of the `Product Info` Google Sheets workbook (gid=1625801440),
data model extraction, gap analysis against the current GAS app, and the development plan to
migrate the spreadsheet into the React + GAS architecture.

> **History:** This app was first built against an older `Inventory` sheet (gid=1945163577) with
> interleaved category-header rows. The source was replaced by a cleaner, fully tabular
> `Product Info` sheet that adds a **STORE** dimension (EASY / GRUTON). This document and the
> backend/migration were updated to the new sheet on **2026-05-28**.

---

## Implementation Status (updated 2026-05-28)

Backend + UI are **implemented**; the migration was rewritten for the new tabular `Product Info`
layout and a `store` field was threaded through the whole stack (types → mapper → repo → service
→ validator → migration → mock → UI).

| Sprint | Status | Notes |
|---|---|---|
| 1 — Backend foundation | ✅ Done | types, mappers, repositories, services, validators, api.js, mock all in place |
| 2 — Data migration | ✅ Rewritten | `src/server/migration/seedFromInventorySheet.js` now parses the tabular `Product Info` sheet; categories are derived from the data, not hardcoded |
| 3 — Categories UI | ✅ Done | `features/categories/` (CategoriesView + useCategories) |
| 4 — Inventory table UI | ✅ Done | `features/inventory/` grouped table, inline stock editing, cost/Kyte display, store badge + store filter, add/edit modal |
| 5 — Dashboard | ✅ Done | `features/dashboard/` summary cards + category breakdown |
| Mismatch view | ⏳ Folded into inventory | "Mismatches only" filter on the inventory table covers this; standalone view deferred |
| 6 — Hardening + deploy | ⏳ Pending | needs live migration run (`dryRunInventorySeed` → `seedInventoryFromSheet`) + manual smoke test |

**Not yet verified:** behavior inside the live GAS iframe (mock backend exercised locally only),
and the migration against the real `Product Info` workbook. Run `dryRunInventorySeed` from the
editor first — it logs the derived categories + per-store SKU counts without writing anything.

---

## 1. Spreadsheet Structure Analysis

### 1.1 Sheet Identified

Single sheet (`gid=1625801440`, tab "Product Info") functions as a **multi-store product +
inventory catalog** for a beverage / ingredient supply business. Unlike the old ledger, **every
row is a SKU** — there are no interleaved category-header or subtotal rows. Two stores are
tracked: **EASY** (milk-tea supply lines) and **GRUTON** (groceries / frozen / packaging).

### 1.2 Column Schema (left → right)

| # | Column Header | Type | Maps to | Notes |
|---|---|---|---|---|
| 1 | STORE | string | `store` | `EASY` or `GRUTON` |
| 2 | CATEGORY | string | category `name` | e.g. "SYRUPS", "MILK", "FROZEN GOODS" |
| 3 | GROUP | string | category `code` (derived) | e.g. "Easy r1f", "hg ba", "sparkle" |
| 4 | PRODUCT | string | `sku` | Display name, usually emoji-prefixed |
| 5 | STOCKEEPING | string | category `packConstraint` | e.g. "Syrup 2.5kg - 6pc max" |
| 6 | UOM | number | `uom` | Units per box (1, 6, 10, 12, 18, 20, 30, 50, 70, 100…) |
| 7 | COST PER BOX (New) | number | `costPerBoxNew` | Supplier box cost |
| 8 | COST PER PIECE (New) | number | `costPerPieceNew` | Current unit cost |
| 9 | COST PER PIECE (Old) | number | `costPerPieceOld` | Previous unit cost |
| 10 | SELLING PRICE (WholeSale) | number | `sellingPriceWholesale` | EASY only; blank for GRUTON |
| 11 | SELLING PRICE (Dealer) | number | `sellingPriceDealer` | EASY only; blank for GRUTON |
| 12 | SELLING PRICE (SRP) | number | `srp` + `sellingPricePiece` | Retail price |
| 13 | QTY GROUND (Pieces) | number | `qtyGround` | On ground floor |
| 14 | EXPIRY (Ground) | date/blank | `expiryGround` | Often blank |
| 15 | QTY UPSTAIRS (Pieces) | number | `qtyUpstair` | Upstairs |
| 16 | EXPIRY (Upstairs) | date/blank | `expiryUpstair` | |
| 17 | QTY BOXES | number | `qtyBox` | Full boxes |
| 18 | EXPIRY (Boxes) | date/blank | `expiryBox` | |
| 19 | TOTAL COST | number | (recomputed) | `Σ / Store` in the sheet |
| 20 | TOTAL QTY | number | (recomputed `qtyTotal`) | All locations combined |
| 21 | POS COUNT | number | `qtyKyte` | Quantity from the POS (was "Kyte QTY") |
| 22 | DISCREPANCY | computed | (recomputed `kyteMatch`) | `-` when matched |

### 1.3 Row Types

**Every data row is a SKU.** There are no category-header rows and no grand-total row — category
grouping is expressed by the per-row `CATEGORY` + `GROUP` columns. This makes parsing far simpler
than the old sheet (no style/pipe-marker detection needed).

### 1.4 Categories present in the data

Categories are **derived at migration time** from the distinct `(CATEGORY, GROUP)` pairs, so the
list below is descriptive, not a hardcoded contract. Codes are derived from `GROUP` by dropping
the store-prefix word (`Easy` / `hg`) and joining the rest (`hg ba` → `hgba`, `Easy r1f` → `r1f`).

- **EASY:** SYRUPS (r1f), DRIZZLE (r1d), POWDER BASE (r2pb), SOFT SERVE BASE (r2ss), ESSENTIAL (r3e),
  TOPPINGS (r3et), SINKERS (r3ets), SYRUP PUMP (r3p), SIG. SYRUP (sy), SIG. SAUCES (sa),
  SIG. POWDER BASE (sp), CHEESE SAUCE DIP (pcd), FRIES POWDER 100g (pfd100), FRIES POWDER 250g (pfd250),
  POWDER MIX (ppm), PREMIUM SAUCES (pps), SPARKLE & SHIMMER (sparkle)
- **GRUTON:** ANCHOR (hgba), BERYLS (hgbb), SPECULOOS (hgbs), MILK (hgcm), COFFEE BEANS (hgccb),
  CONES (hgcc), DAIRY (hgcd), FROZEN GOODS (hgcf), TOPPERS and SINKERS (hgct), PAPER PRODUCTS (hgdpa),
  STRAW (hgdsw), PLASTIC CUPS & LIDS (hgdpcl), ORGANIZERS (hgdpo), Micro (hgdpl), STYRO PRODUCTS (hgdso),
  SUPPLIES (hges), JAM (hgoj), OTHERS (hgo), TORANI (hgto), ARMANDO (hgar), SACHET (sachet),
  BELCRIS (hgbc), INGREDIENTS (hgdcc), ASIAN W (asianw)

> **Parsing note — FRIES POWDER:** both the 100g and 250g categories share `GROUP = "Easy pfd"`.
> The migration appends the pack size parsed from the CATEGORY name so they become distinct
> `pfd100` / `pfd250` codes. **ASIAN W** rows have a blank GROUP, so the code is slugged from the
> category name instead.

---

## 2. Category & SKU Inventory (Complete Extracted Data Model)

### Category Codes (from sheet section headers)

| Code | Category Name | Σ Cost | Σ QTY |
|---|---|---|---|
| `r1f` | Syrups (R1f) | ₱198,902.00 | 675 |
| `r1d` | DRIZZLE 2.5kgx6 | — | — |
| `r2pb` | POWDER BASE | ₱137,776.90 | 523 |
| `r2ss` | SOFT SERVE BASE | ₱122,175.70 | 570 |
| `r3e` | ESSENTIAL | — | — |
| `r3et` | TOPPINGS | ₱17,360.00 | 124 |
| `r3ets` | SINKERS | — | — |
| `r3p` | SYRUP PUMP | ₱15,645.60 | 90 |
| `sy` | SIG. SYRUP (Sig. Syrup 1kg-8pc max) | — | — |
| `sa` | SIG. SAUCES (Sauce-6pc max) | ₱28,776.00 | 79 |
| `sp` | SIG. POWDER BASE | ₱37,066.50 | 138 |
| `pcd` | CHEESE SAUCE DIP | ₱14,400.00 | 100 |
| `pfd` | FRIES POWDER 100g | — | — |
| `pfd` | FRIES POWDER 250g | ₱20,501.87 | 241 |
| `ppm` | POWDER MIX | ₱66,970.90 | 244 |
| `pps` | PREMIUM SAUCES (Sauce-6pc max) | ₱108,308.00 | 426 |
| `sparkle` | SPARKLE & SHIMMER | ₱0.00 | 0 |
| `hgba` | ANCHOR | ₱185,698.20 | 35 |
| `hgbb` | BERYLS | ₱6,167.60 | 29 |
| `hgbs` | SPECULOOS | ₱76,321.40 | 63 |
| `hgcm` | Cost MILK | ₱159,872.00 | 210 |
| `hgccb` | COFFEE BEANS | ₱35,400.00 | 46 |
| `hgcc` | CONES | ₱20,769.40 | 9 |
| `hgcd` | DAIRY | ₱93,548.87 | 63 |
| `hgcf` | FROZEN GOODS | ₱172,188.93 | 246 |
| `hgct` | TOPPERS and SINKERS | ₱9,444.56 | 25 |
| `hgdpa` | PAPER PRODUCTS | ₱9,450.00 | 7 |
| `hgdsw` | STRAW | ₱13,100.00 | 289 |
| `hgdpcl` | PLASTIC CUPS & LIDS | ₱35,444.40 | 366 |
| `hgdpo` | ORGANIZERS | ₱12,094.00 | 30 |
| `hgdpl` | Micro | ₱8,136.00 | 6 |
| `hgdso` | STYRO PRODUCTS | ₱5,095.00 | 16 |
| `hges` | SUPPLIES | ₱81,559.00 | 299 |
| `hgoj` | JAM | ₱4,540.00 | 17 |
| `hgo` | OTHERS | ₱7,111.00 | 27 |
| `hgto` | Torani | ₱18,711.00 | 20 |

**Grand Total: ₱767,883.47 across 3,210 units**

### SKU Count by Category (estimated from PDF)

| Category | SKU Count |
|---|---|
| Syrups (r1f) | 22 |
| Drizzle | 2 |
| Powder Base | 9 |
| Soft Serve Base | 2 |
| Essential | ~8 |
| Toppings | 3 |
| Sinkers | 4 |
| Syrup Pump | 2 |
| Sig. Syrup | ~8 |
| Sig. Sauces | 4 |
| Sig. Powder Base | 4 |
| Cheese Sauce Dip | 1 |
| Fries Powder 250g | 3 |
| Powder Mix | ~7 |
| Premium Sauces | 9 |
| Sparkle & Shimmer | 13 |
| Anchor | ~15 |
| Beryls | ~10 |
| Speculoos | ~8 |
| Milk | ~25 |
| Coffee Beans | ~8 |
| Cones + Dairy + Frozen + Toppers + Paper | ~60 |
| Straws + Cups + Lids + Organizers | ~80 |
| Supplies + Jam + Others + Torani | ~60 |
| **Total** | **~350+ SKUs** |

---

## 3. Data Model Design

### 3.1 Entities Required

Based on the spreadsheet, we need **5 core entities** and **2 computed/view entities**:

```
SkuCategory        — groups SKUs (code, name, packConstraint)
       │
       └── InventoryItem  — one SKU row (all cost + pricing fields)
                │
                └── StockLocation  — per-location qty + expiry
                        (Ground, Upstair, Box)
```

Plus supporting:
- `PriceHistory` — tracks old vs new cost per piece over time
- `KyteSyncRecord` — Kyte POS QTY snapshot for mismatch detection

### 3.2 TypeScript Type Definitions (target `src/shared/types.ts`)

```typescript
// ─── Category ────────────────────────────────────────────────────────────────

export interface SkuCategory {
  id: string;                  // UUID
  code: string;                // e.g. "r1f", "hgcm"
  name: string;                // e.g. "Syrups (R1f)"
  packConstraint?: string;     // e.g. "Syrup 2.5kg - 6pc max"
  sortOrder: number;           // display order
  updatedAt: string;
}

export type NewSkuCategory = Omit<SkuCategory, 'id' | 'updatedAt'>;

// ─── Inventory Item (SKU) ─────────────────────────────────────────────────────

export type Store = 'EASY' | 'GRUTON';

export interface InventoryItem {
  id: string;                   // UUID
  categoryId: string;           // FK → SkuCategory.id
  store: Store;                 // EASY or GRUTON (from the STORE column)
  sku: string;                  // display name, e.g. "🫐 Blueberry"
  emoji?: string;               // extracted emoji prefix
  uom: number;                  // units per box (pack size)

  // Costs
  costPerBoxNew?: number;
  costPerPieceNew?: number;
  costPerPieceOld?: number;

  // Selling prices
  sellingPriceWholesale?: number;
  sellingPriceDealer?: number;
  sellingPricePiece?: number;
  srp?: number;

  // Stock locations (pieces)
  qtyGround: number;
  expiryGround?: number;
  qtyUpstair: number;
  expiryUpstair?: number;
  qtyBox: number;
  expiryBox?: number;

  // Computed / synced
  qtyTotal: number;             // sum of all locations (in pieces)
  qtyKyte?: number;             // from Kyte POS
  kyteMatch: boolean;           // true when qtyTotal === qtyKyte

  // Σ values (denormalized for performance)
  costTotal: number;            // Σ / Store

  updatedAt: string;
}

export type NewInventoryItem = Omit<InventoryItem, 'id' | 'updatedAt' | 'qtyTotal' | 'kyteMatch' | 'costTotal'>;

// ─── Server Functions ─────────────────────────────────────────────────────────

export interface ServerFunctions {
  // Existing (kept)
  getItems(): Item[];
  addItem(item: NewItem): Item;
  updateItem(item: Item): Item;
  deleteItem(id: string): { id: string };

  // New — Categories
  getCategories(): SkuCategory[];
  addCategory(cat: NewSkuCategory): SkuCategory;
  updateCategory(cat: SkuCategory): SkuCategory;
  deleteCategory(id: string): { id: string };

  // New — Inventory Items
  getInventoryItems(categoryId?: string): InventoryItem[];
  addInventoryItem(item: NewInventoryItem): InventoryItem;
  updateInventoryItem(item: InventoryItem): InventoryItem;
  deleteInventoryItem(id: string): { id: string };
  bulkUpdateStock(updates: Array<{ id: string; qtyGround: number; qtyUpstair: number; qtyBox: number }>): InventoryItem[];

  // New — Summary / Reporting
  getInventorySummary(): InventorySummary;
  getCategoryTotals(): CategoryTotal[];
}

// ─── View / Computed ──────────────────────────────────────────────────────────

export interface InventorySummary {
  totalCost: number;
  totalQty: number;
  categoryCount: number;
  skuCount: number;
  mismatchCount: number;      // items where kyteMatch === false
  zeroStockCount: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  totalCost: number;
  totalQty: number;
  skuCount: number;
}
```

### 3.3 Google Sheets Schema (one tab per entity)

#### Tab: `SkuCategories`

| Column | Type | Notes |
|---|---|---|
| `id` | string | UUID PK |
| `code` | string | short code (r1f, hgcm…) |
| `name` | string | display name |
| `packConstraint` | string | e.g. "Syrup 2.5kg - 6pc max" |
| `sortOrder` | number | integer, determines row order in UI |
| `updatedAt` | string | ISO 8601 |

#### Tab: `InventoryItems`

| Column | Type | Notes |
|---|---|---|
| `id` | string | UUID PK |
| `categoryId` | string | FK → SkuCategories.id |
| `store` | string | `EASY` or `GRUTON` |
| `sku` | string | full display name (with emoji) |
| `emoji` | string | optional emoji prefix |
| `uom` | number | units per box |
| `costPerBoxNew` | number | |
| `costPerPieceNew` | number | |
| `costPerPieceOld` | number | |
| `sellingPriceWholesale` | number | |
| `sellingPriceDealer` | number | |
| `sellingPricePiece` | number | |
| `srp` | number | |
| `qtyGround` | number | |
| `expiryGround` | number | |
| `qtyUpstair` | number | |
| `expiryUpstair` | number | |
| `qtyBox` | number | |
| `expiryBox` | number | |
| `qtyTotal` | number | computed: ground + upstair + (box × uom) |
| `qtyKyte` | number | |
| `kyteMatch` | boolean | |
| `costTotal` | number | costPerPieceNew × qtyTotal |
| `updatedAt` | string | ISO 8601 |

---

## 4. Gap Analysis: Current App vs. Target

| Feature | Current App | Target (Inventory Sheet) |
|---|---|---|
| Entity model | 1 entity (`Item`: name, qty) | 2 entities (Category, InventoryItem) with 20+ fields |
| Categories | ❌ none | ✅ 36 categories with codes and constraints |
| SKU fields | name + quantity only | SKU, emoji, UOM, 3× cost, 4× price, 3× location qty, 3× expiry, Kyte sync |
| Multi-location stock | ❌ | ✅ Ground / Upstairs / Box |
| Cost tracking | ❌ | ✅ New + Old cost per piece, cost per box |
| Price tracking | ❌ | ✅ Wholesale / Dealer / Piece / SRP |
| Kyte POS sync | ❌ | ✅ qtyKyte + mismatch flag |
| Summary / totals | ❌ | ✅ Per-category and grand total |
| Bulk stock update | ❌ | ✅ bulkUpdateStock RPC |
| Search / filter | ❌ | ✅ Filter by category, search by SKU name |
| Computed columns | ❌ | ✅ qtyTotal, kyteMatch, costTotal |
| Data seeding | ❌ | ✅ Need migration script from existing sheet |

---

## 5. Implementation Plan

### Phase 0 — Foundation (No UI changes yet)

**Goal:** Extend the shared contract and backend without breaking existing functionality.

#### 0.1 Update `src/shared/types.ts`
- Add `SkuCategory`, `NewSkuCategory`, `InventoryItem`, `NewInventoryItem`
- Add new functions to `ServerFunctions`
- Keep existing `Item` / `NewItem` unchanged

#### 0.2 Add Sheet tabs (auto-created on first access)
- `SkuCategories` tab — created by `categoryRepository.js`
- `InventoryItems` tab — created by `inventoryItemRepository.js`

#### 0.3 Backend — Repositories

**`src/server/repositories/categoryRepository.js`**
```
getAll()              → SkuCategory[]
getById(id)           → SkuCategory | null
insert(cat)           → SkuCategory
update(cat)           → SkuCategory
remove(id)            → { id }
```

**`src/server/repositories/inventoryItemRepository.js`**
```
getAll(categoryId?)   → InventoryItem[]
getById(id)           → InventoryItem | null
insert(item)          → InventoryItem
update(item)          → InventoryItem
remove(id)            → { id }
bulkUpdate(updates)   → InventoryItem[]
```

#### 0.4 Backend — Mappers

**`src/server/mappers/categoryMapper.js`** — row array ↔ SkuCategory
**`src/server/mappers/inventoryItemMapper.js`** — row array ↔ InventoryItem (handles computed fields)

#### 0.5 Backend — Services

**`src/server/services/categoryService.js`**
- `getCategories()` — fetch all, sort by sortOrder
- `addCategory(cat)` — validate code uniqueness, insert
- `updateCategory(cat)` — validate, update
- `deleteCategory(id)` — check no items reference it first

**`src/server/services/inventoryItemService.js`**
- `getInventoryItems(categoryId?)` — fetch + filter
- `addInventoryItem(item)` — validate, compute qtyTotal / costTotal, insert
- `updateInventoryItem(item)` — validate, recompute, update
- `deleteInventoryItem(id)` — remove
- `bulkUpdateStock(updates)` — lock, batch recompute, write all

**`src/server/services/summaryService.js`**
- `getInventorySummary()` — aggregate across all items
- `getCategoryTotals()` — group by category, sum cost + qty

#### 0.6 Backend — API surface (`src/server/api.js`)

Add new global functions:
```
getCategories()
addCategory(payload)
updateCategory(payload)
deleteCategory(id)
getInventoryItems(categoryId)
addInventoryItem(payload)
updateInventoryItem(payload)
deleteInventoryItem(id)
bulkUpdateStock(updates)
getInventorySummary()
getCategoryTotals()
```

#### 0.7 Backend — Validation (`src/server/lib/validate.js`)

Add validators:
- `validateCategory(cat)` — code (alphanumeric, max 10 chars), name (non-empty)
- `validateInventoryItem(item)` — categoryId exists, sku non-empty, uom > 0, all numeric fields ≥ 0

#### 0.8 Contract check (`src/server/contract.ts`)

Update `contract.ts` to assert `ServerFunctions` conformance includes all new functions.

---

### Phase 1 — Data Migration Script

**Goal:** Seed the GAS Sheets from the `Product Info` source sheet.

The migration lives in `src/server/migration/seedFromInventorySheet.js` and exposes three
editor-run functions:

| Function | Purpose |
|---|---|
| `dryRunInventorySeed()` | Read-only preview. Logs the resolved column map and the categories it would create with per-store SKU counts. **Run this first.** |
| `seedInventoryFromSheet()` | The real seed. Refuses to run if `InventoryItems` already has rows. |
| `resetSeededTabs()` | Deletes the `InventoryItems` + `SkuCategories` tabs and clears caches so the seed can be re-run. |

#### 1.1 Migration approach

Because `Product Info` is fully tabular (every row is a SKU), the script is much simpler than the
old header-row parser. **Categories are derived from the data**, not hardcoded — so new categories
appear automatically without editing a seed list. Columns are resolved by header text
(`HEADER_HINTS`), not by fixed position, so column reordering in the sheet won't break it.

```javascript
var SOURCE_SPREADSHEET_ID = '1D_tPksBpflSUD2Hx4I_MYHPQL2yYz_V-c-1uVkkaaIo';
var SOURCE_SHEET_GID      = 1625801440; // "Product Info"
```

#### 1.2 Migration steps

1. Open the source sheet by gid and read all rows into a 2D array.
2. Resolve columns by matching the header row against `HEADER_HINTS`.
3. **Pass 1 (categories):** walk rows; for each new `(CATEGORY, GROUP)` pair, derive a code
   (`_deriveCode`) and create a `SkuCategory` (name = title-cased CATEGORY, packConstraint =
   STOCKEEPING, sortOrder = discovery order). Build a `code → id` map.
4. **Pass 2 (items):** walk rows again; for each SKU, look up its category id and create an
   `InventoryItem`, carrying `store` from the STORE column and `qtyKyte` from POS COUNT.
5. `qtyTotal`, `costTotal`, and `kyteMatch` are computed server-side by `InventoryItemService`
   (`qtyTotal = qtyGround + qtyUpstair + qtyBox × uom`).

#### 1.3 Code derivation (no hardcoded seed list)

```
"Easy r1f"  -> "r1f"      (drop store-prefix word "easy", join the rest)
"hg ba"     -> "hgba"
"hg dpcl"   -> "hgdpcl"
" sparkle"  -> "sparkle"
"sachet"    -> "sachet"
""          -> slug of CATEGORY name  (e.g. "ASIAN W" -> "asianw")
```

Special case: FRIES POWDER 100g and 250g share `GROUP = "Easy pfd"`; the pack size parsed from
the CATEGORY name is appended so they resolve to distinct `pfd100` / `pfd250` codes.

---

### Phase 2 — Frontend: Category Management

**Goal:** Build the `categories` feature module.

#### Files to create:

```
src/client/features/categories/
├── components/
│   ├── CategoryList.tsx       — table of all categories (code, name, constraint, qty, cost)
│   └── CategoryForm.tsx       — add/edit form (controlled)
├── hooks/
│   └── useCategories.ts       — CRUD + loading/error state
└── index.ts
```

#### `useCategories.ts` interface:

```typescript
interface UseCategoriesReturn {
  categories: SkuCategory[];
  loading: boolean;
  error: string | null;
  addCategory: (cat: NewSkuCategory) => Promise<void>;
  updateCategory: (cat: SkuCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}
```

#### `CategoryList.tsx` columns:

| # | Column | Width | Notes |
|---|---|---|---|
| 1 | Code | 80px | monospace badge |
| 2 | Name | flex | |
| 3 | Pack Constraint | 160px | subtitle style |
| 4 | Total Cost | 100px | right-aligned, ₱ formatted |
| 5 | Total QTY | 80px | right-aligned |
| 6 | Actions | 120px | Edit / Delete buttons |

---

### Phase 3 — Frontend: Inventory Items View

**Goal:** Build the main inventory module — the core feature.

#### Files to create:

```
src/client/features/inventory/
├── components/
│   ├── InventoryTable.tsx      — main table, grouped by category
│   ├── InventoryRow.tsx        — single SKU row (expandable)
│   ├── StockEditor.tsx         — inline qty editor (Ground / Upstair / Box)
│   ├── ItemForm.tsx            — full add/edit modal form
│   ├── MismatchBadge.tsx       — red/green Kyte sync badge
│   ├── CostDisplay.tsx         — new/old cost with delta
│   └── SummaryBar.tsx          — sticky header: total cost, qty, mismatch count
├── hooks/
│   ├── useInventoryItems.ts    — CRUD + filter + loading/error
│   └── useSummary.ts           — summary + category totals
└── index.ts
```

#### `InventoryTable.tsx` layout:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Search SKU…]  [Filter: Category ▾]  [Show mismatches only ☐]  [+ Add SKU] │
├─────────────────────────────────────────────────────────────────────────────┤
│  ▼ SYRUPS (R1f)                                   ₱198,902  |  675 pcs      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 🫐 Blueberry  │ UOM:6 │ ₱292 (old) → ₱288.49 │ G:6 U:4 B:7 │ 52 ✅│   │
│  │ 🍯 Brown Sugar│ UOM:6 │ ₱292 (old) → ₱288.49 │ G:6 U:2 B:1 │ 14 ✅│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ▼ DRIZZLE                                        ₱0        |  0 pcs        │
│  …                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Column design (InventoryRow):

| Column | Content |
|---|---|
| SKU | emoji + name |
| UOM | pack size (small badge) |
| Cost | `₱OLD → ₱NEW` with red/green delta arrow |
| SRP | selling price |
| Ground | editable qty input |
| Upstairs | editable qty input |
| Box | editable qty input |
| Total QTY | computed, bold |
| Kyte | Kyte qty + match badge (✅/❌) |
| Actions | Edit (modal) / Delete |

#### `StockEditor.tsx` UX:

- Click qty value → inline input appears
- Tab between Ground / Upstairs / Box
- Enter or blur → save (calls `updateInventoryItem`)
- Shows computed total live as user types

#### `SummaryBar.tsx` (sticky top):

```
Total Inventory Value: ₱767,883.47  |  Total QTY: 3,210  |  Mismatches: 0  |  Last sync: 2m ago
```

---

### Phase 4 — Frontend: Kyte Mismatch View

**Goal:** Dedicated view for discrepancy resolution.

```
src/client/features/mismatch/
├── components/
│   └── MismatchTable.tsx      — shows only items where kyteMatch === false
└── hooks/
    └── useMismatches.ts       — filters getInventoryItems() by kyteMatch
```

Table columns: SKU | Category | App QTY | Kyte QTY | Difference | Resolve (accept Kyte or keep App)

---

### Phase 5 — Frontend: Dashboard / Summary

**Goal:** One-screen overview for a store manager.

```
src/client/features/dashboard/
├── components/
│   ├── SummaryCards.tsx       — 4 stat cards (total cost, total qty, SKUs, mismatches)
│   ├── CategoryBreakdown.tsx  — table of category totals
│   └── ZeroStockList.tsx      — SKUs with qtyTotal === 0
└── hooks/
    └── useDashboard.ts        — calls getInventorySummary() + getCategoryTotals()
```

---

### Phase 6 — Navigation & App Shell Update

Update `App.tsx` to include navigation between views:

```
[Dashboard]  [Inventory]  [Categories]  [Mismatches]
```

Use React state (not a router) for tab switching — consistent with GAS iframe constraints.

---

## 6. Development Sequence (Sprint Plan)

### Sprint 1 — Backend Foundation (Est. 3–4 days)

| Task | File(s) | Priority |
|---|---|---|
| Update `src/shared/types.ts` with all new types | `types.ts` | P0 |
| `categoryMapper.js` | `mappers/` | P0 |
| `categoryRepository.js` | `repositories/` | P0 |
| `categoryService.js` | `services/` | P0 |
| `inventoryItemMapper.js` | `mappers/` | P0 |
| `inventoryItemRepository.js` | `repositories/` | P0 |
| `inventoryItemService.js` | `services/` | P0 |
| `summaryService.js` | `services/` | P1 |
| Update `api.js` with all new globals | `api.js` | P0 |
| Update `contract.ts` | `contract.ts` | P0 |
| Add category/item validators | `lib/validate.js` | P0 |

### Sprint 2 — Data Migration (Est. 1–2 days)

| Task | Notes |
|---|---|
| Write `seedFromInventorySheet.js` migration | One-time GAS script |
| Test migration on dev copy of sheet | Verify counts match PDF |
| Verify computed fields (qtyTotal, costTotal, kyteMatch) | Spot-check 20+ rows |
| Document rollback: clear `SkuCategories` + `InventoryItems` tabs | Include in migration script |

### Sprint 3 — Frontend: Categories (Est. 1–2 days)

| Task | File(s) |
|---|---|
| `useCategories.ts` hook | `features/categories/hooks/` |
| Mock entries in `lib/server.ts` for categories | `lib/server.ts` |
| `CategoryList.tsx` | `features/categories/components/` |
| `CategoryForm.tsx` | `features/categories/components/` |
| Wire into `App.tsx` as tab | `App.tsx` |

### Sprint 4 — Frontend: Inventory Table (Est. 3–5 days)

| Task | File(s) |
|---|---|
| `useInventoryItems.ts` hook | `features/inventory/hooks/` |
| Mock entries in `lib/server.ts` for inventory items | `lib/server.ts` |
| `SummaryBar.tsx` | `features/inventory/components/` |
| `InventoryTable.tsx` (grouped by category) | `features/inventory/components/` |
| `InventoryRow.tsx` | `features/inventory/components/` |
| `StockEditor.tsx` (inline qty editing) | `features/inventory/components/` |
| `CostDisplay.tsx` | `features/inventory/components/` |
| `MismatchBadge.tsx` | `features/inventory/components/` |
| `ItemForm.tsx` (add/edit modal) | `features/inventory/components/` |
| Search + filter controls | `InventoryTable.tsx` |

### Sprint 5 — Mismatch + Dashboard (Est. 2 days)

| Task | File(s) |
|---|---|
| `useMismatches.ts` | `features/mismatch/hooks/` |
| `MismatchTable.tsx` | `features/mismatch/components/` |
| `useDashboard.ts` | `features/dashboard/hooks/` |
| `SummaryCards.tsx` | `features/dashboard/components/` |
| `CategoryBreakdown.tsx` | `features/dashboard/components/` |
| `ZeroStockList.tsx` | `features/dashboard/components/` |

### Sprint 6 — Hardening & Deploy (Est. 1–2 days)

| Task | Notes |
|---|---|
| Full typecheck pass (`npm run typecheck`) | Fix all TS errors |
| Update `lib/server.ts` mock to match full contract | All new functions need mock implementations |
| Update `docs/DATA_MODEL.md` with new schema | Document both sheet tabs |
| Update `docs/CONTRIBUTING.md` with new feature recipe | Add category + inventory item example |
| Test deployment to GAS | `npm run deploy` + smoke test |
| Performance: batch reads, cache `getInventoryItems` | 350 rows × 22 cols = heavy; cache 120s |

---

## 7. Key Technical Decisions & Constraints

### 7.1 Computed fields: store or recalculate?

**Decision: Store `qtyTotal`, `costTotal`, `kyteMatch` in the sheet row.**

- GAS has a 6-minute execution cap; computing 350+ rows on every read is risky
- Storing computed values means slightly stale data after direct sheet edits, but that's acceptable
- `qtyTotal` = `qtyGround + qtyUpstair + (qtyBox × uom)` — recomputed on every write
- `costTotal` = `costPerPieceNew ?? costPerPieceOld ?? 0) × qtyTotal`
- `kyteMatch` = `qtyTotal === (qtyKyte ?? qtyTotal)` — true when no Kyte data

### 7.2 Category filtering: client-side or server-side?

**Decision: Server-side filter in `getInventoryItems(categoryId?)`.**

- With 350+ rows, sending all data to client on every tab switch is wasteful
- GAS call overhead (1–3s) makes per-category calls acceptable for navigation
- `CacheService` keyed by `categoryId` brings repeat calls to ~0ms

### 7.3 Bulk stock update UX

**Decision: Inline editing with debounced save (500ms), not a save button.**

- Matches spreadsheet muscle memory
- `bulkUpdateStock` RPC batches all changes in one Sheets write
- Optimistic update in local state; rollback on error

### 7.4 Kyte sync

**Decision: Manual entry only (no API integration in Phase 1).**

- Kyte POS API integration is a separate project
- For now: user updates `qtyKyte` manually; mismatch flag highlights discrepancies
- Future: add `syncFromKyte()` RPC when API credentials are available

### 7.5 `SkuCategory` deletion guard

**Decision: Block deletion if any `InventoryItem` references the category.**

- Repository layer checks: `getAll().filter(i => i.categoryId === id).length > 0`
- Throws `AppError('CONFLICT', 'Category has items; delete items first')`

### 7.6 Performance — Sheet read batching

- `getAll()` always uses `sheet.getDataRange().getValues()` — one Sheets read
- Never loop cell-by-cell
- Cache key: `'inventoryItems'` (or `'inventoryItems:' + categoryId`) with 120s TTL
- Cache is cleared on any write to `InventoryItems`

---

## 8. File Creation Checklist

### Backend (new files)

```
src/server/
├── mappers/
│   ├── categoryMapper.js              ← NEW
│   └── inventoryItemMapper.js         ← NEW
├── repositories/
│   ├── categoryRepository.js          ← NEW
│   └── inventoryItemRepository.js     ← NEW
├── services/
│   ├── categoryService.js             ← NEW
│   ├── inventoryItemService.js        ← NEW
│   └── summaryService.js              ← NEW
└── migration/
    └── seedFromInventorySheet.js      ← NEW (one-time, not pushed to prod)
```

### Backend (modified files)

```
src/server/
├── api.js                             ← ADD new global functions
└── lib/validate.js                    ← ADD validateCategory, validateInventoryItem
```

### Shared (modified)

```
src/shared/types.ts                    ← ADD SkuCategory, InventoryItem, new ServerFunctions
src/server/contract.ts                 ← UPDATE to assert new functions
```

### Frontend (new files)

```
src/client/features/
├── categories/
│   ├── components/
│   │   ├── CategoryList.tsx
│   │   └── CategoryForm.tsx
│   ├── hooks/
│   │   └── useCategories.ts
│   └── index.ts
├── inventory/
│   ├── components/
│   │   ├── InventoryTable.tsx
│   │   ├── InventoryRow.tsx
│   │   ├── StockEditor.tsx
│   │   ├── ItemForm.tsx
│   │   ├── MismatchBadge.tsx
│   │   ├── CostDisplay.tsx
│   │   └── SummaryBar.tsx
│   ├── hooks/
│   │   ├── useInventoryItems.ts
│   │   └── useSummary.ts
│   └── index.ts
├── mismatch/
│   ├── components/
│   │   └── MismatchTable.tsx
│   ├── hooks/
│   │   └── useMismatches.ts
│   └── index.ts
└── dashboard/
    ├── components/
    │   ├── SummaryCards.tsx
    │   ├── CategoryBreakdown.tsx
    │   └── ZeroStockList.tsx
    ├── hooks/
    │   └── useDashboard.ts
    └── index.ts
```

### Frontend (modified files)

```
src/client/
├── App.tsx                            ← ADD tab navigation
├── lib/server.ts                      ← ADD mock implementations for all new RPCs
└── styles.css                         ← ADD table, badge, summary bar styles
```

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration script misidentifies category header rows | Medium | High | Hardcode category code list; don't rely on style detection |
| 350+ SKU rows exceed Sheets read performance in 6-min GAS cap | Low | High | Batch read entire tab in one call; cache aggressively |
| `qtyTotal` computed incorrectly for items with mixed Box/Piece stock | Medium | Medium | Unit test mapper with edge cases (zero UOM, null box qty) |
| Kyte QTY column mapping is off-by-one in different sheet versions | Medium | Medium | Verify column index by reading header row, not hardcoded index |
| Large `InventoryTable` DOM (350 rows) is slow in React | Medium | Low | Virtualize with `react-window` if needed; group by category limits visible rows |
| Category deletion leaves orphaned `InventoryItems` | Low | High | Guard in `categoryService.deleteCategory` (check FK before delete) |
| Concurrent stock updates from multiple users | Low | Medium | LockService already wraps all writes; no additional risk |
| Bundle size increases significantly with 350 SKUs in mock data | Low | Low | Mock data only in dev; production calls GAS |

---

## 10. Open Questions for User Confirmation

1. **Should the old `Item` entity and existing `Items` sheet be removed**, or kept alongside the new inventory system?
2. **Are `expiryGround`, `expiryUpstair`, `expiryBox` dates (ISO strings) or day-counts (numbers)?** The sheet appears to use integers — clarify unit.
3. **Is `qtyKyte` updated manually or should we build a bulk import UI** (paste from Kyte report)?
4. **Should pricing (wholesale/dealer/piece/SRP) be editable in the app**, or is it read-only reference data managed in the sheet directly?
5. **Is there a concept of "reserved" or "on order" stock** that should be tracked?
6. **What currency symbol** is displayed? (₱ Philippine Peso assumed from values seen.)
7. **Which columns need to be part of the `bulkUpdateStock` operation** — just qty fields, or also expiry?
8. **Are the Sparkle & Shimmer and Fries Powder 100g items truly zero** or was the sheet incomplete at export time?

---

## 11. Summary Estimate

| Phase | Days |
|---|---|
| Sprint 1: Backend foundation | 3–4 |
| Sprint 2: Data migration | 1–2 |
| Sprint 3: Category UI | 1–2 |
| Sprint 4: Inventory table UI | 3–5 |
| Sprint 5: Mismatch + Dashboard | 2 |
| Sprint 6: Hardening + Deploy | 1–2 |
| **Total** | **11–17 days** |

**Recommended first step:** Sprint 1 (backend + types) — it unblocks everything else and has
zero UI risk. Once the contract is defined and the mock is updated, UI sprints can run
independently.
