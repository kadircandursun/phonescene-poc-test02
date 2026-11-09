export async function loadPairCode(): Promise<string | null> {
  try {
    const res = await fetch('/api/session', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { pairCode?: string };
    const code = String(data.pairCode || '').replace(/\D/g, '').slice(0, 6);
    return /^\d{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
