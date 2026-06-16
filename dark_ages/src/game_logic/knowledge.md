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
| `game.js` | `Game` class — top-level orchestrator; accepts optional scenario config |
| `scenarios.js` | Scenario definitions (plain data objects, no game class imports) |
| `ScenarioSelectUI.js` | Scenario selection screen shown before game starts |
| `diplomacy.js` | `TradeAgreement` class + `npcWillAcceptTrade()` (§5). Kept separate from `game.js` to avoid circular imports. |
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
| `theme.js` | Theme system: `ThemeContext`, four themes, colour tokens |
| `gameUI.js` | Top-level 3-column layout component |
| `hud.js` | HUD: timer, harvest quality, play/pause/next-day, treasury |
| `mainUI.js` | Main panel: renders Settlement or Character view |
| `sidePanelUI.js` | Side panel: navigation list |

---

## `game.js` — Game Class

### Key Properties
- `this._scenario` — the scenario config object passed to the constructor (or `null`)
- `this.npcCharacter` — NPC character stored on game instance (for auto-research subscription)
- `this.warningsShown` — `Set` tracking which first-time warnings have been shown (keyed by `warningType_settlementName`)
- `this.isGameOver` — boolean; set to `true` when player loses all settlements
- `this.tradeAgreements` — array of active `TradeAgreement` instances (max 2)

### Module-level constants
- `EVENT_CLASS_MAP` — maps event class name strings to constructors (for `forceEventsOnDayOne` lookup)
- `ALL_TRAIT_CLASSES` — flat array of all trait constructors from all 5 trait group arrays (for `playerTraits` name lookup)

### Construction
Constructor signature: `constructor(scenario)` — `scenario` is an optional plain config object from `scenarios.js`.

1. Creates `gameClock` (`Timer`, 800ms per tick, `daysInYear=12`)
2. Reads `startingPopulation` from scenario (default 37) and `startingTreasury` (default 10)
3. Creates `playerCharacter` (Celtic culture, `isPlayer: true`)
4. Creates NPC character with randomized traits
5. Creates two `Settlement` instances (Village 1 = Marshlands, Village 2 = Farmlands)
   - Village 1 (player) receives `addToTreasury` callback for auto-sell excess goods income
6. Creates `totalMarketIncome` as a `SumAggModifier` over all settlements' `market.netMarketIncome`
7. Creates `treasury` as a `Cumulator` with `totalMarketIncome` as modifier; starting value from scenario
8. Subscribes to treasury to set `bankrupt` Variable (0 or 1) when `baseValue` crosses zero
9. Creates `HarvestEvent` as the only global event
10. Calls `initEvents()` to fire any events that should fire immediately
11. If `scenario` provided, calls `_applyScenario(scenario)`
12. Sets up day-1 behaviour (see below)

### Day-1 Behaviour
Several subscriptions and modifiers are added unconditionally at construction time (regardless of scenario):

**Direct snap subscriptions on `happiness` and `health`**: For each settlement, a callback is subscribed directly to `s.happiness` and `s.health` at priority 1000. Whenever either variable recalculates (triggered by any modifier change — rationing, workers, events, etc.), the callback calls `forceResetTrend()` to snap `trendingValueAtTurnStart` to the new target immediately. This means any UI change the player makes before pressing Play is reflected instantly in the displayed health/happiness values, as if the settlement had always been in that state. A re-entrancy guard (`snappingHappiness` / `snappingHealth` boolean flags) prevents `forceResetTrend()` from re-triggering itself. Both subscriptions are removed on day 2.

**Priority 1000 — `snapTrendsOnDayOne`** (timer subscription): fires on tick 1 only. Calls `forceResetTrend()` on all settlements' `happiness` and `health` after all supply/demand calculations have run for the first tick.

**Priority 999 — `restoreOnDayTwo`** (timer subscription): fires on tick 2 only, then unsubscribes itself, `snapTrendsOnDayOne`, and all direct snap subscriptions from `happiness`/`health`. Also removes the population freeze modifiers.

**Population freeze**: `min` and `max` modifiers (both clamping to 1.0) are added to each settlement's `populationSizeChange` at construction time. This prevents any population change on day 1. Both modifiers are removed by `restoreOnDayTwo` on tick 2.

**`TrendingVariable` is not modified**: the snap behaviour is entirely implemented in `game.js` via subscriptions and `forceResetTrend()`. `TrendingVariable.trend()` behaves normally at all times.

### `_applyScenario(scenario)`
Called at the end of the constructor when a scenario is provided. All game systems are fully wired before this runs. Steps (in order):

1. **Starting resources** — for each `[resourceName, amount]` in `scenario.startingResources`, finds the matching `ResourceStorage` and calls `rs.amount.setNewBaseValue(baseValue + amount)`
2. **Building sizes** — calls `building.forceNewSize(targetSize)` for each entry in `scenario.startingBuildingSizes`; also sets `building.unlocked = true` if size > 0
3. **Building upgrades** — calls `building.upgrade(resourceStorages, force=true)` sequentially up to the specified upgrade index for each entry in `scenario.startingBuildingUpgrades`
4. **Pre-research** — for each name in `scenario.preResearched`, sets `item.researched = true` on the faction tree item and calls `settlement.activateBonus()` for each bonus on the matching settlement research item
5. **Pre-arm soldiers** — calls `settlement.armSoldiers(unitResource, count)` for each entry in `scenario.startingArmy` (weapon resources must already be in storage from step 1)
6. **Player traits** — if `skipTraitSelection`, fills all 5 trait groups using `scenario.playerTraits` names (looked up case-insensitively) or falls back to first available trait in each group
7. **Bandit raid ban** — if `scenario.banditRaidBanDays !== null`, sets `banditRaidEvent.bannedUntil`
8. **Force events on day 1** — adds a priority-998 timer subscription that fires on tick 1, directly calls `event.fire()` for each named event class
9. **Research rate multiplier** — adds a multiplication modifier to Library `productivity` (if Library exists)
10. **General productivity bonus** — adds a multiplication modifier to `playerSettlement.generalProductivity`
11. **Legitimacy bonus** — adds an addition modifier to `playerCharacter.legitimacy`
12. **Event ban until day N** — sets `event.bannedUntil = scenario.eventBanUntilDay` on all player settlement events where the new ban is longer than the existing one

After `_applyScenario` returns, the constructor immediately calls `this.settlements[0].adjustJobs()` to auto-staff any pre-built buildings before the player hits Play. This only runs when a scenario is provided (i.e. never for the bare default new game).

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

### `addGameMessage(message)`
Pushes `message` to both `gameMessages` (transient modal queue) and `messageLog` (permanent log with `{text, day}` entries). All game messages should go through this method.

### `addToTreasury(amount, reason)`
Adds `amount` directly to `treasury.baseValue`. Used by settlements to credit auto-sold excess goods income. Only acts if `amount > 0`.

### `handleRebellion(settlement)`
Calls `addGameMessage()` with rebellion text. If `playerCharacter.settlements.length === 0`, calls `addGameMessage()` with game-over text, calls `gameClock.forceStopTimer("game over")`, and sets `isGameOver = true`.

### Known Issues
- `init()` re-subscribes the game clock to `triggerChecks()` but the constructor does not — so after load there is a subscription but before load there is none (events only fire via `triggerChecks()` called from `Settlement` constructor indirectly via timer)
- Day-1 snap/freeze subscriptions are not serialized — after loading a save, they will not be present (this is acceptable since day 1 has already passed)

---

## `scenarios.js` — Scenario Definitions

Plain data objects only — no game class imports. All interpretation happens in `game.js`.

### Exports
- `SCENARIOS` — object keyed by scenario id (`default`, `intended`, `easy`, `banditRaid`)
- `SCENARIO_LIST` — `Object.values(SCENARIOS)` array (used by `ScenarioSelectUI`)

### Scenario Shape
See the top-level `knowledge.md` Scenario System section for the full field reference.

### Building Name Strings
Building names in `startingBuildingSizes` and `startingBuildingUpgrades` must match the static `.name` property on each building class:
- `'farm'` (Farm)
- `'Mud Huts'` (Housing)
- `"lumberjack's hut"` (LumberjacksHut)
- `'charcoal kiln'` (CharcoalKiln)
- `'storage'` (Storage)
- `'construction site'` (ConstructionSite)
- `'Stone Weapon Maker'` (WeaponMaker)
- `'bowyer'` (Bowyer)
- `'brewery'` (Brewery)
- `'apothecary'` (Apothecary)
- `'Roads'` (Roads)
- `'library'` (Library)

---

## `ScenarioSelectUI.js` — Scenario Selection Screen

React class component shown before the game starts.

### Props
- `onStart: (scenarioConfig) => void` — called when player clicks "Begin"

### State
- `selectedId` — id of the currently selected scenario (default: `'default'`)
- `debugOverrides` — `{ forceEventsOnDayOne: [], banditRaidBanDays: null, skipTraitSelection: false, startingTreasury: null }`
- `showDebug` — boolean; controls visibility of debug options panel

### Key Methods
- `getSelectedScenario()` — returns the scenario object for `selectedId`
- `buildFinalConfig()` — merges selected scenario with debug overrides; `forceEventsOnDayOne` is a union; other overrides take precedence only if non-null/non-false
- `toggleDebugEvent(eventName)` — adds/removes event name from `debugOverrides.forceEventsOnDayOne`
- `setDebugOverride(key, value)` — sets a single debug override key

### Debug Panel
- Force events on day 1: checkboxes for all 8 forceable events; scenario-locked events shown as disabled
- Skip trait selection: checkbox; disabled if scenario already sets it
- Bandit raid ban period: slider 0–48 days + Reset button
- Starting treasury: slider 0–2000 gold (step 10) + Reset button

### `ScenarioTag` helper
Small coloured pill badge shown in scenario cards for quick summary info.

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
- **Force-stop on first day**: ✅ **Implemented**. `Character` constructor calls `gameClock.forceStopTimer(reason)` when `isPlayer=true`. `checkTraitsComplete()` is called after every `addTrait`/`removeTrait`; it releases the stop once all 5 trait groups are filled, and re-applies it if a trait is removed leaving a group empty.

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
- *(none remaining — `compare()` dead code removed)*

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

### `checkTraitsComplete()`
- Called after every `addTrait` and `removeTrait` on the player character
- Checks whether all 5 `traitGroups` slots are non-null/undefined
- If all filled: calls `gameClock.unforceStopTimer(reason)` (only if the stop is currently held)
- If not all filled: calls `gameClock.forceStopTimer(reason)` (only if not already held)
- No-op for NPC characters (`isPlayer=false`) or characters without a `gameClock`

### `Faction` — Research System
- `researchTree`: one `createResearchTree()` call per faction; this is the canonical tree the player interacts with
- `getPlayerSettlements()`: returns all settlements belonging to any faction member
- `getTotalResearch()`: sums `resourceStorage.amount.baseValue` for `Resources.research` across all member settlements
- `canResearch(research)`: checks `research.researched`, sequential unlock (previous item in category must be researched), and `getTotalResearch() >= researchCost`
- `activateResearch(research)`: drains cost proportionally from each settlement's research storage via `oneOffDemand`; marks faction item `researched = true`; applies bonuses to all member settlements by finding matching item in each settlement's internal `research` tree by name and calling `settlement.activateBonus()` on each bonus

### `FactionResearchComponent`
- `UIBase` component subscribing to `props.internalTimer` (re-renders each tick)
- Renders pooled research total (`Math.floor(getTotalResearch())`) and all research categories
- Sequential unlock: item visible if `researched || j === 0 || researchList[j-1].researched`
- Calls `faction.canResearch()` and `faction.activateResearch()` (not settlement methods)
- Rendered in `GameUI` when "Research" button is active

### `CharacterComponent` / `FactionComponent`
- `CharacterComponent` subscribes to `character.legitimacy`
- Shows culture, cultural traits, trait groups (editable for player), skills, attributes, faction
- `ChoiceComponent` renders a tooltip-wrapped display or a MUI `Select` dropdown for editing

### Known Issues
- `addTrait()` throws if a trait group already has a trait — but `updateFactionTraits()` calls `removeTrait` then `addTrait` which should be safe; however if `factionTraits` is undefined on first call, `forEach` on undefined throws
- `copyCulture(character)` creates a new culture instance by finding the matching class — works but creates a fresh culture losing any runtime state

---

## `events.js` — Event System

### Debug Flags
```js
const forceLastCheckedDebug = false;  // If true: forces all events to fire on day 2
const forceFireEvents = false;         // If true: forces all events to fire regardless of eventShouldFire_()
```
Both flags are now correctly set to `false`. Set them to `true` temporarily when debugging event logic.

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

### Concrete Events (all active as of MVP)
- `CropBlight`, `LocalMiracle`, `MineShaftCollapse`, `Fire`, `Pestilence` (severity system), `WolfAttack`, `CourtIntrigue` — original events, now all uncommented
- `WarmSpell` — happiness boost + coal demand reduction (fire_/end_ override)
- `MerchantBoom` — tradeFactor boost via `SimpleSettlementModifier`
- `HuntingGameSurplus` / `DryHuntingLands` — HuntingCabin productivity modifier
- `Blizzard` — farm + general productivity penalty, coal demand increase, trade penalty (fire_/end_ override); only fires in winter
- `RatsInStorage` — immediate food loss via `oneOffDemand` (fire_ override)
- `NomadsArrive` — forcePause; choices: take in / send away / rob (if armyStrength sufficient)
- `BanditRaid` — forcePause; choices: pay tribute / fight (multi-stage battle) / do nothing; banned for first 2 years

### Battle System (§4.4+4.5)
- `BattleArmy` — holds `bowStrength`, `meleeStrength`, `totalStrength`, `strategySkill` Variables + `bowCount`/`meleeCount` plain numbers
- `buildPlayerArmy(settlement)` — builds player army from unit resource storages + mobilised civilians
- `buildBanditArmy(settlement)` — builds bandit army scaled to player unit count / population
- `resolveSkirmishRound(state)` — strategy check → ground advantage → bow casualties
- `resolveMeleeRound(state, firstRoundPenalty)` — bow support + melee → casualties
- `applyBattleAftermath(settlement, playerWon, playerFled, totalPlayerDead, timer)` — happiness/legitimacy/health bonuses/penalties
- `BattleUI` — React component showing battle state and player choices (skirmish/clash/flee/manoeuvre)
- `BanditRaid.advanceBattle(choice)` — drives battle phase transitions; stores state in `this._battleState`

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
- `forceGoodNextHarvest` flag: if true, the next `getBonuses()` call forces `harvestSuccess = successText` and `harvestModifier = 1.0` (decent, not amazing). Flag is cleared after one use. Set via `props.forceGoodNextHarvest` at construction time (used by `goodFirstYearHarvest` scenario field).

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
- **Auto-opens modal on fire**: tracks `_lastAutoOpenedTrigger` (the `lastTriggered` timestamp). In `childRender()`, if `event.isActive() && !event.read && lastTriggered !== _lastAutoOpenedTrigger && !modalOpen`, calls `setTimeout(() => setModalOpen(true), 0)` to auto-open. The `setTimeout` avoids setState-during-render. Only fires for events rendered in the settlement header (player settlements only, since NPC settlements have no `settlementEvents`).

### Known Issues
- `TemporaryEventDisabled.deactivate()` is a no-op — the ban is set but never cleared on deactivate

### Fixed
- **`forceLastCheckedDebug` and `forceFireEvents`** set to `false` — were hardcoded `true`, causing all events to fire on day 2 regardless of `eventShouldFire_()` logic
- `MineShaftCollapse.getEventChoices()` uses `Farm.name` instead of `IronMine.name` when calculating the size change amount (line 460)

### Developer Notes on Events

> These are intentions from `handwritten_notes.md`. Do not implement without confirmation.

- **Gradual event effect fade-out** *(deferred — document only)*: Rather than cutting event bonuses off abruptly when an event ends, effects should decay smoothly. The desired curve is heavily skewed toward the original value — the effect should barely change for most of the duration, then drop off sharply near the end before being cut. Suggested approach: use a `TemporaryModifierBonus` subclass that applies a time-based multiplier to the bonus amount each tick, using a curve like `f(t) = (1 - t^k)` where `t` is proportion of duration elapsed and `k` is a large exponent (e.g. 4–6) so the value stays near 1 for most of the event and only falls meaningfully in the last ~20% of duration. The existing `TemporaryModifierBonus` class in `bonus.js` would need a `fadeOut: true` prop and access to the event's remaining duration. **Do not implement without confirmation.**

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
- `VariableModifier` is in `CLASS_MAP` but `AggregatorModifier`, `ListAggModifier`, `SumAggModifier` (only `SumAggModifier` is present) are not fully covered
- `visualAlerts` is a function reference — serialized as `undefined` (functions are skipped by `JSON.stringify`); after load, visual alerts will be missing
- The `subscriptionPriorities` saved for Variables are restored as `_savedSubscriptionPriorities` but `init()` creates empty subscriptions for them rather than the actual callbacks — this is a placeholder that doesn't fully restore subscription behaviour

---

## `UIBase.js` — Base Component

All class-based UI components extend `UIBase`.

### Two Subscription Modes

**Static (original)**: call `this.addVariables([variable1, variable2])` in the constructor. Subscriptions are set up once on mount and never change. Use when the variables you care about never change identity across re-renders.

**Dynamic (new)**: call `this.addVariableGetters([getter1, getter2, ...])` in the constructor, where each getter is `{ key: string, get: (props) => Variable }`. On mount AND on every `componentDidUpdate`, the getters are re-evaluated against the current props. If any variable identity has changed, old subscriptions are torn down and new ones are set up. Use when props (e.g. `props.character`) can change after mount.

The two modes can be combined.

### Static API: `addVariables(variables)`
- Can only be called once (throws if called twice)
- Stores `{key, variable}` pairs in `this.subs`
- On mount: subscribes each variable; on change, calls `setState` with the variable as the new state value for that key

### Dynamic API: `addVariableGetters(getters)`
- Accepts `[{ key: string, get: (props) => Variable }, ...]`
- On mount: evaluates all getters, subscribes to each variable, sets state
- On `componentDidUpdate`: re-evaluates getters; if any variable identity changed, tears down old subscriptions and sets up new ones
- On unmount: tears down all dynamic subscriptions

### Pattern (static)
```js
constructor(props) {
    super(props);
    this.addVariables([variable1, variable2]);  // call once in constructor
}
```

### Pattern (dynamic — for prop-dependent variables)
```js
constructor(props) {
    super(props);
    this.addVariableGetters([
        { key: 'legitimacy', get: (p) => p.character.legitimacy }
    ]);
}
```

### Known Issues
- `addVariables` uses array index as the state key — so `this.state[0]`, `this.state[1]`, etc. This means state keys are numbers, not meaningful names
- `variablesSet` flag prevents calling `addVariables` twice, but subclasses that call `super(props)` and then `addVariables` in the same constructor are fine; the issue arises if a subclass tries to add more variables later

### Fixed
- **Prop-change subscription bug**: `UIBase` previously did not handle cases where a prop (e.g. `props.character` in `CharacterComponent`) changed after mount — subscriptions were not re-wired to the new prop's variables. Fixed by adding the `addVariableGetters` dynamic subscription mechanism. `CharacterComponent` now uses `addVariableGetters` instead of `addVariables`.

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
`parseFloat(number.toFixed(dp))`. If `number` is `undefined`, `null`, or `NaN`, logs a warning and returns `0` instead of throwing.

### `percentagize(amount)`
`roundNumber((amount - 1) * 100, 1)` — converts a multiplier (e.g. 1.05) to a percentage string ("5").

### `randomRange(low, high)`
`low + (high - low) * Math.random()`

### `HTMLTooltip`
MUI `Tooltip` styled with white background, right-aligned text, max-width 400px, border.
**Always passes `PopperProps={{ disablePortal: true }}`** — this prevents nested tooltips (a `VariableComponent` inside another tooltip's `title`) from flashing to `(0,0)` before Popper measures the anchor. Rendering inline (not via portal) means positioning is correct on first render. Any caller-supplied `PopperProps` are merged in after the default.

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

### `theme.js` — Theme System
- Provides a live-switchable theme system for the game UI
- **Four themes**: `parchment` (soft aged paper), `parchmentDark` (darker parchment), `iron` (dark iron/charcoal), `ironSlate` (cooler slate variant)
- **`ThemeContext`**: React Context whose value is the current theme object; default value is the `parchment` theme
- **`THEME_LIST`**: exported array of all theme objects (used to render switcher buttons)
- **`getTheme(id)`**: returns a theme by its `id` string, falling back to `parchment`
- **`useTheme()`**: hook for functional components
- **Class component pattern**: add `static contextType = ThemeContext` (or `ComponentName.contextType = ThemeContext` after the class definition), then access `const c = this.context?.colors` in `childRender()` / `render()`
- **`App.js` integration**: owns theme state (persisted in `localStorage` key `'darkAgesTheme'`), wraps game in `<ThemeContext.Provider value={theme}>`, renders theme-switcher buttons in the bottom toolbar
- **Color tokens** (all accessed via `theme.colors.*`):
  - `pageBg`, `contentBg`, `contentBgAlt`, `contentBgHover` — layered backgrounds
  - `textPrimary`, `textMuted`, `textAccent` — text colours
  - `accent` — active/highlight colour (active HUD buttons, selected nav items)
  - `borderLight`, `borderMid`, `borderStrong` — border intensity levels
  - `hudBg`, `hudBorder` — HUD and bottom toolbar
  - `sidePanelBg`, `sidePanelBorder` — left navigation panel
  - `btnBorder`, `btnText`, `btnHoverBg` — button styling
  - `warningBg`, `warningBorder`, `warningText` — warning banner
  - `modalBg`, `modalBorder` — modal overlays

### `gameUI.js` — `GameUI`
- Uses `props.game` passed from `App.js` (no longer creates its own `Game` instance)
- 3-column MUI Grid: SidePanel (xs=2) | HUD+MainUI (xs=8) | Logger (xs=2)
- **Main content column** (`xs=8`) has `height: 100vh; overflow-y: auto` — its own scroll container so that `position: sticky` children work correctly within it. Has `paddingBottom` to reserve space for the fixed message log + bottom toolbar.
- **Sticky header block**: a single `position: sticky; top: 0; zIndex: 100` div contains the HUD, `WarningBanner`, and back/forward nav buttons — all three stick together at the top when scrolling. No `marginBottom` on this block (prevents a see-through gap). Settlement sticky header uses `top: 165` to clear this block.
- **`MessageLogPanel`**: rendered outside the main grid as `position: fixed; bottom: 40px; left: 0; right: 0; zIndex: 190` — always visible just above the App.js bottom toolbar. Shown by default (`showMessageLog` defaults to `true`).
- `setSelected(selected)`: pushes to `_navHistory`, truncates forward history, updates `this.state.selected`; also clears `showResearch` state
- Shows `GameMessage` modal when `game.gameMessages.length > 0`
- **Back/Forward navigation**: `_navHistory` array + `_navIndex` pointer. `navBack()` / `navForward()` move the index and call `setState`. Two MUI `Button` components (← →) rendered inside the sticky header block; disabled when at history boundaries or when Research panel is open. Initial history entry is `game.playerCharacter`.
- **Research panel**: "Research" button toggles `showResearch` state. When true, renders `FactionResearchComponent` (from `character.js`) instead of `MainUI`. Imports `FactionResearchComponent` from `./character`. Passes `faction = game.playerCharacter.faction` and `internalTimer` as props.

### `GameMessage`
- Subscribes to timer (so it re-renders)
- Calls `timer.stopTimer()` in `childRender()` — stops the game while message is shown
- "Close" button calls `readGameMessage()` which shifts the first message

### `MessageLogPanel`
- Pure React component (not UIBase)
- Props: `messageLog` (array of `{text, day}` objects), `show` (boolean), `onToggle` (callback)
- Toggle button shows/hides the panel; button label shows message count when hidden
- When shown: scrollable div (**max-height 120px** — ~4 rows before scrolling) showing all messages newest-first
- Each entry shows the day number and message text
- Rendered by `GameUI.childRender()` as a `position: fixed; bottom: 40px` element outside the main grid

### `hud.js` — `HUD`
- Subscribes to `treasury` and `gameClock`
- Uses `ThemeContext` (`HUD.contextType = ThemeContext`)
- Shows: `TimerComponent` (translated time text, 18px bold serif), harvest quality with tooltip (**18px bold**, opacity 0.9 — increased from 14px for visibility)
- Treasury: 🪙 prefix, 22px bold serif, `CumulatorComponent` showing current value and expected change
- **Play** button (▶ Play): disabled if running or force-stopped; filled with `accent` colour when active
- **Pause** button (⏸ Pause): disabled if not running; filled with `accent` colour when active
- **Next Day** button (🌅 Next Day): disabled if running; calls `forceTick()`; filled with `accent` colour when active

### `mainUI.js` — `MainUI`
- Subscribes to `internalTimer` (re-renders on every internal tick)
- Renders `SettlementComponent` if selected is a `Settlement`
- Renders `CharacterComponent` if selected is a `Character`

### `sidePanelUI.js` — `SidePanel`
- Subscribes to `internalTimer`
- Uses `ThemeContext` (`SidePanel.contextType = ThemeContext`)
- Shows section labels: **Characters** (above player character), **Settlements** (above settlement list)
- All nav items are 16px; selected item highlighted with `accent` colour
- **Research** nav item (📜 Research) sits between Characters and Settlements; toggles `showResearch` state in `GameUI` via `onToggleResearch` prop; clicking a settlement/character also closes the Research panel
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
