import Taro from '@tarojs/taro';

export const FAVORITES_KEY = 'curio-favorites';
export const READ_KEY = 'curio-read-knowledge';

export function readIds(key: string): string[] {
  const value: unknown = Taro.getStorageSync(key);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}
