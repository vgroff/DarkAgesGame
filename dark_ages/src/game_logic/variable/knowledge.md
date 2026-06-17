# Variable System

Core reactive state management system. All files in `src/game_logic/variable/`.

## Instructions for AI Assistants

> **Read this before making any changes.**
>
> - **Always update all relevant knowledge.md files** when you make changes, add features, or fix bugs.
> - **Do not make game design decisions without asking.** If unsure whether something is a feature or a bug, ask. Lean towards asking.
> - **Bugs may be fixed without confirmation**, but if you are unsure whether something is intentional, ask first.
> - **The developer's notes (handwritten_notes.md) are rough** — the problems are likely real but the proposed solutions may be wrong. Use them as direction, not prescription.
> - **Do not assume the developer will catch mistakes in your edits.** Be conservative and explicit.

There are knowledge.md files like this one at most levels of the repo, read those if you are missing context for a task. Always update all relevant knowledge.md files as you make changes/add features/fix bugs etc...

## File Index

| File | Purpose |
|------|---------|
| `variable.js` | `Variable` base class + `VariableComponent` React component |
| `modifier.js` | `AbstractModifier`, `UnaryModifier`, `VariableModifier` + type constants |
| `aggregator.js` | `AggregatorModifier` — subscribes to a list of objects and aggregates |
| `listAggModifier.js` | `ListAggModifier` — aggregates over a list accessed via key path |
| `sumAgg.js` | `SumAggModifier` — sums a list of variables |
| `cumulator.js` | `Cumulator` — Variable that banks its value each timer tick |
| `trendingVariable.js` | `TrendingVariable` — Variable that smoothly trends toward a target |

---

## `variable.js` — Variable

### Overview

`Variable` is the fundamental unit of game state. Every numeric value in the game (population, happiness, productivity, resource amounts, prices, etc.) is a `Variable`. Variables are reactive: when a value changes, all subscribers are notified in priority order.

### Constructor Props

| Prop | Type | Description |
|------|------|-------------|
| `name` | string | Display name (default: `'unnamed variable'`) |
| `owner` | object | Reference to owning object (for display) |
| `startingValue` | number | Initial base value (default: 0) |
| `modifiers` | AbstractModifier[] | Initial modifiers |
| `min` | Variable | Minimum bound (itself a Variable) |
| `max` | Variable | Maximum bound (itself a Variable) |
| `displayRound` | number | Decimal places for display (default: 2) |
| `printSubs` | boolean | Debug: log subscription events |
| `visualAlerts` | function | `(variable) => string[] | null` — returns alert strings when conditions met |

### Internal State

- `baseValue`: the "raw" value before modifiers
- `currentValue`: `baseValue` after all modifiers applied
- `modifiers`: sorted array of `AbstractModifier` objects
- `subscriptions`: sorted array of `{callback, priority}` objects
- `explanations`: full array of explanation objects (for expanded tooltip)
- `abridgedExplanations`: only explanations where value actually changed
- `baseValueExplanations`: explanation for the base value itself
- `currentDepth`: recursion guard (reset to 0 after each `recalculate` call)
- `_subscriptionSources`: `WeakMap<source, subscription>` for cleanup tracking

### `setNewBaseValue(baseValue, explanations, indent=0)`

Sets `baseValue` and triggers `recalculate` if the value changed. Throws if `explanations` is undefined. Clamps to `min`/`max` if set. The `explanations` parameter can be a string or array of strings.

**Important**: `explanations` is required — passing `undefined` throws `Error("Need explanation")`.

### `recalculate(reason, indent, quietly)`

1. Increments `currentDepth` (unless `quietly=true`)
2. Sorts modifiers by priority (ascending)
3. Applies each modifier in order: `result = modifier.modify(value, indent, displayRound)`
4. Clamps to `min`/`max`
5. Epsilon check: only updates `currentValue` and calls subscribers if change is significant:
   - `absChange > 1e-8` AND `absChange / |currentValue| > 2e-5`
6. If `currentDepth < 2`: calls `callSubscribers(indent + 1)`
7. Resets `currentDepth` to 0 (unless `quietly=true`)

The depth guard (`currentDepth < 2`) prevents infinite recursion when subscribers trigger further recalculations. This means a chain of A→B→C→A will be cut at depth 2.

### `addModifier(modifier)` / `removeModifier(modifier)` / `setModifiers(modifiers)`

- `addModifier`: appends to modifiers list, calls `setModifiers`
- `removeModifier`: validates modifier exists, removes subscription source, filters list, calls `setModifiers`
- `setModifiers`: cleans up old subscriptions, sets new modifiers, calls `subscribeToModifiers`, triggers `recalculate`

### `subscribeToModifiers()`

For each modifier, calls `modifier.init()` if it exists, then subscribes to the modifier. When the modifier changes, calls `self.recalculate(...)`. Stores subscription in `_subscriptionSources` via `_addSubscriptionSource`.

### `subscribe(callback, priority, reason)` / `unsubscribe(callbackOrSub)`

- `subscribe`: pushes `{callback, priority}` to `subscriptions`, re-sorts by priority descending, returns the subscription object
- `unsubscribe`: filters by reference equality (accepts either the subscription object or the callback function)

### `callSubscribers(indent)`

Calls each subscription's callback. If a callback returns `false`, the subscription is removed (self-unsubscribing pattern used by `TemporaryModifierBonus`).

### `init()`

Called after deserialization to re-establish subscriptions. Order:
1. Clears all subscriptions and `modifierCallbacks`
2. Initializes `min` and `max` if they have `init()`
3. Initializes each modifier
4. Calls `subscribeToModifiers()`
5. Re-subscribes to `min`/`max` changes
6. Restores `_savedSubscriptionPriorities` (from save/load)
7. Calls `recalculate('init after load', 0)`

Uses `_initializing` flag to prevent recursive initialization.

### Epsilon Check Details

```js
let eps = 1e-8;
let absChange = Math.abs(this.currentValue - value);
if (this.currentValue === undefined || (Math.abs(absChange) > eps && (Math.abs(this.currentValue) < eps || absChange / Math.abs(this.currentValue) > 2e-5))) {
    // update and notify
}
```

The condition fires if the absolute change exceeds `1e-8` AND either:
- `currentValue` is itself near zero (skip the relative check entirely — any absolute change matters), or
- the relative change exceeds `2e-5` (suppress noise on large values)

This guards against the original bug where `currentValue = 0` caused `absChange / 0 = Infinity`, always triggering subscribers regardless of the absolute epsilon.

### Static Properties

- `Variable.logText`: string accumulator for calculation logging
- `Variable.maxStackTrack`: unused
- `Variable.logging`: if true, appends to `logText` during `recalculate`

### `makeTextFile(text)`

Creates a Blob URL for downloading `Variable.logText` as a text file. Used in `SettlementComponent` for the "Calculation Log" link.

---

## `VariableComponent` (React)

React component that subscribes to a `Variable` and re-renders when it changes.

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `variable` | required | The Variable to display |
| `showName` | true | Show variable name |
| `showOwner` | true | Show owner name prefix |
| `showBase` | false | Show `baseValue` instead of `currentValue` |
| `showMax` | false | Show `/maxValue` suffix |
| `expanded` | false | Show full explanation list instead of tooltip |
| `style` | — | Extra CSS styles |

### Lifecycle

- `componentDidMount`: subscribes to variable, sets `subscribed = true`
- `componentWillUnmount`: unsubscribes
- `componentDidUpdate`: if `props.variable` changed, calls `ingestProps` to re-subscribe

### `render(extraChildren, extraStyle, miscProps)`

Renders:
1. `HTMLTooltip` wrapping the value display (when not expanded)
2. Tooltip content: bold variable name header + `abridgedExplanations` mapped to HTML spans
3. Value display: `ownerText + nameText + preText + displayValue + maxText + children + extraChildren`
4. Clicking owner text: `Logger.setInspect(variable.owner)`
5. Clicking value: `Logger.setInspect(variable)`
6. Clicking explanation with `variable`: `Logger.setInspect(explanation.variable)`

When `expanded=true`: renders explanation list inline instead of in tooltip.

`visualAlerts`: if `variable.visualAlerts(variable)` returns strings, they are appended to explanations and the value is rendered in red.

**Tooltip styling (updated):**
- A bold variable name header is prepended to `abridgedExplanations` when the variable has a non-unnamed name and there are explanations to show. Styled with `textAlign: left`, `color: #444`, bottom border `#e0e0e8`.
- Explanation spans with a nested `variable` use an `innerPillStyle` — monospace, `#f7f7f9` background, `#c8c8d0` border, `border-radius: 3px` — to visually distinguish hoverable sub-values.
- Plain text explanations use `color: #555`; variable-linked explanations use `color: #444`.
- Description prop span uses `color: #666`, italic.
- All explanation spans use `display: block` for consistent line breaks.
- **`= finalValue` footer**: when `abridgedExplanations` contains at least one modifier entry (detected by `typeof e === 'object' && e.type`), a bold `= {displayValue}` line is appended at the bottom, separated by `borderTop: '1px solid #e0e0e8'`. Matches the tutorial demo's `= 0.82` line. Not shown for variables with no modifiers (base value only).

---

## `modifier.js` — Modifiers

### Modifier Type Constants

```js
export const multiplication = 'multiplication';
export const addition = 'addition';
export const subtraction = 'subtraction';
export const division = 'division';
export const exponentiation = 'exponentiation';
export const invLogit = 'invLogit';
export const min = 'min';
export const minBase = 'min with base value';
export const max = 'max';
export const castInt = 'castInt';
export const roundTo = 'round to decimal';
export const scaledAddition = 'scaledAddition';
export const scaledMultiplication = 'scaledMultiplication';
export const greaterThan = 'greaterThan';  // unused
export const lesserThan = 'lesserThan';    // unused
```

### Priority Constants

```js
export const priority = {
    addition: 1,
    scaledAddition: 1,
    subtraction: 2,
    multiplication: 3,
    scaledMultiplication: 3,
    division: 4,
    exponentiation: 5
};
```

Modifiers are applied in ascending priority order. Lower number = applied first. Custom priorities can override these.

### `AbstractModifier`

Base class. Props: `name`, `type` (required).

- `subscribe(callback, priority=0)`: pushes `{callback, priority}` to subscriptions, re-sorts by priority descending, returns the subscription object
- `callSubscribers(indent)`: calls all subscription callbacks
- `unsubscribe(callback)`: filters by reference

### `UnaryModifier`

A modifier that takes no variable input. Currently only supports `castInt`.

Props: `customPriority` (required), `type`.

`modify(value)`: returns `{result: parseInt(value), text: "Cast to integer"}`.

### `VariableModifier`

The main modifier type. Wraps a `Variable` and applies an operation.

**Constructor props**:
- `variable`: existing Variable to use as the modifier value
- OR `startingValue` + optional `modifiers`: creates a new `Variable` internally
- `object` + `keys`: lazy Variable lookup (re-resolved on each `modify` call)
- `type`: modifier type constant (required)
- `customPriority`: overrides default priority for this type
- `invLogitSpeed`: required for `invLogit` type
- `scale`, `bias`, `offset`, `exponent`: for `scaledAddition`, `scaledMultiplication`, `invLogit`

**`modify(value, indent, displayRound)`** — applies the operation:

| Type | Formula | Notes |
|------|---------|-------|
| `addition` | `value + variable.currentValue` | |
| `subtraction` | `value - variable.currentValue` | |
| `multiplication` | `value × variable.currentValue` | |
| `division` | `value / variable.currentValue` | throws if variable = 0 |
| `exponentiation` | `value ^ variable.currentValue` | |
| `scaledAddition` | `value + scaleValue(variable.currentValue)` | |
| `scaledMultiplication` | `value × scaleValue(variable.currentValue)` | |
| `invLogit` | S-curve transform on `value` using variable as midpoint | |
| `min` | `Math.min(value, variable.currentValue)` | |
| `max` | `Math.max(value, variable.currentValue)` | |
| `minBase` | `Math.min(value, variable.baseValue)` | uses baseValue not currentValue |
| `roundTo` | `roundNumber(value, variable.currentValue)` | |
| `castInt` | not handled here (UnaryModifier) | throws |

**`scaleValue(x)`**:
```
if x < offset: x = offset
if offset: x = x - offset
scaledValue = bias + scale × x^exponent
```

**`invLogit` formula** (S-curve, domain 0..1 → range 0..1):
```
r = -ln(2) / ln(variable.currentValue)   // variable is the midpoint
if value <= 0: result = 0
elif value >= 1: result = 1
else: result = 1 / (1 + (value^r / (1 - value^r))^(-invLogitSpeed))
result = scaleValue(result)
```
The midpoint variable controls where the S-curve crosses 0.5. `invLogitSpeed` controls steepness.

**`resubscribeToVariable(indent)`**:
- If using `object`/`keys` lookup: resolves the variable, re-subscribes if it changed
- Subscribes to `variable` changes; when variable changes, calls `callSubscribers`
- If variable value changed during re-subscription, immediately calls `callSubscribers`

**`getVariable()`**: traverses `object[keys[0]][keys[1]]...` to find the Variable.

**`priority()`**: returns `customPriority` if set, else looks up in `priority` constants dict.

---

## `aggregator.js` — AggregatorModifier

Extends `VariableModifier`. Aggregates over a list of objects to compute a Variable's value.

### Constructor Props

- `aggregatorCallback`: `(variable, variables) => {value, explanation} | {modifiers}` — computes the aggregated result
- `aggregatorList`: array of objects to aggregate over
- OR `aggregate`: single object (wrapped in array)
- `keys`: array of key-path arrays for navigating from each object to its Variable

### `aggregate(indent)`

Calls `aggregatorCallback(this.variable, this.variables)`. If result has `modifiers`, calls `variable.setModifiers(result.modifiers)`. Otherwise calls `variable.setNewBaseValue(result.value, result.explanation)`.

### `getVariables(aggregatorList, keysList)`

For each object in `aggregatorList`, navigates `keysList[index]` (array of key arrays) to find the Variable.

### `resubscribeToVariables(indent)`

**BUG** (line 67): `for (let i = 0; i < this.variable.length; i++)` — `this.variable` is a `Variable` instance, not an array. `Variable.length` is `undefined`, so the loop never runs. The unsubscribe step is completely skipped. Old subscriptions accumulate on every call.

After the broken loop: resolves variables, subscribes each to call `aggregate()`, calls `aggregate()` immediately.

### `modify(value, indent)`

Calls `resubscribeToVariables(indent)` then `super.modify(value, indent)`.

---

## `listAggModifier.js` — ListAggModifier

Extends `AggregatorModifier`. Aggregates over a list accessed via a key path from a single root object.

### Constructor Validation

- `keys` must have exactly length 2
- `keys[0]` and `keys[1]` must not be nested arrays (1D only)
- `aggregatorList` must have exactly 1 element

### `getVariables(aggregatorList, keys)`

1. Navigate from `aggregatorList[0]` using `keys[0]` to get the list
2. For each item in the list, navigate using `keys[1]` to get the Variable
3. Returns array of Variables

Example usage (from `game.js`):
```js
new SumAggModifier({
    aggregate: this,           // aggregatorList = [game]
    keys: [
        ["settlements"],       // keys[0]: game.settlements (the list)
        ["market", "netMarketIncome"]  // keys[1]: settlement.market.netMarketIncome
    ],
    type: addition
})
```

---

## `sumAgg.js` — SumAggModifier

Extends `ListAggModifier`. Sums all variables in the list.

### `aggregatorCallback(variable, variables, modifiers=props.useModifiers)`

If `modifiers=false` (or `useModifiers=false`):
- Returns `{value: sum of currentValues, text: description string}`

If `modifiers=true` (default):
- Returns `{modifiers: variables.map(v => new VariableModifier({variable: v, type: 'addition'}))}`
- This sets the target variable's modifiers to be the sum of all source variables

The modifier approach is preferred as it maintains reactivity — the target Variable automatically updates when any source changes.

---

## `cumulator.js` — Cumulator

Extends `Variable`. Represents a value that accumulates over time (e.g. resources, population, treasury).

### Constructor Props

- `timer`: required Timer Variable

### Behaviour

On each timer tick: `aggregate()` is called.
- Sets `valueAtTurnStart = currentValue`
- Computes `excessAmount`: if `max` is set and the uncapped value (`baseValue + expectedChange`) would exceed `max.currentValue`, `excessAmount = uncapped - max`. Otherwise `excessAmount = 0`.
- If `baseValue !== currentValue`: calls `setNewBaseValue(currentValue, ...)` — "banks" the accumulated change

`recalculateLastChange()`: `expectedChange = currentValue - baseValue` — the net change from all modifiers for this tick.

Subscribes to itself (priority 1) to keep `expectedChange` up to date.

### `excessAmount`

New field (added for auto-sell feature). After each `aggregate()` call, `excessAmount` holds the amount of production that could not be stored because storage was full. This is used by `Settlement.autoSellExcessGoods()` to auto-sell overflow to the market.

### `CumulatorComponent`

Extends `VariableComponent`. Shows `(+expectedChange)` or `(-expectedChange)` suffix.

Default props: `showChange: true`, `showMax: true`.

### Usage Pattern

A `Cumulator` with supply and demand modifiers:
```
baseValue = amount at start of turn
currentValue = baseValue + supply - demand (from modifiers)
On tick: baseValue = currentValue (banks the change)
excessAmount = max(0, (baseValue + expectedChange) - max)  [if max is set]
```

This means `baseValue` always represents the amount at the start of the current tick, and `currentValue` represents the projected amount at the end.

---

## `trendingVariable.js` — TrendingVariable

Extends `Variable`. Smoothly interpolates `currentValue` toward a target, preventing instant jumps.

### Constructor Props

- `timer`: required Timer Variable
- `trendingRoundTo`: decimal places for rounding (required — prevents micro-oscillations)
- `trendingSpeed`: speed for both directions (OR use `trendingUpSpeed` + `trendingDownSpeed`)
- `trendingUpSpeed`: speed when trending upward (0..1, where 1 = instant)
- `trendingDownSpeed`: speed when trending downward (0..1)
- `smallestTrend`: minimum change before snapping to target (prevents infinite approach)

### `recalculate(reason, indent)`

Overrides parent. Calls `super.recalculate(..., quietly=true)` to compute the target value without notifying subscribers, then calls `trend(indent)` to apply the smoothing. Does not manually manage `currentDepth` — the parent handles it via the `quietly` flag.

### `trend(indent)`

```
currentlyTrendingTo = round(currentValue, trendingRoundTo)
if trendingValueAtTurnStart undefined: trendingValueAtTurnStart = currentlyTrendingTo

speed = trendingDownSpeed if trending down, trendingUpSpeed if trending up, else 1

currentValue = speed × currentlyTrendingTo + (1 - speed) × trendingValueAtTurnStart
trendingChange = currentValue - trendingValueAtTurnStart

if |currentValue - currentlyTrendingTo| < smallestTrend: snap to target

currentValue = round(currentValue, trendingRoundTo)
callSubscribers(indent + 1)
```

### `storeCurrentValue()`

Called on each timer tick. Sets `trendingValueAtTurnStart = currentValue`, then calls `recalculate('new turn', 0)`.

### `forceResetTrend()`

Calls `super.recalculate` quietly to get the true current value, then sets `trendingValueAtTurnStart = currentValue` and calls `recalculate` normally. Used during settlement construction to initialize health/happiness without trending.

### `TrendingVariableComponent`

Extends `VariableComponent`. Shows an arrow + target suffix and colours the value green/red based on `trendingChange`.

**Display format:** `43 (↑62)` — main value followed by a dimmed `(↑target)` suffix at `0.85em` / `opacity: 0.7`.

**Arrow logic:**
- `trendingChange < -eps` → red text, `↓` arrow
- `trendingChange > eps` → green text, `↑` arrow
- otherwise → default colour, `→` arrow

**Note:** The stats bar (`renderStatsBar` in `settlement.js`) does **not** apply `fontWeight: 'bold'` to these components; font size is `1.05em`.

Default props: `showTrending: true`, `showMax: true`.

---

## Key Design Patterns

### Pattern 1: Variable as Modifier Input

The most common pattern — a Variable whose value feeds into another Variable:
```js
let productivity = new Variable({name: "productivity", startingValue: 1});
let healthEffect = new Variable({name: "health effect", startingValue: 0, modifiers: [
    new VariableModifier({variable: health, type: addition}),
    new VariableModifier({type: invLogit, ...})
]});
productivity.addModifier(new VariableModifier({variable: healthEffect, type: multiplication}));
```

### Pattern 2: SumAggModifier for Dynamic Lists

When you need to sum a property across a dynamic list:
```js
this.totalJobs = new SumAggModifier({
    aggregate: this,
    keys: [["resourceBuildings"], ["totalJobs"]],
    type: addition
});
// this.totalJobs.variable holds the sum
```

### Pattern 3: Cumulator for Accumulating Resources

```js
this.food = new Cumulator({
    name: "food amount",
    startingValue: 0,
    min: zero,
    max: totalStorage,
    timer: gameClock,
    modifiers: [supplyModifier, demandModifier]
});
// Each tick: food.baseValue = food.currentValue (banks the net change)
```

### Pattern 4: TrendingVariable for Smooth Stats

```js
this.happiness = new TrendingVariable({
    name: "happiness",
    startingValue: 0.05,
    trendingRoundTo: 3,
    timer: gameClock,
    trendingUpSpeed: 0.1,    // slow to improve
    trendingDownSpeed: 0.2,  // faster to worsen
    smallestTrend: 0.009,
    min: zero
});
```

### Pattern 5: Self-Removing Subscription

```js
this.timer.subscribe(() => {
    if (this.durationFactor.currentValue >= 1) {
        settlement[this.variableAccessor].removeModifier(this.modifier);
        return false; // returning false removes this subscription
    }
});
```

### Pattern 6: Lazy Variable Lookup

```js
new VariableModifier({
    object: settlement,
    keys: ["leader", "legitimacy"],  // resolved on each modify() call
    type: addition
})
```
Used when the target Variable may change (e.g. when a settlement's leader changes).

---

## Performance Considerations

From the developer's handwritten notes:
- **Happiness and health should be rounded to 3dp** to reduce subscriber cascade frequency — `TrendingVariable` already does this via `trendingRoundTo`, but the underlying modifiers may still fire frequently
- **Building productivity should have a `roundTo 3` modifier** — currently only `generalProductivity` has this. Suggested implementation: `new VariableModifier({type: roundTo, startingValue: 3, customPriority: 200})` added to each building's `productivity` Variable.
- **Bankruptcy state changes are expensive** — when `bankrupt` flips between 0 and 1, it triggers a cascade through all market `buyProp` Variables across all settlements. Developer suggests examining via logging to find the bottleneck; rounding to dp may help.
- **Subscription chain length**: each Variable in a chain adds latency; deep chains (e.g. `health → unhealth → populationDecline → populationChange → populationInternal → populationExternal → unemployed → ...`) can cause many recalculations per tick

### Optimisation Ideas (from notes)
1. ✅ **Done**: `roundTo 3` modifier added to every `ResourceBuilding.productivity` Variable in `building.js` constructor (priority 200). This reduces subscriber cascade frequency when productivity changes by tiny amounts.
2. Cache `currentValue` and only recalculate when a modifier's variable actually changes (already partially done via epsilon check)
3. Batch subscription notifications (currently each change immediately propagates)
4. The `resubscribeToVariables` bug in `AggregatorModifier` means subscriptions accumulate — fixing this would reduce memory usage and is a confirmed bug fix

### Variable History / Plotting (Developer Idea)

> From `handwritten_notes.md`. Do not implement without confirmation.

The developer wants to add history tracking to key Variables:
- Short-term, long-term, and super-long-term history snapshots
- Plot them over time in the UI
- Snapshot `explanations` over time for debugging (e.g. to see why productivity changed 3 days ago)
- This would require adding a history buffer to `Variable` or a wrapper class, and a corresponding UI component

This is a design idea — the implementation approach is not specified. Ask before adding any history mechanism.

---

## Known Bugs & Issues

### Moderate

1. **`variable.js` epsilon check with zero** (line 256): `absChange / Math.abs(this.currentValue)` when `currentValue = 0` produces `Infinity`, which is always `> 2e-5`. This means any change from 0 always triggers subscribers — probably correct but unintentional. *(Fixed in top-level knowledge.md Bug 10 — epsilon check now guards against zero)*

6. **`VariableModifier` with `object`/`keys`**: calls `resubscribeToVariable()` on every `modify()` call. If the variable hasn't changed, it returns early — but this still does a property traversal on every tick for every such modifier.

### Fixed

- **Bug 2** (`trendingVariable.js`): `trend()` was calling `callSubscribers` directly without going through the `currentDepth < 2` depth guard. Fixed by adding `if (this.currentDepth < 2)` check before `callSubscribers(indent+1)` in `trend()`.

### Minor

7. **`Variable.init()` restores `_savedSubscriptionPriorities`** but creates empty callbacks: the restored subscriptions call `() => {}` (no-op) — they exist only to maintain priority ordering, not to actually do anything useful.

8. **`makeTextFile()`** uses a module-level `textFile` variable — only one text file URL can exist at a time. Multiple calls revoke the previous URL.

9. **`Variable.defaultProps`** and **`VariableComponent.defaultProps`** are set after class definition — this is the old React pattern; modern React uses static class properties or function component defaults.

10. **`VariableComponent.ingestProps()`**: if `wasSubscribed` is true and `forceSubscribe` is false, it unsubscribes but does not re-subscribe. This means if `props.variable` changes while the component is mounted, it will unsubscribe from the old variable but not subscribe to the new one until `componentDidUpdate` calls `ingestProps` with `forceSubscribe` defaulting to false — actually `componentDidUpdate` calls `ingestProps(this.props)` without the second argument, so `forceSubscribe=false`. The component will stop updating after a variable prop change. **This is the UIBase bug noted in the handwritten notes.**

---

## Unit Testing Ideas

### `Variable`
- `setNewBaseValue` updates `baseValue` and triggers `recalculate`
- `setNewBaseValue` throws when `explanations` is undefined
- `setNewBaseValue` clamps to `min`/`max` bounds
- `recalculate` applies modifiers in priority order
- `recalculate` does not call subscribers when change is below epsilon
- `recalculate` depth guard prevents infinite recursion (depth ≥ 2 stops propagation)
- `addModifier` subscribes to modifier and triggers recalculate
- `removeModifier` unsubscribes from modifier and triggers recalculate
- `removeModifier` throws when modifier not found
- `subscribe` returns subscription object; `unsubscribe` removes it
- `callSubscribers` removes subscriptions that return `false`
- `init()` re-establishes subscriptions after deserialization
- `visualAlerts` function is called during render; alerts appear in explanations

### `VariableModifier`
- `addition`: `result = value + variable.currentValue`
- `subtraction`: `result = value - variable.currentValue`
- `multiplication`: `result = value × variable.currentValue`
- `division`: `result = value / variable.currentValue`; throws when variable = 0
- `exponentiation`: `result = value ^ variable.currentValue`
- `min`: `result = Math.min(value, variable.currentValue)`
- `max`: `result = Math.max(value, variable.currentValue)`
- `minBase`: uses `variable.baseValue` not `currentValue`
- `roundTo`: rounds to `variable.currentValue` decimal places
- `scaledAddition` with scale, bias, offset, exponent: correct formula
- `scaledMultiplication` with scale, bias, offset, exponent: correct formula
- `invLogit`: S-curve at midpoint=0.5 returns 0.5; at 0 returns 0; at 1 returns 1
- `customPriority` overrides default priority
- `object`/`keys` lookup resolves correct Variable
- `resubscribeToVariable` re-subscribes when variable changes

### `UnaryModifier`
- `castInt` truncates decimal values correctly

### `Cumulator`
- On timer tick: `baseValue` is set to `currentValue`
- `expectedChange` = `currentValue - baseValue` (net modifier effect)
- `valueAtTurnStart` is updated on each tick

### `TrendingVariable`
- Trends toward target at `trendingUpSpeed` when increasing
- Trends toward target at `trendingDownSpeed` when decreasing
- Snaps to target when within `smallestTrend`
- `forceResetTrend` immediately sets `trendingValueAtTurnStart` to current target
- `trendingChange` is positive when trending up, negative when trending down
- `TrendingVariableComponent` shows green when trending up, red when trending down

### `SumAggModifier` / `ListAggModifier`
- Correctly sums Variables accessed via key path
- Updates when any source Variable changes
- Handles empty list (sum = 0)
- `getVariables` throws when key path leads to non-Variable

### `AggregatorModifier`
- `aggregate()` calls `aggregatorCallback` with correct variables
- `aggregate()` calls `setModifiers` when result has `modifiers`
- `aggregate()` calls `setNewBaseValue` when result has `value`
- **Test the subscription leak bug**: verify that `resubscribeToVariables` called N times results in N subscriptions (current buggy behaviour) vs 1 subscription (correct behaviour)
