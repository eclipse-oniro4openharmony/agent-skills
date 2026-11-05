# ArkUI V2 state, Navigation, builders, and the errors models get wrong

ArkUI has two state-management systems. **V1** (`@Component` with `@State`, `@Prop`,
`@Link`, `@Provide`/`@Consume`, `@Observed`/`@ObjectLink`, `@Watch`) is what most
examples online use. **V2** (`@ComponentV2` with `@Local`, `@Param`, `@Once`, `@Event`,
`@Provider`/`@Consumer`, `@ObservedV2`/`@Trace`, `@Monitor`, `@Computed`) is available from
API 12, observes nested objects without wrapper components, and is what new code should
use. The two decorator sets cannot be mixed inside one struct, and the compiler rejects the
mix, so pick the version per component and keep a component tree in one version where you
can. `oniro-app check arkts` catches every mix-up in the catalogue below before a build.

## V2 in one component

```ts
@ObservedV2
export class Task {
  @Trace title: string = '';
  @Trace done: boolean = false;
  constructor(title: string) { this.title = title; }
}

@ComponentV2
export struct TaskRow {
  @Require @Param task: Task;                 // input; no default, so @Require
  @Param highlight: boolean = false;          // input with a default
  @Event onRemove: (task: Task) => void = (task: Task) => {};  // output to the parent

  build() {
    Row() {
      Toggle({ type: ToggleType.Checkbox, isOn: this.task.done })
        .onChange((on: boolean) => { this.task.done = on; })   // @Trace field: the row re-renders
      Text(this.task.title).fontWeight(this.highlight ? FontWeight.Bold : FontWeight.Normal)
      Button('Remove').onClick(() => this.onRemove(this.task))
    }
  }
}

@Entry
@ComponentV2
struct TaskList {
  @Local tasks: Task[] = [new Task('Write tests')];   // this component's own state
  @Local filter: string = '';

  @Computed get open(): number { return this.tasks.filter((t: Task) => !t.done).length; }

  @Monitor('filter')
  onFilter(monitor: IMonitor) { console.info(`filter ${monitor.value()?.now}`); }

  build() {
    Column() {
      Text(`${this.open} open`)
      ForEach(this.tasks, (task: Task) => {
        TaskRow({ task: task, onRemove: (t: Task) => {
          this.tasks = this.tasks.filter((x: Task) => x !== t);
        } })
      }, (task: Task) => task.title)
    }
  }
}
```

| Decorator | On | Means |
| --- | --- | --- |
| `@Local` | member of a `@ComponentV2` | Own state. The parent cannot pass it (passing it is an error). |
| `@Param` | member | Input from the parent, read-only here, updated when the parent's value changes. Needs a default value or `@Require`. |
| `@Once` | with `@Param` | Take the parent's value once, then treat it as local. |
| `@Event` | function-typed member | Callback to the parent; how a child asks the parent to change a `@Param`. |
| `@Provider()` / `@Consumer()` | member | State shared with descendants without passing it through each level. |
| `@ObservedV2` + `@Trace` | class + its fields | Changes to a `@Trace` field re-render whatever reads it, at any nesting depth. Fields without `@Trace` are not observed. |
| `@Monitor('a', 'b.c')` | method | Called after the named state changes; `monitor.value(path)` has `before` and `now`. |
| `@Computed` | getter | Cached, recomputed when the state it reads changes. |

App-wide V2 state: `AppStorageV2.connect(Type, 'key', () => new Type())`, and
`PersistenceV2.connect(...)` to persist it. V1's `AppStorage.setOrCreate` must not hold an
`@ObservedV2` object (it throws at startup).

**When V1 is still the choice:** a component that must take state by reference from a V1
parent through `@Link` or `$$`, `LocalStorage` (`@LocalStorageLink`/`@LocalStorageProp`),
and library components written in V1 that you extend. `@Entry` itself works with either.
Do not convert a working V1 component just to be consistent.

## Navigation (`Navigation` + `NavPathStack`)

`Navigation` is the routing container; `router.pushUrl` is the older page router. A page
shown through `Navigation` is a `NavDestination`, not an `@Entry` page, and is not listed in
`main_pages.json` (which lists only the `@Entry` pages, normally just `pages/Index`).

```ts
@Entry
@ComponentV2
struct Index {
  @Local stack: NavPathStack = new NavPathStack();

  @Builder
  routes(name: string, param: Object) {        // ONE builder dispatching on the name
    if (name === 'Detail') {
      DetailPage({ id: param as string })
    } else if (name === 'Settings') {
      SettingsPage()
    }
  }

  build() {
    Navigation(this.stack) {
      Button('Open').onClick(() => this.stack.pushPathByName('Detail', 'item-1'))
    }
    .title('Home')
    .navDestination(this.routes)               // call it once; a second call replaces the first
  }
}

@ComponentV2
export struct DetailPage {
  @Require @Param id: string;
  stack: NavPathStack = new NavPathStack();

  build() {
    NavDestination() {                          // the root of every destination page
      Text(this.id)
      Button('Back').onClick(() => this.stack.pop())
    }
    .title('Detail')
    .onReady((ctx: NavDestinationContext) => { this.stack = ctx.pathStack; })
  }
}
```

- `pushPathByName(name, param)`, `replacePathByName`, `pop()`, `popToName(name)`, `clear()`.
- A destination whose root is not `NavDestination` shows a white screen after the push,
  though it compiles. `.hideNavBar(true)` hides the `Navigation`'s own content too, so the
  home page goes blank: to remove only the title bar use `.hideTitleBar(true)`.
- **Route map instead of the builder** (API 12+): list destinations in
  `resources/base/profile/route_map.json` and reference it from `module.json5` as
  `"routerMap": "$profile:route_map"`:
  ```json
  { "routerMap": [ { "name": "Detail", "pageSourceFile": "src/main/ets/pages/Detail.ets",
                     "buildFunction": "DetailBuilder" } ] }
  ```
  `Detail.ets` must then export `@Builder export function DetailBuilder() { DetailPage() }`.
  The only keys allowed are `name`, `pageSourceFile`, `buildFunction`, `data`, `customData`,
  and `pageSourceFile` is relative to the module, not the project.

## `@Builder` and `@BuilderParam`

```ts
@Builder function Badge(label: string) { Text(label).padding(4) }   // reusable UI fragment

@ComponentV2
struct Card {
  @BuilderParam content: () => void = this.empty;   // a slot the parent fills
  @Builder empty() {}
  build() { Column() { this.content() } }
}

// Parent: the trailing block fills the slot.
Card() { Badge('new') }
```

Inside `build()` and any `@Builder` only UI syntax is allowed: components, `if`/`else`,
`ForEach`, `LazyForEach`, `Repeat`. A `const`/`let`, a `for`/`while`/`switch` there is a
compile error (also inside a `ForEach` item callback). Compute values in a method, a getter
or `@Computed`, and loop with `ForEach`. An `@Entry` page's `build()` has exactly one root,
and it must be a container (`Column`, `Row`, `Stack`, `Navigation`, ...).

## Node-API (the NativeCpp template)

The C++ side is called through Node-API (`napi_*`), and the same thread rules as Node.js
apply:

- A `napi_env` and every `napi_value` belong to the ArkTS thread that called into C++. Do
  not keep a `napi_value` past the call or touch either from another thread.
- To call back into ArkTS from a worker thread, create a `napi_threadsafe_function` on the
  ArkTS thread and use `napi_call_threadsafe_function` from the worker; release it when done.
- For background work, use `napi_create_async_work`: `execute` runs on a worker and must not
  call `napi_*`; `complete` runs on the ArkTS thread and resolves the promise.
- An object that must outlive the call needs a `napi_ref` (`napi_create_reference`), deleted
  with `napi_delete_reference`.
- Declare each export in `src/main/cpp/types/libentry/Index.d.ts`, or the ArkTS import of
  `libentry.so` type-checks against nothing.

## Catalogue: what models get wrong, as the tools report it

Each line is the compiler's own text. `check arkts` reports the rule in `rule`; `build
--json` reports the code in `code`. The ArkTS linter rule names are the SDK's own.

**ArkTS strict mode** (the linter in `CompileArkTS`):

| Rule (code) | Typical model output | Fix |
| --- | --- | --- |
| `arkts-no-any-unknown` (10605008) | `let data: any = JSON.parse(s)` | A class or interface: `JSON.parse(s) as Item` |
| `arkts-no-untyped-obj-literals` | `const o = { a: 1 }` with no declared type | Declare `interface O { a: number }`, then `const o: O = { a: 1 }` |
| `arkts-no-obj-literals-as-types` | `let p: { x: number }` | A named interface or class |
| `arkts-no-structural-typing` | Assigning a `Point2` where a `Point` is expected because the fields match | Use the declared type, or make one extend the other |
| `arkts-no-props-by-index` | `obj['name']`, `obj[key]` on a class | Named fields, or a `Map<string, T>` / `Record<string, T>` |
| `arkts-no-destruct-decls`, `arkts-no-destruct-assignment` | `const { a, b } = obj`, `[x, y] = [y, x]` | Read the fields one by one |
| `arkts-no-in` | `if ('name' in obj)` | `obj.name !== undefined`, or `instanceof` |
| `arkts-no-func-expressions` | `function () {}` as a value | An arrow function |
| `arkts-no-spread` | `{ ...a, b: 1 }` | Copy into a new instance field by field |
| `arkts-as-casts` | `<T>value` | `value as T` |
| `arkts-no-misplaced-imports` | `import` after other statements | Move every import to the top |
| `arkts-no-globalthis` | `globalThis.x` | `AppStorageV2`, or a module-level export |
| `arkts-limited-throw` | `throw 'failed'` | `throw new Error('failed')` |
| `arkts-no-classes-as-obj` | Passing a class itself as a value | An instance, or a factory function |
| `arkts-limited-stdlib` | `Object.assign`, `Object.keys` on a class, `eval` | Explicit code |

**Type errors** (the TypeScript checker):

| Code | Message | Usual cause |
| --- | --- | --- |
| 10505001 | `Property 'x' does not exist on type 'Y'` | An invented API member; look it up in the SDK's `.d.ts`, and check the API level in `@since` |
| — | `Cannot find name 'Column'` / `Cannot find module '@kit.X'` | A missing `import { X } from '@kit.ArkUI'`, or a kit that does not exist in this SDK |
| — | `Module '"./X"' declares 'Y' locally, but it is not exported` | Add `export` (`check arkts --fix` does it) |

**ArkUI component model** (enforced by the build; `check arkts` rule in parentheses):

| Code | Error | `check arkts` rule |
| --- | --- | --- |
| 10905338 / 10905339 | A V1 decorator in a `@ComponentV2` struct, or a V2 one in a `@Component` | `component-decorator-version-mismatch` |
| 10905324 | Parent passes a member that the `@ComponentV2` child declares without a decorator | `regular-property-init` (decorate it `@Param`) |
| 10905208 / 10905209 | Parent passes a child's `@Local` | `local-property-init` |
| 10905327 | `@Param` without a default and without `@Require` | `param-requires-require` |
| 10905348 | `@State`/`@Prop` typed with an `@ObservedV2` class | `observed-v2-state-property-type` |
| 10905363 | `@Prop`/`@Link`/`@State` holding a function | `v1-decorator-function-type` (use `@Event`) |
| 10905209 | `let` or a loop inside `build()` / `@Builder` | `builder-body-ui-only` |
| 10905210 | `@Entry` `build()` with two roots, or a non-container root | `entry-build-root-node` |
| 10905227 | A struct named like a built-in component (`Button`, `Text`, `ColorPicker`) | `struct-name-builtin-collision` |
| 10905402 | A page in `main_pages.json` with no `@Entry`, or with two | `page-entry-count` |
| 10904336 | Route map `buildFunction` missing, not exported or not `@Builder` | `route-map-build-function-missing` |
| 10903329 | `$r('app.media.x')` naming a resource that does not exist | `app-resource-name-check` |
| 11211104 | A directory other than `element`, `media`, `profile` under `resources/base/` (often `rawfile`, which belongs at `resources/rawfile`) | `resource-dir-name` |
| 00303221 | An unknown permission in `module.json5` `requestPermissions` | `permission-name-exists` |

The ArkUI codes in this table are the ones hvigor reported in deveco-cli's runs, which is
where the `check arkts` rules come from; trust the rule name and the message text first.
