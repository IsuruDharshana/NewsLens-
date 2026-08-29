/**
 * NewsLens TypeScript types — mirrors the backend API schemas.
 */

export interface ClusterListItem {
  id: string;
  title: string | null;
  summary: string | null;
  source_count: number;
  category: string;
  is_breaking: boolean;
  confidence_score: number;
  trend_score: number;
  top_sources: string[];
  like_count: number;
  comment_count: number;
  published_at: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse {
  data: ClusterListItem[];
  pagination: Pagination;
}

export interface SourceInfo {
  name: string;
  url: string;
  bias_label: string | null;
}

export interface BiasAnalysis {
  neutral: number;
  pro_government: number;
  critical: number;
  sensationalist: number;
}

export interface ClusterDetail {
  id: string;
  title: string | null;
  summary: string | null;
  source_count: number;
  category: string;
  is_breaking: boolean;
  confidence_score: number;
  trend_score: number;
  official_source_data: unknown | null;
  bias_analysis: BiasAnalysis | null;
  sources: SourceInfo[];
  published_at: string | null;
  created_at: string | null;
}

export const CATEGORIES = [
  'All',
  'Politics',
  'Economy',
  'Sports',
  'World',
  'Health',
  'Technology',
  'Environment',
  'Society',
] as const;

export type Category = (typeof CATEGORIES)[number];
