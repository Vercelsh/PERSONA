#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

static WAS_MAXIMIZED_BEFORE_FS: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn app_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn app_toggle_maximize(window: tauri::Window) {
    // If currently in fullscreen mode, cleanly exit fullscreen and restore to normal window
    if let Ok(true) = window.is_fullscreen() {
        let _ = window.set_fullscreen(false);
        let _ = window.unmaximize();
        WAS_MAXIMIZED_BEFORE_FS.store(false, Ordering::SeqCst);
        return;
    }

    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn app_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn app_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn app_toggle_fullscreen(window: tauri::Window) {
    if let Ok(is_fullscreen) = window.is_fullscreen() {
        if is_fullscreen {
            let _ = window.set_fullscreen(false);
            if WAS_MAXIMIZED_BEFORE_FS.load(Ordering::SeqCst) {
                let _ = window.maximize();
            }
        } else {
            let is_max = window.is_maximized().unwrap_or(false);
            WAS_MAXIMIZED_BEFORE_FS.store(is_max, Ordering::SeqCst);
            // On Windows undecorated windows, unmaximize before fullscreen ensures zero black bar artifacts at taskbar
            if is_max {
                let _ = window.unmaximize();
            }
            let _ = window.set_fullscreen(true);
        }
    } else {
        let _ = window.set_fullscreen(true);
    }
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
