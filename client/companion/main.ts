type Adapter = {
  name: string;
  address: string;
  kind: string;
  score: number;
  recommended: boolean;
};

type StatusPayload = {
  ok: boolean;
  pairCode: string;
  port: number;
  uptimeMs: number;
  recommendedAddress: string | null;
  signaling: {
    mobileConnected: boolean;
    desktopConnected: boolean;
    peerReady: boolean;
  };
};

function $(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function log(line: string) {
  const el = $('log');
  const stamp = new Date().toLocaleTimeString();
  el.textContent = `[${stamp}] ${line}\n${el.textContent || ''}`.slice(0, 4000);
}

function setPill(id: string, text: string, state: string) {
  const el = $(id);
  el.textContent = text;
  el.dataset.state = state;
}

function fmtUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

async function refresh() {
  const [statusRes, netRes] = await Promise.all([fetch('/api/status', { cache: 'no-store' }), fetch('/api/network', { cache: 'no-store' })]);
  const status = (await statusRes.json()) as StatusPayload;
  const net = (await netRes.json()) as { adapters: Adapter[]; recommended: Adapter | null };

  $('srvStatus').textContent = status.ok ? 'RUNNING' : 'DOWN';
  $('srvPort').textContent = String(status.port);
  $('srvUp').textContent = fmtUptime(status.uptimeMs);
  $('pairCode').textContent = status.pairCode;

  setPill('pillMobile', `Mobile: ${status.signaling.mobileConnected ? 'bağlı' : 'yok'}`, status.signaling.mobileConnected ? 'connected' : 'idle');
  setPill('pillDesktop', `Desktop: ${status.signaling.desktopConnected ? 'bağlı' : 'yok'}`, status.signaling.desktopConnected ? 'connected' : 'idle');
  setPill('pillPeer', `Peer: ${status.signaling.peerReady ? 'ready' : 'bekliyor'}`, status.signaling.peerReady ? 'connected' : 'connecting');

  const statusEl = $('status');
  statusEl.dataset.tone = 'ok';
  statusEl.textContent = status.recommendedAddress
    ? `Önerilen LAN: ${status.recommendedAddress}:${status.port} · Pair ${status.pairCode}`
    : `Sunucu ayakta · Pair ${status.pairCode}`;

  const box = $('adapters');
  box.innerHTML = '';
  for (const a of net.adapters) {
    const row = document.createElement('div');
    row.className = 'adapter-row' + (a.recommended ? ' recommended' : '');
    row.innerHTML = `<strong>${a.address}</strong><span>${a.name}</span><small>${a.kind} · score ${a.score}${a.recommended ? ' · ÖNERİLEN' : ''}</small>`;
    box.appendChild(row);
  }
}

void (async () => {
  try {
    await refresh();
    log('status ok');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    $('status').dataset.tone = 'error';
    $('status').textContent = `Companion API hatası: ${message}`;
    log(message);
  }
  window.setInterval(() => {
    void refresh().catch((error) => log(String(error)));
  }, 2000);
})();
