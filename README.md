# Alap Gather

Drag menu items into a side tray to build ad-hoc collections from multiple Alap menus. Mix static config entries with live protocol feeds (`:atproto:`, etc.), organize into folders, then export or view in Lightbox/Lens.

## Features

- **Grab from menus** — pointer-drag any menu item sideways into the collection tray
- **External drops** — drag regular links from the page (or other tabs) onto the tray
- **Folders** — create, rename, reorder, and collapse folders; drag items between them
- **HighNotes** — double-click a collected item (or drag it out of the tray) to materialize a floating card on the page, with pin/unpin, drag-to-reposition, collapse, and z-stacking
- **Lightbox / Lens** — open the entire collection in Alap's lightbox or lens viewer
- **Export** — copy as JSON config, Markdown (Obsidian-friendly with `#tags`), or Netscape bookmark HTML
- **Save / Import** — full round-trip JSON with folder structure; drop a `.json` file onto the tray to import
- **Enrichment** — external drops auto-enrich via client-side oEmbed (Vimeo, Spotify) with sanitized metadata
- **Persistence** — collected items, folders, and HighNotes cards survive page reloads via localStorage

## Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173/examples/` in a browser.

## Project structure

```
src/
  gather.ts       Main module: tray UI, drag interactions, export, import
  highnotes.ts    Floating cards materialized from collected items
  state.ts        Shared mutable state and localStorage persistence
  types.ts        CollectedItem, GatherFolder, HighNoteCard interfaces
  config.ts       Demo link library (bridges, coffee, landmarks, :atproto: feeds)
  meta-utils.ts   Metadata extraction, sanitization, oEmbed parsing
  gather.css      Tray, folders, drag ghost, drop zone styles
  highnotes.css   Floating card styles and z-index layering

examples/
  index.html      Demo page with static, dynamic, mixed, and external link sections
  styles.css      Shared example theme (also used by other Alap examples)
```

## How it works

1. `AlapUI` initializes menus from `demoConfig` (including `:atproto:` protocol feeds)
2. `pointerdown`/`pointermove` on menu items detects a sideways drag past an 8px threshold
3. On drop into the tray zone, the engine resolves the full `ResolvedLink` with tags, description, thumbnail, and metadata
4. Items render in a folder-aware tray with drag-to-reorder between items and folders
5. Double-click or drag-out materializes a HighNotes card (floating, draggable, z-stacked)
6. Tag chips on HighNotes cards open a filtered lightbox scoped to that tag across all collected items

## Relationship to Alap

Gather is a standalone application built on top of the Alap library. It imports `AlapUI`, `AlapLightbox`, `AlapLens`, and the engine/type system from the `alap` package. Gather owns the collection UX; Alap owns expression resolution, menu rendering, and viewer components.

## License

Apache-2.0
