import axios from 'axios';
import createLogger from './logger.js';

const log = createLogger('onemap');

let token = process.env.ONEMAP_API || '';
let expiresAt = 0;
let inflight: Promise<void> | null = null;

async function refreshToken() {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_EMAIL_PASSWORD;
  if (!email || !password) {
    log.warn('ONEMAP_EMAIL or ONEMAP_EMAIL_PASSWORD not set, cannot refresh token');
    return;
  }

  const { data } = await axios.post('https://www.onemap.gov.sg/api/auth/post/getToken', { email, password });
  token = data.access_token;
  expiresAt = Number(data.expiry_timestamp) * 1000;
  log.info(`token refreshed, expires ${new Date(expiresAt).toISOString()}`);
}

async function ensureToken() {
  if (token && Date.now() < expiresAt - 3600000) return;
  if (!inflight) inflight = refreshToken().finally(() => { inflight = null; });
  await inflight;
}

const onemapClient = axios.create({
  baseURL: 'https://www.onemap.gov.sg/api/public',
  timeout: 15000,
});

onemapClient.interceptors.request.use(async (config) => {
  await ensureToken();
  config.headers.Authorization = token;
  return config;
});

export default onemapClient;
