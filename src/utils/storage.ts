export const storage = {
  read<T>(key: string, fallback: string): T {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback) as T;
    } catch (error) {
      return JSON.parse(fallback) as T;
    }
  },
  write<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
};
