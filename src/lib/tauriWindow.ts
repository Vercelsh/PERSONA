import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

/**
 * Checks whether Persona is running inside the native Tauri desktop environment
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
}

export interface NativeWindowState {
  isMaximized: boolean;
  isFullscreen: boolean;
}

// Track whether window was maximized before entering fullscreen mode (fallback if JS API is used)
let wasMaximizedBeforeFs = false;
let isWindowTransitionInFlight = false;
let currentWindowState: NativeWindowState = {
  isMaximized: false,
  isFullscreen: false,
};

const stateListeners = new Set<(state: NativeWindowState) => void>();

function broadcastWindowState(next: NativeWindowState) {
  currentWindowState = next;
  stateListeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      // Ignore listener errors
    }
  });
}

function triggerPostTransitionLayoutSync() {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });
}

/**
 * Minimizes the native Windows application to taskbar
 */
export async function nativeMinimize(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    await invoke('app_minimize');
    return true;
  } catch {
    try {
      const win = getCurrentWindow();
      await win.minimize();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Toggles maximize / restore on the native desktop window.
 * If currently in fullscreen mode, it cleanly exits fullscreen and restores to normal window.
 */
export async function nativeToggleMaximize(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    return false;
  }

  if (isWindowTransitionInFlight) return false;
  isWindowTransitionInFlight = true;

  try {
    const nextState = await invoke<NativeWindowState>('app_toggle_maximize');
    if (nextState && typeof nextState.isFullscreen === 'boolean') {
      wasMaximizedBeforeFs = false;
      broadcastWindowState(nextState);
      triggerPostTransitionLayoutSync();
      return true;
    }
  } catch {
    // Fallback to JS Window API if invoke fails
    try {
      const win = getCurrentWindow();
      const isFs = await win.isFullscreen();
      if (isFs) {
        wasMaximizedBeforeFs = false;
        await win.setFullscreen(false);
        if (await win.isMaximized()) {
          await win.unmaximize();
        }
      } else {
        const isMax = await win.isMaximized();
        if (isMax) {
          await win.unmaximize();
        } else {
          await win.maximize();
        }
      }
      const [afterFs, afterMax] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
      broadcastWindowState({ isMaximized: afterMax, isFullscreen: afterFs });
      triggerPostTransitionLayoutSync();
      return true;
    } catch {
      return false;
    }
  } finally {
    isWindowTransitionInFlight = false;
  }

  return false;
}

/**
 * Closes the native application completely
 */
export async function nativeClose(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    await invoke('app_close');
    return true;
  } catch {
    try {
      const win = getCurrentWindow();
      await win.close();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Initiates native OS window dragging on mousedown (disabled in fullscreen mode)
 */
export async function nativeStartDragging(): Promise<void> {
  if (!isTauriEnvironment()) return;
  if (currentWindowState.isFullscreen) return;
  try {
    await invoke('app_start_dragging');
  } catch {
    try {
      const win = getCurrentWindow();
      if (await win.isFullscreen()) return;
      await win.startDragging();
    } catch {
      // Ignored
    }
  }
}

/**
 * Checks if native window is currently maximized
 */
export async function nativeIsMaximized(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const win = getCurrentWindow();
    return await win.isMaximized();
  } catch {
    return false;
  }
}

/**
 * Checks if native window is currently fullscreen
 */
export async function nativeIsFullscreen(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return Boolean(document.fullscreenElement);
  }
  try {
    const win = getCurrentWindow();
    return await win.isFullscreen();
  } catch {
    return false;
  }
}

/**
 * Toggles fullscreen mode smoothly without taskbar black bar or outline artifacts.
 */
export async function nativeToggleFullscreen(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    return true;
  }

  if (isWindowTransitionInFlight) return false;
  isWindowTransitionInFlight = true;

  try {
    const nextState = await invoke<NativeWindowState>('app_toggle_fullscreen');
    if (nextState && typeof nextState.isFullscreen === 'boolean') {
      broadcastWindowState(nextState);
      triggerPostTransitionLayoutSync();
      return true;
    }
  } catch {
    // Fallback to JS Window API if invoke fails
    try {
      const win = getCurrentWindow();
      const isFs = await win.isFullscreen();
      if (isFs) {
        const shouldRestoreMax = wasMaximizedBeforeFs;
        await win.setFullscreen(false);
        const nowFs = await win.isFullscreen();
        if (!nowFs) {
          wasMaximizedBeforeFs = false;
          if (shouldRestoreMax && !(await win.isMaximized())) {
            await win.maximize();
          }
        }
      } else {
        const isMax = await win.isMaximized();
        if (isMax) {
          await win.unmaximize();
        }
        await win.setFullscreen(true);
        const nowFs = await win.isFullscreen();
        if (nowFs) {
          wasMaximizedBeforeFs = isMax;
        } else {
          wasMaximizedBeforeFs = false;
          if (isMax && !(await win.isMaximized())) {
            await win.maximize();
          }
        }
      }
      const [afterFs, afterMax] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
      broadcastWindowState({ isMaximized: afterMax, isFullscreen: afterFs });
      triggerPostTransitionLayoutSync();
      return true;
    } catch {
      return false;
    }
  } finally {
    isWindowTransitionInFlight = false;
  }

  return false;
}

/**
 * Subscribes to real-time window state changes (maximize, restore, fullscreen, resize).
 * Guaranteed to stay synchronized with the OS and only emit when state values actually change.
 */
export function subscribeToWindowState(
  onChange: (state: NativeWindowState) => void
): () => void {
  let isDisposed = false;
  let unlistenResize: (() => void) | null = null;
  let lastMaximized: boolean | null = null;
  let lastFullscreen: boolean | null = null;
  let isSyncing = false;
  let pendingSync = false;

  const emitIfChanged = (isMax: boolean, isFs: boolean) => {
    if (isDisposed) return;
    currentWindowState = { isMaximized: isMax, isFullscreen: isFs };
    if (lastMaximized === isMax && lastFullscreen === isFs) return;
    lastMaximized = isMax;
    lastFullscreen = isFs;
    onChange({ isMaximized: isMax, isFullscreen: isFs });
  };

  const directListener = (next: NativeWindowState) => {
    emitIfChanged(next.isMaximized, next.isFullscreen);
  };
  stateListeners.add(directListener);

  const syncState = async () => {
    if (isDisposed) return;
    if (isSyncing) {
      pendingSync = true;
      return;
    }
    isSyncing = true;
    try {
      do {
        pendingSync = false;
        if (isDisposed) break;
        if (isTauriEnvironment()) {
          try {
            const win = getCurrentWindow();
            const [isFs, isMax] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
            emitIfChanged(isMax, isFs);
          } catch {
            // Fallback
          }
        } else {
          const isFs = Boolean(document.fullscreenElement);
          const isMax =
            !isFs &&
            typeof window !== 'undefined' &&
            window.innerWidth >= (window.screen?.availWidth ?? 1920) - 20;
          emitIfChanged(isMax, isFs);
        }
      } while (pendingSync && !isDisposed);
    } finally {
      isSyncing = false;
    }
  };

  // Immediate query
  syncState();

  if (isTauriEnvironment()) {
    try {
      const win = getCurrentWindow();
      win
        .onResized(() => {
          syncState();
        })
        .then((unsub) => {
          if (isDisposed) unsub();
          else unlistenResize = unsub;
        })
        .catch(() => {});
    } catch {
      // Ignored
    }
  } else {
    window.addEventListener('resize', syncState);
  }

  window.addEventListener('focus', syncState);
  document.addEventListener('fullscreenchange', syncState);

  return () => {
    isDisposed = true;
    stateListeners.delete(directListener);
    window.removeEventListener('resize', syncState);
    window.removeEventListener('focus', syncState);
    document.removeEventListener('fullscreenchange', syncState);
    if (unlistenResize) unlistenResize();
  };
}
