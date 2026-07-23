import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPost = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { post: mockPost, get: jest.fn() } }));
jest.unstable_mockModule('../../src/lib/logger', () => ({
  default: jest.fn().mockReturnValue({ info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }),
}));

process.env.ZHIPUAI_API_KEY = 'test-key';
const { detect, canComplete } = await import('../../src/cron/scraper/llm');

const ok = { data: { choices: [{ message: { content: 'ok' } }] } };
const noChoices = { data: { code: '1113', message: 'Insufficient balance' } };

describe('scraper LLM backend selection', () => {
  beforeEach(() => mockPost.mockReset());

  it('canComplete is true only when the backend returns choices', async () => {
    mockPost.mockResolvedValueOnce(ok);
    expect(await canComplete('zhipuai')).toBe(true);
    mockPost.mockResolvedValueOnce(noChoices);
    expect(await canComplete('zhipuai')).toBe(false);
  });

  it('picks zhipuai when its probe succeeds', async () => {
    mockPost.mockResolvedValueOnce(ok);
    expect(await detect()).toBe('zhipuai');
  });

  it('falls back to the local vLLM when the cloud backend has no balance', async () => {
    mockPost.mockResolvedValueOnce(noChoices);
    mockPost.mockResolvedValueOnce(ok);
    expect(await detect()).toBe('vllm');
  });

  it('returns none when neither backend can complete', async () => {
    mockPost.mockRejectedValueOnce(new Error('balance'));
    mockPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await detect()).toBe('none');
  });
});
