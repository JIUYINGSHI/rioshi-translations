import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
// Explicit staging path; no local config, credentials, dependencies or backups.
const destination = path.resolve('release/rioshi-plugin-translations');
await mkdir(destination, { recursive: true });
for (const name of ['plugin.json', 'translations.json', 'remote-config.json', 'README.md', 'THIRD-PARTY-NOTICES.md', 'locales', '.millennium']) {
  await cp(name, path.join(destination, name), { recursive: true });
}
console.log(destination);
