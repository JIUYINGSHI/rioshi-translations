import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { parse } from '@babel/parser';
import { JSDOM } from 'jsdom';

const sources = { themes: 'https://steambrew.app/api/v2', plugins: 'https://steambrew.app/api/v1/plugins/' };
const fetchJson = async url => { const response = await fetch(url); if (!response.ok) throw Error(`${url}: ${response.status}`); return response.json(); };
const sha = text => createHash('sha256').update(text).digest('hex');
const snapshot = { fetchedAt: new Date().toISOString(), sources, projects: [] };
await mkdir('.cache', { recursive: true });
await mkdir('catalog/projects', { recursive: true });
const themes = await fetchJson(sources.themes);
const plugins = await fetchJson(sources.plugins);
await writeFile('.cache/official-themes.json', JSON.stringify(themes, null, 2));
await writeFile('.cache/official-plugins.json', JSON.stringify(plugins, null, 2));

function collectTheme(skin) {
  const text = new Set();
  const add = value => { if (typeof value === 'string' && /[a-z]/i.test(value) && !/^https?:\/\/\S+$/.test(value)) text.add(value); };
  add(skin.description);
  for (const [key, option] of Object.entries(skin.Conditions || {})) {
    add(key); add(option.description); add(option.tab); add(option.section);
    for (const value of Object.keys(option.values || {})) add(value);
  }
  for (const [key, color] of Object.entries(skin.RootColors || {})) {
    if (typeof color !== 'object') continue;
    add(key); add(color.name); add(color.description);
  }
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['Name', 'ToolTip', 'Label', 'Description', 'name', 'description', 'label', 'tooltip'].includes(key)) add(child);
      else walk(child);
    }
  };
  walk(skin.Configuration);
  return text;
}

const uiProperties = new Set(['label', 'title', 'description', 'strTitle', 'strDescription', 'placeholder', 'tooltip', 'text', 'strLabel', 'strButtonText', 'strOKButtonText', 'strCancelButtonText']);
function sourceStrings(text, filename) {
  const strings = new Set();
  const native = {};
  const languages = { english: 'en', en: 'en', schinese: 'zh-CN', 'zh-CN': 'zh-CN', spanish: 'es', french: 'fr', german: 'de', brazilian: 'pt-BR', japanese: 'ja' };
  const literal = node => {
    if (node?.type === 'StringLiteral') return node.value;
    if (node?.type === 'ObjectExpression') return Object.fromEntries(node.properties.filter(prop => prop.type === 'ObjectProperty').map(prop => [prop.key.name || prop.key.value, literal(prop.value)]));
    return undefined;
  };
  const add = value => {
    if (typeof value === 'string' && value.trim() && /[a-zA-Z]/.test(value) && !/^(?:https?:|#|steam:|_[\w-]{15})/.test(value)) strings.add(value.trim());
  };
  try {
    const ast = parse(text, { sourceType: 'unambiguous', errorRecovery: true, plugins: ['typescript', 'jsx'] });
    function visit(node, parent) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'JSXText') add(node.value.replace(/\s+/g, ' '));
      if (node.type === 'ObjectExpression') {
        const value = literal(node);
        const english = value.english || value.en;
        if (english && typeof english === 'object') {
          const source = flatten(english);
          for (const text of Object.values(source)) add(text);
          for (const [key, target] of Object.entries(value)) {
            const language = languages[key];
            if (!language || language === 'en' || !target || typeof target !== 'object') continue;
            const translated = flatten(target);
            native[language] ||= {};
            for (const [key, text] of Object.entries(source)) if (translated[key]) native[language][text] = translated[key];
          }
        }
      }
      if (node.type === 'StringLiteral') {
        const key = parent?.key?.name || parent?.key?.value || parent?.name?.name;
        if (uiProperties.has(key)) add(node.value);
        if (parent?.type === 'JSXExpressionContainer') add(node.value);
        if (parent?.type === 'CallExpression' && ['createElement', 'jsx', 'jsxs'].includes(parent.callee?.property?.name || parent.callee?.name)) {
          if (parent.arguments?.indexOf(node) >= 2) add(node.value);
        }
      }
      if (node.type === 'TemplateLiteral' && !node.expressions.length && uiProperties.has(parent?.key?.name || parent?.key?.value)) add(node.quasis[0].value.cooked);
      for (const [key, child] of Object.entries(node)) {
        if (['loc', 'start', 'end', 'errors', 'comments'].includes(key)) continue;
        if (Array.isArray(child)) for (const value of child) visit(value, node);
        else if (child && typeof child === 'object') visit(child, node);
      }
    }
    visit(ast, null);
  } catch { /* Parser limitations are recorded via project source availability. */ }
  return { strings, native };
}

function flatten(value, prefix = '', output = {}) {
  if (typeof value === 'string') output[prefix] = value;
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

async function collectPlugin(item) {
  const owner = item.repoOwner, repo = item.repoName;
  const id = `plugin-${owner}-${repo}`;
  const revision = item.commitId || 'HEAD';
  const project = { id, kind: 'plugin', name: item.pluginJson?.common_name || repo, repository: `${owner}/${repo}`, revision, texts: [], native: {}, extraction: 'manifest-and-static-ui' };
  const texts = new Set();
  const add = value => { if (typeof value === 'string' && /[a-z]/i.test(value) && !/^https?:\/\/\S+$/.test(value)) texts.add(value); };
  add(item.pluginJson?.common_name); add(item.pluginJson?.description);
  try {
    const url = `https://codeload.github.com/${owner}/${repo}/zip/${revision}`;
    const cache = `.cache/${id}-${revision}.zip`;
    let buffer;
    try { buffer = await readFile(cache); } catch {
      const response = await fetch(url);
      if (!response.ok) throw Error(`Archive HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(cache, buffer);
    }
    const archive = new AdmZip(buffer);
    const localeFiles = [];
    for (const entry of archive.getEntries()) {
      if (entry.isDirectory || entry.header.size > 3_000_000 || /(?:node_modules|vendor|\.git|package-lock|yarn\.lock|dist\/vendor)/.test(entry.entryName)) continue;
      const name = entry.entryName;
      if (/\.(?:html|htm)$/.test(name) && /(?:template|widget|frontend|webkit)/i.test(name)) {
        const fragment = JSDOM.fragment(entry.getData().toString('utf8'));
        const walk = fragment.ownerDocument.createTreeWalker(fragment, 4);
        let node;
        while ((node = walk.nextNode())) {
          if (!['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName)) {
            const value = node.nodeValue.trim();
            if (!/\{\{/.test(value)) add(value.replace(/\s+/g, ' '));
          }
        }
        for (const element of fragment.querySelectorAll('[title],[placeholder],[aria-label]')) {
          for (const attribute of ['title', 'placeholder', 'aria-label']) add(element.getAttribute(attribute));
        }
      }
      if (/\.(?:tsx?|jsx?)$/.test(name) && !/(?:test|spec)\./.test(name)) {
        const extracted = sourceStrings(entry.getData().toString('utf8'), name);
        for (const value of extracted.strings) texts.add(value);
        for (const [language, dictionary] of Object.entries(extracted.native)) {
          Object.assign(project.native[language] ||= {}, dictionary);
        }
      }
      if (/\.json$/.test(name) && /(?:locales?|i18n|translations?|lang)/i.test(name)) {
        try { localeFiles.push({ name, data: flatten(JSON.parse(entry.getData().toString('utf8'))) }); } catch {}
      }
      if (/(?:settings|config).*\.json$/.test(name)) {
        try {
          const config = JSON.parse(entry.getData().toString('utf8'));
          const walk = value => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (uiProperties.has(key)) add(child); else walk(child); } };
          walk(config);
        } catch {}
      }
    }
    const english = localeFiles.filter(file => /(?:^|\/)(?:en(?:[-_]US)?|english)(?:\/|\.)/i.test(file.name));
    const codes = { 'zh-CN': /(?:schinese|zh[-_]CN|zh[-_]Hans|simplified.chinese)/i, es: /(?:spanish|es(?:[-_]ES)?)(?:\.|\/)/i, fr: /(?:french|fr(?:[-_]FR)?)(?:\.|\/)/i, de: /(?:german|de(?:[-_]DE)?)(?:\.|\/)/i, 'pt-BR': /(?:brazilian|pt[-_]BR|portuguese)(?:\.|\/)/i, ja: /(?:japanese|ja(?:[-_]JP)?)(?:\.|\/)/i };
    for (const source of english) {
      for (const value of Object.values(source.data)) add(value);
      const baseName = source.name.split('/').at(-1);
      for (const [language, pattern] of Object.entries(codes)) {
        for (const target of localeFiles.filter(file => pattern.test(file.name))) {
          if (english.length > 1 && baseName !== target.name.split('/').at(-1) && !/^(?:en|english)\./.test(baseName)) continue;
          project.native[language] ||= {};
          for (const [key, value] of Object.entries(source.data)) {
            if (target.data[key] && typeof target.data[key] === 'string') project.native[language][value] = target.data[key];
          }
        }
      }
    }
    project.archive = { url, sha256: sha(buffer), localeFiles: localeFiles.map(file => file.name) };
  } catch (error) { project.error = error.message; }
  project.texts = [...texts].filter(value => !/^https?:\/\/\S+$/.test(value)).sort();
  await writeFile(`catalog/projects/${id}.json`, JSON.stringify(project, null, 2) + '\n');
  console.log(id, project.texts.length, project.error || 'ok');
  return project;
}

for (const item of themes) {
  const skin = typeof item.skin_data === 'string' ? JSON.parse(item.skin_data) : item.skin_data;
  const github = item.data?.github || skin?.github || {};
  const owner = github.owner || 'unknown', repo = github.repo || github.repo_name || item.id || 'unknown';
  const project = { id: `theme-${owner}-${repo}`, kind: 'theme', name: skin?.name || repo, repository: `${owner}/${repo}`, revision: item.commit_data?.oid || null, texts: [...collectTheme(skin || {})].sort(), native: {}, extraction: 'official-skin-config', source: sources.themes };
  if (typeof skin?.RootColors === 'string') {
    const path = skin.RootColors.replace(/^\.\//, '');
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${project.revision || 'HEAD'}/${path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const css = await response.text();
      const texts = new Set(project.texts);
      for (const match of css.matchAll(/\/\*([^*]{1,100})\*\//g)) {
        const label = match[1].trim();
        if (/[a-z]/i.test(label) && !/[\r\n]/.test(label) && !/(?:copyright|license|https?:|TODO|import|do not|entry|hit-testing)/i.test(label)) texts.add(label);
      }
      project.texts = [...texts].sort();
      project.rootColorSource = { url, sha256: sha(css) };
    } catch (error) { project.rootColorError = error.message; }
  }
  await writeFile(`catalog/projects/${project.id}.json`, JSON.stringify(project, null, 2) + '\n');
  snapshot.projects.push({ ...project, texts: undefined, native: undefined, extracted: project.texts.length });
}
for (let index = 0; index < plugins.length; index += 4) {
  const projects = await Promise.all(plugins.slice(index, index + 4).map(collectPlugin));
  for (const project of projects) snapshot.projects.push({ ...project, texts: undefined, native: undefined, extracted: project.texts.length });
}
snapshot.counts = { themes: themes.length, plugins: plugins.length, extracted: snapshot.projects.reduce((sum, project) => sum + project.extracted, 0) };
await writeFile('catalog/upstream.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(snapshot.counts);
