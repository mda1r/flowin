import * as SQLite from 'expo-sqlite'

let _db: SQLite.SQLiteDatabase | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db
  _db = await SQLite.openDatabaseAsync('nexuspos.db')
  await migrate(_db)
  return _db
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS products_cache (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      variants_json TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories_cache (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_orders (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount_tendered REAL,
      cash_amount REAL,
      card_amount REAL,
      customer_id TEXT,
      notes TEXT,
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      created_at INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `)
}

// ── Product cache ──────────────────────────────────────────────────────────────

export async function cacheProducts(products: unknown[]) {
  const db = await getDb()
  const now = Date.now()
  await db.withTransactionAsync(async () => {
    for (const p of products as Array<{ id: string; name: string; categoryId?: string; imageUrl?: string; isActive?: boolean; variants: unknown[] }>) {
      await db.runAsync(
        `INSERT OR REPLACE INTO products_cache (id, name, category_id, image_url, is_active, variants_json, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.categoryId ?? null, p.imageUrl ?? null, p.isActive !== false ? 1 : 0, JSON.stringify(p.variants), now],
      )
    }
  })
}

export async function getCachedProducts() {
  const db = await getDb()
  const rows = await db.getAllAsync<{
    id: string; name: string; category_id: string | null;
    image_url: string | null; is_active: number; variants_json: string
  }>('SELECT * FROM products_cache ORDER BY name')
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    imageUrl: r.image_url,
    isActive: r.is_active === 1,
    variants: JSON.parse(r.variants_json) as unknown[],
  }))
}

export async function cacheCategories(categories: Array<{ id: string; name: string }>) {
  const db = await getDb()
  const now = Date.now()
  await db.withTransactionAsync(async () => {
    for (const c of categories) {
      await db.runAsync(
        'INSERT OR REPLACE INTO categories_cache (id, name, synced_at) VALUES (?, ?, ?)',
        [c.id, c.name, now],
      )
    }
  })
}

export async function getCachedCategories() {
  const db = await getDb()
  return db.getAllAsync<{ id: string; name: string }>(
    'SELECT id, name FROM categories_cache ORDER BY name',
  )
}

// ── Offline orders ─────────────────────────────────────────────────────────────

export interface OfflineOrder {
  id: string
  branchId: string
  tenantId: string
  lines: Array<{ variantId: string; productName: string; variantName: string; unitPrice: number; quantity: number }>
  paymentMethod: string
  amountTendered?: number
  cashAmount?: number
  cardAmount?: number
  customerId?: string
  notes?: string
  subtotal: number
  taxAmount: number
  total: number
  createdAt: number
  synced: boolean
}

export async function saveOfflineOrder(order: OfflineOrder) {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO offline_orders
     (id, branch_id, tenant_id, lines_json, payment_method, amount_tendered, cash_amount, card_amount,
      customer_id, notes, subtotal, tax_amount, total, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      order.id, order.branchId, order.tenantId,
      JSON.stringify(order.lines), order.paymentMethod,
      order.amountTendered ?? null, order.cashAmount ?? null, order.cardAmount ?? null,
      order.customerId ?? null, order.notes ?? null,
      order.subtotal, order.taxAmount, order.total, order.createdAt,
    ],
  )
}

export async function getUnsyncedOrders(): Promise<OfflineOrder[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM offline_orders WHERE synced = 0 ORDER BY created_at',
  )
  return rows.map((r) => ({
    id: r.id as string,
    branchId: r.branch_id as string,
    tenantId: r.tenant_id as string,
    lines: JSON.parse(r.lines_json as string),
    paymentMethod: r.payment_method as string,
    amountTendered: r.amount_tendered as number | undefined,
    cashAmount: r.cash_amount as number | undefined,
    cardAmount: r.card_amount as number | undefined,
    customerId: r.customer_id as string | undefined,
    notes: r.notes as string | undefined,
    subtotal: r.subtotal as number,
    taxAmount: r.tax_amount as number,
    total: r.total as number,
    createdAt: r.created_at as number,
    synced: false,
  }))
}

export async function markOrderSynced(id: string) {
  const db = await getDb()
  await db.runAsync('UPDATE offline_orders SET synced = 1 WHERE id = ?', [id])
}
