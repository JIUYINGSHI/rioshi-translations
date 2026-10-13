import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
const languages = ['zh-CN', 'es', 'fr', 'de', 'pt-BR', 'ja'];
const projects = await Promise.all((await readdir('catalog/projects')).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(`catalog/projects/${file}`, 'utf8'))));
const existing = {};
for (const language of languages) existing[language] = JSON.parse(await readFile(`locales/${language}.json`, 'utf8'));
const all = [...new Set(projects.flatMap(project => project.texts))].sort();
await mkdir('catalog/translations', { recursive: true });
const preserve = /https?:\/\/[^\s\]<>]+|%[A-Za-z_][A-Za-z_0-9]*%|%(?:\d+\$)?[sdif]|\$\{[^}]+\}|\{\{[^}]+\}\}|\{\d+\}|\[(?:\/?(?:i|b|u|c|code|url|color)(?:=[^\]]+)?)\]|<\/?[A-Za-z][^>]*>/g;
const protect = text => {
  const tokens = [];
  const value = text.replace(preserve, token => { const key = `ZXQPLACEHOLDER${tokens.length}QXZ`; tokens.push(token); return key; });
  return { value, restore(output) {
    for (let i = 0; i < tokens.length; i++) {
      const marker = `ZXQPLACEHOLDER${i}QXZ`;
      if (!output.includes(marker)) throw Error('Translation lost a protected placeholder');
      output = output.replaceAll(marker, tokens[i]);
    }
    return output;
  } };
};

// One-time public-text machine drafts. Never run this automatically in CI.
// Prefer upstream or previously authored translations before requesting a draft.
async function translateBatch(texts, language) {
  const protectedTexts = texts.map(protect);
  const source = protectedTexts.map((item, index) => `ZXQENTRY${index}QXZ\n${item.value}`).join('\n');
  const query = new URLSearchParams({ client: 'gtx', sl: 'en', tl: language === 'pt-BR' ? 'pt' : language, dt: 't', q: source });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Draft translation HTTP ${response.status}`);
  const result = await response.json();
  const output = result[0].map(segment => segment[0] || '').join('');
  const matches = [...output.matchAll(/ZXQENTRY\s*(\d+)\s*QXZ/g)];
  if (matches.length !== texts.length) throw Error('Translation batch separators changed');
  return Object.fromEntries(matches.map((match, position) => {
    const index = Number(match[1]);
    const end = matches[position + 1]?.index ?? output.length;
    return [texts[index], protectedTexts[index].restore(output.slice(match.index + match[0].length, end).trim())];
  }));
}

for (const language of languages) {
  let drafts = {};
  const cache = `catalog/translations/${language}.json`;
  try { drafts = JSON.parse(await readFile(cache, 'utf8')); } catch {}
  const native = {};
  for (const project of projects) Object.assign(native, project.native[language] || {});
  const known = { ...drafts, ...existing[language], ...native };
  const missing = all.filter(text => !Object.hasOwn(known, text));
  let batch = [], length = 0;
  const send = async () => {
    if (!batch.length) return;
    let output;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { output = await translateBatch(batch, language); break; }
      catch (error) {
        if (attempt === 2) {
          // Retry separately so one unusual string cannot lose an entire batch.
          output = {};
          for (const text of batch) {
            try { Object.assign(output, await translateBatch([text], language)); }
            catch (singleError) { console.warn(language, JSON.stringify(text), singleError.message); }
          }
          break;
        }
      }
    }
    Object.assign(drafts, output);
    await writeFile(cache, JSON.stringify(drafts, null, 2) + '\n');
    console.log(language, `${Object.keys(drafts).length}/${missing.length}`, 'draft entries cached');
    batch = []; length = 0;
  };
  if (process.argv.includes('--machine')) {
    for (const text of missing) {
      if (batch.length >= 24 || length + text.length > 2600) await send();
      batch.push(text); length += text.length;
    }
    await send();
  }
}
