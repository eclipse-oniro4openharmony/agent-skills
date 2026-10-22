# Agent Skills Collection

A collection of professional AI agent skills designed to enhance development workflows, project orchestration, and platform-specific tasks.

## 🚀 Available Skills

### 1. [OHOS App Scaffold](./skills/ohos-app-scaffold)
Scaffold a new OpenHarmony / HarmonyOS app (Standard ArkTS or Native C++) and verify it builds — cross-platform, via the `oniro-app` CLI (`oniro-app create [--template NativeCpp]`).

### 2. [OHOS App Dev](./skills/ohos-app-dev)
Inner-loop development for existing OpenHarmony / HarmonyOS apps — lint, build, deploy, run, logs, and UI validation through the cross-platform `oniro-app` CLI.

### 3. [OHOS System Dev](./skills/ohos-system-dev)
System / persistent-bundle development (e.g. systemui, launcher) and components built inside the OHOS source tree — multi-module builds, install-and-reboot-to-reload, signing/cert traps, and verifying the new code actually loaded.

### 4. [Conductor Dev](./skills/conductor-dev)
Initialize the Conductor directory for project orchestration. Use when starting a new project or adding Conductor-based workflow management to an existing repository.

### 5. [HMOS Log Collector](./skills/hmos-log-collector)
Collect HarmonyOS/OpenHarmony device logs, fault evidence, and device snapshots into a timestamped, redacted incident bundle for handoff to a diagnostic workflow.

### 6. [HarmonyOS I18n Resource Sync](./skills/hmos-i18n-resource-sync)
Extract static ArkTS/ArkUI UI copy into string resources, synchronize explicitly configured locales, and validate resource keys, references, JSON, and placeholders.

### 7. [Splash Launch Animation](./skills/splash-launch-animation)
Integrate the bundled branded splash animation into an app's real startup path while preserving its existing route, onboarding, and authentication flow.

---

## 📦 Installation

You can install the entire collection or individual skills using the `npx skills` CLI.

### Install the entire collection
```bash
npx skills add imansmallapple/agent-skills
```

### Install a specific skill
```bash
npx skills add imansmallapple/agent-skills@ohos-app-scaffold
npx skills add imansmallapple/agent-skills@conductor-dev
npx skills add imansmallapple/agent-skills@hmos-log-collector
npx skills add imansmallapple/agent-skills@hmos-i18n-resource-sync
npx skills add imansmallapple/agent-skills@splash-launch-animation
```

## 🛠 Usage
Once installed, your AI agent (Gemini CLI, Trae, etc.) will automatically detect and activate these skills based on your requests.

---
Built with ❤️ for the AI Agent ecosystem.
