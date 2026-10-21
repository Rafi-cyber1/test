export interface DesktopStorageBridge {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  print?: () => Promise<void>;
}

declare global {
  interface Window {
    gymTownStorage?: DesktopStorageBridge;
  }
}

const getDesktopStorage = (): DesktopStorageBridge | undefined =>
  typeof window === 'undefined' ? undefined : window.gymTownStorage;

export const appStorage = {
  getItem(key: string): string | null {
    const desktopStorage = getDesktopStorage();
    if (!desktopStorage) return localStorage.getItem(key);

    const stored = desktopStorage.getItem(key);
    if (stored !== null) return stored;

    const legacyStored = localStorage.getItem(key);
    if (legacyStored !== null) desktopStorage.setItem(key, legacyStored);
    return legacyStored;
  },

  setItem(key: string, value: string): void {
    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      desktopStorage.setItem(key, value);
      return;
    }
    localStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    const desktopStorage = getDesktopStorage();
    if (desktopStorage) {
      desktopStorage.removeItem(key);
      return;
    }
    localStorage.removeItem(key);
  },
};
