// @ts-ignore Node types are intentionally not required by this tiny package.
import fs from 'node:fs';
// @ts-ignore Node types are intentionally not required by this tiny package.
import path from 'node:path';
// @ts-ignore Node types are intentionally not required by this tiny package.
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { compile } from './src/index.js';

const pageDir = path.resolve('example/page');
const distDir = path.resolve('example/dist');
fs.mkdirSync(distDir, { recursive: true });

const sources = fs.readdirSync(pageDir)
  .filter((file: string) => file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.matra'))
  .filter((file: string, _index: number, files: string[]) => {
    if (!file.endsWith('.js')) return true;
    return !files.includes(file.replace(/\.js$/, '.ts'));
  });

for (const file of sources) {
  const name = file.replace(/\.(ts|js|matra)$/, '');
  const outputPath = path.join(distDir, `${name}.svg`);

  if (file.endsWith('.matra')) {
    const source = fs.readFileSync(path.join(pageDir, file), 'utf8');
    fs.writeFileSync(outputPath, `${compile(source)}\n`, 'utf8');
    console.log(`Built: ${path.relative(process.cwd(), outputPath)}`);
    continue;
  }

  const temporaryModule = path.join(distDir, `.${name}.mjs`);

  try {
    esbuild.buildSync({
      entryPoints: [path.join(pageDir, file)],
      outfile: temporaryModule,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: ['es2022'],
    });

    const pageModule = await import(`${pathToFileURL(temporaryModule).href}?time=${Date.now()}`);
    if (typeof pageModule.default !== 'string') {
      throw new TypeError(`${file} must export an SVG string as its default export`);
    }

    fs.writeFileSync(outputPath, `${pageModule.default}\n`, 'utf8');
    // @ts-ignore Node types are intentionally not required by this tiny package.
    console.log(`Built: ${path.relative(process.cwd(), outputPath)}`);
  } finally {
    if (fs.existsSync(temporaryModule)) fs.unlinkSync(temporaryModule);
  }
}
