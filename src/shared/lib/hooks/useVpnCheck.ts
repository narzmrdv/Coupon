import { useState, useCallback } from 'react';
import * as Network from 'expo-network';

export type VpnStatus = 'checking' | 'connected' | 'not_connected';

async function detectVpn(): Promise<boolean> {
  // Method 1: expo-network system check
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.type === Network.NetworkStateType.VPN) return true;
  } catch {
    // ignore
  }

  // Method 2: proxycheck.io — специализированный сервис для VPN-детектинга
  try {
    const controller1 = new AbortController();
    const t1 = setTimeout(() => controller1.abort(), 5000);

    // Получаем IP
    const ipRes = await fetch('https://api.ipify.org?format=json', {
      signal: controller1.signal,
    });
    clearTimeout(t1);

    if (!ipRes.ok) return true; // fail open

    const { ip } = (await ipRes.json()) as { ip: string };

    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), 5000);

    // Проверяем IP через proxycheck.io
    const checkRes = await fetch(
      `https://proxycheck.io/v2/${ip}?vpn=1&risk=1`,
      { signal: controller2.signal },
    );
    clearTimeout(t2);

    if (!checkRes.ok) return true; // fail open

    const data = (await checkRes.json()) as Record<string, { proxy?: string; type?: string }>;
    const ipData = data[ip];

    if (ipData?.proxy === 'yes') return true;
    if (ipData?.type) {
      const t = ipData.type.toLowerCase();
      if (t.includes('vpn') || t.includes('proxy') || t.includes('tor')) return true;
    }

    return false;
  } catch {
    // Network error / timeout — fail open
    return true;
  }
}

export function useVpnCheck() {
  const [status, setStatus] = useState<VpnStatus>('checking');
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    setRetrying(true);
    try {
      const hasVpn = await detectVpn();
      setStatus(hasVpn ? 'connected' : 'not_connected');
    } finally {
      setRetrying(false);
    }
  }, []);

  const initialCheck = useCallback(async () => {
    setStatus('checking');
    const hasVpn = await detectVpn();
    setStatus(hasVpn ? 'connected' : 'not_connected');
  }, []);

  return { status, retrying, check, initialCheck };
}
