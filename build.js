#!/usr/bin/env node
import { build } from 'esbuild';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildProject() {
  console.log('Building frontend...');
  execSync('vite build', { stdio: 'inherit' });
  
  console.log('Building backend...');
  await build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    packages: 'external',
    format: 'esm',
    outdir: 'dist',
    define: {
      'import.meta.dirname': `"${path.join(__dirname, 'dist')}"`
    }
  });
  
  console.log('Build completed!');
}

buildProject().catch(console.error);