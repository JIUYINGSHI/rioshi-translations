import { build } from 'esbuild';
await build({
  entryPoints: ['src/runtime.js'],
  outfile: '.millennium/Dist/index.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome100',
  legalComments: 'eof',
  banner: { js: 'const MILLENNIUM_IS_CLIENT_MODULE = true;' }
});
