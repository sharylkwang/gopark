import axios from 'axios';

interface ProxyConfig {
  buildUrl: (z: number, x: number, y: number) => string;
  keyParam?: string;
  keyEnv?: string;
}

const PROVIDERS: Record<string, ProxyConfig> = {
  'google-roads': {
    buildUrl: (z, x, y) => `https://mt${(x + y) % 4}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
  },
  'google-hybrid': {
    buildUrl: (z, x, y) => `https://mt${(x + y) % 4}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`,
  },
};

export function buildProxyUrl(provider: string, z: number, x: number, y: number): string | null {
  const config = PROVIDERS[provider];
  if (!config) return null;

  let url = config.buildUrl(z, x, y);

  if (config.keyParam && config.keyEnv) {
    const key = process.env[config.keyEnv];
    if (key) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}${config.keyParam}=${key}`;
    }
  }

  return url;
}

interface TileResult {
  data: Buffer;
  contentType: string;
}

export async function fetchTile(provider: string, z: number, x: number, y: number): Promise<TileResult> {
  const url = buildProxyUrl(provider, z, x, y);
  if (!url) throw new Error(`Unknown provider: ${provider}`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 10000,
    headers: { 'User-Agent': 'GoPark/1.0' },
  });

  return {
    data: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'image/png',
  };
}

export function isValidProvider(provider: string): boolean {
  return provider in PROVIDERS;
}

export function getProviderList(): string[] {
  return Object.keys(PROVIDERS);
}
