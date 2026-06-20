function authHeaders(): HeadersInit {
  const token = localStorage.getItem('gopark_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function fetchFavorites(): Promise<string[]> {
  const res = await fetch('/api/favorites', { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function addFavorite(carparkId: string): Promise<void> {
  await fetch(`/api/favorites/${encodeURIComponent(carparkId)}`, { method: 'POST', headers: authHeaders() });
}

export async function removeFavorite(carparkId: string): Promise<void> {
  await fetch(`/api/favorites/${encodeURIComponent(carparkId)}`, { method: 'DELETE', headers: authHeaders() });
}
