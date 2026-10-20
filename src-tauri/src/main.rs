#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Manager;

static WAS_MAXIMIZED_BEFORE_FS: AtomicBool = AtomicBool::new(false);
static IS_WINDOW_TRANSITIONING: AtomicBool = AtomicBool::new(false);

struct TransitionGuard;

impl TransitionGuard {
    fn try_acquire() -> Option<Self> {
        if IS_WINDOW_TRANSITIONING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            Some(TransitionGuard)
        } else {
            None
        }
    }
}

impl Drop for TransitionGuard {
    fn drop(&mut self) {
        IS_WINDOW_TRANSITIONING.store(false, Ordering::SeqCst);
    }
}

#[derive(serde::Serialize, Clone, Copy)]
struct WindowStatePayload {
    #[serde(rename = "isMaximized")]
    is_maximized: bool,
    #[serde(rename = "isFullscreen")]
    is_fullscreen: bool,
}

#[tauri::command]
fn app_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
async fn app_toggle_maximize(window: tauri::Window) -> Result<WindowStatePayload, String> {
    let Some(_guard) = TransitionGuard::try_acquire() else {
        return Ok(WindowStatePayload {
            is_maximized: window.is_maximized().unwrap_or(false),
            is_fullscreen: window.is_fullscreen().unwrap_or(false),
        });
    };

    // If currently in fullscreen mode, cleanly exit fullscreen and restore to normal window
    if window.is_fullscreen().unwrap_or(false) {
        WAS_MAXIMIZED_BEFORE_FS.store(false, Ordering::SeqCst);
        let _ = window.set_fullscreen(false);
        for _ in 0..50 {
            if !window.is_fullscreen().unwrap_or(true) {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
            for _ in 0..50 {
                if !window.is_maximized().unwrap_or(true) {
                    break;
                }
                std::thread::sleep(Duration::from_millis(2));
            }
        }
        return Ok(WindowStatePayload {
            is_maximized: window.is_maximized().unwrap_or(false),
            is_fullscreen: window.is_fullscreen().unwrap_or(false),
        });
    }

    let is_max = window.is_maximized().unwrap_or(false);
    if is_max {
        WAS_MAXIMIZED_BEFORE_FS.store(false, Ordering::SeqCst);
        let _ = window.unmaximize();
        for _ in 0..50 {
            if !window.is_maximized().unwrap_or(true) {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    } else {
        let _ = window.maximize();
        for _ in 0..50 {
            if window.is_maximized().unwrap_or(false) {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }

    Ok(WindowStatePayload {
        is_maximized: window.is_maximized().unwrap_or(false),
        is_fullscreen: window.is_fullscreen().unwrap_or(false),
    })
}

#[tauri::command]
fn app_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn app_start_dragging(window: tauri::Window) {
    // Strictly forbid dragging while in fullscreen mode
    if window.is_fullscreen().unwrap_or(false) {
        return;
    }
    let _ = window.start_dragging();
}

#[tauri::command]
async fn app_toggle_fullscreen(window: tauri::Window) -> Result<WindowStatePayload, String> {
    let Some(_guard) = TransitionGuard::try_acquire() else {
        return Ok(WindowStatePayload {
            is_maximized: window.is_maximized().unwrap_or(false),
            is_fullscreen: window.is_fullscreen().unwrap_or(false),
        });
    };

    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    if is_fullscreen {
        let should_restore_max = WAS_MAXIMIZED_BEFORE_FS.load(Ordering::SeqCst);
        let _ = window.set_fullscreen(false);
        for _ in 0..50 {
            if !window.is_fullscreen().unwrap_or(true) {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }

        let exited_fs = !window.is_fullscreen().unwrap_or(true);
        if exited_fs {
            WAS_MAXIMIZED_BEFORE_FS.store(false, Ordering::SeqCst);
            if should_restore_max {
                if !window.is_maximized().unwrap_or(false) {
                    let _ = window.maximize();
                    for _ in 0..50 {
                        if window.is_maximized().unwrap_or(false) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(2));
                    }
                }
            } else if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
                for _ in 0..50 {
                    if !window.is_maximized().unwrap_or(true) {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(2));
                }
            }
        }
    } else {
        let is_max = window.is_maximized().unwrap_or(false);

        // On Windows undecorated windows (decorations: false), tao's WM_NCCALCSIZE clamps client bounds
        // to monitor.rcWork (excluding the 48px taskbar) whenever IsZoomed(hwnd) / WS_MAXIMIZE is set.
        // We must unmaximize and wait for Win32 to clear WS_MAXIMIZE before entering fullscreen.
        if is_max {
            let _ = window.unmaximize();
            for _ in 0..50 {
                if !window.is_maximized().unwrap_or(true) {
                    break;
                }
                std::thread::sleep(Duration::from_millis(2));
            }
        }

        let _ = window.set_fullscreen(true);
        for _ in 0..50 {
            if window.is_fullscreen().unwrap_or(false) {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }

        let entered_fs = window.is_fullscreen().unwrap_or(false);
        if entered_fs {
            WAS_MAXIMIZED_BEFORE_FS.store(is_max, Ordering::SeqCst);
        } else {
            WAS_MAXIMIZED_BEFORE_FS.store(false, Ordering::SeqCst);
            if is_max && !window.is_maximized().unwrap_or(false) {
                let _ = window.maximize();
                for _ in 0..50 {
                    if window.is_maximized().unwrap_or(false) {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(2));
                }
            }
        }
    }

    Ok(WindowStatePayload {
        is_maximized: window.is_maximized().unwrap_or(false),
        is_fullscreen: window.is_fullscreen().unwrap_or(false),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            app_minimize,
            app_toggle_maximize,
            app_close,
            app_start_dragging,
            app_toggle_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running persona desktop");
}
