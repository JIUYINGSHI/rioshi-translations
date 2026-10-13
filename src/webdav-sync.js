import { createClient } from 'webdav';

export class SyncConflict extends Error {
  constructor() { super('Remote dictionary changed. Download it before uploading.'); this.name = 'SyncConflict'; }
}

// Transport and WebDAV authentication are provided by webdav-client.
// Conditional writes use standard HTTP ETags to avoid lost updates.
export function createWebdavSync(options, store, create = createClient) {
  const endpoint = new URL(options.url);
  if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('Use an HTTP(S) WebDAV URL without embedded credentials');
  }
  const path = options.path || '/rioshi-translations.json';
  if (!path.startsWith('/') || path.split('/').includes('..')) throw new Error('Invalid WebDAV file path');
  const client = create(endpoint.href, { username: options.username || '', password: options.password || '' });
  let etag = null;
  let missing = false;
  let hasBaseline = false;
  let busy = false;
  const exclusive = async operation => {
    if (busy) throw new Error('A sync operation is already running');
    busy = true;
    try { return await operation(); } finally { busy = false; }
  };
  const readRemote = async () => {
    try {
      const result = await client.getFileContents(path, { format: 'text', details: true });
      etag = result.headers?.etag || result.headers?.ETag || null;
      missing = false;
      return JSON.parse(result.data);
    } catch (error) {
      if (error.status === 404) { missing = true; etag = null; return null; }
      throw error;
    }
  };
  return {
    check: () => exclusive(async () => {
      const baseline = { etag, missing };
      try { return { exists: (await readRemote()) !== null }; }
      finally {
        // Connectivity checks must not advance the version last synchronized.
        if (hasBaseline) { etag = baseline.etag; missing = baseline.missing; }
      }
    }),
    download: () => exclusive(async () => {
      const snapshot = await readRemote();
      if (!snapshot) throw new Error('Remote sync file does not exist');
      store.importSnapshot(snapshot);
      hasBaseline = true;
      return snapshot;
    }),
    upload: (force = false) => exclusive(async () => {
      if (!etag && !missing) {
        const snapshot = await readRemote();
        if (snapshot && !force) throw new SyncConflict();
      }
      if (!missing && !hasBaseline && !force) throw new SyncConflict();
      if (!missing && !etag && !force) throw new SyncConflict();
      const parent = path.slice(0, path.lastIndexOf('/'));
      if (parent) await client.createDirectory(parent, { recursive: true });
      const headers = { 'Content-Type': 'application/json; charset=utf-8' };
      if (etag && !force) headers['If-Match'] = etag;
      const snapshot = store.exportSnapshot();
      const result = await client.putFileContents(path, JSON.stringify(snapshot, null, 2), {
        overwrite: !missing || force, contentLength: false, headers
      }).catch(error => { if (error.status === 412) throw new SyncConflict(); throw error; });
      if (!result) throw new SyncConflict();
      const remote = await readRemote();
      if (JSON.stringify(remote) !== JSON.stringify(snapshot)) {
        hasBaseline = false;
        throw new SyncConflict();
      }
      hasBaseline = true;
    })
  };
}
