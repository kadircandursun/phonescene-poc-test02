import os from 'node:os';

export type NetworkAdapterInfo = {
  name: string;
  address: string;
  internal: boolean;
  family: 'IPv4';
  score: number;
  recommended: boolean;
  kind: 'wifi-lan' | 'ethernet-lan' | 'virtual' | 'overlay' | 'link-local' | 'other';
};

function classify(name: string, address: string): NetworkAdapterInfo['kind'] {
  const n = name.toLowerCase();
  if (address.startsWith('169.254.')) return 'link-local';
  if (n.includes('zerotier') || n.includes('tailscale') || n.includes('vpn')) return 'overlay';
  if (n.includes('vethernet') || n.includes('hyper-v') || n.includes('wsl') || n.includes('virtual') || n.includes('default switch')) {
    return 'virtual';
  }
  if (n.includes('wi-fi') || n.includes('wifi') || n.includes('wlan')) return 'wifi-lan';
  if (n.includes('ethernet')) return 'ethernet-lan';
  if (address.startsWith('192.168.') || address.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    return 'ethernet-lan';
  }
  return 'other';
}

function scoreAdapter(kind: NetworkAdapterInfo['kind'], address: string): number {
  let score = 0;
  if (kind === 'wifi-lan') score += 100;
  if (kind === 'ethernet-lan') score += 95;
  if (kind === 'virtual') score += 20;
  if (kind === 'overlay') score += 30;
  if (kind === 'link-local') score -= 50;
  if (kind === 'other') score += 10;
  if (address.startsWith('192.168.')) score += 15;
  if (address.startsWith('10.')) score += 5;
  return score;
}

/** Dynamic LAN discovery — never hardcode 192.168.1.103. */
export function listIpv4Adapters(): NetworkAdapterInfo[] {
  const nets = os.networkInterfaces();
  const list: NetworkAdapterInfo[] = [];

  for (const [name, entries] of Object.entries(nets)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' && (entry.family as unknown) !== 4) continue;
      if (entry.internal) continue;
      const kind = classify(name, entry.address);
      list.push({
        name,
        address: entry.address,
        internal: entry.internal,
        family: 'IPv4',
        kind,
        score: scoreAdapter(kind, entry.address),
        recommended: false,
      });
    }
  }

  list.sort((a, b) => b.score - a.score);
  if (list[0] && list[0].score > 0) list[0].recommended = true;
  return list;
}
