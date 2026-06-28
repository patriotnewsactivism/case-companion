// Mock Supabase client for sandbox/demo mode
// Intercepts all database calls and returns seed data
// AI function calls are intercepted separately in the client wrapper

import { seedCases, seedDocuments, seedTimelineEvents } from './seed-data';

type TableName = string;
type RowData = Record<string, any>;

// Simple in-memory store
const tables: Record<TableName, RowData[]> = {
  cases: [...seedCases],
  documents: [...seedDocuments],
  timeline_events: [...seedTimelineEvents],
  legal_briefs: [],
  discovery_requests: [],
  depositions: [],
  time_entries: [],
  court_dates: [],
  client_communications: [],
  case_members: [],
  case_strategies: [],
  case_context: [],
  case_events: [],
  case_documents: [],
  conflict_checks: [],
  document_versions: [],
  export_jobs: [],
  generated_motions: [],
  invoices: [],
  judicial_profiles: [],
  motion_suggestions: [],
  motion_templates: [],
  organization_members: [],
  organizations: [],
  privilege_log_entries: [],
  profiles: [{ id: 'demo-user', email: 'demo@casebuddy.legal', full_name: 'Demo Attorney', role: 'attorney' }],
  research_notes: [],
  settlement_analyses: [],
  trial_sessions: [],
  trial_simulation_sessions: [],
};

// Query builder that mimics Supabase's fluent API
class MockQueryBuilder {
  private tableName: TableName;
  private filters: { column: string; value: any; op: string }[] = [];
  private orderField?: string;
  private orderAsc = true;
  private nullsFirst = false;
  private limitCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private selectFields: string = '*';

  constructor(table: TableName) {
    this.tableName = table;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value, op: 'eq' });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, value, op: 'neq' });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, value: values, op: 'in' });
    return this;
  }

  like(column: string, pattern: string) {
    this.filters.push({ column, value: pattern, op: 'like' });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ column, value: pattern, op: 'ilike' });
    return this;
  }

  gt(column: string, value: any) { this.filters.push({ column, value, op: 'gt' }); return this; }
  gte(column: string, value: any) { this.filters.push({ column, value, op: 'gte' }); return this; }
  lt(column: string, value: any) { this.filters.push({ column, value, op: 'lt' }); return this; }
  lte(column: string, value: any) { this.filters.push({ column, value, op: 'lte' }); return this; }
  is(column: string, value: any) { this.filters.push({ column, value, op: 'is' }); return this; }
  not(column: string, op: string, value: any) { this.filters.push({ column, value, op: 'not_' + op }); return this; }

  order(field: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    this.nullsFirst = opts?.nullsFirst ?? false;
    return this;
  }

  limit(count: number) { this.limitCount = count; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }

  single() {
    return this.execute(true);
  }

  maybeSingle() {
    return this.execute(true);
  }

  private execute(single = false): Promise<{ data: any; error: any }> {
    let rows = [...(tables[this.tableName] || [])];

    // Apply filters
    for (const f of this.filters) {
      rows = rows.filter((row) => {
        const val = row[f.column];
        switch (f.op) {
          case 'eq': return val === f.value;
          case 'neq': return val !== f.value;
          case 'in': return Array.isArray(f.value) && f.value.includes(val);
          case 'like': return typeof val === 'string' && val.includes(f.value.replace(/%/g, ''));
          case 'ilike': return typeof val === 'string' && val.toLowerCase().includes(String(f.value).replace(/%/g, '').toLowerCase());
          case 'gt': return val > f.value;
          case 'gte': return val >= f.value;
          case 'lt': return val < f.value;
          case 'lte': return val <= f.value;
          case 'is': return (f.value === null && val === null) || (f.value === true && val === true) || (f.value === false && val === false);
          default: return true;
        }
      });
    }

    // Apply ordering
    if (this.orderField) {
      rows.sort((a, b) => {
        const av = a[this.orderField!];
        const bv = b[this.orderField!];
        if (av === null || av === undefined) return this.nullsFirst ? -1 : 1;
        if (bv === null || bv === undefined) return this.nullsFirst ? 1 : -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAsc ? cmp : -cmp;
      });
    }

    // Apply range
    if (this.rangeFrom !== undefined) {
      rows = rows.slice(this.rangeFrom, this.rangeTo !== undefined ? this.rangeTo + 1 : undefined);
    }

    // Apply limit
    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    if (single) {
      return Promise.resolve({ data: rows[0] || null, error: null });
    }

    return Promise.resolve({ data: rows, error: null });
  }

  then(onFulfilled: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class MockInsertBuilder {
  constructor(private table: TableName, private rows: RowData[]) {}

  then(onFulfilled: any, onRejected?: any) {
    if (!tables[this.table]) tables[this.table] = [];
    const inserted = this.rows.map((row) => ({
      ...row,
      id: row.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    }));
    tables[this.table].push(...inserted);
    return Promise.resolve({ data: inserted[0] || null, error: null }).then(onFulfilled, onRejected);
  }
}

class MockUpdateBuilder {
  private filters: { column: string; value: any }[] = [];

  constructor(private table: TableName, private data: RowData[]) {}

  eq(column: string, value: any) { this.filters.push({ column, value }); return this; }

  then(onFulfilled: any, onRejected?: any) {
    let rows = tables[this.table] || [];
    let updated = 0;
    for (const row of rows) {
      if (this.filters.every((f) => row[f.column] === f.value)) {
        Object.assign(row, ...this.data);
        row.updated_at = new Date().toISOString();
        updated++;
      }
    }
    return Promise.resolve({ data: this.data[0] || null, error: null }).then(onFulfilled, onRejected);
  }
}

class MockDeleteBuilder {
  private filters: { column: string; value: any }[] = [];

  constructor(private table: TableName) {}

  eq(column: string, value: any) { this.filters.push({ column, value }); return this; }

  then(onFulfilled: any, onRejected?: any) {
    let deleted = 0;
    if (tables[this.table]) {
      const before = tables[this.table].length;
      tables[this.table] = tables[this.table].filter((row) => {
        const match = this.filters.every((f) => row[f.column] === f.value);
        if (match) deleted++;
        return !match;
      });
    }
    return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  }
}

// Mock auth
const mockAuth = {
  getSession: () => Promise.resolve({
    data: { session: { user: { id: 'demo-user', email: 'demo@casebuddy.legal' }, access_token: 'demo-token' } },
    error: null,
  }),
  getUser: () => Promise.resolve({
    data: { user: { id: 'demo-user', email: 'demo@casebuddy.legal', user_metadata: { full_name: 'Demo Attorney' } } },
    error: null,
  }),
  signInWithPassword: () => Promise.resolve({ data: { user: { id: 'demo-user' } }, error: null }),
  signUp: () => Promise.resolve({ data: { user: { id: 'demo-user' } }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
  onAuthStateChange: (cb: Function) => {
    setTimeout(() => cb('SIGNED_IN', { user: { id: 'demo-user', email: 'demo@casebuddy.legal' } }), 100);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

// Mock storage
const mockStorage = {
  from: (_bucket: string) => ({
    upload: (_path: string, _file: any) => Promise.resolve({ data: { path: _path }, error: null }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://demo.casebuddy.legal/storage/${path}` } }),
    createSignedUrl: (path: string, _expires: number) => Promise.resolve({ data: { signedUrl: `https://demo.casebuddy.legal/signed/${path}` }, error: null }),
    remove: (_paths: string[]) => Promise.resolve({ data: [], error: null }),
    list: () => Promise.resolve({ data: [], error: null }),
  }),
};

// Mock channel for realtime
const mockChannel = {
  on: () => mockChannel,
  subscribe: () => mockChannel,
  unsubscribe: () => {},
};

export const mockSupabaseClient = {
  from: (table: TableName) => {
    const builder = new MockQueryBuilder(table);
    // Add insert/update/delete as methods that return appropriate builders
    (builder as any).insert = (rows: RowData | RowData[]) => new MockInsertBuilder(table, Array.isArray(rows) ? rows : [rows]);
    (builder as any).update = (data: RowData) => new MockUpdateBuilder(table, [data]);
    (builder as any).delete = () => new MockDeleteBuilder(table);
    (builder as any).upsert = (rows: RowData | RowData[]) => new MockInsertBuilder(table, Array.isArray(rows) ? rows : [rows]);
    return builder;
  },
  auth: mockAuth,
  storage: mockStorage,
  functions: {
    invoke: (_name: string, _options?: any) => Promise.resolve({ data: null, error: { message: 'Use /api/ for AI in sandbox mode' } }),
  },
  channel: () => mockChannel,
  removeChannel: () => {},
  realtime: { isConnected: false },
};
