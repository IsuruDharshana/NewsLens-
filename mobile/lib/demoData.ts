/**
 * Demo fallback stories.
 *
 * These are shown only when the backend is unreachable AND there is no local
 * cache. They ensure the app still looks alive during a hackathon demo if the
 * network or server has a problem.
 */
import type { ClusterListItem, ClusterDetail } from './types';

export const DEMO_NEWS: ClusterListItem[] = [
  {
    id: 'demo-politics-1',
    title: 'President calls for local designers to create new Sri Lanka Police uniform',
    summary:
      'President Anura Kumara Dissanayake has directed officials to involve Sri Lankan fashion designers in designing a modern uniform for the police force, aiming to reflect national identity while improving practicality.',
    source_count: 3,
    category: 'Politics',
    is_breaking: false,
    confidence_score: 0.92,
    trend_score: 0.78,
    top_sources: ['Daily News', 'The Island', 'NewsWire'],
    like_count: 12,
    comment_count: 4,
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'demo-economy-1',
    title: 'IMF review team to visit Sri Lanka next month for second tranche talks',
    summary:
      'A team from the International Monetary Fund is scheduled to visit Colombo in the coming weeks to review progress on debt restructuring and reform targets tied to the extended fund facility.',
    source_count: 4,
    category: 'Economy',
    is_breaking: false,
    confidence_score: 0.89,
    trend_score: 0.81,
    top_sources: ['EconomyNext', 'Lanka Business Online', 'Daily News'],
    like_count: 8,
    comment_count: 2,
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: 'demo-sports-1',
    title: 'Sri Lanka announces Test squad for upcoming home series',
    summary:
      'The national selectors have named a 16-member squad for the forthcoming Test series, recalling an experienced fast bowler and handing a debut call-up to a promising top-order batter from the domestic circuit.',
    source_count: 2,
    category: 'Sports',
    is_breaking: false,
    confidence_score: 0.85,
    trend_score: 0.64,
    top_sources: ['The Island', 'Sri Lanka Mirror'],
    like_count: 15,
    comment_count: 6,
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: 'demo-society-1',
    title: 'Health ministry launches nationwide dengue prevention campaign',
    summary:
      'With reported cases rising in several districts, the Ministry of Health has launched a week-long campaign focusing on clearing mosquito breeding sites and raising public awareness.',
    source_count: 3,
    category: 'Society',
    is_breaking: false,
    confidence_score: 0.87,
    trend_score: 0.71,
    top_sources: ['NewsWire', 'Daily News', 'Sri Lanka Mirror'],
    like_count: 6,
    comment_count: 1,
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

export const DEMO_BREAKING: ClusterListItem[] = [
  {
    id: 'demo-breaking-1',
    title: 'Parliament convenes emergency session on economic reforms',
    summary:
      'Lawmakers are meeting this evening to debate urgent amendments tied to the ongoing reform program, with opposition parties demanding more transparency on debt restructuring terms.',
    source_count: 5,
    category: 'Politics',
    is_breaking: true,
    confidence_score: 0.94,
    trend_score: 0.95,
    top_sources: ['NewsWire', 'The Island', 'EconomyNext'],
    like_count: 22,
    comment_count: 9,
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

export const DEMO_STORIES: Record<string, ClusterDetail> = {
  'demo-politics-1': {
    id: 'demo-politics-1',
    title: 'President calls for local designers to create new Sri Lanka Police uniform',
    summary:
      'President Anura Kumara Dissanayake has directed officials to involve Sri Lankan fashion designers in designing a modern uniform for the police force. The move aims to reflect national identity while improving practicality for officers on duty. Officials said a committee will evaluate proposals over the next month.',
    source_count: 3,
    category: 'Politics',
    is_breaking: false,
    confidence_score: 0.92,
    trend_score: 0.78,
    official_source_data: null,
    bias_analysis: { neutral: 3, pro_government: 0, critical: 0, sensationalist: 0 },
    sources: [
      { name: 'Daily News', url: 'https://dailynews.lk', bias_label: 'neutral' },
      { name: 'The Island', url: 'https://www.island.lk', bias_label: 'neutral' },
      { name: 'NewsWire', url: 'https://www.newswire.lk', bias_label: 'neutral' },
    ],
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  'demo-economy-1': {
    id: 'demo-economy-1',
    title: 'IMF review team to visit Sri Lanka next month for second tranche talks',
    summary:
      'A team from the International Monetary Fund is scheduled to visit Colombo in the coming weeks to review progress on debt restructuring and reform targets tied to the extended fund facility. Government sources say they are hopeful the review will clear the way for the next disbursement.',
    source_count: 4,
    category: 'Economy',
    is_breaking: false,
    confidence_score: 0.89,
    trend_score: 0.81,
    official_source_data: null,
    bias_analysis: { neutral: 4, pro_government: 0, critical: 0, sensationalist: 0 },
    sources: [
      { name: 'EconomyNext', url: 'https://economynext.com', bias_label: 'neutral' },
      { name: 'Lanka Business Online', url: 'https://www.lankabusinessonline.com', bias_label: 'neutral' },
      { name: 'Daily News', url: 'https://dailynews.lk', bias_label: 'neutral' },
    ],
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  'demo-sports-1': {
    id: 'demo-sports-1',
    title: 'Sri Lanka announces Test squad for upcoming home series',
    summary:
      'The national selectors have named a 16-member squad for the forthcoming Test series, recalling an experienced fast bowler and handing a debut call-up to a promising top-order batter from the domestic circuit. The first match is set to begin next Friday at Galle.',
    source_count: 2,
    category: 'Sports',
    is_breaking: false,
    confidence_score: 0.85,
    trend_score: 0.64,
    official_source_data: null,
    bias_analysis: { neutral: 2, pro_government: 0, critical: 0, sensationalist: 0 },
    sources: [
      { name: 'The Island', url: 'https://www.island.lk', bias_label: 'neutral' },
      { name: 'Sri Lanka Mirror', url: 'https://srilankamirror.com', bias_label: 'neutral' },
    ],
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  'demo-society-1': {
    id: 'demo-society-1',
    title: 'Health ministry launches nationwide dengue prevention campaign',
    summary:
      'With reported cases rising in several districts, the Ministry of Health has launched a week-long campaign focusing on clearing mosquito breeding sites and raising public awareness. Health officials urged the public to remove stagnant water and seek early treatment if symptoms appear.',
    source_count: 3,
    category: 'Society',
    is_breaking: false,
    confidence_score: 0.87,
    trend_score: 0.71,
    official_source_data: null,
    bias_analysis: { neutral: 3, pro_government: 0, critical: 0, sensationalist: 0 },
    sources: [
      { name: 'NewsWire', url: 'https://www.newswire.lk', bias_label: 'neutral' },
      { name: 'Daily News', url: 'https://dailynews.lk', bias_label: 'neutral' },
      { name: 'Sri Lanka Mirror', url: 'https://srilankamirror.com', bias_label: 'neutral' },
    ],
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  'demo-breaking-1': {
    id: 'demo-breaking-1',
    title: 'Parliament convenes emergency session on economic reforms',
    summary:
      'Lawmakers are meeting this evening to debate urgent amendments tied to the ongoing reform program, with opposition parties demanding more transparency on debt restructuring terms. The Speaker has extended the sitting until midnight if needed.',
    source_count: 5,
    category: 'Politics',
    is_breaking: true,
    confidence_score: 0.94,
    trend_score: 0.95,
    official_source_data: null,
    bias_analysis: { neutral: 4, pro_government: 1, critical: 0, sensationalist: 0 },
    sources: [
      { name: 'NewsWire', url: 'https://www.newswire.lk', bias_label: 'neutral' },
      { name: 'The Island', url: 'https://www.island.lk', bias_label: 'neutral' },
      { name: 'EconomyNext', url: 'https://economynext.com', bias_label: 'neutral' },
      { name: 'Daily News', url: 'https://dailynews.lk', bias_label: 'pro_government' },
    ],
    image_url: null,
    published_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
};

export function getDemoStory(id: string): ClusterDetail | null {
  return DEMO_STORIES[id] ?? null;
}
