import axios, { AxiosInstance } from 'axios';
import createLogger from './logger.js';

const log = createLogger('justpark');

const BASE = 'https://justpark.capitaland.com';

interface Session {
  client: AxiosInstance;
  formToken: string;
}

async function createSession(): Promise<Session> {
  const client = axios.create({
    baseURL: BASE,
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });

  const { data: html, headers } = await client.get('/Lot-Availability');

  const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/);
  if (!tokenMatch) throw new Error('failed to extract CSRF token');
  const formToken = tokenMatch[1];

  const setCookie = headers['set-cookie'] ?? [];
  const cookies = setCookie
    .map((c: string) => c.split(';')[0])
    .join('; ');

  client.defaults.headers.common['Cookie'] = cookies;
  client.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
  client.defaults.headers.common['__RequestVerificationToken'] = formToken;
  client.defaults.headers.common['x-ModID'] = 'FELotAvail';
  client.defaults.headers.common['Origin'] = BASE;
  client.defaults.headers.common['Referer'] = `${BASE}/Lot-Availability`;

  return { client, formToken };
}

function buildFormData(jdata: string): string {
  const boundary = '----JustParkBoundary';
  return `------JustParkBoundary\r\nContent-Disposition: form-data; name="JData"\r\n\r\n${jdata}\r\n------JustParkBoundary--\r\n`;
}

export interface JustParkSite {
  SiteCode: string;
  SiteDesc: string;
  BusinessUnit: string;
  BusinessUnitDesc: string;
  LotBalance: string;
  LotTotal: string | null;
  Available: boolean;
  IsFull: boolean;
}

async function apiPost(session: Session, action: string, jdata: string): Promise<any> {
  const { data } = await session.client.post('/AjaxNoAuth/OnHttpPost', buildFormData(jdata), {
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----JustParkBoundary',
      'X-APIAction': action,
    },
  });

  if (data.HasError) throw new Error(`JustPark API error: ${data.Message}`);
  return data.Result;
}

export async function fetchSites(): Promise<JustParkSite[]> {
  const session = await createSession();
  const raw = await apiPost(session, 'SelectSiteNoAuth/OnSelectSite', JSON.stringify({ DisplayType: 'LotAvail', IsAuth: 'false' }));
  const sites: JustParkSite[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
  log.info(`fetched ${sites.length} sites`);
  return sites;
}

export async function fetchRateInfo(session: Session, siteCode: string): Promise<string> {
  const raw = await apiPost(session, 'SelectSiteNoAuth/OnGetHourlyRateInfo', JSON.stringify(siteCode));
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function fetchAllRates(sites: JustParkSite[]): Promise<Record<string, string>> {
  const session = await createSession();
  const rates: Record<string, string> = {};

  const BATCH = 10;
  for (let i = 0; i < sites.length; i += BATCH) {
    const batch = sites.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(s => fetchRateInfo(session, s.SiteCode))
    );
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled' && r.value) {
        rates[batch[j].SiteCode] = r.value;
      } else if (r.status === 'rejected') {
        log.warn(`rate fetch failed for ${batch[j].SiteCode}: ${r.reason}`);
      }
    }
  }

  log.info(`fetched rates for ${Object.keys(rates).length}/${sites.length} sites`);
  return rates;
}
