import { attachOrientationListener, requestOrientationPermission } from '../shared/sensors';
import { loadPairCode } from '../shared/session';
import type { SensorPayload } from '../shared/types';
import { $, measureVideoFps, renderAngles, setStatus, setText } from '../shared/ui';
import { PhoneScenePeer, wsUrl } from '../shared/webrtc';

declare global {
  interface Window {
    __PS_READY__?: boolean;
  }
}
window.__PS_READY__ = true;

const codeInput = $('code') as HTMLInputElement;
const connectBtn = $('connect') as HTMLButtonElement;
const disconnectBtn = $('disconnect') as HTMLButtonElement;
const preview = $('preview') as HTMLVideoElement;
const sensorWarning = $('sensorWarning');

let ws: WebSocket | null = null;
let peer: PhoneScenePeer | null = null;
let localStream: MediaStream | null = null;
let stopFps: (() => void) | null = null;
let stopSensors: (() => void) | null = null;
let dataOpen = false;
let connecting = false;

function setPill(id: string, text: string, state: string) {
  const el = $(id);
  el.textContent = text;
  el.dataset.state = state;
}

function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

function cleanupPeer() {
  peer?.close();
  peer = null;
  dataOpen = false;
}

function cleanupMedia() {
  stopFps?.();
  stopFps = null;
  stopSensors?.();
  stopSensors = null;
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  preview.srcObject = null;
  setText('fps', '—');
  setText('resolution', '—');
  setPill('camState', 'Kamera: kapalı', 'idle');
}

function disconnect(reason = 'Bağlantı kesildi.') {
  connecting = false;
  try {
    ws?.send(JSON.stringify({ type: 'bye' }));
  } catch {
    /* ignore */
  }
  ws?.close();
  ws = null;
  cleanupPeer();
  cleanupMedia();
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  setPill('pcState', 'PC: bekleniyor', 'idle');
  setStatus('status', reason, 'warn');
}

function createPeer() {
  cleanupPeer();
  if (!localStream) return null;

  peer = new PhoneScenePeer('mobile', {
    onConnectionState: (state) => {
      setStatus('status', `WebRTC: ${state}`, state === 'failed' || state === 'disconnected' ? 'error' : 'ok');
      if (state === 'failed' || state === 'disconnected') {
        setPill('pcState', `PC: ${state}`, 'error');
      }
      if (state === 'connected') setPill('pcState', 'PC: bağlı', 'connected');
    },
    onLocalIce: (candidate) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice', candidate }));
      }
    },
    onDataOpen: () => {
      dataOpen = true;
      setStatus('status', 'DataChannel açık — sensörler PC’ye gidiyor.', 'ok');
    },
    onDataClose: () => {
      dataOpen = false;
    },
  });

  peer.addLocalStream(localStream);
  peer.ensureOutgoingDataChannel();
  return peer;
}

async function handleSignal(raw: MessageEvent) {
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(String(raw.data)) as Record<string, unknown>;
  } catch {
    return;
  }

  const type = String(message.type || '');

  if (type === 'joined') {
    setStatus('status', 'Eşleştirme OK. Windows alıcısı bekleniyor…', 'ok');
    setPill('pcState', 'PC: bekleniyor', 'connecting');
    return;
  }

  if (type === 'peer-ready') {
    setPill('pcState', 'PC: hazır', 'connecting');
    setStatus('status', 'PC hazır. WebRTC offer gönderiliyor…', 'ok');
    const p = createPeer();
    if (p && ws) await p.createAndSendOffer((msg) => ws!.send(JSON.stringify(msg)));
    return;
  }

  if (type === 'peer-left') {
    cleanupPeer();
    setPill('pcState', 'PC: ayrıldı', 'disconnected');
    setStatus('status', 'Windows alıcısı ayrıldı. Yeniden bağlanmayı deneyin.', 'error');
    return;
  }

  if (type === 'answer' && peer && message.sdp) {
    await peer.handleAnswer(message.sdp as RTCSessionDescriptionInit);
    return;
  }

  if (type === 'ice' && peer && message.candidate) {
    await peer.handleIce(message.candidate as RTCIceCandidateInit);
    return;
  }

  if (type === 'error') {
    setStatus('status', `Sunucu: ${String(message.message || 'hata')}`, 'error');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    connecting = false;
  }
}

async function startCamera(): Promise<MediaStream> {
  setPill('camState', 'Kamera: isteniyor', 'connecting');
  setStatus('status', 'Kamera izni isteniyor… (Safari diyaloğunu onaylayın)', 'ok');

  // Prefer 720p; fall back gradually so iOS Safari still opens the camera.
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
    },
    {
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: { facingMode: 'user' } },
    { audio: false, video: true },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream = stream;
      preview.srcObject = stream;
      await preview.play().catch(() => undefined);

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          });
        } catch {
          /* device may ignore; keep whatever we got */
        }
      }

      const settings = track?.getSettings() || {};
      const w = preview.videoWidth || settings.width;
      const h = preview.videoHeight || settings.height;
      setText('resolution', w && h ? `${w}×${h}` : '—');
      setPill('camState', 'Kamera: açık', 'granted');

      stopFps?.();
      stopFps = measureVideoFps(preview, (fps) => setText('fps', String(fps)));
      return stream;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function startSensors(permission: Awaited<ReturnType<typeof requestOrientationPermission>>) {
  stopSensors?.();
  if (permission === 'denied' || permission === 'unsupported') {
    setPill('sensorState', `Sensör: ${permission}`, permission === 'denied' ? 'denied' : 'warn');
    sensorWarning.classList.add('show');
    return;
  }

  setPill('sensorState', 'Sensör: aktif', 'granted');
  sensorWarning.classList.remove('show');
  stopSensors = attachOrientationListener((payload: SensorPayload) => {
    renderAngles('alpha', 'beta', 'gamma', payload.alpha, payload.beta, payload.gamma);
    if (dataOpen && peer) peer.sendData(payload);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} zaman aşımı (${ms / 1000}sn)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function connect() {
  if (connecting) return;

  const code = normalizeCode(codeInput.value);
  codeInput.value = code;

  if (!/^\d{6}$/.test(code)) {
    setStatus('status', '6 haneli eşleştirme kodunu girin (ör. 482915).', 'warn');
    return;
  }

  if (!window.isSecureContext) {
    setStatus(
      'status',
      'Güvenli bağlam yok. Telefonda https://….trycloudflare.com/mobile/ adresini açın.',
      'error',
    );
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('status', 'Bu tarayıcı kamera API desteklemiyor.', 'error');
    return;
  }

  connecting = true;
  connectBtn.disabled = true;
  disconnectBtn.disabled = false;
  setStatus('status', 'Bağlanılıyor… kamera ve sensör izni istenecek.', 'ok');
  setPill('sensorState', 'Sensör: isteniyor', 'connecting');

  // Must start inside the same user-gesture turn (no await before these calls).
  const sensorPermissionPromise = requestOrientationPermission().catch(() => 'denied' as const);
  const cameraPromise = startCamera();

  // Never block video on the iOS motion sheet — race with a short timeout.
  void withTimeout(sensorPermissionPromise, 12000, 'Sensör izni')
    .then((permission) => startSensors(permission))
    .catch(() => {
      setPill('sensorState', 'Sensör: zaman aşımı', 'warn');
      sensorWarning.classList.add('show');
    });

  try {
    await withTimeout(cameraPromise, 25000, 'Kamera');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPill('camState', 'Kamera: hata', 'error');
    disconnect(`Kamera hatası: ${message}`);
    return;
  }

  setStatus('status', `Sinyale bağlanılıyor… ${wsUrl()}`, 'ok');

  try {
    ws = new WebSocket(wsUrl());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    disconnect(`WebSocket açılamadı: ${message}`);
    return;
  }

  const wsOpenTimeout = window.setTimeout(() => {
    if (ws && ws.readyState !== WebSocket.OPEN) {
      disconnect('Sinyal zaman aşımı. Tunnel ve sunucunun açık olduğundan emin olun.');
    }
  }, 12000);

  ws.onopen = () => {
    clearTimeout(wsOpenTimeout);
    setStatus('status', 'Sinyal açık, eşleştirme gönderiliyor…', 'ok');
    ws?.send(JSON.stringify({ type: 'join', code, role: 'mobile' }));
  };
  ws.onmessage = (event) => {
    handleSignal(event).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatus('status', `Signal hatası: ${message}`, 'error');
    });
  };
  ws.onclose = () => {
    clearTimeout(wsOpenTimeout);
    if (connecting || connectBtn.disabled) {
      setStatus('status', 'Sinyal bağlantısı koptu. Sayfayı yenileyip tekrar deneyin.', 'error');
      setPill('pcState', 'PC: sinyal yok', 'error');
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      connecting = false;
      cleanupPeer();
    }
  };
  ws.onerror = () => {
    setStatus('status', 'WebSocket hatası. Tunnel URL ve sunucuyu kontrol edin.', 'error');
  };
}

codeInput.addEventListener('input', () => {
  codeInput.value = normalizeCode(codeInput.value);
});

connectBtn.addEventListener('click', (event) => {
  event.preventDefault();
  void connect();
});

disconnectBtn.addEventListener('click', (event) => {
  event.preventDefault();
  disconnect('Bağlantı kullanıcı tarafından kesildi.');
});

window.addEventListener('pagehide', () => {
  disconnect('Sayfa kapandı.');
});

async function bootstrap() {
  const code = await loadPairCode();
  if (code) {
    codeInput.value = code;
    setStatus(
      'status',
      window.isSecureContext
        ? `Hazır (HTTPS). Kod otomatik dolduruldu (${code}). Bağlan’a basın.`
        : 'Bu sayfa güvenli değil. Telefonda Cloudflare HTTPS URL kullanın.',
      window.isSecureContext ? 'ok' : 'error',
    );
  } else if (!window.isSecureContext) {
    setStatus('status', 'Bu sayfa güvenli değil. Telefonda Cloudflare HTTPS URL kullanın.', 'error');
  } else {
    setStatus('status', 'Hazır (HTTPS). Kodu girip Bağlan’a basın.', 'ok');
  }
}

void bootstrap();
