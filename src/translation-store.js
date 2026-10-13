export const STATE_KEY = 'rioshi-plugin-translations:state-v4';
const LEGACY_KEY = 'rioshi-plugin-translations:editor-source';

export function validateDictionary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
  const entries = Object.entries(value);
  if (entries.length > 20000) throw new Error('Dictionary exceeds 20,000 entries');
  for (const [key, text] of entries) {
    if (!key || typeof text !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error('Dictionary entries must be source-text: translated-text strings');
    }
  }
  return Object.fromEntries(entries);
}

export function createTranslationStore(storage) {
  const initialLanguage = typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('zh') ? 'en' : 'zh-CN';
  let state = { version: 1, uiLanguage: initialLanguage, language: initialLanguage, dictionaries: {} };
  try {
    const saved = JSON.parse(storage.getItem(STATE_KEY) || 'null');
    if (saved?.version === 1) {
      state.uiLanguage = saved.uiLanguage === 'en' ? 'en' : 'zh-CN';
      state.language = typeof saved.language === 'string' ? saved.language : 'zh-CN';
      for (const [language, dictionary] of Object.entries(saved.dictionaries || {})) {
        state.dictionaries[language] = validateDictionary(dictionary);
      }
    } else {
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) {
        state.dictionaries['zh-CN'] = validateDictionary(JSON.parse(legacy));
        state.language = 'zh-CN';
      }
    }
  } catch { /* Invalid local state does not stop Steam startup. */ }
  const persist = () => storage.setItem(STATE_KEY, JSON.stringify(state));
  return {
    get uiLanguage() { return state.uiLanguage; },
    get language() { return state.language; },
    getDictionary(language = state.language) { return state.dictionaries[language]; },
    setUiLanguage(language) { state.uiLanguage = language === 'en' ? 'en' : 'zh-CN'; persist(); },
    saveDictionary(language, dictionary) {
      state.dictionaries[language] = validateDictionary(dictionary);
      state.language = language;
      persist();
    },
    resetDictionary() { delete state.dictionaries[state.language]; persist(); },
    exportSnapshot() { return JSON.parse(JSON.stringify(state)); },
    importSnapshot(snapshot) {
      if (snapshot?.version !== 1 || !snapshot.dictionaries || typeof snapshot.language !== 'string') {
        throw new Error('Unsupported sync file');
      }
      const dictionaries = {};
      for (const [language, dictionary] of Object.entries(snapshot.dictionaries)) {
        dictionaries[language] = validateDictionary(dictionary);
      }
      storage.setItem(`${STATE_KEY}:before-download`, JSON.stringify(state));
      state = { version: 1, uiLanguage: snapshot.uiLanguage === 'en' ? 'en' : 'zh-CN', language: snapshot.language, dictionaries };
      persist();
    }
  };
}

export function githubRawBase(repository, branch = 'main') {
  const match = repository.trim().match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!match || !branch.trim()) throw new Error('Use owner/repository or a GitHub repository URL');
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${encodeURIComponent(branch.trim())}/`;
}

export async function downloadLanguage({ repository, branch, language, fetcher = fetch }) {
  const base = githubRawBase(repository, branch);
  const response = await fetcher(`${base}locales/catalog.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`GitHub catalog: HTTP ${response.status}`);
  const catalog = await response.json();
  const item = catalog.languages?.find(item => item.id === language);
  if (!item || !/^locales\/[A-Za-z0-9-]+\.json$/.test(item.path)) throw new Error('Language is not available');
  const packResponse = await fetcher(base + item.path, { cache: 'no-store' });
  if (!packResponse.ok) throw new Error(`GitHub dictionary: HTTP ${packResponse.status}`);
  return validateDictionary(await packResponse.json());
}
