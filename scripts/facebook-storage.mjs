import {writeFile, rename, rm} from 'node:fs/promises';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const repository = fileURLToPath(new URL('../', import.meta.url));
export class CollectorError extends Error {}

export async function saveSnapshot(output, snapshot) {
  const suffix = snapshot.fetchedAt.replace(/[:.]/g, '-') + '-' + randomUUID();
  const file = join(output, `snapshot-${suffix}.json`);
  const temporary = join(output, `.latest-${randomUUID()}.tmp`);
  await writeFile(file, JSON.stringify(snapshot, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    await rename(temporary, join(output, 'latest.json'));
  } finally { await rm(temporary, {force: true}); }
  return file;
}

export function assertPrivateOutput(output) {
  const path = relative(repository, resolve(output));
  if (!path || (!isAbsolute(path) && path !== '..' && !path.startsWith('../'))) {
    throw new CollectorError('Analytics output must be outside the Git repository and website.');
  }
}
