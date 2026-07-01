// @ts-ignore
import fs from 'fs';
// @ts-ignore
import path from 'path';

import esbuild from 'esbuild';

const pageDir = path.resolve('./page');

for (const file of fs.readdirSync(pageDir)) {
  if (file.endsWith('.ts')) {
    const tsFilePath = path.join(pageDir, file);
    const jsFilePath = tsFilePath.replace(/\.ts$/, '.js');

    // Transpile TypeScript to JavaScript using esbuild
    esbuild.buildSync({
      entryPoints: [tsFilePath],
      outfile: jsFilePath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['es2024'],
    });
  }

  const jsFilePath = path.join(pageDir, file.replace(/\.ts$/, '.js'));
  if (fs.existsSync(jsFilePath)) {
    const kamiPageModule = await import(jsFilePath);
    const kamiPage = kamiPageModule.default;

    const distDir = path.resolve('./dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    const buildDir = path.resolve(distDir);
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    const outputPath = path.join(buildDir, file.replace(/\.ts$|\.js$/, '.svg'));
    fs.writeFileSync(outputPath, kamiPage, 'utf-8');
    console.log(`Built: ${outputPath}`);
  }
}
