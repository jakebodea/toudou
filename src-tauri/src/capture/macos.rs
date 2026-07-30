use super::{CapturePayload, PermissionStatus};
use crate::capture::double_shift;
use objc2_app_kit::NSWorkspace;
use objc2_application_services::{
    kAXTrustedCheckOptionPrompt, AXError, AXIsProcessTrusted, AXIsProcessTrustedWithOptions,
    AXUIElement,
};
use objc2_core_foundation::{CFBoolean, CFDictionary, CFRetained, CFString, CFType};
use objc2_foundation::{NSString, NSURL};
use std::ptr::NonNull;
use tauri::AppHandle;

const ACCESSIBILITY_SETTINGS_URL: &str =
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility";
const INPUT_MONITORING_SETTINGS_URL: &str =
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ListenEvent";

pub fn permission_status() -> PermissionStatus {
    PermissionStatus {
        accessibility: unsafe { AXIsProcessTrusted() },
        input_monitoring: double_shift::input_monitoring_granted(),
    }
}

pub fn request_accessibility_permission() {
    unsafe {
        let key = kAXTrustedCheckOptionPrompt;
        let value = CFBoolean::new(true);
        let options = CFDictionary::<CFString, CFBoolean>::from_slices(&[key], &[value]);
        let _ = AXIsProcessTrustedWithOptions(Some(options.as_ref()));
    }
    open_settings_url(ACCESSIBILITY_SETTINGS_URL);
}

pub fn request_input_monitoring_permission() {
    double_shift::request_input_monitoring();
    open_settings_url(INPUT_MONITORING_SETTINGS_URL);
}

pub fn start_double_shift_listener(app: AppHandle) {
    double_shift::start(app);
}

pub fn read_capture_payload() -> Option<CapturePayload> {
    let body = selected_text()?;
    let trimmed = body.trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    Some(CapturePayload {
        body: trimmed,
        source: frontmost_app_name(),
    })
}

fn frontmost_app_name() -> String {
    let workspace = NSWorkspace::sharedWorkspace();
    workspace
        .frontmostApplication()
        .and_then(|app| app.localizedName())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

fn open_settings_url(settings_url: &str) {
    let url_string = NSString::from_str(settings_url);
    let Some(url) = NSURL::URLWithString(&url_string) else {
        return;
    };
    let _ = NSWorkspace::sharedWorkspace().openURL(&url);
}

fn selected_text() -> Option<String> {
    if !unsafe { AXIsProcessTrusted() } {
        return None;
    }

    unsafe {
        let system = AXUIElement::new_system_wide();
        let focused = copy_ax_attr(&system, "AXFocusedUIElement")?;
        let focused_el = focused.downcast::<AXUIElement>().ok()?;
        let selected = copy_ax_attr(&focused_el, "AXSelectedText")?;
        let text = selected.downcast::<CFString>().ok()?;
        Some(text.to_string())
    }
}

unsafe fn copy_ax_attr(element: &AXUIElement, attribute: &str) -> Option<CFRetained<CFType>> {
    let attr = CFString::from_str(attribute);
    let mut value: *const CFType = std::ptr::null();
    let err = unsafe { element.copy_attribute_value(&attr, NonNull::from(&mut value)) };
    if err != AXError::Success || value.is_null() {
        return None;
    }
    Some(unsafe { CFRetained::from_raw(NonNull::new_unchecked(value.cast_mut())) })
}
