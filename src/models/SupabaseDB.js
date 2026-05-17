const supabase = require('../config/supabase');

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
    const all = await this.readAll();
    return all.find(r => r.id === id || r.reviewId === id) || null;
  }

  async findOne(predicate) {
    const all = await this.readAll();
    return all.find(predicate) || null;
  }

  async findAll(predicate) {
    const all = await this.readAll();
    return predicate ? all.filter(predicate) : all;
  }

  async insert(record) {
    const { data, error } = await supabase.from(this.table).insert(record).select('*').single();
    if (error) throw new Error(`[DB:${this.table}] insert: ${error.message}`);
    return data;
  }

  async update(id, changes) {
    const { data, error } = await supabase
      .from(this.table).update(changes).eq(this.pk, id).select('*').maybeSingle();
    if (error) throw new Error(`[DB:${this.table}] update: ${error.message}`);
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from(this.table).delete().eq(this.pk, id);
    if (error) throw new Error(`[DB:${this.table}] delete: ${error.message}`);
    return true;
  }
}

module.exports = SupabaseDB;
