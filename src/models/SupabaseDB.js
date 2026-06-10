const supabase = require('../config/supabase');

/**
 * SupabaseDB — thin wrapper around Supabase JS client.
 *
 * Two query styles supported:
 *  - Direct: findById(id), findByField(field, value) — efficient, runs SQL on server
 *  - Predicate: findOne(fn), findAll(fn) — pulls table, filters in memory (use sparingly)
 *
 * Prefer direct methods. Predicate methods exist for backward compatibility with
 * controllers that need composite filters not expressible as a single column match.
 */
class SupabaseDB {
  constructor(tableName, primaryKey = 'id') {
    this.table = tableName;
    this.pk = primaryKey;
  }

  async readAll() {
    const { data, error } = await supabase.from(this.table).select('*');
    if (error) { console.error(`[DB:${this.table}] readAll:`, error.message); return []; }
    return data || [];
  }

  async findById(id) {
    const { data, error } = await supabase
      .from(this.table).select('*').eq(this.pk, id).maybeSingle();
    if (error) { console.error(`[DB:${this.table}] findById:`, error.message); return null; }
    return data;
  }

  async findByField(field, value) {
    // Email lookups are case-insensitive (some seed data may be mixed-case)
    const useIlike = field === 'email' && typeof value === 'string';
    let query = supabase.from(this.table).select('*');
    query = useIlike ? query.ilike(field, value) : query.eq(field, value);
    const { data, error } = await query.maybeSingle();
    if (error) { console.error(`[DB:${this.table}] findByField(${field}):`, error.message); return null; }
    return data;
  }

  async findAllByField(field, value) {
    const { data, error } = await supabase
      .from(this.table).select('*').eq(field, value);
    if (error) { console.error(`[DB:${this.table}] findAllByField(${field}):`, error.message); return []; }
    return data || [];
  }

  // Fetch rows matching multiple conditions (server-side filtering)
  // conditions: { field: value, ... }
  async findAllWhere(conditions) {
    let query = supabase.from(this.table).select('*');
    for (const [field, value] of Object.entries(conditions)) {
      if (value === null) query = query.is(field, null);
      else query = query.eq(field, value);
    }
    const { data, error } = await query;
    if (error) { console.error(`[DB:${this.table}] findAllWhere:`, error.message); return []; }
    return data || [];
  }

  // Paginated query that pushes filters AND limit/offset to Postgres
  // so we never pull every row into Node memory. Returns { rows, total,
  // hasMore } — the count is computed by the DB in the same round-trip.
  //
  // opts:
  //   eq:    { field: value, ... }           exact-match filters
  //   ilike: { field: 'partial%' }           case-insensitive LIKE
  //   gte:   { field: 0 }                    >= value
  //   lte:   { field: 999 }                  <= value
  //   inAny: { field: [...] }                IN (...)
  //   order: { field: 'col', dir: 'desc' }   ordering (default: createdAt desc)
  //   limit:  number (default 24, max 200)
  //   offset: number (default 0)
  async findPage(opts = {}) {
    const limit  = Math.min(Math.max(parseInt(opts.limit) || 24, 1), 200);
    const offset = Math.max(parseInt(opts.offset) || 0, 0);

    let q = supabase.from(this.table).select('*', { count: 'exact' });

    for (const [f, v] of Object.entries(opts.eq    || {})) {
      q = v === null ? q.is(f, null) : q.eq(f, v);
    }
    for (const [f, v] of Object.entries(opts.ilike || {})) {
      if (v != null && v !== '') q = q.ilike(f, `%${v}%`);
    }
    for (const [f, v] of Object.entries(opts.gte   || {})) {
      if (v != null && v !== '' && !Number.isNaN(+v)) q = q.gte(f, +v);
    }
    for (const [f, v] of Object.entries(opts.lte   || {})) {
      if (v != null && v !== '' && !Number.isNaN(+v)) q = q.lte(f, +v);
    }
    for (const [f, vs] of Object.entries(opts.inAny || {})) {
      if (Array.isArray(vs) && vs.length) q = q.in(f, vs);
    }

    const ord = opts.order || { field: 'createdAt', dir: 'desc' };
    q = q.order(ord.field, { ascending: ord.dir !== 'desc', nullsFirst: false });
    q = q.range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) {
      console.error(`[DB:${this.table}] findPage:`, error.message);
      return { rows: [], total: 0, hasMore: false, limit, offset };
    }
    const rows = data || [];
    return {
      rows,
      total: count != null ? count : rows.length,
      hasMore: count != null ? offset + rows.length < count : rows.length === limit,
      limit, offset,
    };
  }

  // Fetch multiple rows by primary key in a single query
  async findByIds(ids) {
    if (!ids || !ids.length) return [];
    const { data, error } = await supabase
      .from(this.table).select('*').in(this.pk, ids);
    if (error) { console.error(`[DB:${this.table}] findByIds:`, error.message); return []; }
    return data || [];
  }

  // Fetch multiple rows where field matches any of the given values
  async findAllWhereIn(field, values) {
    if (!values || !values.length) return [];
    const { data, error } = await supabase
      .from(this.table).select('*').in(field, values);
    if (error) { console.error(`[DB:${this.table}] findAllWhereIn(${field}):`, error.message); return []; }
    return data || [];
  }

  async findOne(predicate) {
    if (typeof predicate === 'object' && predicate !== null) {
      const [field, value] = Object.entries(predicate)[0];
      return this.findByField(field, value);
    }
    const all = await this.readAll();
    return all.find(predicate) || null;
  }

  async findAll(predicate) {
    if (typeof predicate === 'object' && predicate !== null) {
      const [field, value] = Object.entries(predicate)[0];
      return this.findAllByField(field, value);
    }
    const all = await this.readAll();
    return predicate ? all.filter(predicate) : all;
  }

  async insert(record) {
    const { data, error } = await supabase
      .from(this.table).insert(record).select('*').single();
    if (error) throw new Error(`[DB:${this.table}] insert: ${error.message}`);
    return data;
  }

  async update(id, changes) {
    const { data, error } = await supabase
      .from(this.table).update(changes).eq(this.pk, id).select('*').maybeSingle();
    if (error) throw new Error(`[DB:${this.table}] update: ${error.message}`);
    return data;
  }

  async updateWhere(field, value, changes) {
    const { data, error } = await supabase
      .from(this.table).update(changes).eq(field, value).select('*');
    if (error) throw new Error(`[DB:${this.table}] updateWhere(${field}): ${error.message}`);
    return data || [];
  }

  async delete(id) {
    const { error } = await supabase.from(this.table).delete().eq(this.pk, id);
    if (error) throw new Error(`[DB:${this.table}] delete: ${error.message}`);
    return true;
  }

  async count(filter) {
    let query = supabase.from(this.table).select('*', { count: 'exact', head: true });
    if (filter && typeof filter === 'object') {
      for (const [field, value] of Object.entries(filter)) query = query.eq(field, value);
    }
    const { count, error } = await query;
    if (error) { console.error(`[DB:${this.table}] count:`, error.message); return 0; }
    return count || 0;
  }
}

module.exports = SupabaseDB;
