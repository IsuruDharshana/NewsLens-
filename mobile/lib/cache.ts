import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClusterListItem, ClusterDetail } from './types';

const KEYS = {
  news: 'newslens:news',
  breaking: 'newslens:breaking',
  story: (id: string) => `newslens:story:${id}`,
  cacheMeta: 'newslens:cacheMeta',
};

type CacheMeta = {
  newsAt?: string;
  breakingAt?: string;
};

export async function getCachedNews(): Promise<ClusterListItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.news);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedNews(clusters: ClusterListItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.news, JSON.stringify(clusters));
    const meta: CacheMeta = JSON.parse((await AsyncStorage.getItem(KEYS.cacheMeta)) || '{}');
    meta.newsAt = new Date().toISOString();
    await AsyncStorage.setItem(KEYS.cacheMeta, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export async function getCachedBreaking(): Promise<ClusterListItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.breaking);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedBreaking(breaking: ClusterListItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.breaking, JSON.stringify(breaking));
    const meta: CacheMeta = JSON.parse((await AsyncStorage.getItem(KEYS.cacheMeta)) || '{}');
    meta.breakingAt = new Date().toISOString();
    await AsyncStorage.setItem(KEYS.cacheMeta, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export async function getCachedStory(id: string): Promise<ClusterDetail | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.story(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedStory(id: string, story: ClusterDetail): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.story(id), JSON.stringify(story));
  } catch {
    /* ignore */
  }
}

export async function getCacheMeta(): Promise<CacheMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.cacheMeta);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ourKeys = keys.filter((k) => k.startsWith('newslens:'));
    await AsyncStorage.multiRemove(ourKeys);
  } catch {
    /* ignore */
  }
}
