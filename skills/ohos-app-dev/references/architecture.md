# HarmonyOS Clean Architecture Guide

## Overview
This project follows a strict "Clean Architecture" pattern to ensure maintainability, testability, and scalability.

## Layers

### 1. Domain Layer (Core)
- **Role:** Contains the business logic and entities.
- **Dependencies:** NONE. Must be pure ArkTS/TypeScript.
- **Components:**
  - **Entities:** Data models representing business objects.
  - **Use Cases:** Specific business actions (e.g., `GetTaskStatsUseCase`).
  - **Repository Interfaces:** Contracts defining data access methods.

### 2. Data Layer (Infrastructure)
- **Role:** Handles data retrieval and storage.
- **Dependencies:** Domain Layer.
- **Components:**
  - **Repository Implementations:** Concretions of Domain interfaces.
  - **Data Sources:** API clients, local database (RelationalStore/Preferences).
  - **Mappers:** Convert "Data Models" (JSON/DB) to "Domain Entities".

### 3. Presentation Layer (UI)
- **Role:** Displays data and handles user interaction.
- **Dependencies:** Domain Layer.
- **Components:**
  - **ViewModels:** Manages UI state and executes Use Cases.
  - **ArkUI Components:** Declarative UI. New components use V2 state: `@ComponentV2` with
    `@Local` (own state), `@Param` / `@Event` (in from and out to the parent), and view
    models as `@ObservedV2` classes with `@Trace` fields. Existing V1 components (`@Component`
    with `@State`, `@Prop`, `@Link`) stay V1; do not mix the two in one struct. See
    [`arkui-v2-state.md`](./arkui-v2-state.md).

## Rules
1. **Dependency Rule:** Source code dependencies can only point inwards. (UI -> Domain <- Data).
2. **Separation:** The UI should never call the Data layer directly. It must go through the Domain (Use Cases).
3. **State:** Use the state decorators (`@Local` and `@Param` in V2 components, `@State` and `@Prop` in V1) strictly for UI state. Business logic state belongs in the ViewModel (an `@ObservedV2` class, so the UI observes its `@Trace` fields) or in the Domain.
