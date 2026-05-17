const fs = require('fs');
const path = require('path');

class FileDB {
  constructor(filename) {
    this.filepath = path.join(__dirname, '..', 'data', filename);
  }

  readAll() {
    try {
      const raw = fs.readFileSync(this.filepath, 'utf8').replace(/^﻿/, '');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  writeAll(data) {
    fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2), 'utf8');
  }

  findById(id) {
    return this.readAll().find(r => r.id === id || r.reviewId === id);
  }

  findOne(predicate) {
    return this.readAll().find(predicate) || null;
  }

  findAll(predicate) {
    const all = this.readAll();
    return predicate ? all.filter(predicate) : all;
  }

  insert(record) {
    const all = this.readAll();
    all.push(record);
    this.writeAll(all);
    return record;
  }

  update(id, changes) {
    const all = this.readAll();
    const idx = all.findIndex(r => r.id === id || r.reviewId === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes };
    this.writeAll(all);
    return all[idx];
  }

  delete(id) {
    const all = this.readAll();
    const idx = all.findIndex(r => r.id === id || r.reviewId === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    this.writeAll(all);
    return true;
  }
}

module.exports = FileDB;
