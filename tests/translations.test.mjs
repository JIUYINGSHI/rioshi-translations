import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { createTranslationStore, downloadLanguage } from '../src/translation-store.js';
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
    assert.equal(doc.querySelector('input[type="password"]'), null);
    assert.equal(doc.querySelector('details'), null);
    assert.equal(store.uiLanguage, 'en');
    editor.dispose();
    assert.equal(doc.querySelector('section'), null);
    assert.equal(host.style.position, 'static');
  } finally { globalThis.localStorage = oldStorage; dom.window.close(); }
});

test('download and apply uses the fixed repository with no source fields or legacy overrides', async () => {
  const dom = new JSDOM('<div id="host" style="position:static"></div>', { url: 'https://steam.local' });
  const oldStorage = globalThis.localStorage;
  const oldFetch = globalThis.fetch;
  globalThis.localStorage = dom.window.localStorage;
  dom.window.localStorage.setItem('rioshi-plugin-translations:sync-config-v4', JSON.stringify({ repository: 'wrong/repo', branch: 'wrong' }));
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return new Response(JSON.stringify(url.endsWith('catalog.json')
      ? { languages: [{ id: 'fr', path: 'locales/fr.json' }] } : { Save: 'Enregistrer' }));
  };
  let editor;
  try {
    const store = createTranslationStore(dom.window.localStorage);
    store.setUiLanguage('en'); store.saveDictionary('fr', { Save: 'Old text' });
    editor = mountEditor({ documentRef: dom.window.document, host: dom.window.document.getElementById('host'), store,
      catalog: { languages: [{ id: 'fr', name: 'Français' }] },
      defaults: { repository: 'JIUYINGSHI/rioshi-translations', branch: 'main' },
      loadBundled: async () => ({}), apply() {}
    });
    assert.equal(Array.from(dom.window.document.querySelectorAll('label')).some(label => ['Repository', 'Branch'].includes(label.textContent)), false);
    Array.from(dom.window.document.querySelectorAll('button')).find(button => button.textContent === 'Download & apply').click();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(requests[0], 'https://raw.githubusercontent.com/JIUYINGSHI/rioshi-translations/main/locales/catalog.json');
    assert.deepEqual(store.getDictionary(), { Save: 'Enregistrer' });
  } finally {
    editor?.dispose(); globalThis.localStorage = oldStorage; globalThis.fetch = oldFetch; dom.window.close();
  }
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
