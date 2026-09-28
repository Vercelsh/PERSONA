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

// Track whether window was maximized before entering fullscreen mode
let wasMaximizedBeforeFs = false;

/**
 * Minimizes the native Windows application to taskbar
 */
export async function nativeMinimize(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const win = getCurrentWindow();
    await win.minimize();
    return true;
  } catch {
    try {
      await invoke('app_minimize');
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

  try {
    const win = getCurrentWindow();
    const isFs = await win.isFullscreen();
    if (isFs) {
      wasMaximizedBeforeFs = false;
      await win.setFullscreen(false);
      await win.unmaximize();
      return true;
    }

    const isMax = await win.isMaximized();
    if (isMax) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
    return true;
  } catch {
    try {
      await invoke('app_toggle_maximize');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Closes the native application completely
 */
export async function nativeClose(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const win = getCurrentWindow();
    await win.close();
    return true;
  } catch {
    try {
      await invoke('app_close');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Initiates native OS window dragging on mousedown
 */
export async function nativeStartDragging(): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const win = getCurrentWindow();
    await win.startDragging();
  } catch {
    try {
      await invoke('app_start_dragging');
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
 * Toggles fullscreen mode smoothly without jitter, black bars, or white outlines.
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

  try {
    const win = getCurrentWindow();
    const isFs = await win.isFullscreen();
    if (isFs) {
      await win.setFullscreen(false);
      if (wasMaximizedBeforeFs) {
        await win.maximize();
      }
    } else {
      const isMax = await win.isMaximized();
      wasMaximizedBeforeFs = isMax;
      if (isMax) {
        await win.unmaximize();
      }
      await win.setFullscreen(true);
    }
    return true;
  } catch {
    try {
      await invoke('app_toggle_fullscreen');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Subscribes to real-time window state changes (maximize, restore, fullscreen, resize).
 * Guaranteed to stay synchronized with the OS at all times.
 */
export function subscribeToWindowState(
  onChange: (state: { isMaximized: boolean; isFullscreen: boolean }) => void
): () => void {
  let isDisposed = false;
  let unlistenResize: (() => void) | null = null;
  let unlistenMove: (() => void) | null = null;

  const syncState = async () => {
    if (isDisposed) return;
    if (isTauriEnvironment()) {
      try {
        const win = getCurrentWindow();
        const [isFs, isMax] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
        if (!isDisposed) {
          onChange({ isMaximized: isMax, isFullscreen: isFs });
        }
      } catch {
        // Fallback
      }
    } else {
      const isFs = Boolean(document.fullscreenElement);
      const isMax = isFs || (typeof window !== 'undefined' && window.innerWidth >= (window.screen?.availWidth ?? 1920) - 20);
      onChange({ isMaximized: isMax, isFullscreen: isFs });
    }
  };

  // Immediate query
  syncState();

  if (isTauriEnvironment()) {
    try {
      const win = getCurrentWindow();
      win.onResized(() => {
        syncState();
      }).then((unsub) => {
        if (isDisposed) unsub();
        else unlistenResize = unsub;
      }).catch(() => {});

      win.onMoved(() => {
        syncState();
      }).then((unsub) => {
        if (isDisposed) unsub();
        else unlistenMove = unsub;
      }).catch(() => {});
    } catch {
      // Ignored
    }
  }

  const handleWebChange = () => {
    syncState();
  };

  window.addEventListener('resize', handleWebChange);
  document.addEventListener('fullscreenchange', handleWebChange);

  return () => {
    isDisposed = true;
    window.removeEventListener('resize', handleWebChange);
    document.removeEventListener('fullscreenchange', handleWebChange);
    if (unlistenResize) unlistenResize();
    if (unlistenMove) unlistenMove();
  };
}
