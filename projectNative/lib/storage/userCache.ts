import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser } from '@/types/auth';

const USER_CACHE_KEY = 'app_user_v1';

export async function getCachedUser(): Promise<AppUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: AppUser | null): Promise<void> {
  try {
    if (user) {
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // silent fail
  }
}

export async function clearUserCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // silent fail
  }
}
