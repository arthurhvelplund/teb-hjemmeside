import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function database(filename=':memory:') {
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  sqlite.exec('CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
  const directory=new URL('../migrations/',import.meta.url);
  for(const name of readdirSync(directory).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) {
    if(sqlite.prepare('SELECT 1 FROM d1_migrations WHERE name=?').get(name))continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      // An older local pilot predates migration tracking. Its schema is compatible
      // with 0001, whose CREATE statements are deliberately idempotent.
      sqlite.exec(readFileSync(new URL(name,directory),'utf8'));
      if(name==='0001_calendar.sql'&&!sqlite.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='receipt_state'))sqlite.exec("ALTER TABLE events ADD COLUMN receipt_state TEXT NOT NULL DEFAULT 'pending'");
      sqlite.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);
      sqlite.exec('COMMIT');
    } catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  }
  const wrap=(sql,args=[])=>({
    bind(...values){return wrap(sql,values);},
    first(){return sqlite.prepare(sql).get(...args)||null;},
    all(){return {results:sqlite.prepare(sql).all(...args)};},
    run(){const before=sqlite.prepare('SELECT total_changes() AS n').get().n;sqlite.prepare(sql).run(...args);return {meta:{changes:Number(sqlite.prepare('SELECT total_changes() AS n').get().n-before)}};}
  });
  return {prepare:sql=>wrap(sql),batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close();}};
}
