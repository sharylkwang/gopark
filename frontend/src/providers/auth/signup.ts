const API_URL = '/api/auth';

export async function sendVerificationCode(username: string, email: string, password: string) {
  const response = await fetch(`${API_URL}/register/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'could not send the code');
  return data;
}

export async function verifyAndRegister(email: string, code: string) {
  const response = await fetch(`${API_URL}/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'code check failed');
  return data; 
}