#!/usr/bin/env node
/** Download RVM MobileNetV3 ONNX into models/rvm/ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../models/rvm');
const outFile = path.join(outDir, 'rvm_mobilenetv3_fp32.onnx');
const url =
  process.env.RVM_MODEL_URL ||
  'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx';

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1_000_000) {
  console.log('Already present:', outFile);
  process.exit(0);
}

console.log('Downloading', url);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error('Download failed', res.status, res.statusText);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(outFile, buf);
console.log('Wrote', outFile, `(${(buf.length / 1e6).toFixed(1)} MB)`);
