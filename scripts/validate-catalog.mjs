import { readFile, readdir } from 'node:fs/promises';
import { validateDictionary } from '../src/translation-store.js';
const catalog = JSON.parse(await readFile('locales/catalog.json', 'utf8'));
const projects = await Promise.all((await readdir('catalog/projects')).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(`catalog/projects/${file}`, 'utf8'))));
const tokenPattern = /%[A-Za-z_][A-Za-z_0-9]*%|%(?:\d+\$)?[sdif]|\$\{[^}]+\}|\{\{[^}]+\}\}|\{\d+\}|\[(?:\/?(?:i|b|u|c|code|url|color)(?:=[^\]]+)?)\]/g;
const issues = [];
const sourceKeys = [...new Set(projects.flatMap(project => project.texts))];
for (const language of catalog.languages) {
  const dictionary = validateDictionary(JSON.parse(await readFile(language.path, 'utf8')));
  for (const source of sourceKeys) {
    if (!Object.hasOwn(dictionary, source)) { issues.push({ language: language.id, source, error: 'missing' }); continue; }
    const expected = (source.match(tokenPattern) || []).sort();
    const actual = (dictionary[source].match(tokenPattern) || []).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) issues.push({ language: language.id, source, error: 'placeholder mismatch', expected, actual });
  }
}
for (const issue of issues) console.log(JSON.stringify(issue));
if (issues.length) { console.log(`${issues.length} catalog issues`); process.exitCode = 1; }
else console.log(`${projects.length} projects; ${sourceKeys.length} unique extracted texts; ${catalog.languages.length} language packs validated`);
