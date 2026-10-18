// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod single_instance {
    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS, HWND};
    use windows::Win32::System::Threading::CreateMutexW;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE,
    };

    pub fn ensure_single_instance() -> bool {
        unsafe {
            let handle = CreateMutexW(None, true, w!("Local\\OrbiterSingleInstanceMutex"));
            if handle.is_err() {
                return true;
            }
            if GetLastError() == ERROR_ALREADY_EXISTS {
                let mut hwnd: HWND = FindWindowW(None, w!("Orbiter — 8D Spatial Audio Editor by HaiCLOP Labs"));
                if hwnd.0 == 0 {
                    hwnd = FindWindowW(None, w!("Orbiter — 8D Spatial Audio Editor"));
                }
                if hwnd.0 != 0 {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    let _ = SetForegroundWindow(hwnd);
                    return false;
                }
                return true;
            }
        }
        true
    }
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Orbiter Panic: {info}\n");
        eprintln!("{msg}");
        let _ = std::fs::write("panic.log", &msg);
    }));

    #[cfg(windows)]
    {
        if !single_instance::ensure_single_instance() {
            eprintln!("Orbiter instance already running. Brought to foreground.");
            return;
        }
    }

    orbiter_lib::run();
}
