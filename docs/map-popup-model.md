# Map Popup Model

This document defines the next popup state shape for the fullscreen map before any additional popup behavior is added.

## Principles

- Keep cross-surface focus separate from map-local popup state.
- Let the global store keep only the currently selected camera that must stay in sync with the gallery, modal, URL state, and fullscreen map.
- Keep multi-popup behavior inside the map feature so hover, preview, pinning, and collision layout do not leak into the global app store.
- Persist only the focused camera to the URL for now.
- Treat pinned and preview popups as local UI state until there is a deliberate sharing model for them.

## Current Contract

- `selectedCameraId` is the shared focus camera.
- In gallery mode, a selected camera is visible only while the modal is open.
- In fullscreen map mode, a selected camera is visible as the focused popup.
- If filters remove the selected camera from the filtered result set, the selection is cleared.
- If fullscreen map exits back to the gallery shell, the shared selection is cleared.

## Next-State Popup Model

The map feature owns a local `MapPopupState`.

- `focusCameraId`: the popup tied to the shared app selection.
- `previewCameraId`: a transient popup for hover or soft preview interactions.
- `pinnedCameraIds`: stable map-local popups that can coexist with the focused popup.
- `maxPinnedPopups`: a map-local cap to keep layout and rendering bounded.

The implementation scaffold lives in `src/features/map/popup-model.ts`.

## Rendering Order

- Render the focused popup first.
- Render the preview popup second if it is different from the focused popup.
- Render pinned popups last in insertion order.
- Deduplicate camera IDs before layout so one camera cannot produce multiple popup cards.

## URL Scope

- Keep `camera` in the URL as the focused camera only.
- Do not serialize pinned popup IDs yet.
- Do not serialize preview popup state.
- Add a dedicated URL contract later only if pinned popup sharing becomes a real product requirement.

## Migration Path

- Keep the current app store contract as-is for shared focus.
- Move future popup interactions onto a local reducer in `MapView` that uses `MapPopupState`.
- Feed `getVisiblePopupDescriptors()` into collision layout instead of wrapping more logic around `selectedCameraId`.
- Promote only the focused popup back into the shared store and URL.