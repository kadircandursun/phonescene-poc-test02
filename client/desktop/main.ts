import { loadPairCode } from '../shared/session';
import { isPosePayload, isSensorPayload, type MediaChannelPayload } from '../shared/types';
import { $, appendDebug, renderAngles, setStatus, setText } from '../shared/ui';
import { PhoneScenePeer, wsUrl } from '../shared/webrtc';
import { SceneCompositor, type OutputProfile, type PreviewMode } from './scene/compositor';
import type { QualityProfile } from './scene/matting';
import type { SceneId } from './scene/room';

const codeInput = $('code') as HTMLInputElement;
const connectBtn = $('connect') as HTMLButtonElement;
const disconnectBtn = $('disconnect') as HTMLButtonElement;
const remote = $('remote') as HTMLVideoElement;
const output = $('output') as HTMLCanvasElement;
const roomCanvas = $('room') as HTMLCanvasElement;

const sceneSelect = $('sceneSelect') as HTMLSelectElement;
const previewMode = $('previewMode') as HTMLSelectElement;
const outputProfile = $('outputProfile') as HTMLSelectElement;
const quality = $('quality') as HTMLSelectElement;
const tog3d = $('tog3d') as HTMLInputElement;
const togPhoto = $('togPhoto') as HTMLInputElement;
const togSeg = $('togSeg') as HTMLInputElement;
const togTrack = $('togTrack') as HTMLInputElement;
const recenterBtn = $('recenter') as HTMLButtonElement;
const roomBgFile = $('roomBgFile') as HTMLInputElement;
const roomBgClear = $('roomBgClear') as HTMLButtonElement;
const roomBgRefresh = $('roomBgRefresh') as HTMLButtonElement;
const roomBgStatus = $('roomBgStatus');

let lastRoomUpdatedAt: number | null = null;
const broadcastBtn = $('broadcastBtn') as HTMLButtonElement;
const exitBroadcastBtn = $('exitBroadcastBtn') as HTMLButtonElement;
const fullscreenBtn = $('fullscreenBtn') as HTMLButtonElement;
const broadcastHud = $('broadcastHud');
const previewBox = $('previewBox');

let ws: WebSocket | null = null;
let peer: PhoneScenePeer | null = null;

const compositor = new SceneCompositor({
  video: remote,
  roomCanvas,
  outputCanvas: output,
  onDiag: (d) => {
    setText('fps', String(d.videoFps || '—'));
    setText('compFps', String(d.compositeFps || '—'));
    setText('segMs', d.segInferMs ? String(d.segInferMs) : '—');
    setText('segFps', String(d.segFps || '—'));
    setText('poseHz', String(d.poseHz || '—'));
    setText('dropped', String(d.droppedLate));
    setText('segStatus', d.segStatus);
    setText('resolution', `${d.width}×${d.height}`);
    setPill('segState', `Seg: ${d.segStatus}`, d.segStatus === 'ready' ? 'connected' : d.segStatus === 'error' ? 'error' : 'connecting');
    const label = $('broadcastLabel');
    label.textContent = `BROADCAST · ${d.outputProfile.toUpperCase()} ${d.width}×${d.height}${d.hasSignal ? '' : ' · HOLD'}`;
  },
});

let broadcastMode = false;

function setPill(id: string, text: string, state: string) {
  const el = $(id);
  el.textContent = text;
  el.dataset.state = state;
}

function log(line: string) {
  appendDebug('debug', line);
}

function cleanupPeer() {
  peer?.close();
  peer = null;
  remote.srcObject = null;
  setText('fps', '—');
  setText('resolution', '—');
  setText('webrtc', '—');
  setText('data', '—');
}

function disconnect(reason = 'Oturum sonlandı.') {
  try {
    ws?.send(JSON.stringify({ type: 'bye' }));
  } catch {
    /* ignore */
  }
  ws?.close();
  ws = null;
  cleanupPeer();
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  setPill('phoneState', 'Telefon: bağlı değil', 'idle');
  setPill('signalState', 'Sinyal: kapalı', 'idle');
  setStatus('status', reason, 'warn');
  log(reason);
}

function createPeer() {
  cleanupPeer();
  peer = new PhoneScenePeer('desktop', {
    onConnectionState: (state) => {
      setText('webrtc', state);
      setStatus('status', `WebRTC: ${state}`, state === 'connected' ? 'ok' : state === 'failed' ? 'error' : 'warn');
      log(`connectionState=${state}`);
      if (state === 'failed' || state === 'disconnected') {
        setPill('phoneState', `Telefon: ${state}`, 'error');
      }
      if (state === 'connected') setPill('phoneState', 'Telefon: canlı', 'connected');
    },
    onIceConnectionState: (state) => log(`iceConnectionState=${state}`),
    onLocalIce: (candidate) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice', candidate }));
      }
    },
    onTrack: ({ track }) => {
      if (track.kind !== 'video') return;
      const id = (track.id || '').toLowerCase();
      const isAlpha =
        id.includes('alpha') ||
        id.includes('matte') ||
        // Dual-track offer: 2nd video = Vision person alpha
        (!!remote.srcObject && (remote.srcObject as MediaStream).getVideoTracks().length >= 1);

      if (isAlpha && remote.srcObject) {
        compositor.attachPhoneAlphaTrack(track);
        setStatus('status', 'Phone Vision alpha track alındı — boş arka plan gerekmez.', 'ok');
        log(`alpha track id=${track.id}`);
        return;
      }

      const stream = new MediaStream([track]);
      remote.srcObject = stream;
      void remote.play().catch(() => {
        setStatus('status', 'Video oynatmak için sayfaya tıklayın.', 'warn');
      });
      const updateResolution = () => {
        const w = remote.videoWidth || track.getSettings().width;
        const h = remote.videoHeight || track.getSettings().height;
        if (w && h) {
          setText('resolution', `${w}×${h}`);
          log(`resolution ${w}x${h}`);
        }
      };
      remote.addEventListener('loadedmetadata', updateResolution, { once: true });
      remote.addEventListener('resize', updateResolution);
      updateResolution();
      log(`rgb track id=${track.id}`);
    },
    onDataOpen: () => {
      setText('data', 'open');
      log('DataChannel open');
    },
    onDataClose: () => {
      setText('data', 'closed');
      log('DataChannel closed');
    },
    onDataMessage: (raw) => {
      try {
        const payload = JSON.parse(raw) as MediaChannelPayload;
        if (isSensorPayload(payload)) {
          renderAngles('alpha', 'beta', 'gamma', payload.alpha, payload.beta, payload.gamma);
          compositor.pushSensors(payload.alpha, payload.beta, payload.gamma);
          return;
        }
        if (isPosePayload(payload)) {
          if (payload.alpha != null || payload.beta != null || payload.gamma != null) {
            renderAngles('alpha', 'beta', 'gamma', payload.alpha ?? null, payload.beta ?? null, payload.gamma ?? null);
          }
          compositor.pushPose(payload);
        }
      } catch {
        /* ignore */
      }
    },
  });
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
  log(`signal ${type}`);

  if (type === 'joined') {
    setStatus('status', 'Alıcı hazır. Telefon bağlanınca video gelecek.', 'ok');
    setPill('signalState', 'Sinyal: bağlı', 'connected');
    return;
  }

  if (type === 'peer-ready') {
    setPill('phoneState', 'Telefon: eşleşti', 'connecting');
    setStatus('status', 'Telefon bağlandı, WebRTC bekleniyor…', 'ok');
    return;
  }

  if (type === 'peer-left') {
    cleanupPeer();
    setPill('phoneState', 'Telefon: ayrıldı', 'disconnected');
    setStatus('status', 'Telefon ayrıldı. Yeniden bağlanabilir.', 'error');
    return;
  }

  if (type === 'offer' && message.sdp) {
    const p = createPeer();
    await p.handleOffer(message.sdp as RTCSessionDescriptionInit, (msg) => {
      ws?.send(JSON.stringify(msg));
    });
    return;
  }

  if (type === 'ice' && peer && message.candidate) {
    await peer.handleIce(message.candidate as RTCIceCandidateInit);
    return;
  }

  if (type === 'error') {
    setStatus('status', `Sunucu: ${String(message.message || 'hata')}`, 'error');
  }
}

function connect() {
  const code = codeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    setStatus('status', '6 haneli eşleştirme kodunu girin.', 'warn');
    return;
  }

  connectBtn.disabled = true;
  disconnectBtn.disabled = false;
  setStatus('status', 'Sinyal sunucusuna bağlanılıyor…', 'ok');
  setPill('signalState', 'Sinyal: bağlanıyor', 'connecting');
  log(`connecting ${wsUrl()}`);

  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    ws?.send(JSON.stringify({ type: 'join', code, role: 'desktop' }));
  };
  ws.onmessage = (event) => {
    handleSignal(event).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatus('status', `Signal hatası: ${message}`, 'error');
      log(message);
    });
  };
  ws.onclose = () => {
    setPill('signalState', 'Sinyal: kapalı', 'disconnected');
    if (connectBtn.disabled) {
      setStatus('status', 'Sinyal bağlantısı koptu.', 'error');
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      cleanupPeer();
    }
  };
  ws.onerror = () => {
    setStatus('status', 'WebSocket hatası.', 'error');
    log('websocket error');
  };
}

function setBroadcastMode(on: boolean) {
  broadcastMode = on;
  document.body.classList.toggle('broadcast-mode', on);
  broadcastHud.hidden = !on;
  // Force final composite so OBS never gets raw/debug views by accident.
  if (on) {
    compositor.previewMode = 'final';
    previewMode.value = 'final';
  }
  log(`broadcastMode=${on}`);
}

async function toggleFullscreen() {
  const target = previewBox;
  try {
    if (!document.fullscreenElement) {
      await target.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`fullscreen: ${message}`);
  }
}

async function refreshRoomBackground(force = false) {
  try {
    const st = await fetch('/api/room/status').then((r) => r.json());
    if (!st?.hasBackground) {
      roomBgStatus.textContent = 'Oda fotoğrafı yok — telefondan gönder veya buradan yükle.';
      return;
    }
    if (!force && st.updatedAt && st.updatedAt === lastRoomUpdatedAt && compositor.hasPhotoBackground()) {
      roomBgStatus.textContent = `Oda: ${st.name || 'adsız'} (${Math.round((st.bytes || 0) / 1024)} KB)`;
      return;
    }
    lastRoomUpdatedAt = st.updatedAt ?? Date.now();
    const ok = await compositor.setPhotoBackgroundFromUrl(
      `/api/room/background?t=${lastRoomUpdatedAt}`,
      String(st.name || ''),
    );
    if (ok) {
      togPhoto.checked = true;
      tog3d.checked = false;
      compositor.usePhotoBackground = true;
      compositor.enabled3d = false;
      roomBgStatus.textContent = `Oda: ${st.name || 'adsız'} · foto BG aktif`;
      log(`room bg loaded name=${st.name}`);
    } else {
      roomBgStatus.textContent = 'Oda fotoğrafı indirilemedi.';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`room bg: ${message}`);
  }
}

function wireControls() {
  sceneSelect.addEventListener('change', () => {
    compositor.setScene(sceneSelect.value as SceneId);
    log(`scene=${sceneSelect.value}`);
  });
  previewMode.addEventListener('change', () => {
    if (broadcastMode) {
      previewMode.value = 'final';
      return;
    }
    compositor.previewMode = previewMode.value as PreviewMode;
  });
  outputProfile.addEventListener('change', () => {
    compositor.setOutputProfile(outputProfile.value as OutputProfile);
    document.body.dataset.outputProfile = outputProfile.value;
    log(`outputProfile=${outputProfile.value}`);
  });
  quality.addEventListener('change', () => {
    compositor.setQuality(quality.value as QualityProfile);
    log(`quality=${quality.value}`);
  });
  togPhoto.addEventListener('change', () => {
    compositor.usePhotoBackground = togPhoto.checked;
    if (togPhoto.checked) {
      tog3d.checked = false;
      compositor.enabled3d = false;
    }
  });
  tog3d.addEventListener('change', () => {
    compositor.enabled3d = tog3d.checked;
    if (tog3d.checked) {
      togPhoto.checked = false;
      compositor.usePhotoBackground = false;
    }
  });
  togSeg.addEventListener('change', () => {
    compositor.enabledSeg = togSeg.checked;
  });
  togTrack.addEventListener('change', () => {
    compositor.setTracking(togTrack.checked);
    log(`tracking=${togTrack.checked}`);
  });
  recenterBtn.addEventListener('click', () => {
    compositor.recenter();
    setStatus('status', 'Recenter: dik tutuş = bakış sıfır. Şimdi çevirerek dene.', 'ok');
    log('recenter');
  });
  roomBgRefresh.addEventListener('click', () => {
    void refreshRoomBackground(true);
  });
  roomBgClear.addEventListener('click', () => {
    void (async () => {
      await fetch('/api/room/background', { method: 'DELETE' });
      compositor.clearPhotoBackground();
      lastRoomUpdatedAt = null;
      roomBgStatus.textContent = 'Oda fotoğrafı temizlendi.';
      log('room bg cleared');
    })();
  });
  roomBgFile.addEventListener('change', () => {
    const file = roomBgFile.files?.[0];
    if (!file) return;
    void (async () => {
      const res = await fetch('/api/room/background', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-Room-Name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const json = await res.json();
      if (json?.ok) {
        await refreshRoomBackground(true);
        setStatus('status', 'Oda fotoğrafı yüklendi.', 'ok');
      } else {
        setStatus('status', `Oda yükleme hata: ${json?.error || res.status}`, 'error');
      }
      roomBgFile.value = '';
    })();
  });
  broadcastBtn.addEventListener('click', () => setBroadcastMode(true));
  exitBroadcastBtn.addEventListener('click', () => setBroadcastMode(false));
  fullscreenBtn.addEventListener('click', () => {
    void toggleFullscreen();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && broadcastMode) setBroadcastMode(false);
    if ((e.key === 'b' || e.key === 'B') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setBroadcastMode(!broadcastMode);
    }
  });
}

connectBtn.addEventListener('click', () => connect());
disconnectBtn.addEventListener('click', () => disconnect('Kullanıcı oturumu sonlandırdı.'));
window.addEventListener('beforeunload', () => {
  disconnect();
  compositor.dispose();
});

wireControls();
compositor.setQuality('balanced');
compositor.setTracking(true);
compositor.setOutputProfile('portrait');
compositor.enabled3d = false;
compositor.usePhotoBackground = true;
tog3d.checked = false;
togPhoto.checked = true;
document.body.dataset.outputProfile = 'portrait';
compositor.start();

log(`origin=${location.origin}`);

void (async () => {
  const code = await loadPairCode();
  if (code) {
    codeInput.value = code;
    setStatus('status', `Kod otomatik (${code}). Oda fotoğrafı + kesim için telefonu bağla.`, 'ok');
    log(`pairCode=${code}`);
  }
  await refreshRoomBackground(true);
  window.setInterval(() => {
    void refreshRoomBackground(false);
  }, 2500);
  try {
    await compositor.init((msg) => {
      log(msg);
      setPill('segState', msg.slice(0, 42), 'connecting');
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`seg init failed: ${message}`);
  }
})();
