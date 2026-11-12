#!/usr/bin/env node
/** Smoke: load RVM with DirectML→CPU and print session info. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const model = path.resolve(__dirname, '../../../models/rvm/rvm_mobilenetv3_fp32.onnx');

if (!fs.existsSync(model)) {
  console.error('Missing model. Run: npm run matting:download');
  process.exit(1);
}

const attempts = [
  { name: 'DML', eps: ['dml', 'cpu'] },
  { name: 'CPU', eps: ['cpu'] },
];

for (const a of attempts) {
  try {
    const session = await ort.InferenceSession.create(model, {
      executionProviders: a.eps,
      graphOptimizationLevel: 'all',
    });
    console.log('PASS provider=', a.name);
    console.log('inputs=', session.inputNames);
    console.log('outputs=', session.outputNames);
    process.exit(0);
  } catch (e) {
    console.warn('FAIL', a.name, String(e.message || e).slice(0, 200));
  }
}
console.error('All providers failed');
process.exit(1);
