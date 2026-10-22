# HarmonyOS I18n Resource Sync

An Agent Skills-compatible package for extracting static ArkTS/ArkUI UI copy into HarmonyOS `string.json` resources, synchronizing configured locales, and validating resource references and format placeholders.

Resource directory and access rules follow the [official HarmonyOS resource guide](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/resource-categories-and-access).

## Matrix Description

Localize HarmonyOS ArkTS/ArkUI projects. Scan `.ets` pages and components for user-facing static copy, extract it into `string.json`, replace literals with `$r(...)` references, create missing module resource directories and confirmed locale files (such as `zh_CN` and `en_US`), synchronize missing keys, and validate references, placeholders, and JSON. Use whenever users ask to internationalize UI text, extract hardcoded strings, create resource files, add or synchronize translations, or find missing translations. Inspect project conventions first; ask when target locales or the `base` fallback language is unclear. Never assume `base` means Chinese or English.

## Package Contents

- `SKILL.md` — portable skill instructions and trigger description.
- `evals/evals.json` and `evals/files/` — validation scenarios and a fixture for creating a missing resource tree.

## Matrix Registry

The package slug is `hmos-i18n-resource-sync`. After publishing it to the HarmonyOS Matrix Skill Registry, the expected install URL is:

```text
https://matrix.openharmony.cn/api/registry/skills/hmos-i18n-resource-sync
```
