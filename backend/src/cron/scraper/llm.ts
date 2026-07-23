import axios from 'axios';
import { TIMEOUTS } from '../config.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('llm');

const ZHIPUAI_KEY = process.env.ZHIPUAI_API_KEY || '';
const ZHIPUAI_BASE = 'https://api.z.ai/api/coding/paas/v4';
const ZHIPUAI_MODEL = process.env.ZHIPUAI_MODEL || 'glm-4-flash';
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8100/v1';
const VLLM_MODEL = process.env.VLLM_MODEL || 'Qwen/Qwen3.5-4B';

export type Backend = 'zhipuai' | 'vllm' | 'none';

export async function canComplete(backend: Backend): Promise<boolean> {
  try {
    const { url, key, model } = endpoint(backend);
    const { data } = await axios.post(`${url}/chat/completions`, {
      model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0,
    }, {
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      timeout: TIMEOUTS.llmHealthCheck,
    });
    return Array.isArray(data?.choices) && data.choices.length > 0;
  } catch (e) {
    log.warn(`${backend} backend probe failed: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

export async function detect(): Promise<Backend> {
  if (ZHIPUAI_KEY && await canComplete('zhipuai')) return 'zhipuai';
  if (await canComplete('vllm')) { log.info('falling back to the local vLLM backend'); return 'vllm'; }
  log.warn('no working LLM backend (cloud balance/model or local vLLM both unavailable)');
  return 'none';
}

export function endpoint(backend: Backend): { url: string; key: string; model: string } {
  return backend === 'zhipuai'
    ? { url: ZHIPUAI_BASE, key: ZHIPUAI_KEY, model: ZHIPUAI_MODEL }
    : { url: VLLM_URL, key: '', model: VLLM_MODEL };
}

export async function complete(backend: Backend, system: string, user: string): Promise<string> {
  const { url, key, model } = endpoint(backend);
  const { data } = await axios.post(`${url}/chat/completions`, {
    model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0, max_tokens: 16384,
  }, {
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    timeout: TIMEOUTS.llmExtract,
  });
  return data.choices[0]?.message?.content ?? '';
}

export function parseJson(raw: string): Record<string, unknown> {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}
