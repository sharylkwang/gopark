function headers(): Record<string, string> {
  const token = localStorage.getItem('gopark_token');
  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchFavorites(): Promise<string[]> {
  const res = await fetch('/api/favorites', {
    headers: headers(),
  });

  if (!res.ok) return [];
  return res.json();
}

export async function addFavorite(id: string) {
  await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: headers(),
  });
}

export async function removeFavorite(id: string) {
  await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
  });
}
