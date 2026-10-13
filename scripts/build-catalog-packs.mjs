import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('catalog/upstream.json', 'utf8'));
const catalog = JSON.parse(await readFile('locales/catalog.json', 'utf8'));
const projects = await Promise.all((await readdir('catalog/projects')).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(`catalog/projects/${file}`, 'utf8'))));
const corrections = JSON.parse(await readFile('catalog/corrections.json', 'utf8'));
const coverage = { generatedAt: new Date().toISOString(), catalogDate: manifest.fetchedAt, counts: manifest.counts, extractionLimitations: ['Static display text only; dynamic strings need runtime inspection.', 'Paid/promoted themes absent from official API are not part of the 26-item inventory.', 'Machine drafts are not human-reviewed.'], languages: {}, projects: [] };
await mkdir('catalog/packs', { recursive: true });
await mkdir('catalog/authored', { recursive: true });
for (const language of catalog.languages) {
  let authored;
  try { authored = JSON.parse(await readFile(`catalog/authored/${language.id}.json`, 'utf8')); }
  catch {
    authored = JSON.parse(await readFile(`locales/${language.id}.json`, 'utf8'));
    await writeFile(`catalog/authored/${language.id}.json`, JSON.stringify(authored, null, 2) + '\n');
  }
  let machine = {};
  try { machine = JSON.parse(await readFile(`catalog/translations/${language.id}.json`, 'utf8')); } catch {}
  const sourceKeys = [...new Set(projects.flatMap(project => project.texts))];
  const combined = language.id === 'en' ? Object.fromEntries(sourceKeys.map(key => [key, key])) : { ...machine, ...authored };
  let nativeCount = 0;
  for (const project of projects) {
    const native = project.native[language.id] || {};
    nativeCount += Object.keys(native).length;
    Object.assign(combined, native);
  }
  for (const key of sourceKeys) {
    if (/^(Arial|Ubuntu|Quicksand|Google Sans|Source Code Pro|Roboto|Montserrat|Inter|Gluten|Maple Mono NF CN)(?: \(default\))?$/.test(key)) combined[key] = key;
  }
  Object.assign(combined, corrections[language.id] || {});
  if (language.id === 'zh-CN') {
    for (const key of Object.keys(combined)) combined[key] = combined[key].replaceAll('图书馆', '库').replaceAll('大图片模式', '大屏幕模式');
  }
  await writeFile(`locales/${language.id}.json`, JSON.stringify(combined, null, 2) + '\n');
  const missing = sourceKeys.filter(key => !Object.hasOwn(combined, key));
  coverage.languages[language.id] = { extracted: sourceKeys.length, translated: sourceKeys.length - missing.length, missing, machineDrafts: Object.keys(machine).length, nativeEntries: nativeCount };
  language.entries = Object.keys(combined).length;
  language.status = missing.length ? 'partial-catalog-coverage' : language.id === 'en' ? 'source-text' : 'complete-extracted-text-with-machine-drafts';
  for (const project of projects) {
    const dictionary = Object.fromEntries(project.texts.filter(key => Object.hasOwn(combined, key)).map(key => [key, project.native[language.id]?.[key] || combined[key]]));
    await mkdir(`catalog/packs/${project.id}`, { recursive: true });
    await writeFile(`catalog/packs/${project.id}/${language.id}.json`, JSON.stringify(dictionary, null, 2) + '\n');
    let entry = coverage.projects.find(item => item.id === project.id);
    if (!entry) {
      entry = { id: project.id, name: project.name, kind: project.kind, repository: project.repository, revision: project.revision, extracted: project.texts.length, sourceError: project.error || null, languages: {} };
      coverage.projects.push(entry);
    }
    entry.languages[language.id] = { translated: Object.keys(dictionary).length, missing: project.texts.filter(key => !Object.hasOwn(dictionary, key)) };
  }
}
await writeFile('locales/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
await writeFile('catalog/coverage.json', JSON.stringify(coverage, null, 2) + '\n');
const lines = ['# Millennium catalog translation coverage', '', `Official inventory fetched: ${manifest.fetchedAt}`, '', `Themes: ${manifest.counts.themes}; plugins: ${manifest.counts.plugins}.`, '', 'Coverage counts refer to statically extracted display texts, not a claim that every runtime screen was inspected. Machine drafts require human review. Configuration IDs are not changed.', '', '| Project | Type | Extracted | zh-CN | es | fr | de | pt-BR | ja |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
for (const project of coverage.projects) lines.push(`| [${project.name.replaceAll('|', '\\|')}](https://github.com/${project.repository}) | ${project.kind} | ${project.extracted} | ${['zh-CN','es','fr','de','pt-BR','ja'].map(language => project.languages[language]?.translated || 0).join(' | ')} |`);
lines.push('', '## Per-language totals', '', ...Object.entries(coverage.languages).map(([language, data]) => `- ${language}: ${data.translated}/${data.extracted}, ${data.missing.length} missing; ${data.machineDrafts} machine draft entries.`));
await writeFile('catalog/COVERAGE.md', lines.join('\n') + '\n');
console.log(Object.fromEntries(Object.entries(coverage.languages).map(([language, data]) => [language, `${data.translated}/${data.extracted}`])));
