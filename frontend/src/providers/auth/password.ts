const API_URL = '/api/auth';

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_URL}/password/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'could not send the reset code');
  return data;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const response = await fetch(`${API_URL}/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'password reset failed');
  return data;
}