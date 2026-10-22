---
name: hmos-i18n-resource-sync
description: Localize HarmonyOS ArkTS/ArkUI projects. Scan .ets pages and components for user-facing static copy, extract it into string.json, replace literals with $r(...) references, create missing module resource directories and confirmed locale files (such as zh_CN and en_US), synchronize missing keys, and validate references, placeholders, and JSON. Use whenever users ask to internationalize UI text, extract hardcoded strings, create resource files, add or synchronize translations, or find missing translations. Inspect project conventions first; ask when target locales or the base fallback language are unclear. Never assume base means Chinese or English.
compatibility: Requires access to the HarmonyOS project files. Does not require a specific IDE or external service.
---

# HarmonyOS I18n Resource Sync

Internationalize only ArkTS/ArkUI user-facing static copy. Preserve existing project conventions and translations. Treat resource edits as a coordinated change across source files and every configured locale.

## Resource Layout Reference

Use the [official HarmonyOS resource categories and access guide](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/resource-categories-and-access) as the source of truth for resource layout and access. For string resources, the minimum structure is `resources/base/element/string.json`; locale-specific variants use directories such as `resources/zh_CN/element/string.json` and `resources/en_US/element/string.json`. `dark` and `light` are visual qualifiers, not locales. `element/string.json` uses a top-level `string` array of `{ "name": "...", "value": "..." }` entries. Preserve any additional project-specific attributes and formatting.

## Workflow

1. **Inspect before editing.** Identify the application/module roots from `build-profile.json5` and `module.json5`, the `.ets` pages/components in each target module, resource roots, all `element/string.json` files, existing `$r(...)` references, locale directories, and project documentation/configuration that declares supported languages. Page/component strings belong to that module's `src/main/resources`; use `AppScope/resources` only for app-wide resources already owned there. Read representative resource files to learn their JSON shape, formatting, key style, and placeholder conventions. Do not overwrite files or choose a locale based on assumptions.
2. **Resolve locale policy.** Distinguish locale directories such as `zh_CN` and `en_US` from `base` and qualifier directories such as `dark` or `light`. A directory name alone is not proof that it is a configured language. Treat `base` as the project's default/fallback resource bucket, not inherently Chinese or English. Follow explicit project policy or existing content. If the target locales, source language for `base`, or translation policy remains ambiguous, ask a concise question and make no edits until clarified.
3. **Inventory candidate text.** Scan `.ets` UI construction and component properties for static strings rendered to users, including `Text('...')`, button/menu/tab labels, input hints, accessibility labels, and other visibly rendered copy. Trace constants only when their value is static and their UI use is clear. Prefer syntax-aware inspection; do not use broad replacement that can alter unrelated strings.
4. **Exclude non-copy.** Do not extract logs, comments, URLs, API paths or field names, code identifiers, resource keys, debug text, dynamic expressions, user input, or machine-readable values. Do not package, generate, or alter icon/image assets. For ambiguous strings, leave them unchanged and report the file and reason rather than guessing.
5. **Plan keys and destinations.** Reuse an existing key only when its meaning matches the UI text. Otherwise create a stable key using the project's established naming style; if none exists, use a concise semantic lower-camel key. Do not key by translated text when a semantic key is practical. Record each literal, proposed key, source location, and destination locale before making coordinated edits.
6. **Create missing resource structure and add translations.** Once the target module, requested locales, and source/fallback policy are clear, do not stop merely because resource directories are absent. Create the minimum HarmonyOS tree as needed: `<module>/src/main/resources/base/element/string.json` for base strings, plus `<module>/src/main/resources/<locale>/element/string.json` for each explicitly requested or project-configured locale (for example `zh_CN` or `en_US`). Initialize a missing string resource as valid `{"string": []}` and create parent directories. Preserve existing resource files and their JSON formatting; add new entries without changing existing values. Translate new and missing values using UI context and the verified source-language policy. Do not treat `base` as a translation target unless project conventions say so.
7. **Replace source literals.** Replace only the inventoried user-visible literals with the project's established resource reference form, normally `$r('app.string.<key>')`. Preserve surrounding ArkTS syntax and behavior. For formatted strings, follow existing parameterized-resource usage; never remove, rename, reorder unsafely, or invent placeholder syntax. Keep dynamic values dynamic and localize only the static surrounding copy.
8. **Synchronize locales.** Compare keys across configured locale string resources. Add missing keys only to requested/configured locales, using translations consistent with the source meaning. Preserve all existing translations. Do not create locale files for `dark`, `light`, or other visual qualifiers as if they were languages.
9. **Validate.** Parse every touched `string.json`; check duplicate keys, key parity for the locales in scope, every changed `$r('app.string.<key>')` reference against the relevant resource sets, and placeholder-token preservation across translations. Inspect the final diff to confirm excluded strings/assets and unrelated files were untouched. Run the project's available lint/build validation when practical; do not claim a build passed if it was not run.
10. **Report.** Summarize changed `.ets` and resource files, locales handled, number of extracted/reused/added keys, validation performed and results, and unresolved ambiguous text or translations. State explicitly if any locale was not changed and why.

## Safety Rules

- Do not overwrite or silently revise existing translations. When an existing key's meaning is uncertain, add a new semantic key or ask.
- Do not infer that `base` means `zh_CN`, `en_US`, or any other language. Preserve original copy in `base` only when the project's existing convention establishes that as the correct source/fallback value.
- Do not translate into unrequested languages merely because a directory happens to exist. Supported locales must be grounded in user instructions or project configuration.
- Do not modify user-entered values, runtime-generated text, logs, comments, URLs, API contracts, identifiers, or assets as part of UI localization.
- If the repository is not clearly a HarmonyOS ArkTS/ArkUI project, or no `.ets`/resource layout can be established, ask for the intended project root instead of guessing.
- Missing resource directories are not a reason to stop after the target module and locale policy are established. Create only the required `resources/<qualifier>/element/string.json` paths; do not fabricate unrelated `media`, `profile`, `rawfile`, or `resfile` directories.
- In a multi-module project, create resources under the module containing the changed `.ets` source. Do not create a second copy in `AppScope` or another module unless the resource is explicitly app-wide or shared.

## Completion Checklist

- Every changed source literal is confirmed user-visible static UI copy.
- Every new or reused key resolves in the applicable resource set.
- Existing resource entries and translations are preserved.
- Locale creation follows project configuration; `base` and color qualifiers were not mistaken for locales.
- Missing resource trees were created only under the correct target module and only for the required resource groups/locales.
- Placeholder tokens and JSON structure are valid.
- The final report identifies validation limits and any unresolved ambiguity.
