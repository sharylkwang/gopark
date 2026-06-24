const API_URL = '/api/auth';

export async function verifyCaptcha(token: string) {
  const response = await fetch(`${API_URL}/verify/captcha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Captcha verification failed');
  return data;
}