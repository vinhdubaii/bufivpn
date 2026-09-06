#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    WindowEvent,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const POPUP_WIDTH: f64 = 300.0;
const POPUP_HEIGHT: f64 = 400.0;

fn run_hidden(cmd: &str, args: &[&str]) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new(cmd)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (cmd, args);
        Err("Only supported on Windows".to_string())
    }
}

fn get_output_hidden(cmd: &str, args: &[&str]) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new(cmd)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (cmd, args);
        Err("Only supported on Windows".to_string())
    }
}

/// Get list of network adapters currently "Up", via PowerShell.
#[tauri::command]
fn list_adapters() -> Result<Vec<String>, String> {
    let text = get_output_hidden(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -ExpandProperty Name",
        ],
    )?;

    let adapters: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(adapters)
}

/// Set static DNS on every active adapter to primary/secondary.
#[tauri::command]
fn set_dns(primary: String, secondary: String) -> Result<(), String> {
    let adapters = list_adapters()?;
    if adapters.is_empty() {
        return Err("No active network adapter found".to_string());
    }

    for adapter in adapters {
        let name_arg = format!("name={}", adapter);

        run_hidden(
            "netsh",
            &["interface", "ip", "set", "dns", &name_arg, "static", &primary, "primary"],
        )?;

        if !secondary.is_empty() {
            // Ignore errors adding secondary (some virtual adapters don't support it)
            let _ = run_hidden(
                "netsh",
                &["interface", "ip", "add", "dns", &name_arg, &secondary, "index=2"],
            );
        }
    }

    Ok(())
}

/// Reset DNS back to automatic (DHCP) on every active adapter.
#[tauri::command]
fn reset_dns() -> Result<(), String> {
    let adapters = list_adapters()?;
    for adapter in adapters {
        let name_arg = format!("name={}", adapter);
        let _ = run_hidden("netsh", &["interface", "ip", "set", "dns", &name_arg, "dhcp"]);
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct LocationInfo {
    city: String,
    country: String,
    lat: f64,
    lng: f64,
    ip: String,
}

/// Detect the user's approximate location via public IP-geolocation APIs.
/// Done on the Rust side (not from the webview) so it isn't affected by the
/// app's Content-Security-Policy / webview CORS restrictions.
#[tauri::command]
async fn get_my_location() -> Result<LocationInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    // Primary provider: ipapi.co
    if let Ok(resp) = client.get("https://ipapi.co/json/").send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let (Some(lat), Some(lng)) = (
                json.get("latitude").and_then(|v| v.as_f64()),
                json.get("longitude").and_then(|v| v.as_f64()),
            ) {
                return Ok(LocationInfo {
                    city: json.get("city").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                    country: json.get("country_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    lat,
                    lng,
                    ip: json.get("ip").and_then(|v| v.as_str()).unwrap_or("—").to_string(),
                });
            }
        }
    }

    // Fallback provider: ipwho.is
    let resp = client
        .get("https://ipwho.is/")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let success = json.get("success").and_then(|v| v.as_bool()).unwrap_or(true);
    if !success {
        return Err("Could not detect location from either provider".to_string());
    }

    Ok(LocationInfo {
        city: json.get("city").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
        country: json.get("country").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        lat: json.get("latitude").and_then(|v| v.as_f64()).unwrap_or(21.0285),
        lng: json.get("longitude").and_then(|v| v.as_f64()).unwrap_or(105.8542),
        ip: json.get("ip").and_then(|v| v.as_str()).unwrap_or("—").to_string(),
    })
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn toggle_tray_popup(app: &tauri::AppHandle, cursor_pos: tauri::PhysicalPosition<f64>) {
    if let Some(popup) = app.get_window("tray-popup") {
        let is_visible = popup.is_visible().unwrap_or(false);
        if is_visible {
            let _ = popup.hide();
            return;
        }

        // Position the popup just above/left of the tray click point so it
        // behaves like a normal Windows tray flyout near the bottom-right corner.
        if let Ok(Some(monitor)) = popup.current_monitor() {
            let screen_size = monitor.size();
            let scale = monitor.scale_factor();
            let mut x = cursor_pos.x - (POPUP_WIDTH * scale) / 2.0;
            let mut y = cursor_pos.y - (POPUP_HEIGHT * scale) - 12.0;

            let max_x = screen_size.width as f64 - (POPUP_WIDTH * scale) - 8.0;
            let max_y = screen_size.height as f64 - (POPUP_HEIGHT * scale) - 8.0;
            if x > max_x { x = max_x; }
            if x < 8.0 { x = 8.0; }
            if y > max_y { y = max_y; }
            if y < 8.0 { y = 8.0; }

            let _ = popup.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        }

        let _ = popup.show();
        let _ = popup.set_focus();
    }
}

fn main() {
    let open_item = CustomMenuItem::new("open".to_string(), "Open BUFI VPN");
    let quit_item = CustomMenuItem::new("quit".to_string(), "Exit");
    let tray_menu = SystemTrayMenu::new()
        .add_item(open_item)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit_item);
    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_adapters, set_dns, reset_dns, get_my_location])
        .system_tray(tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { position, .. } => {
                toggle_tray_popup(app, position);
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "open" => show_main_window(app),
                "quit" => {
                    let _ = reset_dns();
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            // Main window: closing (the X button) only hides it, so the app
            // keeps running in the background (DNS stays applied) until the
            // user explicitly chooses "Exit" from the tray menu.
            if let Some(main_win) = app.get_window("main") {
                let main_win_clone = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_win_clone.hide();
                    }
                });
            }

            // Tray popup: behaves like a flyout, auto-hides when it loses focus.
            if let Some(popup) = app.get_window("tray-popup") {
                let popup_clone = popup.clone();
                popup.on_window_event(move |event| {
                    if let WindowEvent::Focused(focused) = event {
                        if !*focused {
                            let _ = popup_clone.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running BUFI VPN");
}
