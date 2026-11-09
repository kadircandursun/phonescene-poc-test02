#!/usr/bin/env node
/**
 * Windows Companion launcher (Phase 1 without Tauri/Rust).
 * Builds if needed, starts the PhoneScene server, opens Companion + Receiver.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8787';
const distDesktop = path.join(root, 'dist', 'desktop', 'index.html');
const distCompanion = path.join(root, 'dist', 'companion', 'index.html');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, cwd: root, ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  if (!existsSync(distDesktop) || !existsSync(distCompanion)) {
    console.log('Building client…');
    await run('npm', ['run', 'build']);
  }

  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  const openSoon = () => {
    const companion = `http://127.0.0.1:${port}/companion/`;
    const desktop = `http://127.0.0.1:${port}/desktop/`;
    spawn('cmd', ['/c', 'start', '', companion], { shell: true, stdio: 'ignore' });
    setTimeout(() => {
      spawn('cmd', ['/c', 'start', '', desktop], { shell: true, stdio: 'ignore' });
    }, 700);
    console.log(`Companion: ${companion}`);
    console.log(`Receiver : ${desktop}`);
  };

  setTimeout(openSoon, 1200);

  const shutdown = () => {
    server.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
