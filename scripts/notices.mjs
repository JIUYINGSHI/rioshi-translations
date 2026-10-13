import { readFile, readdir, writeFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
let output = '# Third-party notices\n\nRuntime dependencies bundled by esbuild.\n';
for (const [directory, metadata] of Object.entries(lock.packages)) {
  if (!directory || metadata.dev || !directory.startsWith('node_modules/')) continue;
  const pkg = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'));
  const candidates = (await readdir(directory)).filter(name => /^licen[sc]e(?:\.|$)/i.test(name));
  output += `\n## ${pkg.name} ${pkg.version}\n\nLicense: ${pkg.license || 'See package license'}\n\n`;
  if (candidates.length) output += await readFile(`${directory}/${candidates[0]}`, 'utf8');
}
await writeFile('THIRD-PARTY-NOTICES.md', output);
