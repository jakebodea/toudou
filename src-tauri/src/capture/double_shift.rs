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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ShiftSide {
    Left,
    Right,
}

impl ShiftSide {
    fn from_keycode(keycode: i64) -> Option<Self> {
        match keycode {
            SHIFT_LEFT => Some(Self::Left),
            SHIFT_RIGHT => Some(Self::Right),
            _ => None,
        }
    }

    fn action(self) -> DoubleShiftAction {
        match self {
            Self::Left => DoubleShiftAction::Capture,
            Self::Right => DoubleShiftAction::OpenWindow,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DoubleShiftAction {
    Capture,
    OpenWindow,
}

struct DoubleShiftState {
    last_shift_up: Option<(ShiftSide, Instant)>,
    left_shift_down: bool,
    right_shift_down: bool,
}

impl DoubleShiftState {
    const fn new() -> Self {
        Self {
            last_shift_up: None,
            left_shift_down: false,
            right_shift_down: false,
        }
    }

    fn is_shift_down(&self, side: ShiftSide) -> bool {
        match side {
            ShiftSide::Left => self.left_shift_down,
            ShiftSide::Right => self.right_shift_down,
        }
    }

    fn set_shift_down(&mut self, side: ShiftSide, down: bool) {
        match side {
            ShiftSide::Left => self.left_shift_down = down,
            ShiftSide::Right => self.right_shift_down = down,
        }
    }

    fn handle_event(
        &mut self,
        side: ShiftSide,
        shift_held: bool,
        now: Instant,
    ) -> Option<DoubleShiftAction> {
        let was_down = self.is_shift_down(side);

        // A flags-changed event identifies the key that changed, but the Shift
        // flag is aggregate when both Shift keys are held. Track each side so
        // releasing one key while the other remains down still counts as an
        // up event for the correct side.
        if was_down {
            self.set_shift_down(side, false);
            self.last_shift_up = Some((side, now));
            return None;
        }

        if !shift_held {
            return None;
        }

        self.set_shift_down(side, true);
        let Some((last_side, last_up)) = self.last_shift_up else {
            return None;
        };

        let same_side = last_side == side;
        let within_window = now.duration_since(last_up) <= DOUBLE_WINDOW;
        self.last_shift_up = None;

        if same_side && within_window {
            return Some(side.action());
        }

        None
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
        .name("toudou-double-shift".into())
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

    let Some(side) = ShiftSide::from_keycode(keycode) else {
        // Another modifier changed — cancel an in-flight double-Shift.
        state.last_shift_up = None;
        return event;
    };

    let Some(action) = state.handle_event(side, shift_held, Instant::now()) else {
        return event;
    };

    if ARMED.swap(true, Ordering::SeqCst) {
        return event;
    }

    drop(state);
    fire_action(action);
    event
}

fn fire_action(action: DoubleShiftAction) {
    let app = APP.lock().ok().and_then(|guard| guard.clone());
    let Some(app) = app else {
        ARMED.store(false, Ordering::SeqCst);
        return;
    };

    // Tiny delay so the second Shift-up finishes before AX selection reads.
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(40));
        match action {
            DoubleShiftAction::Capture => crate::capture::run_capture(&app),
            DoubleShiftAction::OpenWindow => {
                let app_for_main_thread = app.clone();
                if let Err(err) = app.run_on_main_thread(move || {
                    crate::show_main_window(&app_for_main_thread);
                }) {
                    eprintln!("show window main-thread dispatch failed: {err}");
                }
            }
        }
        ARMED.store(false, Ordering::SeqCst);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timestamp(offset_ms: u64) -> Instant {
        Instant::now() + Duration::from_millis(offset_ms)
    }

    #[test]
    fn left_double_shift_captures() {
        let mut state = DoubleShiftState::new();

        assert_eq!(
            state.handle_event(ShiftSide::Left, true, timestamp(0)),
            None
        );
        assert_eq!(
            state.handle_event(ShiftSide::Left, false, timestamp(50)),
            None
        );
        assert_eq!(
            state.handle_event(ShiftSide::Left, true, timestamp(100)),
            Some(DoubleShiftAction::Capture)
        );
    }

    #[test]
    fn right_double_shift_opens_the_window() {
        let mut state = DoubleShiftState::new();

        assert_eq!(
            state.handle_event(ShiftSide::Right, true, timestamp(0)),
            None
        );
        assert_eq!(
            state.handle_event(ShiftSide::Right, false, timestamp(50)),
            None
        );
        assert_eq!(
            state.handle_event(ShiftSide::Right, true, timestamp(100)),
            Some(DoubleShiftAction::OpenWindow)
        );
    }

    #[test]
    fn double_shift_requires_the_same_side() {
        let mut state = DoubleShiftState::new();

        state.handle_event(ShiftSide::Left, true, timestamp(0));
        state.handle_event(ShiftSide::Left, false, timestamp(50));

        assert_eq!(
            state.handle_event(ShiftSide::Right, true, timestamp(100)),
            None
        );
    }

    #[test]
    fn tracks_each_shift_side_when_both_are_held() {
        let mut state = DoubleShiftState::new();

        state.handle_event(ShiftSide::Left, true, timestamp(0));
        state.handle_event(ShiftSide::Right, true, timestamp(50));
        state.handle_event(ShiftSide::Left, false, timestamp(100));

        assert!(!state.left_shift_down);
        assert!(state.right_shift_down);
    }

    #[test]
    fn double_shift_expires_after_the_double_window() {
        let mut state = DoubleShiftState::new();

        state.handle_event(ShiftSide::Left, true, timestamp(0));
        state.handle_event(ShiftSide::Left, false, timestamp(50));

        assert_eq!(
            state.handle_event(
                ShiftSide::Left,
                true,
                timestamp(DOUBLE_WINDOW.as_millis() as u64 + 51)
            ),
            None
        );
    }
}
