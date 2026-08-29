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
  lang?: string,
): Promise<PaginatedResponse> {
  const params: Record<string, string | number> = { page, limit };
  if (category && category !== 'All') {
    params.category = category;
  }
  if (lang && lang !== 'en') {
    params.lang = lang;
  }
  const { data } = await api.get<PaginatedResponse>('/api/news', { params });
  return data;
}

/** Get breaking news stories. */
export async function getBreakingNews(lang?: string): Promise<PaginatedResponse> {
  const params: Record<string, string> = {};
  if (lang && lang !== 'en') {
    params.lang = lang;
  }
  const { data } = await api.get<PaginatedResponse>('/api/news/breaking', { params });
  return data;
}

/** Get full detail for a single story cluster. */
export async function getStoryDetail(clusterId: string, lang?: string): Promise<ClusterDetail> {
  const params: Record<string, string> = {};
  if (lang && lang !== 'en') {
    params.lang = lang;
  }
  const { data } = await api.get<ClusterDetail>(`/api/news/${clusterId}`, { params });
  return data;
}

/** User preferences. */
export interface UserPreferences {
  user_id: string;
  categories: string[];
  language: string;
  notification_enabled: boolean;
  sports_interests: string[];
}

/** Get current user's preferences. */
export async function getPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<UserPreferences>('/api/user/preferences');
  return data;
}

/** Update user preferences. */
export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
  const { data } = await api.put<UserPreferences>('/api/user/preferences', prefs);
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

/** Engagement types */
export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export interface Comment {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  user_name: string;
}

/** Toggle like on a story. Returns new state. */
export async function toggleLike(clusterId: string): Promise<LikeStatus> {
  const { data } = await api.post<LikeStatus>(`/api/engage/like/${clusterId}`);
  return data;
}

/** Get like status for a story. */
export async function getLikeStatus(clusterId: string): Promise<LikeStatus> {
  const { data } = await api.get<LikeStatus>(`/api/engage/like/${clusterId}`);
  return data;
}

/** Get comments for a story. */
export async function getComments(clusterId: string): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/api/engage/comments/${clusterId}`);
  return data;
}

/** Add a comment to a story. */
export async function addComment(clusterId: string, text: string): Promise<Comment> {
  const { data } = await api.post<Comment>(`/api/engage/comments/${clusterId}`, { text });
  return data;
}

/** Delete your own comment. */
export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/api/engage/comments/${commentId}`);
}

export default api;
