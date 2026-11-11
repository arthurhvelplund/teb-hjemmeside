import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, readdir, stat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveSnapshot, assertPrivateOutput} from './facebook-storage.mjs';

test('private output rejects the repository, its website and nested paths', () => {
  for (const name of ['../', '../site/facebook', '../private-data']) {
    assert.throws(() => assertPrivateOutput(new URL(name, import.meta.url).pathname), /outside/);
  }
  assert.doesNotThrow(() => assertPrivateOutput(join(tmpdir(), 'teb-private')));
});

test('snapshots retain history, atomically replace latest and leave no temporary files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-storage-'));
  try {
    const snapshot = {fetchedAt: '2026-11-11T08:00:00.000Z', posts: []};
    const first = await saveSnapshot(directory, snapshot);
    const second = await saveSnapshot(directory, snapshot);
    assert.notEqual(first, second);
    assert.equal(await readFile(first, 'utf8'), await readFile(join(directory, 'latest.json'), 'utf8'));
    for (const file of [first, second, join(directory, 'latest.json')]) assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await readdir(directory)).some(name => name.endsWith('.tmp')), false);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('a snapshot that cannot be serialized leaves the previous latest untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'teb-storage-failure-'));
  try {
    const previous = '{"lastKnownGood":true}\n';
    await writeFile(join(directory, 'latest.json'), previous);
    const invalid = {fetchedAt: '2026-11-11T08:00:00.000Z'};
    invalid.circular = invalid;
    await assert.rejects(saveSnapshot(directory, invalid));
    assert.equal(await readFile(join(directory, 'latest.json'), 'utf8'), previous);
    assert.deepEqual(await readdir(directory), ['latest.json']);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
