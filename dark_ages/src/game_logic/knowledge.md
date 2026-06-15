# Game Logic

Core game systems and mechanics. All files in `src/game_logic/`.

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
| `game.js` | `Game` class — top-level orchestrator |
| `timer.js` | `Timer` extends `Variable`; drives all ticks via `setInterval` |
| `seasons.js` | Season constants; `daysInYear = 12` |
| `rolling.js` | Probabilistic roll helpers |
| `character.js` | `Character`, `Culture`, `Trait`, `Faction` + React components |
| `events.js` | `Event` hierarchy + all concrete event types |
| `logger.js` | Singleton `Logger` + `LoggerComponent` debug inspector |
| `save_load.js` | JSON serialization/deserialization with circular-ref tracking |
| `UIBase.js` | Base React class component with Variable subscription wiring |
| `UIUtils.js` | Re-export barrel for the variable system |
| `utils.js` | `titleCase`, `roundNumber`, `HTMLTooltip`, `CustomTooltip` |
| `config.js` | Global UI config (`buttonVariant: "outlined"`) |
| `gameUI.js` | Top-level 3-column layout component |
| `hud.js` | HUD: timer, harvest quality, play/pause/next-day, treasury |
| `mainUI.js` | Main panel: renders Settlement or Character view |
| `sidePanelUI.js` | Side panel: navigation list |

---

## `game.js` — Game Class

### Construction
1. Creates `gameClock` (`Timer`, 800ms per tick, `daysInYear=12`)
2. Creates `playerCharacter` (Celtic culture, `isPlayer: true`)
3. Creates NPC character with randomized traits
4. Creates two `Settlement` instances (Village 1 = Marshlands, Village 2 = Farmlands)
5. Creates `totalMarketIncome` as a `SumAggModifier` over all settlements' `market.netMarketIncome`
6. Creates `treasury` as a `Cumulator` with `totalMarketIncome` as modifier; starting value 10
7. Subscribes to treasury to set `bankrupt` Variable (0 or 1) when `baseValue` crosses zero
8. Creates `HarvestEvent` as the only global event
9. Calls `initEvents()` to fire any events that should fire immediately

### `init()` — Post-Load Re-wiring
Called after `loadGame()`. Order matters:
1. Stops game clock
2. Calls `bankrupt.init()`, then each settlement's `init()`, then `treasury.init()`
3. Re-subscribes game clock to `triggerChecks()`
4. Re-subscribes treasury to bankruptcy check
5. Re-initializes events
6. Restores UI state references
7. Restarts game clock

### `triggerChecks()`
Called every tick. Iterates `globalEvents` and calls `event.fire()` if `eventShouldFire()` returns true.

### `handleRebellion(settlement)`
Pushes a game message. If `playerCharacter.settlements.length === 0`, pushes game-over message. **Bug**: does not actually stop the game or prevent further play.

### Known Issues
- `handleRebellion` does not stop the game clock or prevent further interaction after game over
- `init()` re-subscribes the game clock to `triggerChecks()` but the constructor does not — so after load there is a subscription but before load there is none (events only fire via `triggerChecks()` called from `Settlement` constructor indirectly via timer)
- `App.js` passes a `game` prop to `GameUI` but `GameUI` ignores it and creates `new Game()` internally — the `game` prop in `App.js` is wasted

---

## `timer.js` — Timer

`Timer extends Variable`. The `currentValue` is the current tick count (day number).

### Key Properties
- `every`: milliseconds between ticks
- `timerNumber`: static counter for debugging
- `timeTranslator`: function mapping tick count → `{day, season, year, text}`
- `translatedTime`: result of last `timeTranslator` call (updated before `setNewBaseValue`)
- `forceStops`: array of reason strings; timer won't run while non-empty

### Methods
- `startTimer()` / `stopTimer()`: start/stop `setInterval`
- `forceStopTimer(reason)` / `unforceStopTimer(reason)`: add/remove from `forceStops` array; used by events and faction privilege changes to pause the game
- `forceTick()`: manually advance one tick (used by "Next Day" button); respects `forceStops`
- `killTimer()`: stops and clears all subscriptions

### Game Clock Translation
```js
year = parseInt(value / 12) + 1
day = value - (year - 1) * 12 + 1   // 1-indexed, 1..12
season = seasons[parseInt((day-1)*4/12)]  // spring/summer/autumn/winter
```
With `daysInYear = 12`, each season is exactly 3 days.

### Known Issues
- `Timer.timerNumber` is a static counter that increments every time a `Timer` is constructed, including dummy timers in `default_buildings.js` — the counter is not meaningful
- `stopTimer()` checks `!this.isForceStopped()` before clearing the interval, so if force-stopped, `stopTimer()` is a no-op — this means `unforceStopTimer` must restart the timer manually (which it does via `this.started = false; this.startTimer()`)

### Developer Notes
- **Force-stop on first day**: The developer intends to force-stop the timer until all player traits are set on day 1, so the game doesn't run before the player has configured their character. This would use `forceStopTimer(reason)` / `unforceStopTimer(reason)` — the mechanism already exists.

---

## `seasons.js`

```js
export const daysInYear = 12;  // IMPORTANT: not 365
export const seasons = ['spring', 'summer', 'autumn', 'winter'];
```

`seasonToTempFactor(season)`: returns -1 (winter), 0 (spring/autumn), 1 (summer). Used for coal demand adjustment.

---

## `rolling.js` — Dice System

Four outcomes: `majorSuccess`, `success`, `failure`, `majorFailure`.

### `rollSuccess(successChance, majorModifier=0.33)`
- Roll < `successChance * majorModifier` → major success
- Roll < `successChance` → success
- Roll - successChance < `(1-successChance) * majorModifier` → major failure
- Otherwise → failure

### `getProbabilities(successChance, majorModifier)`
Returns object with probability of each outcome. Used in event choice tooltips.

### `successToNumber(successFailure, majorModifier=0.5)`
Maps outcomes to numbers: majorSuccess=1+m, success=1, failure=-1, majorFailure=-1-m.

### `successToQualityText(successFailure)`
Maps to: 'great', 'good', 'poor', 'very poor'. Used in HUD harvest display.

### `chooseRandomly(array)`
Returns a random element. Used for NPC trait randomization.

### Known Issues
- `compare(val1, comparator, val2)` is defined but never called anywhere — dead code

---

## `character.js` — Characters, Cultures, Traits, Factions

### `Character`
Constructor props: `name`, `culture`, `isPlayer`, `gameClock`, `diplomacy`, `strategy`, `administration`, `randomizeTraits`, `faction`, `factionName`.

Key Variables:
- `legitimacy` (startingValue: 0.1) — affects settlement local legitimacy
- `diplomacy`, `strategy`, `administration` — skill Variables
- `administrativeEfficiency` = 0.9 + 0.3 × administration — multiplied into settlement `generalProductivity`

Trait groups (each holds one trait at a time):
- `childhoodTrait`: NobleUpbringing, MilitaryUpbringing, MerchantUpbringing, PeasantUpbringing
- `abilityTrait`: SmoothTalker, Intelligent, Strategic
- `personalityTrait`: Witty, Careful, Brave
- `fameTrait`: JoustingChampion, Orator, Officer, PoliticalVeteran, SuccesfulMerchant
- `trinketTrait`: Regalia, Ledger, Sword

`TraitScaler = 0.1` — base unit for skill bonuses from traits.

### `Culture` (abstract)
Subclasses: `Celtic`, `Roman`. Each defines `getTraits()` returning a list of `Trait` objects.

**Celtic traits**: elected kings (legitimacy ×0.95), druidic traditions (Apothecary ×1.25, health ×1.03), foresters (LumberjacksHut ×1.15, HuntingCabin ×1.1)

**Roman traits**: obsolete military tactics (strategy ×0.85), academic traditions (Library ×1.2), roman plumbing (health ×1.05), rhetorical training (diplomacy ×1.1)

### `Trait`
- `effects`: array of `Bonus` objects
- `activate(character)`: calls `character.activateBonus(bonus)` for each effect
- `deactivate(character)`: calls `character.deactivateBonus(bonus)` for each effect
- `getText()`: returns array of strings for tooltip display

### `Faction`
- `numPrivilegesAllowed = 4` (total across all privilege types)
- 3 privilege types: noble (4 levels), citizen (1 level), clergy (1 level)
- `changePrivilegeTentatively(index, change)`: pauses game clock via `forceStopTimer`
- `confirmPrivilegeChanges()`: applies `TemporaryLegitimacyBonus(-0.05, 5 years)`, unpauses
- `updatePrivileges()`: calls `member.updateFactionTraits()` for all members

### `CharacterComponent` / `FactionComponent`
- `CharacterComponent` subscribes to `character.legitimacy`
- Shows culture, cultural traits, trait groups (editable for player), skills, attributes, faction
- `ChoiceComponent` renders a tooltip-wrapped display or a MUI `Select` dropdown for editing

### Known Issues
- `changePrivilegeTentatively()` line 80: `this.privileges.filter(...)` result is discarded — the check to revert `tentativelyChanged` never works
- `addTrait()` throws if a trait group already has a trait — but `updateFactionTraits()` calls `removeTrait` then `addTrait` which should be safe; however if `factionTraits` is undefined on first call, `forEach` on undefined throws
- `copyCulture(character)` creates a new culture instance by finding the matching class — works but creates a fresh culture losing any runtime state

---

## `events.js` — Event System

### Debug Flags (MUST SET TO FALSE FOR PRODUCTION)
```js
const forceLastCheckedDebug = true;  // Forces all events to fire on day 2
const forceFireEvents = true;         // Forces all events to fire regardless of eventShouldFire_()
```

### `Event` (base class)
- `checkEvery`: ticks between checks
- `lastChecked`: initialized to `-checkEvery` (or `-1` if forceLastCheckedDebug)
- `bannedUntil`: timestamp before which event cannot fire
- `eventDuration`: Variable for how long the event lasts
- `forcePause`: if true, pauses game clock on fire (player must make a choice)
- `pause`: if true, stops (but doesn't force-stop) timer on fire

`triggerChecks()` logic:
1. Call `endIfShouldEnd()` — ends event if `daysLeft() <= 0`
2. If not active AND enough ticks have passed AND not banned → fire

`isActive()`: `lastTriggered !== null && (lastEnded === null || lastTriggered >= lastEnded)`

### `SettlementEvent`
- `fire()`: calls `getBonuses()`, deactivates old bonuses, activates new ones on all settlements
- `end()`: deactivates all bonuses and event effects
- `applyChoice(eventChoice)`: activates choice effects, unpauses if `forcePause`
- `activateEventEffect()`: dispatches to `EventEffect.activate()` or `SettlementBonus.activate()`

### `RegularSettlementEvent`
Adds variance to `checkEvery` on each check: `checkEvery = checkEveryAvg * randomRange(1-variance, 1+variance)`

### Concrete Events

| Event | checkEveryAvg | Variance | Duration | forcePause | Fire chance |
|-------|--------------|----------|----------|------------|-------------|
| `CropBlight` | 1 year | 45% | 6 days | yes | 20% |
| `LocalMiracle` | 4 years | 25% | 18 days | no | 25% |
| `MineShaftCollapse` | 2 years | 50% | 1 day | yes | 20% (if mine exists) |
| `Fire` | 3 years | 45% | 1 day | no (pause) | 25% |
| `Pestilence` | 4 years | 35% | ~8 days | yes | 25% |
| `WolfAttack` | 3 years | 35% | 1 day | yes | 25% |
| `CourtIntrigue` | 3.5 years | 35% | 1 day | yes | 35% |
| `HarvestEvent` | 1 year | 0 | permanent | no | always |

**Note**: All settlement events except `CourtIntrigue` are commented out in `settlement.js`. Only `CourtIntrigue` fires in the current build.

### `HarvestEvent`
- Fires every year (not a `RegularSettlementEvent`)
- `harvestSuccess = rollSuccess(0.7)` — 70% base success chance
- `harvestModifier = 0.95 + 0.05 * successToNumber(result, 3)` — ranges ~0.8 to ~1.1
- Applies `SpecificBuildingProductivityBonus` to Farm and `ChangePriceBonus` to food (inverse of harvest modifier)

### `EventEffect` subclasses
- `ChangeEventDuration`: multiplies `eventDuration` by `amount`
- `TemporaryEventDisabled`: calls `setEventBan(amount)` — prevents re-firing for `amount` days

### `EventChoice` / `ProbabilisticEventChoice`
- `ProbabilisticEventChoice.getEffects()`: rolls `rollSuccess(successChance.currentValue)` and returns appropriate effects
- `successChance` is a Variable (can be modified by character skills)
- `getText()` shows probabilities before choice is made, roll result after

### `EventComponent`
- Subscribes to `event.timer`
- Shows event name in red until read, black after
- Opens a Modal with event text, choice buttons, and applied choice display

### Known Issues
- `events.js` imports `getButtonUnstyledUtilityClass` from `@mui/base` and `toHaveDisplayValue` from `@testing-library/jest-dom` — both unused; the testing-library import will break in production
- `forceLastCheckedDebug` and `forceFireEvents` are both `true` — must be changed before release
- `TemporaryEventDisabled.deactivate()` is a no-op — the ban is set but never cleared on deactivate
- `MineShaftCollapse.getEventChoices()` uses `Farm.name` instead of `IronMine.name` when calculating the size change amount (line 460)

### Developer Notes on Events

> These are intentions from `handwritten_notes.md`. Do not implement without confirmation.

- **Wolf attack**: should depend on how much weaponry the settlement has available (currently fires regardless of military strength)
- **Fire event**: add a probabilistic outcome where high administration allows better building organisation. Also add an `EventEffect` that permanently increases `checkEvery` (fire prevention improves after a fire).
- **Default `_eventShouldFire()` with probability prop**: add a probability prop to the base `RegularSettlementEvent` class so simple events don't need to override `eventShouldFire_()`. Also add an `EventEffect` that changes the firing probability.
- **Pestilence health penalty**: the developer notes that the health penalty should NOT be temporary. Currently it is implemented as a `TemporaryHealthBonus` — this may be a design change or a bug. **Ask before changing.**
- **Planned new events** (rough ideas, do not implement without confirmation):
  - Blizzard: increased coal demand, massively increased trade costs
  - Rats in storage: lose food
  - Landslide: spend money or face unhappiness
  - Warm spell: happiness boost, less coal demand
  - Merchant boom: trade factor increase
  - Hunting game surplus: HuntingCabin productivity increase
  - Dry hunting lands: HuntingCabin significant decrease
  - Large group of nomads arrives: choices — take in, trade with, send away; risk of robbery follow-up event
  - Bandit raid: fight, pay off, or get raided

---

## `logger.js` — Debug Inspector

### `Logger` (singleton)
- `Logger.getLogger()` / `Logger.constructLogger()` — lazy singleton
- `addLine(line)`: appends to `lines` array, notifies subscribers
- `setInspect(inspect)`: sets the current inspected object, pushes to history (max 35)
- `backOne()`: pops history and re-inspects previous object
- `subscribe(callback)` / `unsubscribe(callback)`: standard pub/sub

### `LoggerComponent`
- Renders the current `inspect` object
- If `inspect instanceof Variable`: renders `VariableComponent` in expanded mode
- Otherwise: renders `renderObject()` which shows all properties
  - `Variable` values: rendered as `VariableComponent`
  - Functions: rendered as source code string
  - Objects: rendered as clickable `{object}` that calls `setInspect`
- "Go Back" button calls `logger.backOne()`

### Known Issues
- `childRender()` line 120: `{this.logger.lines.map((line, i) => <span key={i}>line<br /></span>)}` renders the string literal `"line"` instead of the variable `line` — log lines never display their content
- `backOne()` pops twice from `inspects` (once explicitly, once via `setInspect`) — the history navigation is off by one

---

## `save_load.js` — Serialization

### `CLASS_MAP`
Maps class name strings to `{ constructor, hasInit }`. `hasInit: true` means `instance.init()` is called after deserialization.

Classes with `hasInit: true`: Game, Settlement, Timer, Variable, Cumulator, SumAggModifier, CourtIntrigue, CropBlight, Fire, HarvestEvent, LocalMiracle, MineShaftCollapse, Pestilence, WolfAttack.

### `EXCLUDED_PROPS`
`component`, `react`, `_reactInternals`, `logHref` — never serialized.

### `SPECIAL_PROPS`
`subscriptions`, `subscribed`, `callback`, `modifierCallbacks`, `_subscriptionSources`, `_initializing`, `currentDepth` — excluded from serialization; re-established by `init()`.

### `serializeObject(obj, seen)`
- `seen`: `WeakMap<object, id>` for circular reference tracking
- Circular refs serialized as `{ $ref: id }`
- Arrays serialized recursively
- `Date`, `Set`, `Map` have special `$type` handling
- `Variable` instances have a dedicated serialization path preserving `baseValue`, `currentValue`, `modifiers`, `min`, `max`, `explanations`, `visualAlerts`
- All other objects: `{ $type: constructor.name, $id: id, $data: {...props} }`

### `deserializeObject(serialized, seen)`
- `seen`: `Map<id, instance>` for circular reference resolution
- Resolves `$ref` by looking up in `seen`
- For `Variable`: creates instance via `Object.create(Variable.prototype)`, populates props, calls `init()`
- For other classes: looks up in `CLASS_MAP`, creates via `Object.create`, populates props, calls `init()` if `hasInit`
- Unknown types: returns `$data` as plain object with a console warning

### Known Issues
- `BogIronPit`, `CoalPit`, `PeatBog` are not in `CLASS_MAP` — saves with Marshlands/Mountains terrain will fail to deserialize these buildings
- `VariableModifier` is in `CLASS_MAP` but `AggregatorModifier`, `ListAggModifier`, `SumAggModifier` (only `SumAggModifier` is present) are not fully covered
- `visualAlerts` is a function reference — serialized as `undefined` (functions are skipped by `JSON.stringify`); after load, visual alerts will be missing
- The `subscriptionPriorities` saved for Variables are restored as `_savedSubscriptionPriorities` but `init()` creates empty subscriptions for them rather than the actual callbacks — this is a placeholder that doesn't fully restore subscription behaviour

---

## `UIBase.js` — Base Component

All class-based UI components extend `UIBase`.

### Pattern
```js
constructor(props) {
    super(props);
    this.addVariables([variable1, variable2]);  // call once in constructor
}
componentDidMount() {
    // subscribes each variable; setState on change
}
componentWillUnmount() {
    // unsubscribes all
}
render() {
    if (this.state.ready) return <div>{this.childRender()}</div>;
    return <div>Not Ready</div>;
}
childRender() { /* override in subclass */ }
```

### `addVariables(variables)`
- Can only be called once (throws if called twice)
- Stores `{key, variable}` pairs in `this.subs`
- On mount: subscribes each variable; on change, calls `setState` with the variable as the new state value for that key

### Known Issues
- `addVariables` uses array index as the state key — so `this.state[0]`, `this.state[1]`, etc. This means state keys are numbers, not meaningful names
- `variablesSet` flag prevents calling `addVariables` twice, but subclasses that call `super(props)` and then `addVariables` in the same constructor are fine; the issue arises if a subclass tries to add more variables later
- **Prop-change subscription bug** (from developer notes): `UIBase` does not correctly handle cases where a prop (e.g. `props.character` in `CharacterComponent`) changes after mount — subscriptions are not re-wired to the new prop's variables. The suggested fix is to give components a callback that retrieves the correct variable from props and re-runs it in `componentDidUpdate()`, including clearing old subscriptions. This is also confirmed by `VariableComponent.ingestProps()` analysis — see variable system knowledge.md.

---

## `UIUtils.js` — Barrel Re-export

Re-exports everything from the variable system for convenient import in settlement/game code:
- From `modifier.js`: all type constants + `UnaryModifier`, `VariableModifier`
- From `variable.js`: `Variable`, `VariableComponent`, `makeTextFile`
- From `aggregator.js`: `AggregatorModifier`
- From `cumulator.js`: `Cumulator`, `CumulatorComponent`
- From `listAggModifier.js`: `ListAggModifier`
- From `trendingVariable.js`: `TrendingVariable`, `TrendingVariableComponent`

---

## `utils.js` — Utilities

### `titleCase(str)`
Uppercases first character only. Does not handle multi-word strings.

### `roundNumber(number, dp=3)`
`parseFloat(number.toFixed(dp))`. If `number` is `undefined`, throws (the `debugger` is commented out).

### `percentagize(amount)`
`roundNumber((amount - 1) * 100, 1)` — converts a multiplier (e.g. 1.05) to a percentage string ("5").

### `randomRange(low, high)`
`low + (high - low) * Math.random()`

### `HTMLTooltip`
MUI `Tooltip` styled with white background, right-aligned text, max-width 400px, border.

### `CustomTooltip`
Wraps `HTMLTooltip`. Accepts `items` array where each item can be:
- `Variable` instance → renders `VariableComponent`
- `string` → renders in italic span
- `{text, style}` object → renders with custom style
- Throws on unknown type

---

## `config.js`

```js
const config = { buttonVariant: "outlined" };
```
Used in `hud.js` for Play/Pause/Next Day buttons.

---

## UI Components

### `gameUI.js` — `GameUI`
- Creates `new Game()` internally (ignores `game` prop from `App.js`)
- 3-column MUI Grid: SidePanel (xs=2) | HUD+MainUI (xs=8) | Logger (xs=2)
- `setSelected(selected)`: updates `this.state.selected`; passed down to child components
- Shows `GameMessage` modal when `game.gameMessages.length > 0`

### `GameMessage`
- Subscribes to timer (so it re-renders)
- Calls `timer.stopTimer()` in `childRender()` — stops the game while message is shown
- "Close" button calls `readGameMessage()` which shifts the first message

### `hud.js` — `HUD`
- Subscribes to `treasury` and `gameClock`
- Shows: `TimerComponent` (translated time text), harvest quality with tooltip
- Play button: disabled if running or force-stopped
- Pause button: disabled if not running
- Next Day button: disabled if running; calls `forceTick()`
- Treasury: `CumulatorComponent` showing current value and expected change

### `mainUI.js` — `MainUI`
- Subscribes to `internalTimer` (re-renders on every internal tick)
- Renders `SettlementComponent` if selected is a `Settlement`
- Renders `CharacterComponent` if selected is a `Character`

### `sidePanelUI.js` — `SidePanel`
- Subscribes to `internalTimer`
- Shows player character name (clickable)
- Shows all settlement names (clickable)
- Clicking calls `setSelected` to update `GameUI` state

---

## Unit Testing Ideas

### `timer.js`
- `startTimer()` begins incrementing `currentValue` at correct interval
- `stopTimer()` halts increments
- `forceStopTimer(reason)` prevents `startTimer()` from running
- `unforceStopTimer(reason)` re-enables timer only when all force-stops cleared
- `forceTick()` does nothing when force-stopped
- `timeTranslator` correctly maps tick 0→11 to day/season/year
- `killTimer()` clears subscriptions

### `rolling.js`
- `rollSuccess(0)` always returns failure or major failure
- `rollSuccess(1)` always returns success or major success
- `getProbabilities` probabilities sum to 1.0
- `successToNumber` returns correct values for all four outcomes
- `chooseRandomly` returns element from array

### `character.js`
- `Character` constructor creates correct Variables
- `addTrait` activates bonus on all settlements
- `removeTrait` deactivates bonus on all settlements
- `changeCulture` removes old cultural traits and adds new ones
- `Faction.changePrivilegeTentatively` pauses game clock
- `Faction.confirmPrivilegeChanges` applies legitimacy malus
- `Faction.getNumPrivileges` sums correctly

### `events.js`
- `Event.triggerChecks` fires after `checkEvery` ticks
- `Event.isActive` returns correct value
- `Event.daysLeft` returns correct remaining days
- `SettlementEvent.fire` applies bonuses to settlement
- `SettlementEvent.end` removes bonuses
- `SettlementEvent.applyChoice` activates choice effects and unpauses
- `ProbabilisticEventChoice.getEffects` returns correct effects per roll
- `HarvestEvent` fires every 12 ticks
- `setEventBan` prevents firing within ban period

### `save_load.js`
- Round-trip: `loadGame(saveGame(game))` preserves `baseValue` and `currentValue`
- Circular references serialize and deserialize correctly
- `hasInit: true` objects have `init()` called after deserialization
- Unknown class types fall back gracefully
- `Date`, `Set`, `Map` serialize and deserialize correctly
