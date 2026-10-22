---
name: splash-launch-animation
description: >-
  Use this skill whenever a user wants a HarmonyOS app to show a branded animated
  splash/launch page at startup, asks to create or improve SplashPage, or wants
  the splash screen wired to the app entry point. Work only inside the named
  project root; inspect its entry, page registration, required assets, and
  startup gate, then apply the bundled fixed SplashPage template and statically
  verify the wiring. Run builds, lint, or device checks only when explicitly
  requested. Never scan unrelated projects or the full SDK/tool installation.
---

# Splash Launch Animation

Apply one consistent, short startup template to the current app and make it part
of the real launch path. Reuse the same composition and motion across projects;
customize only the app identity inputs. Treat the splash as an introduction to
the app, not as a replacement for system startup configuration,
authentication, onboarding, or the app's main navigation.

## Scope

Use bundled `references/SplashPage.template.ets` as the visual and motion
authority. Keep the design consistent while deriving paths, resource IDs, route
behavior, and framework choices from the target project.

When the project is not ArkUI, identify its actual UI stack and entry mechanism
before proceeding. Do not generate `.ets` code for a different framework. For
uncertain or version-sensitive ArkUI APIs, use the project's installed SDK
documentation and available ArkUI knowledge resources rather than guessing.

## Search Boundaries

- Treat the user-named project directory as the complete search boundary. Keep
  `Glob`, `Grep`, and reads scoped to that root and specific relevant paths.
- Never search a drive, parent directory, home directory, sibling project,
  `C:\Program Files`, or the full SDK installation. Avoid unbounded patterns
  such as `**/*`, `**/ArkUI*`, or recursive scans of the whole machine.
- Identify the entry module from the root `build-profile.json5`, then inspect
  only its manifest, Ability, page list, existing splash, home route, and the
  exact resources those files reference.
- Do not inspect `local.properties`, `oh_modules`, `.hvigor`, IDE metadata, or
  every resource file unless a specific blocker requires it.
- Treat bundled `references/SplashPage.template.ets` as canonical. Do not scan
  another reference app during normal use.
- Query only an uncertain API/signature in an available focused reference; do
  not enumerate SDK folders.

## Workflow

1. **Map the launch path.** Read the root build profile, selected module
   manifest, Ability, page list, existing splash, and directly referenced home
   component/route. Search only that module for `loadContent`, `@Entry`, and
   relevant route names. Determine whether to add, repair, or restyle the splash.
2. **Collect template inputs.** Find the app icon/logo, localized name, optional
   footer label, and splash background. Reuse project resources; do not invent
   resource IDs or add assets. If there is no splash background, match the
   system start-window background to avoid a cold-start color flash.
3. **Load the template before editing.** Read
   `references/SplashPage.template.ets` and use it as the starting point. Do not
   recreate its component order, values, or transitions from prose.
4. **Replace only project inputs.** Update the content import/handoff, resource
   identifiers (`SPLASH_ICON`, `APP_NAME`, `SPLASH_FOOTER`), and background as
   needed. For route-based apps, replace only the handoff with the existing
   route mechanism. Keep composition and motion values unchanged.
5. **Preserve the fixed composition.** Use a full-screen background, a 90 vp
   square icon 120 vp from the top, a bold 21 vp app name 15 vp below it, a
   `Blank()`, and a bold 12 vp footer 30 vp above the bottom. Keep the
   top-brand/open-space/bottom-footer structure. Do not add ornaments, cards,
   taglines, or loading bars.
6. **Use the fixed motion.** Start icon and title hidden. During a 1000 ms
   state-driven animation, insert the icon from the left (`opacity: 0`,
   `translate.x: -150`) and title from the right (`opacity: 0`,
   `translate.x: 150`). Keep the footer stationary, wait 200 ms, then continue
   to normal app content.
7. **Follow project conventions.** Keep the component focused. For ArkUI, use
   documented APIs supported by the target SDK. Use `UIContext.animateTo` for
   the state change on API 18+ and `transition` for icon/title insertion.
   Preserve state-management and route APIs unless migration is requested.
8. **Wire the actual entry.** Ensure the app launches into the splash and
   register it where required. Do not merely create a page while leaving the
   old launch target. Preserve platform start-window configuration unless asked
   to change it; system and custom splash are separate stages.
9. **Continue to the right destination.** Keep existing login, onboarding,
   authentication, and session restoration. Do not hard-code a sample route.
   Make completion idempotent to avoid duplicate navigation and do not replay
   on every return/foreground unless requested.
10. **Verify and report.** Statically check entry target, page registration,
    resource references, one-time completion, and destination handoff. Do not
    run builds, lint, tests, installation, screenshots, or device checks unless
    explicitly requested (or required by a documented project gate).

## Completion Checklist

- The bundled template was used and the fixed composition/motion was preserved.
- All project exploration stayed within the named project root.
- The Ability/app entry launches the splash and page/route registration is valid.
- Existing authentication, onboarding, and first-launch decisions remain intact.
- The destination exists and duplicate navigation is prevented.
- The report distinguishes static checks from build/runtime checks not run.
