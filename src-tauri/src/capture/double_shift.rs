//! Listen-only CGEventTap for double-Shift.
//!
//! Deliberately avoids `rdev` / Text Input Source — those call TSM off the
//! tap thread and SIGTRAP the process. This tap only reads keycodes + flags.

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;

const SHIFT_LEFT: i64 = 56;
const SHIFT_RIGHT: i64 = 60;
const DOUBLE_WINDOW: Duration = Duration::from_millis(350);

const K_CG_SESSION_EVENT_TAP: u32 = 1;
const K_CG_HEAD_INSERT_EVENT_TAP: u32 = 0;
const K_CG_EVENT_TAP_OPTION_LISTEN_ONLY: u32 = 1;
const K_CG_EVENT_FLAGS_CHANGED: u32 = 12;
const K_CG_EVENT_TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
const K_CG_EVENT_TAP_DISABLED_BY_USER_INPUT: u32 = 0xFFFF_FFFF;
const K_CG_KEYBOARD_EVENT_KEYCODE: u32 = 9;
const K_CG_EVENT_FLAG_MASK_SHIFT: u64 = 0x0002_0000;

type CgEventRef = *mut c_void;
type CfMachPortRef = *mut c_void;
type CfRunLoopSourceRef = *mut c_void;
type CfRunLoopRef = *mut c_void;
type CfStringRef = *const c_void;

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: unsafe extern "C" fn(
            proxy: *mut c_void,
            event_type: u32,
            event: CgEventRef,
            user_info: *mut c_void,
        ) -> CgEventRef,
        user_info: *mut c_void,
    ) -> CfMachPortRef;
    fn CGEventTapEnable(tap: CfMachPortRef, enable: bool);
    fn CGEventGetIntegerValueField(event: CgEventRef, field: u32) -> i64;
    fn CGEventGetFlags(event: CgEventRef) -> u64;
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFMachPortCreateRunLoopSource(
        allocator: *const c_void,
        port: CfMachPortRef,
        order: isize,
    ) -> CfRunLoopSourceRef;
    fn CFRunLoopGetCurrent() -> CfRunLoopRef;
    fn CFRunLoopAddSource(rl: CfRunLoopRef, source: CfRunLoopSourceRef, mode: CfStringRef);
    fn CFRunLoopRun();
    static kCFRunLoopCommonModes: CfStringRef;
}

static TAP_PORT: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
static ARMED: AtomicBool = AtomicBool::new(false);
static STATE: Mutex<DoubleShiftState> = Mutex::new(DoubleShiftState::new());
static APP: Mutex<Option<AppHandle>> = Mutex::new(None);

struct DoubleShiftState {
    last_shift_up: Option<Instant>,
    shift_down: bool,
}

impl DoubleShiftState {
    const fn new() -> Self {
        Self {
            last_shift_up: None,
            shift_down: false,
        }
    }
}

pub fn input_monitoring_granted() -> bool {
    unsafe { CGPreflightListenEventAccess() }
}

pub fn request_input_monitoring() {
    unsafe {
        let _ = CGRequestListenEventAccess();
    }
}

pub fn start(app: AppHandle) {
    if let Ok(mut slot) = APP.lock() {
        *slot = Some(app);
    }

    std::thread::Builder::new()
        .name("towdow-double-shift".into())
        .spawn(|| {
            if let Err(err) = run_tap() {
                eprintln!("double-Shift tap failed: {err}");
            }
        })
        .expect("spawn double-Shift thread");
}

fn run_tap() -> Result<(), String> {
    let mask = 1u64 << K_CG_EVENT_FLAGS_CHANGED;
    unsafe {
        let tap = CGEventTapCreate(
            K_CG_SESSION_EVENT_TAP,
            K_CG_HEAD_INSERT_EVENT_TAP,
            K_CG_EVENT_TAP_OPTION_LISTEN_ONLY,
            mask,
            tap_callback,
            std::ptr::null_mut(),
        );
        if tap.is_null() {
            return Err(
                "CGEventTapCreate returned null (grant Input Monitoring, then relaunch)".into(),
            );
        }
        TAP_PORT.store(tap, Ordering::SeqCst);

        let source = CFMachPortCreateRunLoopSource(std::ptr::null(), tap, 0);
        if source.is_null() {
            return Err("CFMachPortCreateRunLoopSource returned null".into());
        }

        let rl = CFRunLoopGetCurrent();
        CFRunLoopAddSource(rl, source, kCFRunLoopCommonModes);
        CGEventTapEnable(tap, true);
        CFRunLoopRun();
    }
    Ok(())
}

unsafe extern "C" fn tap_callback(
    _proxy: *mut c_void,
    event_type: u32,
    event: CgEventRef,
    _user_info: *mut c_void,
) -> CgEventRef {
    if event_type == K_CG_EVENT_TAP_DISABLED_BY_TIMEOUT
        || event_type == K_CG_EVENT_TAP_DISABLED_BY_USER_INPUT
    {
        let tap = TAP_PORT.load(Ordering::SeqCst);
        if !tap.is_null() {
            unsafe { CGEventTapEnable(tap, true) };
        }
        return event;
    }

    if event_type != K_CG_EVENT_FLAGS_CHANGED || event.is_null() {
        return event;
    }

    let keycode = unsafe { CGEventGetIntegerValueField(event, K_CG_KEYBOARD_EVENT_KEYCODE) };
    let flags = unsafe { CGEventGetFlags(event) };
    let shift_held = (flags & K_CG_EVENT_FLAG_MASK_SHIFT) != 0;

    let Ok(mut state) = STATE.lock() else {
        return event;
    };

    if keycode != SHIFT_LEFT && keycode != SHIFT_RIGHT {
        // Another modifier changed — cancel an in-flight double-Shift.
        state.last_shift_up = None;
        state.shift_down = shift_held && state.shift_down;
        return event;
    }

    if shift_held {
        if state.shift_down {
            return event;
        }
        state.shift_down = true;
        if let Some(prev) = state.last_shift_up {
            if prev.elapsed() <= DOUBLE_WINDOW && !ARMED.swap(true, Ordering::SeqCst) {
                state.last_shift_up = None;
                state.shift_down = false;
                drop(state);
                fire_capture();
                return event;
            }
        }
    } else {
        state.shift_down = false;
        state.last_shift_up = Some(Instant::now());
    }

    event
}

fn fire_capture() {
    let app = APP.lock().ok().and_then(|guard| guard.clone());
    let Some(app) = app else {
        ARMED.store(false, Ordering::SeqCst);
        return;
    };

    // Tiny delay so the second Shift-up finishes before AX/clipboard reads.
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(40));
        crate::capture::run_capture(&app);
        ARMED.store(false, Ordering::SeqCst);
    });
}
