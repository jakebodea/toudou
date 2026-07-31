use objc2::{rc::Retained, runtime::ProtocolObject, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSBackingStoreType, NSPanel, NSWindowStyleMask};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};
use objc2_quick_look_ui::{QLPreviewItem, QLPreviewView, QLPreviewViewStyle};
use std::cell::RefCell;
use std::path::Path;

const PANEL_WIDTH: f64 = 760.0;
const PANEL_HEIGHT: f64 = 560.0;

thread_local! {
    static PREVIEW_PANEL: RefCell<Option<Retained<NSPanel>>> = const { RefCell::new(None) };
}

pub fn show(path: &Path) {
    let Some(main_thread) = MainThreadMarker::new() else {
        return;
    };

    PREVIEW_PANEL.with(|stored_panel| {
        if let Some(previous) = stored_panel.borrow_mut().take() {
            previous.close();
        }
    });

    let frame = NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(PANEL_WIDTH, PANEL_HEIGHT),
    );
    let style = NSWindowStyleMask::Titled
        | NSWindowStyleMask::Closable
        | NSWindowStyleMask::Resizable
        | NSWindowStyleMask::UtilityWindow;
    let panel = NSPanel::initWithContentRect_styleMask_backing_defer(
        NSPanel::alloc(main_thread),
        frame,
        style,
        NSBackingStoreType::Buffered,
        false,
    );
    let Some(preview) = (unsafe {
        QLPreviewView::initWithFrame_style(
            QLPreviewView::alloc(main_thread),
            frame,
            QLPreviewViewStyle::Normal,
        )
    }) else {
        return;
    };

    let path = NSString::from_str(&path.to_string_lossy());
    let url = NSURL::fileURLWithPath(&path);
    let item: &ProtocolObject<dyn QLPreviewItem> = ProtocolObject::from_ref(&*url);
    unsafe {
        preview.setPreviewItem(Some(item));
    }

    panel.setContentView(Some(&preview));
    panel.setTitle(&NSString::from_str("Quick Look"));
    panel.setFloatingPanel(true);
    panel.center();
    panel.makeKeyAndOrderFront(None);
    PREVIEW_PANEL.with(|stored_panel| stored_panel.replace(Some(panel)));
}
