import * as esbuild from 'esbuild';
import { rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: watch,
  minify: false,
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  await rm('dist/extension.js.map', { force: true });
  console.log('Build complete.');
}
