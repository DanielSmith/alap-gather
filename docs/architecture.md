# Gather Architecture

## Module overview

```
gather.ts ──→ state.ts ←── highnotes.ts
    │              │              │
    ├─→ config.ts  ├─→ types.ts  ├─→ alap (AlapLightbox, AlapLens)
    ├─→ meta-utils.ts             │
    └─→ alap (AlapUI, engine)     └─→ state.ts
```

**gather.ts** is the main entry point. It initializes AlapUI, sets up the tray DOM, handles all drag interactions (both pointer-based and HTML5 native), and wires up export/import.

**highnotes.ts** manages the floating card layer. Cards live in an absolutely-positioned overlay (`#highnotes-layer`) that sits above normal page content but below Alap's lightbox/lens overlays.

**state.ts** holds the shared mutable arrays (`collected`, `folders`, `cards`) and handles localStorage persistence. Both gather and highnotes import from here.

**meta-utils.ts** provides metadata extraction and sanitization, extracted from the editors' shared meta library. It handles oEmbed response parsing, site-rule-based field resolution, tag normalization, and XSS sanitization.

**config.ts** defines the demo link library used by the example page.

**types.ts** defines the three core interfaces: `CollectedItem`, `GatherFolder`, and `HighNoteCard`.

## Drag interactions

There are three distinct drag paths:

### 1. Pointer drag (menu items → tray)

Menu items use a pointer-event-based drag rather than HTML5 drag. This avoids browser restrictions on reading `dataTransfer` during `dragover` and gives full control over the ghost element and drop detection.

- `pointerdown` on `#alapelem a[role="menuitem"]` starts tracking
- After 8px of movement, a custom ghost element appears and the drop zone activates
- On `pointerup` inside the tray/drop zone, the engine resolves the full link data
- If engine lookup fails (e.g. timing), falls back to DOM attributes

### 2. Native drag (menu items → enriched)

A `dragstart` listener on the document captures native HTML5 drags from menu items and piggybacks the full resolved item data into `dataTransfer` as `application/x-alap-item`. This means if a user does a native drag (instead of pointer drag) to the tray, the drop handler still gets rich data.

### 3. External drops (non-Alap links → tray)

The tray accepts drops from outside Alap menus:
- `text/html` drops are parsed with DOMParser to extract href, label, and surrounding text
- `text/uri-list` and `text/plain` URLs are accepted as fallback
- `.json` files are imported as full gather exports (with folder structure)
- Clipboard paste of JSON is also supported

External drops get tagged with the hostname and `external_drop`, and auto-enrich via oEmbed when a provider is available.

## HighNotes card system

### Z-index management

Cards occupy the z-index range 20,000–30,000. Each interaction raises a card by incrementing a high-water mark by 100. When the mark hits the ceiling, all cards rebase: the stack order array is walked oldest-to-newest, reassigning z-indices from the floor up.

Lightbox and lens overlays sit at z-index 40,000 (set via CSS custom properties) to always float above cards.

### Positioning modes

- **Pinned** (`position: fixed`): card stays in the viewport as you scroll
- **Anchored** (`position: absolute`): card scrolls with the document

Toggle via the pin button. Switching from pinned to anchored adjusts coordinates by `window.scrollX/Y`.

### Materialization

Cards are created by:
- Double-clicking a tray item (positions card to the left of the tray)
- Dragging a tray item onto the page (positions at drop coordinates)

If a card for that item already exists, it surfaces the existing card instead of duplicating: raises z-index, highlights briefly, and scrolls into view if anchored.

### Persistence

Card state (position, mode, visibility, collapsed) persists to localStorage. On page load, `restoreRenderedCards()` rebuilds the DOM from saved state.

## Folder system

Folders are flat (no nesting). Items belong to zero or one folder via `gather_folder`. Folder operations:

- **Create**: generates a timestamp-named folder, focuses the name input
- **Rename**: inline editable input, persists on blur or Enter
- **Reorder**: drag the handle to reorder folders (before/after insertion)
- **Collapse**: animated via CSS grid `grid-template-rows` transition
- **Delete**: promotes child items to root level
- **Active folder**: clicking a folder marks it active; new items auto-assign to the active folder

Items can be dragged between folders or back to root (drop on header).

## Export formats

| Format | Scope | Details |
|--------|-------|---------|
| JSON config | All items | Alap-compatible `{ settings, allLinks }` |
| Markdown | All items + folders | Folder-aware headings, `#tag` syntax, photo credits, thumbnails |
| Bookmarks HTML | All items + folders | Netscape bookmark format importable by all browsers |
| Save Gather | Full state | JSON with `allLinks` + `gather` section containing folder structure and assignments |

## Enrichment pipeline

For external drops and Alap items alike, `tryEnrich()` attempts client-side oEmbed:

1. Match URL against known CORS-friendly providers (Vimeo, Spotify)
2. Fetch oEmbed JSON with a 5-second timeout
3. Parse response via `parseOembedResponse()`
4. Sanitize all fields via `sanitizeRaw()` (strips HTML, blocks script injection)
5. Apply site rules via `applyRule()` to extract title, description, thumbnail, tags
6. Merge enriched data back into the CollectedItem
