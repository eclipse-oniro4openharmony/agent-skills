---
name: conductor-dev
description: Professional project orchestration and workflow management. Initialize the Conductor directory to manage tracks, specifications, and implementation plans.
---

# Conductor Dev

## Overview

This skill provides the boilerplate files and structure for the Conductor project orchestration framework. It initializes a `conductor/` directory with essential documentation and workflow definitions according to the Universal File Resolution Protocol. It supports both standard linear workflows and advanced cycle-based development (V4 Supercharged).

## Workflow

### 1. Initialize Conductor
Scaffolds the `conductor/` directory in the current project.
- **Trigger:** "Initialize conductor", "Setup conductor template", "Add conductor to project"
- **Action:**
  1. Create a `conductor/` directory at the project root if it doesn't exist.
  2. Create an `artifacts/snapshots/` directory at the project root if it doesn't exist.
  3. Create an `artifacts/logs/` directory at the project root if it doesn't exist.
  4. Copy all template files from `assets/conductor-template/` to the `conductor/` directory using a cross-platform recursive copy (the agent's file tools, or `cp -r` on macOS/Linux / `Copy-Item -Recurse` on Windows).
  5. Inform the user that the Conductor directory and artifacts folder have been initialized.

### 2. Cycle Workflow (V4 Supercharged)
Executes a structured task cycle defined in `conductor/workflows/cycle.md`.
- **Key Files:** `TASKS.md`, `SESSION_STATE.json` (runtime), `artifacts/logs/`
- **Design Context:** Use the **Figma Extension** to inspect designs and extract CSS/ArkTS styling before implementation.
- **Steps:** Initialization -> Design Analysis (Figma) -> Strategy -> Execution -> Self-Review -> Synchronization -> Handover.

## Implementation Directives

When implementing tracks or tasks under Conductor:

1. **Design-First implementation:** For all UI tasks, you MUST use the `figma` extension to fetch and analyze the relevant design files. Extract precise values for dimensions, colors, and typography to ensure pixel-perfect implementation.
2. **Dynamic Path Resolution:** ALWAYS resolve template paths relative to the skill's root directory.
3. **Lint Before Commit:** Execute `codelinter` on all modified files immediately after editing.
4. **Task Verification:** 
    - For logic changes, rely primarily on `codelinter` to save tokens.
    - **UI Validation (MANDATORY):** For any UI modification, you MUST:
        1. Ensure a device/emulator is connected via `oniro-app devices`.
        2. Ensure the `artifacts/snapshots/` directory exists.
        3. Capture the screen straight to the artifact (one cross-platform command): `oniro-app screenshot -o "artifacts/snapshots/[task_id].jpeg"` — add `--grid` to read coordinates off a 10×10 (0.0–1.0) overlay, or `--contact-sheet` for a transient/animated state.
        4. **Visual Comparison:** Compare the captured snapshot against the Figma design. Note any discrepancies in `learning.md` or the log.
        5. (Optional but recommended) If the track specifies automated tests, run them (e.g., `oniro-app build` / `hvigorw test`) and capture the final state as an additional snapshot.
4. **Visual Proof:** Save all UI validation snapshots to `artifacts/snapshots/[task_id].png` or `artifacts/snapshots/[task_id]_test.png`.
5. **Idempotent Edits:** Before using the `replace` tool, you MUST use `read_file` to verify the current content. Ensure that `new_string` is DIFFERENT from the existing text to avoid "No changes to apply" errors.
6. **Automated Self-Learning Loop:** 
    - At the start of every track implementation or task, you MUST read `conductor/learning.md`. If it does not exist, create it with a `# Learning Log` header.
    - If an error happens, analyze and document the fix in `conductor/learning.md`.
    - **Display Lessons:** Proactively notify the user and explicitly display the content of "Lessons Learned" in the chat whenever `conductor/learning.md` is updated or after resolving errors or complex tasks.
7. **Flexible Checkpointing:** Commit changes after every task by default, but allow "Phase-based" commits if requested in the track plan.
8. **Quality Standards:** Adhere strictly to the project's `product-guidelines.md` and prioritize UI performance ("Premium Design" and "Robustness").
9. **HarmonyOS Context:** Read `build-profile.json5` for SDK versions and cross-reference with API mapping.
10. **Final Build Verification:** ONLY after all phases in a track's `plan.md` are completed, you MUST execute `hvigorw assembleHap` as a final verification step to ensure the entire project is in a stable, buildable state before completing the track. Do not execute this command after individual tasks or phases.

## Cross-Platform Compatibility

When performing analysis or file operations, distinguish between agent tools (e.g.,
`read_file`, `grep_search`) and shell commands — never run an agent-tool name as a shell
command.

Prefer the cross-platform **`oniro-app`** CLI for any build / device / screenshot / lint
step — it behaves identically on Linux, macOS, and Windows, so you avoid OS-specific shell
branches. For raw file operations, use commands appropriate to the host OS:
- **macOS / Linux (Bash):** `mkdir -p`, `cp -r`, `[ -e <path> ]`.
- **Windows (PowerShell):** `New-Item -ItemType Directory -Force`, `Copy-Item -Recurse`, `Test-Path`; avoid Unix-only pipes like `xargs`.
- **Path Resolution:** use cross-platform path handling; in PowerShell prefer `$HOME` over `~` for literal paths.

## Resources

### assets/
Contains the template files for the Conductor directory structure:
- `index.md`: The entry point and file resolution index.
- `product.md`: Product definition and goals.
- `tech-stack.md`: Technology stack and architectural decisions.
- `workflow.md`: Development workflow and lifecycle.
- `tracks.md`: Registry for development tracks.
- `product-guidelines.md`: Design and implementation guidelines.
- `setup_state.json`: Initial state configuration for setup tracking.
- `code_styleguides/`: Directory for language-specific style guides (e.g., `arkts.md`).
- `workflows/`: Detailed workflow patterns (e.g., `cycle.md` for V4 Supercharged cycle).

## Reference: HarmonyOS Version to API Level Mapping

| Version | API Level |
| :--- | :--- |
| 4.0 | 10 |
| 4.1 | 11 |
| 5.0.0 | 12 |
| 5.0.1 | 13 |
| 5.0.2 | 14 |
| 5.0.3 | 15 |
| 5.1.0 | 18 |
| 5.1.1 | 19 |
| 6.0 | 20 |

**Note:** If the version string in `build-profile.json5` includes a number in parentheses, such as `6.0.0(20)`, the number in the parentheses is the API Level.
