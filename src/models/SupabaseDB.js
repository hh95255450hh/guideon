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
    const { data, error } = await supabase
      .from(this.table).select('*').eq(field, value).maybeSingle();
    if (error) { console.error(`[DB:${this.table}] findByField(${field}):`, error.message); return null; }
    return data;
  }

  async findAllByField(field, value) {
    const { data, error } = await supabase
      .from(this.table).select('*').eq(field, value);
    if (error) { console.error(`[DB:${this.table}] findAllByField(${field}):`, error.message); return []; }
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
