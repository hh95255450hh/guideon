(async () => {
  const SupabaseDB = require('./src/models/SupabaseDB');
  const users = new SupabaseDB('users');
  // find a company
  const companies = await users.findAllWhere({ userType: 'company' });
  if (!companies.length) { console.log('no company to test'); return; }
  const c = companies[0];
  console.log('company:', c.id, '| current maxConcurrentTours:', c.maxConcurrentTours);
  // write
  const upd = await users.update(c.id, { maxConcurrentTours: 3 });
  console.log('after write -> maxConcurrentTours:', upd.maxConcurrentTours);
  // read back fresh
  const fresh = await users.findById(c.id);
  console.log('read back -> maxConcurrentTours:', fresh.maxConcurrentTours);
})().catch(e => console.log('ERR', e.message));
