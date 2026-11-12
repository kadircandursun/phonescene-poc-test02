#!/usr/bin/env node
/**
 * Native RVM matte service — no empty-background plate.
 * Works while phone/user moves. DirectML → CPU.
 *
 * Binary WS (LE):
 *   request:  [u32 w][u32 h][RGBA…]
 *   response: [u32 w][u32 h][u32 inferMs][alpha u8…]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MATTING_PORT || 8791);
const MODEL = path.resolve(__dirname, '../../../models/rvm/rvm_mobilenetv3_fp32.onnx');

class RvmEngine {
  session = null;
  provider = 'cpu';
  r1 = null;
  r2 = null;
  r3 = null;
  r4 = null;
  downsampleRatio = 0.25;

  async init() {
    if (!fs.existsSync(MODEL)) {
      throw new Error(`Missing ${MODEL} — run npm run matting:download`);
    }
    for (const [id, eps] of [
      ['dml', ['dml', 'cpu']],
      ['cpu', ['cpu']],
    ]) {
      try {
        this.session = await ort.InferenceSession.create(MODEL, {
          executionProviders: eps,
          graphOptimizationLevel: 'all',
        });
        this.provider = id;
        this.reset();
        return;
      } catch {
        /* next */
      }
    }
    throw new Error('RVM init failed');
  }

  reset() {
    this.r1 = this.r2 = this.r3 = this.r4 = null;
  }

  emptyR() {
    return new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
  }

  rgbaToNchw(rgba, w, h) {
    const plane = w * h;
    const f32 = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      const o = i * 4;
      f32[i] = rgba[o] / 255;
      f32[plane + i] = rgba[o + 1] / 255;
      f32[2 * plane + i] = rgba[o + 2] / 255;
    }
    return new ort.Tensor('float32', f32, [1, 3, h, w]);
  }

  async infer(rgba, w, h) {
    const src = this.rgbaToNchw(rgba, w, h);
    const t0 = performance.now();
    const out = await this.session.run({
      src,
      downsample_ratio: new ort.Tensor('float32', Float32Array.from([this.downsampleRatio]), [1]),
      r1i: this.r1 ?? this.emptyR(),
      r2i: this.r2 ?? this.emptyR(),
      r3i: this.r3 ?? this.emptyR(),
      r4i: this.r4 ?? this.emptyR(),
    });
    this.r1 = out.r1o;
    this.r2 = out.r2o;
    this.r3 = out.r3o;
    this.r4 = out.r4o;

    const pha = out.pha.data;
    const plane = w * h;
    const off = pha.length >= plane ? pha.length - plane : 0;
    const alpha = new Uint8Array(plane);
    for (let i = 0; i < plane; i++) {
      alpha[i] = Math.max(0, Math.min(255, Math.round(pha[off + i] * 255)));
    }
    return { alpha, inferMs: performance.now() - t0 };
  }
}

const engine = new RvmEngine();
await engine.init();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'rvm-matting',
        provider: engine.provider,
        emptyBgRequired: false,
      }),
    );
    return;
  }
  if (req.url === '/reset' && req.method === 'POST') {
    engine.reset();
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/matte' });
wss.on('connection', (ws) => {
  engine.reset();
  ws.on('message', async (data, isBinary) => {
    try {
      if (!isBinary) {
        const text = Buffer.from(data).toString('utf8');
        if (text === 'reset') engine.reset();
        return;
      }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length < 8) return;
      const w = buf.readUInt32LE(0);
      const h = buf.readUInt32LE(4);
      const need = 8 + w * h * 4;
      if (buf.length < need || w < 32 || h < 32 || w > 1280 || h > 1280) {
        ws.send(JSON.stringify({ type: 'error', message: 'bad frame' }));
        return;
      }
      const rgba = buf.subarray(8, need);
      const { alpha, inferMs } = await engine.infer(rgba, w, h);
      const out = Buffer.allocUnsafe(12 + alpha.length);
      out.writeUInt32LE(w, 0);
      out.writeUInt32LE(h, 4);
      out.writeUInt32LE(Math.round(inferMs), 8);
      Buffer.from(alpha.buffer, alpha.byteOffset, alpha.byteLength).copy(out, 12);
      ws.send(out, { binary: true });
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: String(error?.message || error) }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`RVM matting : http://127.0.0.1:${PORT}/health`);
  console.log(`Matte WS    : ws://127.0.0.1:${PORT}/matte`);
  console.log(`Provider    : ${engine.provider}`);
  console.log('No empty-bg plate — safe for moving phone/user');
});
