/**
 * NewsLens API client — talks to the FastAPI backend.
 *
 * Set API_BASE_URL to your backend:
 *   - Local dev:  http://localhost:8000
 *   - Deployed:   https://your-render-url.onrender.com
 */
import axios from 'axios';
import type { PaginatedResponse, ClusterDetail } from './types';

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://your-render-url.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Get paginated news feed, optionally filtered by category. */
export async function getNews(
  page = 1,
  limit = 20,
  category?: string,
): Promise<PaginatedResponse> {
  const params: Record<string, string | number> = { page, limit };
  if (category && category !== 'All') {
    params.category = category;
  }
  const { data } = await api.get<PaginatedResponse>('/api/news', { params });
  return data;
}

/** Get breaking news stories. */
export async function getBreakingNews(): Promise<PaginatedResponse> {
  const { data } = await api.get<PaginatedResponse>('/api/news/breaking');
  return data;
}

/** Get full detail for a single story cluster. */
export async function getStoryDetail(clusterId: string): Promise<ClusterDetail> {
  const { data } = await api.get<ClusterDetail>(`/api/news/${clusterId}`);
  return data;
}

/** Health check — useful for connection status indicator. */
export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await api.get('/health');
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

export default api;
