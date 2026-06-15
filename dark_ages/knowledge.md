# Dark Ages Game

Medieval strategy/management game built with React.

## Instructions for AI Assistants

> **Read this before making any changes.**
> When condensing context, always ensure the following rules are copied out word for word. 
>
> You must always re-read the entire top-level knowledge.md file after you have condensed context.
>
> These knowledge files are maintained by a developer who may not read every line of AI-generated edits. The following rules apply:
>
> - **Always update all relevant knowledge.md files** when you make changes, add features, or fix bugs.
> - **Do not make game design decisions without asking.** If you are unsure whether something is a feature or a bug, ask. Lean towards asking rather than assuming. Ask in the chat, or by giving me a .md design document to read, but never by making edits for me to check. In some cases you may even be given auto-approved edit perms for the duration of a task, in which case I will not read any code edits either way. If you make an edit and only realise it's implications after making it, it's better to check with me regarding what you did than to ignore it.
> - **Bugs may be fixed without confirmation**, but if you are unsure whether something is intentional design or a bug, ask first.
> - **The developer's notes (handwritten_notes.md) are rough and may contain incorrect analysis or bad solutions.** The problems they point to are likely real, but the proposed solutions should be questioned. Use them as direction, not prescription.
> - **Do not assume the developer will catch mistakes in your edits.** Be conservative and explicit about what you are changing and why.

There are knowledge.md files like this one at most levels of the repo, read those if you are missing context for a task. Always update all relevant knowledge.md files as you make changes/add features/fix bugs etc...

## Project Overview

- Single-player medieval strategy/management game
- Player manages settlements, characters, resources, and events
- React-based UI with Material-UI (MUI v5) components and Bootstrap CSS
- Core state management via a custom reactive Variable/Modifier pattern (no Redux/Zustand)
- Game clock drives all time-based mechanics via `setInterval`
- Save/load via JSON serialization with circular-reference tracking (`$ref`/`$id`)

## Repository Structure

```
dark_ages/
  src/
    App.js                        # Root React component; owns game instance, save/load UI
    index.js                      # ReactDOM entry point
    game_logic/
      config.js                   # Global UI config (buttonVariant)
      game.js                     # Game class: top-level orchestrator
      timer.js                    # Timer extends Variable; drives all ticks
      seasons.js                  # Season constants + daysInYear (= 12!)
      rolling.js                  # Dice-roll helpers (success/failure/major)
      character.js                # Character, Culture, Trait, Faction + UI components
      events.js                   # Event hierarchy + all concrete event types
      logger.js                   # Singleton Logger + LoggerComponent (debug inspector)
      save_load.js                # serializeObject / deserializeObject (JSON save system)
      UIBase.js                   # Base React class component with Variable subscriptions
      UIUtils.js                  # Re-export barrel for variable system
      utils.js                    # titleCase, roundNumber, HTMLTooltip, CustomTooltip
      gameUI.js                   # Top-level game layout component
      hud.js                      # HUD: timer display, play/pause/next-day, treasury
      mainUI.js                   # Main panel: renders Settlement or Character view
      sidePanelUI.js              # Side panel: settlement/character navigation list
      variable/                   # Core reactive state system
      settlement/                 # Settlement, buildings, resources, market, research
```

## Architecture Overview

### Reactive State: Variable → Modifier → Subscriber

All numeric game state lives in `Variable` instances. A `Variable`:
- Has a `baseValue` and a list of `AbstractModifier` objects
- Recalculates `currentValue` by applying modifiers in priority order
- Notifies `subscriptions` (sorted by priority) when `currentValue` changes
- Supports `min`/`max` bounds (themselves Variables)
- Carries `explanations` for tooltip display

Modifiers are `VariableModifier` (wraps another Variable) or `UnaryModifier` (e.g. `castInt`). Modifier types include: `addition`, `subtraction`, `multiplication`, `division`, `exponentiation`, `invLogit`, `scaledAddition`, `scaledMultiplication`, `min`, `max`, `minBase`, `roundTo`, `castInt`.

Specialised Variable subclasses:
- **`Cumulator`** – accumulates over time; on each timer tick, sets `baseValue = currentValue` (i.e. "banks" the change). Used for treasury, resources, population.
- **`TrendingVariable`** – smoothly interpolates `currentValue` toward a target at configurable up/down speeds. Used for happiness and health to prevent instant swings.

### Timer

`Timer` extends `Variable`. It increments its value by 1 on each `setInterval` tick (`every` ms). All time-based systems subscribe to the game clock. The game clock uses `daysInYear = 12` (not 365), so a "year" is 12 ticks.

There are two timers:
- **Game clock** (`every: 800ms`) – drives all game mechanics
- **Internal timer** (`every: 500ms`) – drives React UI re-renders (passed as `internalTimer` prop)

### Game Class

`Game` is the top-level orchestrator:
- Creates `gameClock`, `playerCharacter`, two `Settlement` instances
- Creates `treasury` as a `Cumulator` with `totalMarketIncome` as a modifier
- Monitors treasury for bankruptcy (`bankrupt` Variable, 0 or 1)
- Holds `globalEvents` (currently only `HarvestEvent`)
- `triggerChecks()` is called each tick to fire eligible events
- `handleRebellion()` handles settlement loss; game-over if all settlements lost

### UI Architecture

- `App.js` owns the `Game` instance and save/load logic
- `GameUI` renders a 3-column layout: SidePanel | MainUI+HUD | Logger
- `UIBase` is the base class for all class-based UI components; it subscribes to a list of Variables and calls `setState` on change
- `MainUI` renders either `SettlementComponent` or `CharacterComponent` depending on what is selected
- `SidePanel` lists player character and all settlements as clickable nav items
- `HUD` shows timer, harvest quality, play/pause/next-day buttons, treasury

## Key Concepts

### Game Systems

#### Characters
- Have a `Culture` (Celtic or Roman), each providing cultural `Trait`s
- Have 5 trait groups: childhood, ability, personality, fame, trinket
- Skills: `strategy`, `diplomacy`, `administration` (all `Variable`)
- `administrativeEfficiency` = 0.9 + 0.3 × administration (affects settlement productivity)
- `legitimacy` Variable affects settlement `localLegitimacy` and rebellion risk
- Characters belong to a `Faction` which can have up to 4 privilege levels across 3 privilege types (noble, citizen, clergy)
- Faction privilege changes pause the game clock until confirmed; confirmation applies a temporary legitimacy malus

#### Settlements
- Each settlement has: population, buildings, resources, rationing, market, research, events, terrain
- `populationSizeInternal` is a `Cumulator` that multiplies by `populationSizeChange` each tick
- Population growth/decline driven by health, homelessness, and immigration factor
- `generalProductivity` is a `Variable` modified by health (invLogit curve), happiness (invLogit curve), leader administration, and research/traits
- `happiness` and `health` are `TrendingVariable`s (slow to change)
- `support = happiness + localLegitimacy + diplomacyEffect - 1`; negative support accumulates in `totalRebellionSupport`; when ≥ 1, rebellion fires
- Rebellion replaces the leader with a random NPC; if the player loses all settlements, game over

#### Resources
- 25+ resource types defined in `Resources` object
- Each has a `storageMultiplier` (storage capacity per storage building size unit)
- Resources with `cumulates: false` (housing, roads, religion, entertainment, tools) are "flow" resources — their `amount` is recalculated each tick, not accumulated
- `ResourceStorage` manages supply/demand queuing with priority ordering (buildings=1, citizens=2, market=3)
- `updateDemands()` distributes available supply across demands in priority order

#### Events
- `Event` base class: checks `eventShouldFire()` every `checkEvery` ticks
- `SettlementEvent` applies `SettlementBonus` objects on fire, removes them on end
- `RegularSettlementEvent` adds variance to check interval
- Events can `forcePause` the game clock until the player makes a choice
- `EventChoice` / `ProbabilisticEventChoice` for player decisions
- Active events: `CourtIntrigue` (only one currently active in settlements; others commented out)
- Global events: `HarvestEvent` fires every year, affects farm productivity and food prices

#### Market
- Each settlement has a `Market` with buy/sell proportions per resource
- `tradeFactor` (boosted by roads) determines max trade volume and price spread
- `marketSellPriceFactor` = 0.65 + tradeFactor bonus (sell below ideal price)
- `marketBuyPriceFactor` = 1.35 - tradeFactor bonus (buy above ideal price)
- Bankruptcy (`bankrupt=1`) zeroes out buy amounts via `scaledMultiplication` modifier
- `netMarketIncome` feeds into `treasury` via `SumAggModifier`

#### Research
- Research tree with 11 categories: agriculture, housing, woodcutting, charcoal, brewing, services, health, roads, mining, tools, military, productivity
- Research costs `research` resource (produced by Library)
- Unlocks buildings, building upgrades, and productivity bonuses
- Research is sequential within each category (must research earlier items first)

#### Terrain
- `NoTerrain`, `Farmlands`, `Woodlands`, `Marshlands`, `Mountains`
- Each applies `SettlementBonus` objects on construction (productivity modifiers, new buildings, max size changes)
- Marshlands: adds BogIronPit and PeatBog; Mountains: adds CoalMine

### Technical Architecture

#### Save/Load System (`save_load.js`)
- `serializeObject()` does a deep walk, tracking circular refs via `WeakMap` (assigns `$id`)
- Circular references serialized as `{ $ref: id }`
- Each object serialized as `{ $type, $id, $data }`
- `CLASS_MAP` maps type names to constructors; `hasInit` controls whether `init()` is called after deserialization
- `SPECIAL_PROPS` (subscriptions, callbacks) are excluded from serialization — re-established by `init()`
- `Variable` has special serialization path that preserves `baseValue`, `currentValue`, modifiers
- After load, `game.init()` re-wires all subscriptions and restarts the timer

#### Subscription Cleanup
- `Variable._subscriptionSources` is a `WeakMap` tracking which subscriptions were created for which modifier/min/max sources
- `_addSubscriptionSource` / `_removeSubscriptionSource` manage this map
- `removeModifier()` calls `_removeSubscriptionSource` before filtering the modifier out
- `UIBase` components unsubscribe in `componentWillUnmount`
- `VariableComponent` handles prop changes via `componentDidUpdate` → `ingestProps`

## Development Guidelines

### UI Style
- Use grey color for supporting text on white backgrounds
- Use alpha channel for supporting text on colored backgrounds
- Use grey for unselected items, black/bold for selected
- Minimize labels and headings where possible
- Group related UI elements into tabs (production, distribution, trading, research)
- `HTMLTooltip` for explanatory hover text (white background, right-aligned text)
- `CustomTooltip` wraps `HTMLTooltip` and accepts `Variable` instances, strings, or `{text, style}` objects

### Code Style
- Keep Variable/Modifier pattern for all numeric game state
- Always pass an `explanation` string to `setNewBaseValue()` — it throws if missing
- Use `HTMLTooltip` / `CustomTooltip` for explanatory hover text
- Maintain separation between game logic (no React imports) and UI components
- `UIUtils.js` is the barrel re-export for the variable system — import from there in settlement/game code
- `config.js` holds global UI constants (currently just `buttonVariant: "outlined"`)

## Current Development Focus
- Improving UI/UX to make game more playable
- Balancing resource production and trading
- Expanding events and faction systems (most settlement events are commented out)
- Adding more cultural traits and faction mechanics

## Developer Notes & Planned Work

> The following sections are derived from `handwritten_notes.md`. The problems identified are likely real, but the proposed solutions may be imperfect. Do not implement anything here without confirming with the developer first — these are intentions, not specifications.

### Immediate / Short-Term Tasks

- **Move to character screen on first day**: Force-stop the timer until all player traits are set on day 1. Intent: prevent the game from running before the player has configured their character.
- **Nomad events for population growth**: Add events where nomads arrive and can be taken in to boost immigration. (See Events section below for detail.)
- **Permanent game message log**: Keep a persistent log of all game messages somewhere accessible to the player.
- **Auto-sell excess goods to market**: Currently excess production is wasted when storage is full. The developer suggests tracking excess within the `Cumulator` variable and picking it up at end of day. This is considered important for the economy to function correctly.
- **UIBase subscription bug**: `UIBase` does not correctly handle cases where a prop (e.g. `props.character` in `CharacterComponent`) changes after mount — subscriptions are not re-wired. The fix suggested is to give components a callback that retrieves the correct variable from props, and re-run it in `componentDidUpdate()` (including clearing old subscriptions). This is confirmed by code analysis — see `UIBase.js` Known Issues.

### Optimisation Notes

- **Round happiness, health, building productivity to 3dp**: Reduces subscriber cascade frequency. `TrendingVariable` already rounds via `trendingRoundTo`, but underlying modifiers may still fire frequently. Suggested fix: add `new VariableModifier({type: roundTo, startingValue: 3, customPriority: 200})` to building `productivity` Variables.
- **Bankruptcy state change is slow**: When `bankrupt` flips between 0 and 1, it triggers a cascade through all market `buyProp` Variables. Developer suggests examining via logging to find the bottleneck. Rounding to dp may help.

### UI Improvement Ideas

> These are design suggestions — do not implement without confirmation.

- Tabulate the settlement view: production, distribution, trading, research tabs
- Move research into its own tab; research should aggregate across all settlements (research is not per-settlement in the intended design)
- Add Paradox-style warnings for homelessness, unemployment, rebellions, etc.
- Add browser-style back/forward navigation
- Hide research and market UI behind having the Library and Market buildings respectively
- Add descriptions/tooltips to character and settlement variables
- "Buy/sell now" button in market to immediately trade as much as possible from storage (developer notes this may be unbalanced)

### Balance Notes

> These are design concerns — do not implement without confirmation.

- **Trade exploit**: If building productivities differ significantly between settlements, trading will be preferred over production. Research bonuses should not be too aggressive, and trade should have penalties. This is a known potential exploit.
- **Tavern/entertainment should improve trade modifier**: Currently entertainment has no effect on `tradeFactor`. Developer intends to add this.

### Planned Content

> Do not add any of these without confirmation from the developer.

#### New Buildings (trivial to add)
- Cemetery
- Bathhouse
- Sculpture / Artist's Studio
- Sports field
- Coastal terrain: Fishing Wharf + higher raid chances

#### New Terrain
- **Coastal**: fishing wharf building, higher raid event probability

#### New Cultures & Traits
- More cultures beyond Celtic and Roman (developer has notes on phone)
- More cultural traits

#### New Faction Features
- More faction privilege edits / laws (developer has notes on phone)
- Possible interest group mechanics

### Planned Events

> Do not implement without confirmation. These are rough ideas.

- **Blizzard**: increased coal demand, massively increased trade costs. Suggested implementation: `ModifySettlementVariableBonus` passing variable name; add/remove modifier to coal `idealAmount` (see `adjustCoalDemand`).
- **Rats in storage**: lose food; player may be able to mitigate somehow.
- **Landslide**: spend money or face unhappiness.
- **Warm spell**: happiness boost, less coal demand.
- **Merchant boom**: trade factor increase.
- **Hunting game surplus**: HuntingCabin productivity increase.
- **Dry hunting lands**: HuntingCabin significant decrease.
- **Local miracle**: happiness boost and immigration boost (immigration not yet implemented).
- **Court intrigue**: trials, corruption, noble dealings — affects legitimacy and happiness, depends on character abilities. (Partly implemented.)
- **Large group of nomads arrives**: choices — take them in, trade with them, send them away. Possibly force-pause. Risk of robbery triggering a follow-up event. Could be a one-time event.
- **Pestilence**: health loss, then choice to isolate (productivity hit) or lose more health. **Note from developer: the health penalty should NOT be temporary.** (Currently implemented as temporary — this may be a bug or design change.)
- **Bandit raid**: fight, pay off, or get raided.

#### Event System Improvements
- **Wolf attack**: make it depend on how much weaponry the settlement has available.
- **Fire event**: add a probabilistic outcome where high administration allows better building organisation. Add an `EventEffect` that permanently increases `checkEvery` (i.e. fire prevention improves after a fire).
- **Default `_eventShouldFire()`**: add a probability prop to the base class so simple events don't need to override it. Add an `EventEffect` that changes the firing probability.

### Next Up (MVP Priorities)

1. Basic character/RPG system
2. Basic combat system — bandit raids
3. Civilian and military rebellions — legitimacy system; low legitimacy + happiness triggers rebellions
4. Paradox-style warnings for homelessness, unemployment, etc.
5. Balance testing via automated tests — set up conditions and measure happiness
6. Save/Load system (partially implemented — see `save_load.js`)
7. UX improvements
8. Playtesting

### Later Builds

> Long-term ideas — do not implement without confirmation.

- Diplomacy system
- "Fake" AI settlements — characters that do combat/diplomacy but don't manage settlements
- Conditional variables — take a boolean or two variables to compare, return different results
- Building upkeep costs
- Food decay

### AI / Reinforcement Learning Ideas

> Speculative long-term ideas. Do not implement.

- **Job setting NN**: one network per building; inputs: demand, stockpile, productivity, unemployed, happiness, health, strategy. Output: % of unemployed to assign.
- **Ration setting NN**: one network per ration; inputs: happiness, health, demand. Output: ration %. Could be trained via simulation.
- **Building/upgrading NN**: decides what to build/upgrade and passes to job-setting NN.

### Variable History / Plotting

> Design idea — do not implement without confirmation.

- Add short-term, long-term, and super-long-term history to key variables
- Plot them over time
- Snapshot explanations over time for debugging
- Resource buildings should show a productivity breakdown so the player can see the effect of terrain, crop blight, etc.

### Market: Buying Inputs Without Producing Them

> Design question — do not implement without confirmation.

- Currently, a settlement can only buy resources on the market if it also produces them (i.e. has the relevant building). The developer wants to allow buying inputs (e.g. iron) even without an iron mine. This would require changes to how market resources are registered.

## Known Bugs & Issues

### Critical
*(all critical bugs fixed — see below)*

### Moderate
9. **`TemporaryModifierBonus.deactivate()`**: does nothing — relies on timer callback to remove modifier. If the event ends before the timer fires, the modifier may persist

### Minor
*(all minor bugs fixed — see below)*

### Fixed (this session)
- **`events.js` debug flags**: `forceLastCheckedDebug` and `forceFireEvents` set to `false` — were hardcoded `true`, causing all events to fire on day 2 regardless of `eventShouldFire_()` logic
- **`default_buildings.js` module-level side effects + timer leak**: `DefaultBuildings` was constructed at module import time, creating live `Timer` (with `setInterval`) and `ResourceStorage` instances. Replaced with `createDefaultBuildings()` factory and `getDefaultBuildings()` lazy singleton. `settlement.js` updated to call `getDefaultBuildings()`. `resource.defaultBuilding` assignment now happens at game construction time, not import time.
- **`settlement.js` coal demand set twice**: the rationing loop subscribed to `gameClock` to set `coal.idealAmount` on every tick, duplicating `adjustCoalDemand()`. The redundant subscription removed; `adjustCoalDemand()` is the sole owner.
- **`settlement.js` stale `debugger` statement**: removed leftover `debugger;` in the `unemployed` subscription callback.
- **Bug 1** (`aggregator.js`): `this.variable.length` → `this.variables.length` in `resubscribeToVariables` loop
- **Bug 2** (`modifier.js`): `subscribe()` parameter renamed from `proiority` to `priority`; shorthand `{callback, priority}` now correctly captures the parameter
- **Bug 3** (`building.js`): `Housing` second upgrade `changes` corrected from `Resources.steelTools` to `Resources.brickHouses`
- **Bug 4** (`default_buildings.js`): removed duplicate `dummyIronWeaponMaker` entry; `dummySteelWeaponMaker` now correctly placed
- **Bug 5** (`bonus.js`): `SpecificBuildingMaxSizeBonus.activate()` now adds modifier to `building.size.max` (creating it if absent) instead of `building.productivity`
- **Bug 6** (`character.js`): `changePrivilegeTentatively()` now assigns filter result to `changedPrivileges` and checks its length
- **Bug 7** (`settlement.js`): `this.unemployed.currentVariable` → `this.unemployed.currentValue`
- **Bug 8** (`trendingVariable.js`): removed manual `currentDepth` increment/reset from `TrendingVariable.recalculate()` — parent handles depth via `quietly` flag
- **Bug 10** (`save_load.js`): `BogIronPit`, `CoalPit`, `PeatBog` added to imports and `CLASS_MAP`
- **Bug 13** (`variable.js`): min explanation typo fixed — `abridgedExplanations` now says `"min value is ..."` not `"max value is ..."`
- **Bug 14** (`logger.js`): `childRender()` now renders `{line}` (the value) instead of the string literal `line`
- **Bug 15** (`utils.js`): `roundNumber()` now returns `0` and logs a warning instead of throwing when `number` is `undefined`/`null`/`NaN`
- **Bug 16** (`modifier.js`): removed unused `compare()` dead-code function
- **Bug 17** (`events.js`): removed unused imports `getButtonUnstyledUtilityClass` and `toHaveDisplayValue`
- **Bug 20** (`gameUI.js`): `GameUI` now uses `props.game` instead of creating its own `new Game()` internally
- **Bug 10** (`variable.js`): epsilon check in `recalculate()` now guards against `currentValue = 0` — condition changed to `Math.abs(this.currentValue) < eps || absChange / Math.abs(this.currentValue) > 2e-5`
- **Bug 11** (`settlement.js`): removed duplicate `forceResetTrend()` calls — health and happiness each reset once, not twice
- **Bug 12** (`settlement.js`): population formula restructured to `immigrationFactor * (1 + growth) - decline` — immigration now scales inflow only, not death rate

## Unit Testing Ideas

### Variable System
- `Variable` recalculates correctly after `setNewBaseValue`
- `Variable` respects `min`/`max` bounds
- `Variable` does not call subscribers when value change is below epsilon
- `Variable` unsubscribes correctly; no memory leaks after `removeModifier`
- `VariableModifier` all types: addition, subtraction, multiplication, division, exponentiation, invLogit, scaledAddition, scaledMultiplication, min, max, roundTo, castInt
- `VariableModifier` `scaleValue()` with offset, bias, exponent combinations
- `Cumulator` banks value on timer tick; `expectedChange` is correct
- `TrendingVariable` trends toward target at correct speed; `forceResetTrend` snaps immediately
- `AggregatorModifier` / `SumAggModifier` correctly sums a list of variables
- `ListAggModifier` correctly navigates key paths to find variables
- Subscription priority ordering is maintained after add/remove
- Circular subscription chains do not cause infinite recursion (depth guard)

### Settlement
- `ResourceStorage.updateDemands()` distributes supply correctly across priorities
- `ResourceStorage.addDemand()` / `removeDemand()` correctly wire/unwire modifiers
- `ResourceStorage.oneOffDemand()` reduces `baseValue` correctly
- Building `canBuild()` returns false when resources insufficient
- Building `build()` deducts correct resources
- Building `upgrade()` / `downgrade()` correctly swaps output resource and input resources
- `Settlement.adjustJobs()` assigns workers to highest-priority buildings
- `Settlement.adjustJobs()` removes workers when population drops
- `Settlement.rebel()` replaces leader and calls `handleRebellion`
- Population growth/decline rates are within expected bounds
- Happiness/health trending variables respond correctly to ration changes

### Events
- `Event.triggerChecks()` fires when `checkEvery` ticks have elapsed
- `Event.isActive()` / `daysLeft()` return correct values
- `SettlementEvent.fire()` applies bonuses to settlement
- `SettlementEvent.end()` removes bonuses from settlement
- `ProbabilisticEventChoice.getEffects()` returns correct effects for each roll outcome
- `HarvestEvent` fires every year and modifies farm productivity and food price
- `CropBlight` choice "Destroy some fields" reduces farm size and halves duration
- Event ban (`setEventBan`) prevents re-firing within ban period

### Characters & Factions
- `Character.addTrait()` activates bonus on all settlements
- `Character.removeTrait()` deactivates bonus on all settlements
- `Character.changeCulture()` swaps cultural traits correctly
- `Faction.changePrivilegeTentatively()` pauses game clock
- `Faction.confirmPrivilegeChanges()` applies legitimacy malus and unpauses
- `Faction.getNumPrivileges()` returns correct total

### Save/Load
- `saveGame()` / `loadGame()` round-trip preserves `baseValue` and `currentValue`
- Circular references are correctly serialized and restored
- `init()` is called on objects with `hasInit: true`
- Unknown class types in `CLASS_MAP` fall back gracefully
- Loading a save file restores game clock state correctly
