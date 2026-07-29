# Towdow

Personal desktop capture inbox: grab selected content from anywhere, tag and filter it, copy it back out later.

## Language

**Capture**:
An item of content saved into Towdow — text, an image, or a URL-as-text — created from a global hotkey (selection or clipboard fallback) or from the in-app composer.
_Avoid_: Todo, task, note (unless talking about the UI metaphor casually)

**Composer**:
The small input at the bottom of the main window; Enter submits a new text Capture.
_Avoid_: New Capture form, modal

**Expanded Capture**:
A Capture row opened in place by click; body, tags, and actions are editable there.
_Avoid_: Detail page, modal editor

**Tag**:
A user-defined badge used to group and filter Captures. A Capture may have many Tags. The main list is flat — Tags are optional filing, not sections/folders.
_Avoid_: Folder, project, label, section (as a filing hierarchy)

**Source**:
An auto-assigned Tag naming the frontmost app at capture time when detectable (e.g. Cursor, Helium).
_Avoid_: Origin, app name (as a separate concept)

**Done**:
The completed state of a Capture. Done Captures stay visible in a collapsible, filterable section until purged 24 hours after completion.
_Avoid_: Archive, trash, soft-delete (as the user-facing name)
