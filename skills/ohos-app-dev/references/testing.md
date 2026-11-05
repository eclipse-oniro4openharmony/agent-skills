# Tests: Hypium suites, UI tests, `aa test`

An app's instrumented tests live in its `ohosTest` source set and run on the device with
the app installed beside them. `oniro-app test` does the whole cycle; this page is what to
put in the suites, and the raw commands underneath for when you need them.

## Layout

```
entry/src/ohosTest/
  module.json5            # name "entry_test"; deviceTypes must equal the main module's
  ets/test/List.test.ets  # imports and calls every suite: the runner only sees what it calls
  ets/test/Ability.test.ets
  ets/test/Index.test.ets
```

- **`deviceTypes`.** The test module's `deviceTypes` must list the same types as
  `entry/src/main/module.json5`. A test module that says `"phone"` beside a main module that
  says `"default"` does not build, and `oniro-app test` reports that as a build failure.
- **`List.test.ets`.** A new suite file runs only once `List.test.ets` imports it and calls
  its default export. A suite that never runs looks the same as a suite that passes, so
  check the case count `oniro-app test` prints.
- **Module name.** The test module is `<module>_test` (`entry_test`); `aa test -m` takes it.

## Writing a suite (Hypium)

```ts
import { describe, beforeAll, it, expect } from '@ohos/hypium';
import { formatPrice } from '../../../main/ets/common/Price';

export default function priceTest() {
  describe('PriceTest', () => {
    it('formatsCents', 0, () => {
      expect(formatPrice(1999)).assertEqual('19.99');
    })
    it('rejectsNegative', 0, () => {
      expect(() => formatPrice(-1)).assertThrowError('negative price');
    })
  })
}
```

- `describe(name, fn)` is a suite; `it(name, 0, fn)` a case (the `0` is the filter level).
  Names become the `Suite#case` that `--class` selects, so keep them unique and free of spaces.
- `beforeAll` / `beforeEach` / `afterEach` / `afterAll` take one function each. An `async`
  function, or one returning a Promise, is awaited.
- Assertions: `assertEqual`, `assertDeepEquals`, `assertContain`, `assertTrue`,
  `assertFalse`, `assertNull`, `assertUndefined`, `assertLarger`, `assertLess`,
  `assertClose(expected, precision)`, `assertThrowError(message)`; `.not()` negates.
- Test the app's own code: import it from `../../../main/ets/...`. `expect(1).assertEqual(1)`
  proves only that the runner starts.
- A failing `expect` is status `-2` (`fail`) with the assertion message ("expect 0 equals
  3"); an exception is `-1` (`error`) with its stack. The first stack frame outside
  `oh_modules` is where it failed, and `oniro-app test` prints it.

## UI tests (UiTest `Driver`)

Start the ability once for the suite, wait for the page, then drive it by component:

```ts
import { UIAbility, Want } from '@kit.AbilityKit';
import { abilityDelegatorRegistry, Component, Driver, ON } from '@kit.TestKit';
import { beforeAll, describe, expect, it } from '@ohos/hypium';

const delegator = abilityDelegatorRegistry.getAbilityDelegator();
const bundleName: string = abilityDelegatorRegistry.getArguments().bundleName;

export default function indexTest() {
  describe('IndexTest', () => {
    beforeAll(async () => {
      const want: Want = { bundleName: bundleName, abilityName: 'EntryAbility' };
      await delegator.startAbility(want);
      await Driver.create().waitForComponent(ON.id('HelloWorld'), 5000);
    })

    it('tapShowsWelcome', 0, async () => {
      const driver: Driver = Driver.create();
      const greeting: Component = await driver.findComponent(ON.id('HelloWorld'));
      await greeting.click();
      await driver.delayMs(500);
      expect(await (await driver.findComponent(ON.id('HelloWorld'))).getText()).assertEqual('Welcome');
    })
  })
}
```

- Give the components a test touches an `.id('...')` in the page and find them with
  `ON.id`; `ON.text` breaks when the copy changes.
- Start the ability in `beforeAll`, not in an earlier case: `--class Suite#case` runs one
  case on its own, and a case that depends on another's side effects then fails.
- The screen must be on and unlocked for UI tests: `getCurrentTopAbility` fails on a locked
  device. `oniro-app test` wakes the screen, swipes away a lock screen that has no
  credential, and keeps the screen on during the run; with a PIN set, unlock it yourself.

## Running

```
oniro-app test                              # build both HAPs, install, run every suite
oniro-app test --class IndexTest#tapShowsWelcome
oniro-app test --no-build --json            # reuse the built HAPs; one JSON report
```

Exit 0: every case passed. Exit 1: a case failed or threw; fix the code or the test.
Exit 2: the run did not complete (build failed, test module missing, device gone, run
timed out); read `error`, `diagnostics` and `log` in the JSON, not the counts.

### Underneath (when `oniro-app test` does not fit)

```
hvigorw assembleHap --mode module -p product=default -p module=entry@ohosTest
hdc install -r entry/build/default/outputs/default/entry-default-signed.hap
hdc install -r entry/build/default/outputs/ohosTest/entry-ohosTest-signed.hap
hdc shell aa test -b <bundle> -m entry_test -s unittest OpenHarmonyTestRunner -s timeout 15000
```

Add `-s class Suite#case` to filter, `-s dryRun true` to list cases without running them.
Each case prints `OHOS_REPORT_STATUS: class=` / `test=` lines and an
`OHOS_REPORT_STATUS_CODE` (1 started, 0 passed, -2 assertion failed, -1 threw); the run
ends with `OHOS_REPORT_RESULT: stream=Tests run: N, Failure: F, Error: E, Pass: P, Ignore: I`
and `TestFinished-ResultCode`. "The specified module name is not found" means the test HAP
is not installed, or its module name is not the one passed to `-m`.
