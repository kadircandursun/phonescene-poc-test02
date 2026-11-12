#!/usr/bin/env node
/**
 * PhoneScene Windows app launcher (no Tauri):
 * 1) ensure RVM model
 * 2) RVM matting service (DirectML→CPU) — no empty-bg plate
 * 3) signaling + Receiver/Companion
 * Phone Vision alpha (when iOS rebuilt) overrides RVM at runtime.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8787';
const mattingPort = process.env.MATTING_PORT || '8791';
const rvmModel = path.join(root, 'models', 'rvm', 'rvm_mobilenetv3_fp32.onnx');
const children = [];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: root, ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function start(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

async function main() {
  if (!existsSync(path.join(root, 'dist', 'desktop', 'index.html'))) {
    console.log('Building client…');
    await run('npm', ['run', 'build']);
  }
  if (!existsSync(rvmModel)) {
    console.log('Downloading RVM model…');
    await run('npm', ['run', 'matting:download']);
  }

  console.log('Starting RVM matting (no empty-bg)…');
  start('node', ['apps/windows/matting-native/server.mjs'], { MATTING_PORT: String(mattingPort) });

  await new Promise((r) => setTimeout(r, 1500));

  console.log('Starting PhoneScene server…');
  start('npx', ['tsx', 'server/index.ts'], { PORT: String(port), PAIR_CODE: process.env.PAIR_CODE || '482915' });

  setTimeout(() => {
    const companion = `http://127.0.0.1:${port}/companion/`;
    const desktop = `http://127.0.0.1:${port}/desktop/`;
    spawn('cmd', ['/c', 'start', '', companion], { shell: true, stdio: 'ignore' });
    setTimeout(() => spawn('cmd', ['/c', 'start', '', desktop], { shell: true, stdio: 'ignore' }), 600);
    console.log(`Companion : ${companion}`);
    console.log(`Receiver  : ${desktop}`);
    console.log(`RVM health: http://127.0.0.1:${mattingPort}/health`);
    console.log('Cutout: phone Vision alpha (if rebuilt) → else RVM+person gate — move freely');
  }, 1400);

  const shutdown = () => {
    for (const c of children) {
      try {
        c.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
