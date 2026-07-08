import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('ura-token');

const TOKEN_URL = 'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';

let cachedToken: { token: string; dateKey: string } | null = null;

function currentDateKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

export function getAccessKey(): string {
  return process.env.URA_ACCESS_KEY || '';
}

export function isUraConfigured(): boolean {
  return getAccessKey().length > 0;
}

export function resetTokenCache(): void {
  cachedToken = null;
}

export async function getDailyToken(): Promise<string> {
  const accessKey = getAccessKey();
  if (!accessKey) throw new Error('URA_ACCESS_KEY is not set');

  const dateKey = currentDateKey();
  if (cachedToken && cachedToken.dateKey === dateKey) return cachedToken.token;

  const { data } = await axios.get(TOKEN_URL, {
    timeout: 15000,
    headers: { AccessKey: accessKey, 'User-Agent': 'GoPark/1.0' },
  });

  if (data?.Status !== 'Success' || !data?.Result) {
    throw new Error(data?.Message || 'URA token request failed');
  }

  cachedToken = { token: data.Result, dateKey };
  log.info('obtained URA daily token');
  return cachedToken.token;
}
