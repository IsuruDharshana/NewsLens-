/**
 * NewsLens API client — talks to the FastAPI backend.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  After deploying backend to Render, replace the URL     │
 * │  below with your Render URL (no trailing slash).        │
 * │  e.g. 'https://newslens-backend.onrender.com'           │
 * └─────────────────────────────────────────────────────────┘
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PaginatedResponse,
  ClusterDetail,
  RAGResponse,
} from './types';

// ━━ UPDATE THIS after deploying backend ━━━━━━━━━━━━━━━━━━
const PRODUCTION_API_URL = 'https://newslens-wcki.onrender.com';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Allow overriding via build-time env var (EXPO_PUBLIC_API_URL) without
// editing source. Falls back to the hardcoded production URL.
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = __DEV__
  ? (ENV_API_URL ?? 'http://localhost:8000')
  : (ENV_API_URL ?? PRODUCTION_API_URL);

const TOKEN_KEY = 'newslens_token';
const REFRESH_KEY = 'newslens_refresh';

const api = axios.create({
  baseURL: API_BASE_URL,
  // Render free tier cold starts can take 30-60s; give the backend time
  // to wake up before showing a connection error.
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refresh_token: refreshToken,
    });

    await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
    await AsyncStorage.setItem(REFRESH_KEY, data.refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
    return data.access_token;
  } catch (error) {
    return null;
  }
}

// Auto-refresh expired tokens and retry the original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
        } else {
          // Refresh failed — clear stored tokens
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(REFRESH_KEY);
          delete api.defaults.headers.common['Authorization'];
          return Promise.reject(error);
        }
      }

      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

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

/** RAG: ask a natural-language question about the news. */
export async function askQuestion(question: string): Promise<RAGResponse> {
  const { data } = await api.post<RAGResponse>('/api/news/query', { question });
  return data;
}

/** Full-text search across news clusters (title + summary). */
export async function searchNews(
  query: string,
  page = 1,
  limit = 30,
): Promise<PaginatedResponse> {
  const { data } = await api.get<PaginatedResponse>('/api/news/search', {
    params: { q: query, page, limit },
  });
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
