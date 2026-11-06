# The OpenHarmony documentation, searched

`oniro-app api show` / `api search` read the SDK typings: they say whether a symbol exists
at this API level and with what signature. They cannot say how an API is used, what a
component's attributes do, which business error codes a kit throws or how the platform
behaves (lifecycle, permissions, threads). That is in the OpenHarmony application-development
documentation (`en/application-dev` of gitcode.com/openharmony/docs), which `oniro-app
docs` reads for the release matching the project's SDK (`6.1.0.x` → `OpenHarmony-6.1-Release`).

## Commands

- `oniro-app docs sync` (once per SDK release, about 100 MB; `--api <level>`, `--sdk <dir>`
  or `--ref <branch>` pick another release). Every other `docs` command says when the
  release is not synced: run this, then retry. Needs `git`.
- `oniro-app docs search "<words>"` ranks the pages that contain every word by where the
  words occur (title, headings, path, body) and prints each page's path, title, the
  **matching sections with their lines** and its first line. Use domain words (a component,
  kit or decorator name, an error code), not sentences: `docs search LazyForEach reuse`,
  `docs search relationalStore insert`, `docs search 14800011`, `docs search
  Navigation pushPathByName`. `--section ui|database|application-models`
  narrows; `--limit <n>` (default 8). Exit 1 means no page matched: fewer or different words.
- `oniro-app docs show <path> --heading "<section>"` prints that section (from the heading
  to the next of the same level; a distinctive part of the heading is enough). Without
  `--heading` the page is cut at 250 lines (`--lines <n>`) and lists its sections: read a
  section, not the page. Exit 1 names close paths or the page's headings.
- `--json` on each; `serve mcp` exposes them as `docs_search` and `docs_show`.

## When to look

- Before using a kit or component for the first time in the task (persistence, Navigation,
  LazyForEach/Repeat, permissions, a lifecycle hook): one search, one section, then write.
- A compile error code the build names (`10905xxx` ArkUI, `arkts-…` rules): `docs search
  <code>` finds the catalogue entry with the fix.
- A business error code at runtime (`14800011` RDB, `401`, `201`): the error-code page
  says the cause and what to do.
- Never paste a whole page into the context: a section is 20–80 lines.

## Where things are

| Need | Section |
| --- | --- |
| ArkUI components, attributes, events | `reference/apis-arkui/arkui-ts/ts-basic-components-*.md`, `ts-container-*.md` |
| ArkUI guides (layout, Navigation, state, rendering control) | `ui/` |
| State management V2 | `ui/state-management/arkts-new-*.md` |
| Preferences, RDB, KV store | `database/`, `reference/apis-arkdata/` |
| UIAbility, lifecycle, contexts, Want | `application-models/`, `reference/apis-ability-kit/` |
| Permissions | `security/AccessToken/` |
| Error codes per kit | `reference/apis-*/errorcode-*.md` |
| ArkUI compile error codes | `reference/apis-arkui/_ark_ui_compile.md` |
