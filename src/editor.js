import { labels } from './ui-languages.js';
import { downloadLanguage, validateDictionary } from './translation-store.js';
import { createWebdavSync } from './webdav-sync.js';

const CONFIG_KEY = 'rioshi-plugin-translations:sync-config-v4';

export function mountEditor({ documentRef: doc, host, store, catalog, defaults, initialDictionary, loadBundled, apply }) {
  let ui = labels[store.uiLanguage];
  let config = {};
  try { config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { /* Use defaults. */ }
  let sync = null;
  let syncSignature = '';
  let disposed = false;
  let busy = false;
  let lastSaved = '';
  const root = doc.createElement('section');
  root.setAttribute('data-rioshi-translation-settings', 'editor');
  Object.assign(root.style, {
    position: 'absolute', inset: '0', zIndex: '20', display: 'flex', flexDirection: 'column',
    boxSizing: 'border-box', padding: '24px 30px', overflow: 'auto', background: '#1b1b1b', color: '#f5f7ff'
  });
  const originalPosition = host.style.position;
  const changedPosition = doc.defaultView.getComputedStyle(host).position === 'static';
  if (changedPosition) host.style.position = 'relative';
  const localized = [];
  function el(tag, parent, key) {
    const node = doc.createElement(tag);
    if (key) { node.textContent = ui[key]; localized.push([node, key]); }
    parent?.appendChild(node);
    return node;
  }
  function button(parent, key) {
    const node = el('button', parent, key);
    node.type = 'button';
    Object.assign(node.style, { minHeight: '32px', padding: '4px 12px', border: '1px solid #555', borderRadius: '4px', background: '#363636', color: '#fff', cursor: 'pointer', font: 'inherit' });
    return node;
  }
  function field(parent, key, value, type = 'text') {
    const label = el('label', parent);
    Object.assign(label.style, { display: 'flex', flexDirection: 'column', gap: '5px', flex: '1', minWidth: '140px' });
    el('span', label, key);
    const input = el('input', label);
    input.type = type;
    input.value = value || '';
    Object.assign(input.style, { padding: '7px', background: '#252525', color: '#fff', border: '1px solid #555', borderRadius: '4px', minWidth: '0' });
    return input;
  }
  function row(parent) {
    const node = el('div', parent);
    Object.assign(node.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' });
    return node;
  }
  const header = row(root);
  const title = el('h1', header, 'title');
  title.style.margin = '0';
  const uiSelect = el('select', header);
  uiSelect.setAttribute('aria-label', 'Interface language');
  Object.assign(uiSelect.style, { marginLeft: 'auto', background: '#363636', color: '#fff', padding: '7px', borderRadius: '4px' });
  for (const [value, text] of [['zh-CN', '简体中文'], ['en', 'English']]) {
    const option = el('option', uiSelect); option.value = value; option.textContent = text;
  }
  uiSelect.value = store.uiLanguage;
  const description = el('p', root, 'description');
  description.style.margin = '0 0 12px';
  const toolbar = row(root);
  const applyButton = button(toolbar, 'apply');
  const formatButton = button(toolbar, 'format');
  const restoreButton = button(toolbar, 'restore');
  const languageLabel = el('label', toolbar, 'language');
  languageLabel.style.marginLeft = 'auto';
  const language = el('select', toolbar);
  Object.assign(language.style, { background: '#363636', color: '#fff', padding: '7px' });
  for (const item of catalog.languages) {
    const option = el('option', language); option.value = item.id; option.textContent = item.name;
  }
  language.value = store.language;

  const downloadButton = button(toolbar, 'download');

  const dav = el('details', root);
  el('summary', dav, 'webdav').style.cursor = 'pointer';
  const davRow = row(dav);
  const url = field(davRow, 'url', config.url);
  const username = field(davRow, 'username', config.username);
  const password = field(davRow, 'password', config.password, 'password');
  const path = field(davRow, 'path', config.path || '/rioshi-translations.json');
  const rememberLabel = el('label', dav);
  const remember = el('input', rememberLabel); remember.type = 'checkbox'; remember.checked = Boolean(config.remember);
  el('span', rememberLabel, 'remember');
  const davButtons = row(dav);
  const checkButton = button(davButtons, 'check');
  const uploadButton = button(davButtons, 'upload');
  const pullButton = button(davButtons, 'pull');
  const forceButton = button(davButtons, 'force');
  el('p', dav, 'cors').style.fontSize = '12px';
  const status = el('div', root);
  Object.assign(status.style, { margin: '10px 0', minHeight: '18px', color: '#66c0f4', fontSize: '12px' });
  const box = el('div', root);
  Object.assign(box.style, { display: 'flex', flex: '1 0 260px', minHeight: '260px', overflow: 'hidden', border: '1px solid #444', borderRadius: '6px' });
  const gutter = el('pre', box);
  const textarea = el('textarea', box);
  textarea.wrap = 'off'; textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'Translation dictionary JSON');
  const font = '"Maple Mono Normal NF CN", Consolas, monospace';
  Object.assign(gutter.style, { margin: '0', padding: '14px 10px', width: '40px', flexShrink: '0', overflow: 'hidden', color: '#777', fontFamily: font, fontSize: '12px', lineHeight: '1.55', textAlign: 'right', userSelect: 'none' });
  Object.assign(textarea.style, { boxSizing: 'border-box', flex: '1', minWidth: '0', height: '100%', minHeight: '260px', padding: '14px', resize: 'none', outline: 'none', border: '0', background: '#121212', color: '#eee', fontFamily: font, fontSize: '12px', lineHeight: '1.55' });
  const lines = () => { gutter.textContent = Array.from({ length: textarea.value.split(/\r\n|\r|\n/).length }, (_, i) => i + 1).join('\n'); };
  const message = (text, error = false) => { if (!disposed) { status.textContent = text; status.style.color = error ? '#ff7b86' : '#66c0f4'; } };
  function showDictionary(dictionary) {
    textarea.value = JSON.stringify(dictionary || {}, null, 2); lastSaved = textarea.value; lines();
    message(ui.loaded + Object.keys(dictionary || {}).length);
    language.value = store.language;
  }
  function saveConfig() {
    const next = { url: url.value, username: username.value, path: path.value, remember: remember.checked };
    if (remember.checked) next.password = password.value;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  }
  function davClient() {
    const options = { url: url.value, username: username.value, password: password.value, path: path.value };
    const signature = JSON.stringify(options);
    if (!sync || signature !== syncSignature) { sync = createWebdavSync(options, store); syncSignature = signature; }
    saveConfig();
    return sync;
  }
  const allButtons = [applyButton, formatButton, restoreButton, downloadButton, checkButton, uploadButton, pullButton, forceButton];
  async function run(operation) {
    if (busy) return; busy = true; allButtons.forEach(node => { node.disabled = true; }); language.disabled = true;
    message(ui.working);
    try { await operation(); } catch (error) { message(ui.error + error.message, true); }
    finally { busy = false; allButtons.forEach(node => { node.disabled = false; }); language.disabled = false; }
  }
  const mayReplace = () => textarea.value === lastSaved || doc.defaultView.confirm(ui.dirty);
  textarea.addEventListener('input', lines);
  textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop; });
  uiSelect.addEventListener('change', () => {
    store.setUiLanguage(uiSelect.value); ui = labels[store.uiLanguage];
    for (const [node, key] of localized) node.textContent = ui[key];
    message(ui.loaded + Object.keys(store.getDictionary() || {}).length);
  });
  applyButton.addEventListener('click', () => run(async () => {
    const dictionary = validateDictionary(JSON.parse(textarea.value));
    store.saveDictionary(language.value, dictionary); apply(dictionary); showDictionary(dictionary); message(ui.done);
  }));
  formatButton.addEventListener('click', () => run(async () => {
    textarea.value = JSON.stringify(validateDictionary(JSON.parse(textarea.value)), null, 2); lines(); message(ui.success);
  }));
  restoreButton.addEventListener('click', () => run(async () => {
    if (!mayReplace()) return;
    const dictionary = await loadBundled(language.value);
    store.saveDictionary(language.value, dictionary); apply(dictionary); showDictionary(dictionary);
  }));
  language.addEventListener('change', () => run(async () => {
    if (!mayReplace()) { language.value = store.language; return; }
    const dictionary = store.getDictionary(language.value) || await loadBundled(language.value);
    store.saveDictionary(language.value, dictionary); apply(dictionary); showDictionary(dictionary);
  }));
  downloadButton.addEventListener('click', () => run(async () => {
    if (!mayReplace()) return;
    const selected = language.value;
    const dictionary = await downloadLanguage({ repository: defaults.repository, branch: defaults.branch, language: selected });
    if (disposed) return;
    saveConfig(); store.saveDictionary(selected, dictionary); apply(dictionary); showDictionary(dictionary); message(ui.success);
  }));
  checkButton.addEventListener('click', () => run(async () => { const result = await davClient().check(); message(result.exists ? ui.exists : ui.missing); }));
  const persistBundledIfNeeded = () => {
    if (!store.getDictionary()) store.saveDictionary(store.language, initialDictionary || {});
  };
  uploadButton.addEventListener('click', () => run(async () => {
    persistBundledIfNeeded(); await davClient().upload(); message(ui.success);
  }));
  forceButton.addEventListener('click', () => run(async () => {
    if (doc.defaultView.confirm(ui.confirmForce)) { persistBundledIfNeeded(); await davClient().upload(true); message(ui.success); }
  }));
  pullButton.addEventListener('click', () => run(async () => {
    if (!mayReplace() || !doc.defaultView.confirm(ui.confirmPull)) return;
    await davClient().download();
    const dictionary = store.getDictionary() || await loadBundled(store.language);
    apply(dictionary); showDictionary(dictionary);
    uiSelect.value = store.uiLanguage; ui = labels[store.uiLanguage];
    for (const [node, key] of localized) node.textContent = ui[key];
    message(ui.success);
  }));
  for (const input of [url, username, password, path, remember]) input.addEventListener('change', saveConfig);
  showDictionary(store.getDictionary() || initialDictionary);
  host.appendChild(root);
  return { overlay: root, dispose() {
    disposed = true; root.remove(); password.value = ''; sync = null;
    if (changedPosition && host.style.position === 'relative') host.style.position = originalPosition;
  } };
}
