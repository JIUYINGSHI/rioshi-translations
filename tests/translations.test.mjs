import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { createTranslationStore, downloadLanguage } from '../src/translation-store.js';
import { createWebdavSync, SyncConflict } from '../src/webdav-sync.js';
import { mountEditor } from '../src/editor.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
}

test('a saved dictionary and interface language survive reopening without losing other languages', () => {
  const storage = memoryStorage();
  const first = createTranslationStore(storage);
  first.saveDictionary('fr', { Save: 'Enregistrer' });
  first.saveDictionary('ja', { Save: '保存' });
  first.setUiLanguage('en');
  const reopened = createTranslationStore(storage);
  assert.equal(reopened.uiLanguage, 'en');
  assert.equal(reopened.language, 'ja');
  assert.deepEqual(reopened.getDictionary('fr'), { Save: 'Enregistrer' });
});

test('GitHub download resolves a catalog language and applies valid dictionary text', async () => {
  const requests = [];
  const dictionary = await downloadLanguage({ repository: 'owner/translations', branch: 'main', language: 'fr',
    fetcher: async url => {
      requests.push(url);
      return new Response(JSON.stringify(url.endsWith('catalog.json')
        ? { languages: [{ id: 'fr', path: 'locales/fr.json' }] } : { Save: 'Enregistrer' }));
    }
  });
  assert.deepEqual(dictionary, { Save: 'Enregistrer' });
  assert.equal(requests[1], 'https://raw.githubusercontent.com/owner/translations/main/locales/fr.json');
});

test('a remote catalog cannot redirect language download outside the repository', async () => {
  await assert.rejects(downloadLanguage({ repository: 'owner/repo', branch: 'main', language: 'fr',
    fetcher: async () => new Response(JSON.stringify({ languages: [{ id: 'fr', path: 'https://another.example/credentials' }] }))
  }), /not available/);
});

test('WebDAV client uploads, downloads and rejects concurrent remote changes using real HTTP', async t => {
  let body = null;
  let revision = 0;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (request.method === 'GET') {
      if (body === null) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { ETag: `"${revision}"`, 'Content-Type': 'application/json' }); response.end(body); return;
    }
    if (request.method === 'PUT') {
      if (request.headers['if-none-match'] === '*' && body !== null || request.headers['if-match'] && request.headers['if-match'] !== `"${revision}"`) {
        response.writeHead(412); response.end(); return;
      }
      body = Buffer.concat(chunks).toString(); revision++;
      response.writeHead(201); response.end(); return;
    }
    response.writeHead(405); response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const source = createTranslationStore(memoryStorage());
  source.saveDictionary('fr', { Save: 'Enregistrer' });
  const client = createWebdavSync({ url, path: '/dictionary.json', password: 'not-in-snapshot' }, source);
  await client.upload();
  assert.equal(body.includes('not-in-snapshot'), false);
  const destination = createTranslationStore(memoryStorage());
  const secondClient = createWebdavSync({ url, path: '/dictionary.json' }, destination);
  await secondClient.download();
  assert.deepEqual(destination.getDictionary(), { Save: 'Enregistrer' });
  source.saveDictionary('fr', { Save: 'Sauvegarder' });
  await client.upload();
  destination.saveDictionary('fr', { Save: 'Conflicting edit' });
  await assert.rejects(secondClient.upload(), SyncConflict);
  assert.equal(JSON.parse(body).dictionaries.fr.Save, 'Sauvegarder');
});

test('checking an existing remote file does not grant permission to overwrite it', async () => {
  const store = createTranslationStore(memoryStorage());
  store.saveDictionary('en', { Save: 'Save' });
  const sync = createWebdavSync({ url: 'https://dav.example' }, store, () => ({
    getFileContents: async () => ({ data: JSON.stringify(store.exportSnapshot()), headers: { etag: '"1"' } }),
    putFileContents: async () => { throw new Error('Must not upload'); }
  }));
  assert.deepEqual(await sync.check(), { exists: true });
  await assert.rejects(sync.upload(), SyncConflict);
});

test('the editor switches all plugin labels to English and restores its host on disposal', () => {
  const dom = new JSDOM('<div id="host" style="position:static;height:700px"></div>', { url: 'https://steam.local' });
  const doc = dom.window.document;
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = dom.window.localStorage;
  try {
    const store = createTranslationStore(dom.window.localStorage);
    store.setUiLanguage('zh-CN'); store.saveDictionary('zh-CN', { Save: '保存' });
    const host = doc.getElementById('host');
    const editor = mountEditor({ documentRef: doc, host, store,
      catalog: { languages: [{ id: 'zh-CN', name: '简体中文' }] }, defaults: {}, initialDictionary: { Save: '保存' },
      loadBundled: async () => ({ Save: '保存' }), apply() {}
    });
    const select = doc.querySelector('[aria-label="Interface language"]');
    select.value = 'en'; select.dispatchEvent(new dom.window.Event('change'));
    assert.equal(doc.querySelector('h1').textContent, 'Translations');
    assert.equal(doc.querySelector('button').textContent, 'Apply & save');
    assert.equal(store.uiLanguage, 'en');
    editor.dispose();
    assert.equal(doc.querySelector('section'), null);
    assert.equal(host.style.position, 'static');
  } finally { globalThis.localStorage = oldStorage; dom.window.close(); }
});

test('Millennium popup navigation can leave and reopen Translations without an editor overlay remaining', async () => {
  const bootstrap = new JSDOM('<script src="https://steam.local/rioshi-plugin-translations/.millennium/Dist/index.js"></script>', { url: 'https://steam.local', runScripts: 'outside-only' });
  const popup = new JSDOM(`<div class="MillenniumSettings"><div><nav>
    <div id="/millennium/settings/general">General</div><div id="/settings/quickcss">Quick CSS</div><div id="/settings/themes">Themes</div>
    </nav><div class="OX7USkJ5dDP_icD00Gal6" style="position:static"></div></div></div>`, { url: 'https://steam.local', runScripts: 'outside-only' });
  const win = bootstrap.window;
  const visibleRoot = popup.window.document.querySelector('.MillenniumSettings');
  visibleRoot.getClientRects = () => [{}];
  win.g_PopupManager = { m_mapPopups: new Map([['main', { window: popup.window }]]), AddPopupCreatedCallback: () => ({ Unregister() {} }) };
  win.fetch = async () => new Response(JSON.stringify({ Save: '保存' }));
  win.MILLENNIUM_BACKEND_IPC = { postMessage() {} };
  win.eval(await readFile('.millennium/Dist/index.js', 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 650));
  try {
    for (let i = 0; i < 3; i++) {
      popup.window.document.querySelector('[data-rioshi-translation-settings="nav"]').click();
      assert.ok(popup.window.document.querySelector('[data-rioshi-translation-settings="editor"]'));
      popup.window.document.getElementById('/settings/themes').click();
      assert.equal(popup.window.document.querySelector('[data-rioshi-translation-settings="editor"]'), null);
    }
  } finally {
    win.PLUGIN_LIST['rioshi-plugin-translations'].cleanup(); bootstrap.window.close(); popup.window.close();
  }
});
