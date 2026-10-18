import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function database(filename=':memory:') {
  const sqlite=new DatabaseSync(filename);
  sqlite.exec(readFileSync(new URL('../migrations/0001_calendar.sql',import.meta.url),'utf8'));
  if(!sqlite.prepare('PRAGMA table_info(events)').all().some(column=>column.name==='receipt_state'))sqlite.exec("ALTER TABLE events ADD COLUMN receipt_state TEXT NOT NULL DEFAULT 'pending'");
  const wrap=(sql,args=[])=>({
    bind(...values){return wrap(sql,values);},
    first(){return sqlite.prepare(sql).get(...args)||null;},
    all(){return {results:sqlite.prepare(sql).all(...args)};},
    run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}
  });
  return {prepare:sql=>wrap(sql),batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(statement=>statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close();}};
}
