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
    App.js                        # Root React component; owns game instance, save/load UI, scenario select
    index.js                      # ReactDOM entry point
    game_logic/
      config.js                   # Global UI config (buttonVariant)
      game.js                     # Game class: top-level orchestrator; accepts scenario config
      scenarios.js                # Scenario definitions (plain data objects, no game imports)
      ScenarioSelectUI.js         # Scenario selection screen shown before game starts
      diplomacy.js                # TradeAgreement class + npcWillAcceptTrade() (§5)
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
      TutorialUI.js               # In-game tutorial / how-to-play page
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
- Constructor now accepts an optional `scenario` plain config object (from `scenarios.js`)
- Creates `gameClock`, `playerCharacter`, two `Settlement` instances
- Creates `treasury` as a `Cumulator` with `totalMarketIncome` as a modifier
- Monitors treasury for bankruptcy (`bankrupt` Variable, 0 or 1)
- Holds `globalEvents` (currently only `HarvestEvent`)
- `triggerChecks()` is called each tick to fire eligible events
- `handleRebellion()` handles settlement loss; game-over if all settlements lost
- `_applyScenario(scenario)` applies scenario overrides after full construction
- Day 1 behaviour: trending variables (happiness/health) snap instantly to their long-term values on day 1 and continue to snap whenever the player changes anything (rationing, workers, etc.) before pressing Play. Direct subscriptions to `happiness` and `health` call `forceResetTrend()` on any change. At construction time, `recalculate()` is called explicitly on both before `forceResetTrend()` to ensure all modifier chains have propagated, so displayed values are correct from game load. Subscriptions are removed on day 2. Population is frozen via `min`/`max` modifiers on `populationSizeChange` (both removed on day 2).

### Scenario System

Scenarios are plain data objects defined in `scenarios.js`. They are passed to `new Game(scenario)` and interpreted by `_applyScenario()`. No game classes are imported in `scenarios.js`.

**Available scenarios** (`SCENARIOS` object, also exported as `SCENARIO_LIST` array):
- `default` — standard start, 37 pop, 10 gold, no modifiers
- `intended` — standard start + no events for first year (`eventBanUntilDay: 12`)
- `easy` — 30 gold, +15% research rate, +5% productivity, +5% legitimacy, no events for 2 years (`eventBanUntilDay: 24`)
- `banditRaid` — 80 pop, 500 gold, pre-built mid-game settlement, pre-set traits, army (10 iron spears, 5 stone swords, 8 short bows), BanditRaid forced on day 1; starts with 25 iron weaponry (increased from 20)

**Scenario config fields:**
| Field | Type | Description |
|-------|------|-------------|
| `startingPopulation` | number | Player settlement starting population (default 37) |
| `startingTreasury` | number | Starting gold (default 10) |
| `startingResources` | `{[resourceName]: number}` | Extra resources added to player settlement |
| `startingBuildingSizes` | `{[buildingName]: number}` | Force building sizes (uses building `.name` static strings) |
| `startingBuildingUpgrades` | `{[buildingName]: number}` | Force upgrades by index (0 = first upgrade) |
| `startingArmy` | `{[unitResourceName]: number}` | Pre-arm soldiers (weapon resources must be in `startingResources`) |
| `preResearched` | `string[]` | Research item names to pre-activate (bypasses cost) |
| `skipTraitSelection` | boolean | Auto-fill player traits so game doesn't force-stop on day 1 |
| `playerTraits` | `{childhoodTrait?, abilityTrait?, personalityTrait?, fameTrait?, trinketTrait?}` | Specific trait names per group |
| `forceEventsOnDayOne` | `string[]` | Event class names to fire on day 1 (e.g. `'BanditRaid'`) |
| `banditRaidBanDays` | number \| null | Override bandit raid ban period; `null` = use default (2 years) |
| `researchRateMultiplier` | number \| null | Multiplication modifier on Library productivity (e.g. `1.15`) |
| `generalProductivityBonus` | number \| null | Multiplication modifier on settlement `generalProductivity` |
| `legitimacyBonus` | number \| null | Addition modifier on player character `legitimacy` |
| `eventBanUntilDay` | number \| null | Ban all settlement events until this day (grace period) |
| `goodFirstYearHarvest` | boolean | If true (default), forces the first harvest to be a "success" outcome (modifier=1.0, "Good" quality). Prevents a terrible first harvest ruining the start. |

**`_applyScenario(scenario)` steps (in order):**
1. Starting resources — `rs.amount.setNewBaseValue(baseValue + amount)`
2. Building sizes — `building.forceNewSize(targetSize)` + unlock if needed
3. Building upgrades — `building.upgrade(resourceStorages, force=true)` sequentially up to index
4. Pre-research — sets `item.researched = true` and calls `settlement.activateBonus()` for each bonus
5. Pre-arm soldiers — calls `settlement.armSoldiers(unitResource, count)` (weapons must already be in storage from step 1)
6. Player traits — fills all 5 trait groups; uses `playerTraits` names if specified, else first available
7. Bandit raid ban override — sets `banditRaidEvent.bannedUntil`
8. Force events on day 1 — timer subscription at priority 998 fires on tick 1
9. Research rate multiplier — multiplication modifier on Library `productivity`
10. General productivity bonus — multiplication modifier on `generalProductivity`
11. Legitimacy bonus — addition modifier on `playerCharacter.legitimacy`
12. Event ban until day N — sets `event.bannedUntil` on all player settlement events (only if new ban is longer)

**`ScenarioSelectUI`** (React class component):
- Props: `onStart: (scenarioConfig) => void`
- Shows scenario cards (clickable), summary tags, collapsible debug options panel
- Debug options: force events on day 1 checkboxes, skip trait selection, bandit raid ban slider (0–48), starting treasury slider (0–2000)
- `buildFinalConfig()` merges selected scenario with debug overrides before calling `onStart`
- Scenario-locked options shown as disabled/italic with "(scenario)" label

**`App.js` flow:**
- `scenarioChosen` state (boolean) controls whether `ScenarioSelectUI` or `GameUI` is shown
- `handleScenarioStart(scenarioConfig)` creates `new Game(scenarioConfig)` and sets `scenarioChosen = true`
- Game clock is NOT started in `handleScenarioStart` — player uses HUD Play button
- "↩ Scenario Select" button stops game clock and returns to scenario select
- Loading a save file also sets `scenarioChosen = true` (skips scenario select)
- Load save file input is shown on both the scenario select screen and the game screen

### UI Architecture

- `App.js` owns the `Game` instance and save/load logic
- `GameUI` renders a 3-column layout: SidePanel | MainUI+HUD | Logger
- `UIBase` is the base class for all class-based UI components; it subscribes to a list of Variables and calls `setState` on change
- `MainUI` renders either `SettlementComponent` or `CharacterComponent` depending on what is selected
- `SidePanel` lists player character and all settlements as clickable nav items; also has 📜 Research and 📖 How to Play (tutorial) nav items
- `HUD` shows timer, harvest quality, play/pause/next-day buttons, treasury
- `TutorialUI` is a pure React component (no Variable subscriptions) shown when the player clicks 📖 How to Play in the side panel; contains interactive tooltip and trending-variable demos

## Key Concepts

### Game Systems

#### Characters
- Have a `Culture` (Celtic, Roman, Byzantine, Germanic, or Viking), each providing cultural `Trait`s
- Have a `Religion` (CelticPagan, GermanPagan, Christianity, RomanPagan, CelticChristianity, or NorsePagan), each providing religious `Trait`s
- Available religions per culture are defined in `CULTURE_RELIGION_COMPATIBILITY`; changing culture resets religion to the new culture's default if the old religion is no longer compatible
- Have 5 trait groups: childhood, ability, personality, fame, trinket
- Skills: `strategy`, `diplomacy`, `administration` (all `Variable`)
- `administrativeEfficiency` = 0.9 + 0.3 × administration (affects settlement productivity)
- `legitimacy` Variable affects settlement `localLegitimacy` and rebellion risk
- Characters belong to a `Faction` which can have up to 4 privilege levels across 3 privilege types (noble, citizen, clergy)
- Faction privilege changes pause the game clock until confirmed; confirmation applies a temporary legitimacy malus
- NPC characters are assigned a random culture, the default religion for that culture, and a culture-appropriate random name on creation

#### Settlements
- Each settlement has: population, buildings, resources, rationing, market, research, events, terrain
- `populationSizeInternal` is a `Cumulator` that multiplies by `populationSizeChange` each tick
- Population growth/decline driven by health, homelessness, and immigration factor
- `generalProductivity` is a `Variable` modified by health (invLogit curve), happiness (invLogit curve), leader administration, and research/traits
- `happiness` and `health` are `TrendingVariable`s (slow to change)
- `support = happiness + localLegitimacy + diplomacyEffect - 1`; negative support accumulates in `totalRebellionSupport`; when ≥ 1, rebellion fires
- Rebellion replaces the leader with a new NPC copying the old leader's culture and religion, with a culture-appropriate random name; if the player loses all settlements, game over
- **`setLeader()` ordering**: `leader.addSettlement(this)` is called AFTER `rebellionSupport` is created, so cultural/religious trait modifiers targeting `rebellionSupport` are applied to the correct Variable instance

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

### Variable Display Philosophy

**`Variable` and its subclasses (`Cumulator`, `TrendingVariable`) are core to how the player understands the game.** Every `Variable` carries a full tooltip breakdown showing its base value, all modifiers, and their sources. This is the primary mechanism by which the player learns cause and effect.

**Rule: any number shown to the player should be a `VariableComponent` (or subclass) unless there is a specific reason it cannot be.**

- If a value is already a `Variable`, always render it with `VariableComponent` / `CumulatorComponent` / `TrendingVariableComponent`. Never extract `.currentValue` and display it as plain text.
- If a value is derived from Variables but is not itself a Variable, consider wrapping it in a `Variable` with appropriate modifiers so it can be displayed with a tooltip.
- Plain text numbers (e.g. `{someVar.currentValue}`) are only acceptable for ephemeral UI state that has no meaningful breakdown (e.g. a button label showing a count that the player already understands).
- `CumulatorComponent` additionally shows the expected change per tick (`(+N)` / `(-N)`) — always prefer it over `VariableComponent` for `Cumulator` instances.
- **Never wrap a `VariableComponent` in a `CustomTooltip`.** This creates two overlapping tooltips. Instead, pass a `description` prop to `VariableComponent` — it is prepended (in italic) to the Variable's own tooltip.

### UI Style
- Use grey color for supporting text on white backgrounds
- Use alpha channel for supporting text on colored backgrounds
- Use grey for unselected items, black/bold for selected
- Minimize labels and headings where possible
- Group related UI elements into tabs (production, distribution, trading, research)
- `HTMLTooltip` for explanatory hover text (white background, right-aligned text)
- `CustomTooltip` wraps `HTMLTooltip` and accepts `Variable` instances, strings, or `{text, style}` objects
- **If a number can be displayed as a `Variable` (i.e. it is or can be wrapped in a `Variable` instance), it almost always should be.** This gives the player tooltip breakdowns for free. Examples: melee strength on the skirmish screen, bow strength, strategy skill, ground advantage — all should be `VariableComponent`, not plain text.
- **Never wrap a `VariableComponent` in a `CustomTooltip`.** This creates two overlapping tooltips. Instead, pass a `description` prop to `VariableComponent` — it is prepended (in italic) to the Variable's own tooltip. Use `CustomTooltip` only for things that are NOT already `VariableComponent`s.
- **Inline Variables in text**: when a log entry or message contains numbers that should be hoverable, use the `{ text: string, vars: { [key]: Variable } }` pattern. Put `{key}` tokens in the text string; the renderer replaces them with inline `VariableComponent`s. See `BattleUI.renderLogEntry(entry)` for the reference implementation.
- **Draggable modals**: add a `data-drag-handle` attribute to the title bar element. In the component, track `_dragState` and `_modalPos = { x, y }` (pixel offset from center). On `mousedown` on the drag handle, attach `mousemove`/`mouseup` to `window`. Store position and call `forceUpdate()`. Pass `top: calc(50% + ${pos.y}px), left: calc(50% + ${pos.x}px)` to the `Box` sx prop. Add `resize: both; overflow: auto` for resizability. See `EventComponent` and `BattleUI` for the reference implementation.

### Theme System (`theme.js`)
- Four themes selectable live during playtesting: **Parchment**, **Parchment Dark**, **Iron**, **Iron Slate**
- Theme is stored in `localStorage` under the key `'darkAgesTheme'` and persists across reloads
- `ThemeContext` (React Context) provides the current theme object to all components without prop drilling
- Class components access the theme via `static contextType = ThemeContext` (or `ComponentName.contextType = ThemeContext` after the class), then read `this.context` in `childRender()` / `render()`
- `App.js` owns the theme state, wraps the game in `<ThemeContext.Provider value={theme}>`, and renders theme-switcher buttons in the bottom toolbar
- Each theme object has: `id`, `label`, `description`, and a `colors` object with ~25 named tokens:
  - `pageBg`, `contentBg`, `contentBgAlt`, `contentBgHover` — background layers
  - `textPrimary`, `textMuted`, `textAccent` — text colours
  - `accent` — highlight/active colour (used for active HUD buttons, selected nav items)
  - `borderLight`, `borderMid`, `borderStrong` — border intensity levels
  - `hudBg`, `hudBorder` — HUD / toolbar backgrounds
  - `sidePanelBg`, `sidePanelBorder` — side panel backgrounds
  - `btnBorder`, `btnText`, `btnHoverBg` — button styling tokens
  - `warningBg`, `warningBorder`, `warningText` — warning banner colours
  - `modalBg`, `modalBorder` — modal overlay colours
- Exports: `THEME_LIST` (array), `getTheme(id)`, `ThemeContext`, `useTheme()` hook

### Code Style
- Keep Variable/Modifier pattern for all numeric game state
- Always pass an `explanation` string to `setNewBaseValue()` — it throws if missing
- Use `HTMLTooltip` / `CustomTooltip` for explanatory hover text
- Maintain separation between game logic (no React imports) and UI components
- `UIUtils.js` is the barrel re-export for the variable system — import from there in settlement/game code
- `config.js` holds global UI constants (currently just `buttonVariant: "outlined"`)

## Current Development Focus
- Playtesting and balance tuning (all MVP features implemented)
- All settlement events are now active (previously commented out)
- Military system, battle system, and diplomacy are implemented
- Warning banner, game over, NPC AI all in place

## Developer Notes & Planned Work

> The following sections are derived from `handwritten_notes.md`. The problems identified are likely real, but the proposed solutions may be imperfect. Do not implement anything here without confirming with the developer first — these are intentions, not specifications.

### Immediate / Short-Term Tasks

- **Move to character screen on first day**: ✅ **Implemented**. `Character` constructor calls `gameClock.forceStopTimer(reason)` when `isPlayer=true`. `checkTraitsComplete()` is called after every `addTrait`/`removeTrait`; releases the stop once all 5 trait groups are filled, re-applies if a trait is removed leaving a group empty.
- **Nomad events for population growth**: Add events where nomads arrive and can be taken in to boost immigration. (See Events section below for detail.)
- **Permanent game message log**: ✅ **Implemented**. `game.messageLog` is a permanent array of `{text, day}` entries. All messages go through `game.addGameMessage()`. A collapsible `MessageLogPanel` is shown below the 3-column layout in `GameUI`, toggled by a button.
- **Auto-sell excess goods to market**: ✅ **Implemented**. `Cumulator.excessAmount` tracks overflow each tick. `Settlement.autoSellExcessGoods()` runs each tick and sells excess at market sell price for resources where `desiredSellProp > 0`. Income credited via `game.addToTreasury()`.
- **UIBase subscription bug**: ✅ **Fixed**. `UIBase` now supports a `addVariableGetters([{key, get}])` dynamic subscription mechanism. Getters are re-evaluated on every `componentDidUpdate`; if any variable identity changes, subscriptions are re-wired. `CharacterComponent` updated to use this pattern.

### Optimisation Notes

- **Round happiness, health, building productivity to 3dp**: ✅ **Implemented for building productivity**. `TrendingVariable` already rounds via `trendingRoundTo`. A `roundTo(3dp)` modifier at priority 200 is now added to every `ResourceBuilding.productivity` Variable in the `ResourceBuilding` constructor.
- **Bankruptcy state change is slow**: When `bankrupt` flips between 0 and 1, it triggers a cascade through all market `buyProp` Variables. Developer suggests examining via logging to find the bottleneck. Rounding to dp may help.

### UI Improvement Ideas

> These are design suggestions — do not implement without confirmation.

- **Tabulate the settlement view**: ✅ **Implemented**. `SettlementComponent` now renders three MUI tabs: Production (stats + buildings), Distribution (rationing + resources), Trading (market). Research moved to top-level faction panel.
- **Move research into its own tab**: ✅ **Implemented**. Research is now a top-level `FactionResearchComponent` shown in the main panel when the "Research" button is clicked. Uses a shared faction research tree; bonuses propagate to all member settlements; cost drained proportionally from all settlements' research storage.
- Add Paradox-style warnings for homelessness, unemployment, rebellions, etc.
- **Browser-style back/forward navigation**: ✅ **Implemented**. `GameUI` maintains `_navHistory` array and `_navIndex`. `setSelected()` pushes to history (truncating forward). ← → buttons rendered above `MainUI`; disabled at history boundaries.
- **Hide research and market UI behind buildings**: ✅ **Implemented**. Trading tab shows "Build Roads to unlock trading" when Roads size = 0. Research is now faction-level (not per-settlement). Library gating not needed since research is no longer in the settlement view.
- **Add descriptions/tooltips to character and settlement variables**: ✅ **Implemented**. `CharacterComponent` wraps all skill/attribute `VariableComponent`s in `CustomTooltip` with descriptions. `SettlementComponent` Production tab wraps all stat variables in `CustomTooltip` with descriptions.
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
- Byzantine, Germanic, and Viking cultures are now implemented (see `character.js`)
- Religion system is now implemented: 6 religions with culture compatibility matrix
- More cultural/religious traits and balance tweaks (developer has notes on phone)

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
*(all moderate bugs fixed — see below)*

### Minor
*(all minor bugs fixed — see below)*

### Fixed (this session) — playtest fixes round 1

- **`settlement.js` rationing index bug**: `rationsDemanded.filter(...).map((ration, i) => ...)` — after filtering, index `i` no longer matched the original `rationsAchieved[i]`, `idealRations[i]`, `rationResources[i]` arrays. This caused the Apothecary (medicinalHerbs) to display as "beer" in the rationing UI. Fixed by replacing `.filter().map()` with `.map()` + conditional return to preserve original indices.
- **`settlement.js` active events line breaks**: Active event names in the settlement header were wrapped in block-level `<span>` elements, causing a large gap between each event. Fixed by wrapping all event spans in a `display: flex; flexWrap: wrap; gap: 8px` div.
- **`settlement.js` + `building.js` resource change rate in building UI**: `SettlementComponent` now finds the `ResourceStorage` for each `ResourceBuilding`'s output resource and passes it as `outputStorage` prop to `BuildingComponent`. `BuildingComponent.childRender()` reads `outputStorage.amount.expectedChange` (from the Cumulator) and displays it inline after the jobs count — green for positive, red for negative (e.g. `+2.4/tick`).
- **`events.js` + `game.js` harvest pop-up**: `HarvestEvent` now accepts an `addGameMessage` callback prop. In `getBonuses()`, after rolling the harvest, it calls `addGameMessage` with a formatted message showing quality and farm productivity modifier (e.g. `🌾 Harvest: Good (+5%)`). `game.js` passes `this.addGameMessage.bind(this)` to the `HarvestEvent` constructor.
- **`App.js` remove save/load buttons**: Removed the "Save Game" button and file input from the bottom toolbar. Kept the "↩ Scenario Select" button and theme switcher. Save/load is not properly implemented.
- **`events.js` `NomadsArrive` group size freeze**: `getEventChoices()` was calling `Math.round(5 + Math.random() * 10)` on every call (every render), causing the displayed group size to vary while the modal was open. Fixed by adding a `fire_()` override that rolls and freezes `nomadGroupSize` once at fire time. Group size is capped at 10% of current population (minimum 3). `fire_()` also resets choice state (`deactivateBonusesAndEventEffects()`, `choiceApplied`, `appliedChoice`, `lastBonuses`).
- **`resource.js` starting labour time**: `labourTime.startingAmount` reduced from 1000 to 500 across all scenarios.
- **`character.js` `CharacterComponent` styling**: Rewrote `childRender()` with styled sections separated by horizontal dividers and uppercase section labels (matching the village stats style). Sections: Identity, Cultural Traits, Personal Traits, Skills, Attributes, Faction. Cultural traits displayed as pill badges in a flex row.

### Fixed (this session) — battle system round 3

- **`events.js` `BattleArmy` casualty fraction redesign**: the previous design called `setModifiers([])` in `finalise()` to wipe unit modifiers and bake a single base value — this meant the tooltip showed only "finalise: bake starting bow strength" with no unit breakdown. Redesigned: unit `addition` modifiers are kept permanently. A `bowCasualtyFraction` / `meleeCasualtyFraction` Variable (starts at 1.0) is added as a `multiplication` modifier. Because `addition` has priority 1 and `multiplication` has priority 3, units are summed first then scaled by the fraction. Casualties call `setNewBaseValue` on the fraction Variable only. The tooltip now shows the full unit breakdown (e.g. "3 short bows ×1.2: 3.6", "2 war bows ×2.5: 5.0") × surviving fraction — exactly like every other Variable in the game.
- **`events.js` `BattleArmy.strategySkill`**: player army now uses `settlement.leader.strategy` directly (the same Variable shown on the character page), so hovering shows the full trait/culture breakdown. Enemy army uses a plain Variable.
- **`events.js` structured log entries**: `state.log` entries changed from plain strings to `{ text: string, vars: { [key]: Variable } }` objects. `{key}` tokens in `text` are replaced by inline `VariableComponent`s in `BattleUI.renderLogEntry(entry)`. Per-round Variables are created for: effective bow strengths (`playerEffBowVar`, `enemyEffBowVar`), bow casualties (`playerBowDeadVar`, `enemyBowDeadVar`), total attack values (`playerAttackVar`, `enemyAttackVar`), melee casualties (`playerMeleeDeadVar`, `enemyMeleeDeadVar`). Each Variable has a `setNewBaseValue` explanation showing the calculation (e.g. "bow strength × (1 + GA)", "enemy attack ÷ cost-per-casualty").
- **`events.js` `BattleUI` end-of-battle phase**: when `state.ended`, the battle modal stays open showing the final state and log. A "Close battle report" button calls `event._endEventCallback()` (which unforces the timer stop) and sets `event._battleState = null`. `EventComponent` now shows `BattleUI` whenever `event._battleState` is non-null (including after `ended`).
- **`events.js` `BattleUI` draggable + resizable**: title bar has `data-drag-handle` attribute; `onMouseDown` on the `Box` starts drag tracking. Position stored as `this._modalPos = { x, y }` pixel offset from center. `Box` uses `resize: both` CSS for resizable corners.
- **`events.js` `EventComponent` modal draggable + resizable**: same drag-handle pattern applied to all event modals. Position reset to `null` on re-open.

### Fixed (this session) — battle system round 2

- **`events.js` battle casualty math redesign**: the old system computed `casualtyRate = enemyAttack / totalAttack` then multiplied by `armyCount`, meaning a larger army always lost more soldiers in absolute terms even when winning. Replaced with a **cost-per-casualty** model: `dead = attackStrength / costPerCasualty` (bow: 3.0, melee: 4.0). Now the stronger side always kills more fighters per round in absolute terms, regardless of army sizes. Dead counts are capped at remaining unit count.
- **`events.js` enemy flee threshold**: changed from `< 0.20` to `<= 0.25` of starting strength. Enemy now flees when at 25% or less of original forces.
- **`events.js` `BattleUI` tooltip layering fix**: removed all `CustomTooltip` wrappers around `VariableComponent`s in `renderArmy` and the ground advantage header. Instead, the `description` prop is passed directly to each `VariableComponent` — this prepends the description to the Variable's own tooltip, so the player sees the full breakdown (unit contributions, casualty history) without a double-tooltip layer. Affected: bow strength, melee strength, total strength, strategy skill, ground advantage.
- **`events.js` `BattleUI` manoeuvre button tooltip**: replaced `playerArmy.strategySkill.currentValue.toFixed(2)` plain text with a `VariableComponent` so the player can hover the strategy value inside the tooltip for a full breakdown.
- **`events.js` `resolveSkirmishRound` log enrichment**: log line now shows effective bow strengths after ground advantage (e.g. `your bow 7.2 vs enemy 0.0`) so the player can see why casualties are what they are.
- **`events.js` `resolveMeleeRound` log enrichment**: log line now shows full attack breakdown — `Attack: yours 19.5 (melee 19.5 + bows 0.0) vs enemy 7.4 (melee 7.4 + bows 0.0)` — plus ground advantage percentage when non-zero. Player can now understand exactly why they lost N soldiers.

### Fixed (this session) — battle system, Variable UI, tooltip depth

- **`events.js` battle bug — enemy with 0 fighters still dealing damage**: `BattleArmy` strength Variables had addition modifiers added during build (one per unit type). When `setNewBaseValue(currentValue * scale)` was called to apply casualties, the modifiers still added back the original values, so `currentValue` never reached 0. Fixed by redesigning `BattleArmy.finalise()`: after all units are added, `finalise()` records `startingBowStrength` / `startingMeleeStrength`, then calls `setModifiers([])` to remove all build-time modifiers and bakes the total into `baseValue`. Subsequent `applyBowCasualties(dead)` / `applyMeleeCasualties(dead)` calls use `setNewBaseValue(startingStrength * survivingFraction)` — with no modifiers present, this correctly scales to 0 when all fighters are dead.
- **`events.js` `BattleArmy` constructor cleanup**: removed dead intermediate code (a first `bowStrength` with multiplication modifiers that was immediately overwritten by a second plain one).
- **`events.js` `BattleUI` — Variable UI on skirmish screen**: replaced all plain `Typography` text for bow strength, melee strength, total strength, strategy skill, and ground advantage with `VariableComponent` wrapped in `CustomTooltip`. Players now see full tooltip breakdowns (unit contributions, casualty history) for all numeric battle values.
- **`events.js` `BattleUI` — strategy roll info panel**: after each skirmish round or manoeuvre, a "Last strategy roll" panel shows the player's and enemy's roll result (colour-coded by outcome) and the success chance used. Manoeuvre rolls show "Last manoeuvre roll" with only the player's roll (no enemy roll for manoeuvres).
- **`events.js` `BattleUI` — action button tooltips**: "Continue skirmishing", "Move in (melee)", "Hold the line", and "Attempt a manoeuvre" buttons now have `HTMLTooltip` explanations showing what each action does and the relevant strategy chances.
- **`events.js` `advanceBattle` manoeuvre**: stores roll info in `state.lastSkirmishRoll` with `isManoeuvre: true` flag so the UI can display it correctly.
- **`events.js` `resolveSkirmishRound`**: stores `lastSkirmishRoll` on state with `{ playerStratRoll, enemyStratRoll, playerStratChance, enemyStratChance, groundDelta }` for UI display.
- **`events.js` `resolveMeleeRound`**: stores `lastMeleeRound` on state with attack breakdown for potential future UI use.
- **`utils.js` `HTMLTooltip` — depth-aware tooltip placement**: converted from a `styled` component to a function component that reads `TooltipDepthContext`. Depth 0 (top-level) is identical to the original — no explicit placement (MUI defaults to bottom), flip/preventOverflow disabled. Depth ≥ 1 (nested, e.g. a `VariableComponent` inside a `CustomTooltip` title) opens rightward (`placement="right-start"`) with **all repositioning disabled** (flip off, preventOverflow off, adaptive off) — clips at the viewport edge rather than stuttering. Any enabled repositioning modifier causes a recalculate loop near the viewport edge. `TooltipDepthContext` is exported from `utils.js`. The tooltip `title` content is automatically wrapped in `TooltipDepthContext.Provider value={depth+1}` so nested tooltips know their depth.

### Fixed (this session) — scenario bugs & log level improvements

- **`scenarios.js` banditRaid `startingResources`**: keys `stoneWeaponry` and `ironWeaponry` were camelCase but resource names are `"stone weaponry"` / `"iron weaponry"` (with spaces). Fixed to use quoted string keys. This also fixes the downstream `armSoldiers` failures for "stone swords" and "iron spears" (which failed because no weapons had been added).
- **`game.js` `_applyScenario` auto-assign workers**: added `playerSettlement.adjustJobs()` call at the end of `_applyScenario` (step 13) so scenarios start with workers assigned. Prevents the player seeing a large "unemployed" count on load when the scenario has pre-built buildings.
- **`logger.js` `GAME_MSG` level**: added `GAME_MSG = 4` as a new log level above ERROR. `addGameMessage()` now logs at this level. Setting `inGameLogLevel = GAME_MSG` in the `LoggerComponent` shows only player-facing game messages in the message log panel. `LOG_LEVEL_NAMES` updated to include `'GAME'` as the display name for level 4.
- **`logger.js` download button**: replaced static `<a href>` (stale blob URL) with a `<button onClick>` that generates a fresh blob URL and triggers download programmatically at click time.
- **`gameUI.js` `MessageLogPanel`**: now receives `logger` prop and reads from `logger.inGameLog` (subscribes in `componentDidMount`). Log level selector in `LoggerComponent` now directly controls what appears in the player-facing message log. Entry format: `{ ts, level, levelName, message, context }`. Day shown from `entry.context?.day`. Entries colour-coded by level.
- **`settlement.js` "logging is off"**: removed the "logging is off" text — the calculation log link now only renders when `Variable.logging === true`.

### Fixed (this session) — logging, bug fixes & UI polish

- **`settlement.js` events div**: `renderHeader()` now only renders the events section when `activeEvents.length > 0`. Removed the unconditional `<br />` that caused empty space when no events were active. Added an "Active Events" group label with the same style as "Population" / "Jobs & Homes" labels in the production tab (10px, bold, uppercase, `textMuted` color).
- **`trendingVariable.js` depth guard in `trend()`**: `trend()` was calling `callSubscribers` directly without going through the `currentDepth < 2` guard. Fixed by adding the guard check before `callSubscribers(indent+1)` in `trend()`.
- **`bonus.js` `TemporaryModifierBonus.deactivate()`**: was a no-op — if an event ended before the timer fired, the modifier persisted. Fixed by adding `_activeSettlement` and `_modifierRemoved` tracking fields in `activate()`, a `_removeModifier(settlement)` helper with a double-removal guard, and making `deactivate(settlement)` call `_removeModifier`. The timer callback also now calls `_removeModifier` instead of directly removing.
- **Logging system** (`logger.js`): complete rewrite. `LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }`. `Logger` class now has `fileLog` (all entries, never trimmed) and `inGameLog` (filtered by `inGameLogLevel`, default INFO). Static convenience methods: `Logger.debug()`, `Logger.info()`, `Logger.warn()`, `Logger.error()`. `setInGameLogLevel(level)` rebuilds `inGameLog` from `fileLog`. `getFileLogBlobUrl()` downloads full log as text file. `LoggerComponent` updated with log level selector buttons and download link. Legacy API (`addLine`, `setInspect`, etc.) preserved.
- **Log calls added** (42 total across `game.js`, `events.js`, `settlement.js`, `character.js`, `save_load.js`): game construction, treasury bankruptcy/recovery, NPC research, scenario application, day-2 cleanup, treasury additions, global event firing, rebellion, game over, event fire/end/choice, harvest/blight/pestilence/nomads/bandit events, auto-sell, arm/disarm soldiers, privilege confirmation, research activation, trait add/remove, save/load success/failure.

### Fixed (this session) — UI polish round 3

- **`gameUI.js` sticky header block**: `WarningBanner` and back/forward nav buttons moved inside the `position: sticky; top: 0` block alongside the HUD. All three now stick together at the top when scrolling. No `marginBottom` on the sticky block (prevents see-through gap). A `React.createRef()` (`_stickyHeaderRef`) is attached to the sticky div; its `offsetHeight` is measured on each render and passed as `stickyHeaderHeight` prop to `MainUI` → `SettlementComponent`.
- **`settlement.js` sticky settlement header offset**: uses `this.props.stickyHeaderHeight || 165` as the `top` value — dynamically measured from the actual DOM so it always clears the sticky block exactly, regardless of warning banner presence or font size changes.
- **`mainUI.js`**: passes `stickyHeaderHeight` prop through from `GameUI` to `SettlementComponent`.
- **`gameUI.js` message log max height**: `MessageLogPanel` panel `maxHeight` reduced from `200px` to `120px` (~4 rows before scrolling).
- **`utils.js` nested tooltip flashing**: `HTMLTooltip` now passes `PopperProps={{ disablePortal: true }}` to MUI `Tooltip`. This prevents inner `VariableComponent` tooltips (rendered inside an outer tooltip's `title`) from briefly flashing to `(0,0)` before Popper measures the anchor position. `disablePortal` renders the Popper inline rather than teleporting to `document.body`, so positioning is correct on first render.
- **`game.js` day-1 snap**: Added explicit `s.happiness.recalculate()` and `s.health.recalculate()` calls before `forceResetTrend()` in the day-1 setup block. This ensures all modifier chains have propagated before the snap, so the displayed values are correct from the moment the game loads (not just after the player makes a change).

### Fixed (this session) — UI polish round 2

- **`trendingVariable.js` `TrendingVariableComponent`**: now shows `↑`/`↓` arrows (green/red) when trending up/down, and `→` when stable. Target value shown as `(↑0.62)` style suffix at 0.85em opacity 0.7. Bold removed from stats bar (`renderStatsBar` in `settlement.js`); font size increased to `1.05em`.
- **`App.js` bottom toolbar**: now `position: fixed; bottom: 0; zIndex: 200` — always visible at the bottom of the viewport regardless of scroll position.
- **`gameUI.js` message log**: `MessageLogPanel` moved outside the main scroll container and rendered as `position: fixed; bottom: 40px; zIndex: 190` (sits above the App.js toolbar). Shown by default (`showMessageLog` defaults to `true` when state is undefined). Main scroll column has `paddingBottom` to avoid content being hidden behind the fixed bars.
- **`events.js` `EventComponent`**: auto-opens the event modal when an event fires and hasn't been read yet. Tracks `_lastAutoOpenedTrigger` (the `lastTriggered` timestamp) to avoid re-opening on every render. Uses `setTimeout(..., 0)` to avoid setState-during-render. Only fires for events rendered in the settlement header (player settlements only).
- **`settlement.js` event names**: active event names in the settlement header are now wrapped in a `1.05em bold` span for better visibility.

### Fixed (this session) — UI polish & balance

- **`hud.js` harvest text size**: increased from 14px to 18px (opacity 0.9) so the harvest quality is more prominent
- **`gameUI.js` sticky HUD**: main content column (`xs=8`) now has `height: 100vh; overflow-y: auto` creating its own scroll container. The HUD wrapper has `position: sticky; top: 0; zIndex: 100` so it always stays visible at the top when scrolling
- **`settlement.js` sticky settlement header**: in `SettlementComponent.childRender()`, the header + stats bar + tabs row are wrapped in a `position: sticky; top: 130; zIndex: 90` block, sticking just below the HUD when scrolling through a settlement's content. `renderStatsBar()` is now called once in `childRender()` rather than at the top of each tab render method
- **`building.js` building icons**: `BUILDING_ICONS` map in `BuildingComponent.childRender()` now covers all buildings including upgrade display names (`'Wooden Huts'`, `'Brick Houses'`, `'Dirt Paths'`, `'Gravel Paths'`, `'Brick Roads'`, `'Military Blacksmith (Iron)'`, `'Military Blacksmith (Steel)'`, `'Blacksmith (Iron)'`, `'Blacksmith (Steel)'`). Keys match `titleCase(displayName)` exactly
- **`settlement.js` rebellion support floor**: `rebellionSupport` Variable now has `min: new Variable({startingValue: 0})` so it never goes negative. This is a cosmetic/clarity change — `totalRebellionSupport` already has `min=0` so game behaviour is unchanged
- **`scenarios.js` bandit raid iron weaponry**: `ironWeaponry` starting resource increased from 20 to 25
- **`settlement.js` military tab capitalisation**: weapon stockpile names and unit names now title-cased via `.replace(/\b\w/g, c => c.toUpperCase())`. Unit group labels changed to title case ("Stone Weapon Soldiers", "Iron Weapon Soldiers", etc.)

### Fixed (this session) — MVP implementation
- **`events.js` all settlement events uncommented + 8 new events added**: WarmSpell, MerchantBoom, HuntingGameSurplus, DryHuntingLands, Blizzard, RatsInStorage, NomadsArrive, BanditRaid. WarmSpell/Blizzard use `fire_()`/`end_()` overrides to directly manipulate `popDemands.coal.idealAmount` and `tradeFactor`.
- **`game.js` game over**: `isGameOver = true` + `gameClock.forceStopTimer("game over")` in `handleRebellion`. `warningsShown = new Set()` for first-time warning tracking.
- **`game.js` NPC AI**: happiness floor 0.35, health floor 0.6, productivity buffer ×1.15 (priority 198), productivity floor 0.8 (priority 199). NPC auto-research subscription fires yearly.
- **`gameUI.js` warning banner**: `WarningBanner` component checks all player settlements. Warnings: homeless (orange), unemployed (yellow), rebellion >30% (red), food shortage (red), bankrupt (red). Game Over modal overlay.
- **`events.js` Pestilence severity**: severity 1–3 roll scales health damage and duration. `bonusFlavourText` set per severity.
- **`resource.js` military units**: 10 unit resources (stoneSpears through longbowmen). `UNIT_ATTACK_VALUES`, `UNIT_WEAPON_COSTS`, `MELEE_UNIT_NAMES`, `BOW_UNIT_NAMES` exported. `ironWeaponry.startingAmount = 5`.
- **`settlement.js` armyStrength**: `this.armyStrength` Variable with strategy invLogit modifier. `armSoldiers()` and `disarmSoldiers()` methods. `_unitModifiers` dict tracks modifier references for disarming.
- **`settlement.js` Military tab**: 4th tab in `SettlementComponent`. Shows army strength, weapon stockpiles, unit conversion (+1/+5/-1 buttons).
- **`events.js` battle system**: `BattleArmy`, `buildPlayerArmy()`, `buildBanditArmy()`, `resolveSkirmishRound()`, `resolveMeleeRound()`, `applyBattleAftermath()`. `BattleUI` React component. `BanditRaid` event with full multi-stage battle.
- **`diplomacy.js` (new file)**: `TradeAgreement` class + `npcWillAcceptTrade()`. Kept separate from `game.js` to avoid circular imports with `settlement.js`.
- **`game.js` tradeAgreements**: `this.tradeAgreements = []` array (max 2 active). Re-exports `TradeAgreement`/`npcWillAcceptTrade` from `diplomacy.js`.
- **`settlement.js` diplomacy UI**: `renderDiplomacySection()` shown in NPC settlement Production tab. Trade proposal modal with resource/amount selectors and NPC acceptance preview.
- **`settlement.js` rebellion visualAlerts**: threshold changed from `> 0` to `> 0.3`, shows percentage.
- **`hud.js` treasury countdown**: "Bankrupt in ~N days" shown when `expectedChange < 0 && baseValue > 0`. Color-coded by urgency.
- **`mainUI.js`**: passes `game` prop to `SettlementComponent` for diplomacy UI access.

### Fixed (previous session)
- **`character.js` faction research system**: `Faction` now has a `researchTree` (one `createResearchTree()` call per faction). `getTotalResearch()` sums research storage across all member settlements. `canResearch(research)` checks sequential unlock and pooled cost. `activateResearch(research)` drains cost proportionally from all settlements, marks faction item researched, and applies bonuses to all member settlements' internal trees by name lookup.
- **`character.js` `FactionResearchComponent`**: New `UIBase` component subscribing to `internalTimer`. Renders pooled research total and all research categories with sequential unlock. Used in the top-level Research panel in `GameUI`.
- **`gameUI.js` top-level Research panel**: "Research" button in nav bar toggles `showResearch` state. When active, renders `FactionResearchComponent` instead of `MainUI`. Back/forward buttons disabled while Research panel is open. Clicking any item in `SidePanel` closes the Research panel.
- **`settlement.js` Trading tab gated behind Roads**: `renderTradingTab()` checks `getBuildingByName(Roads.name).size.currentValue > 0`; shows "Build Roads to unlock trading" otherwise.
- **`settlement.js` Research tab removed**: Settlement view now has 3 tabs (Production, Distribution, Trading). Research is faction-level only.
- **`settlement.js` + `character.js` variable tooltips**: All key stat variables in `SettlementComponent` Production tab and all skill/attribute variables in `CharacterComponent` wrapped in `CustomTooltip` with plain-English descriptions.
- **`character.js` first-day timer force-stop**: `Character` constructor calls `gameClock.forceStopTimer(reason)` when `isPlayer=true`. New `checkTraitsComplete()` method releases the stop once all 5 trait groups are filled; re-applies if a trait is removed. Called from `addTrait()` and `removeTrait()`.
- **`gameUI.js` back/forward navigation**: `GameUI` now maintains `_navHistory` (array) and `_navIndex` (integer). `setSelected()` pushes to history and truncates forward entries. `navBack()` / `navForward()` move the index. Two ← → `Button` components rendered above `MainUI`; disabled at history boundaries.
- **`settlement.js` tabbed settlement view**: `SettlementComponent` refactored into four MUI `Tabs`: Production (stats + buildings), Distribution (rationing + resources), Trading (market), Research. Header (name, leader, terrain, active events) always visible. NPC settlement tabs 1–3 show a placeholder. `Tab`/`Tabs` imported from `@mui/material`.
- **`building.js` productivity rounding**: `ResourceBuilding.productivity` now has a `roundTo(3dp)` modifier at priority 200, reducing subscriber cascade frequency when productivity changes by tiny amounts.
- **`UIBase.js` prop-change subscription bug**: Added `addVariableGetters([{key, get}])` dynamic subscription mechanism. `CharacterComponent` updated to use it so subscriptions re-wire when `props.character` changes.
- **`cumulator.js` excess tracking**: `Cumulator.aggregate()` now computes `excessAmount` — the amount of production that overflowed storage this tick. Used by `Settlement.autoSellExcessGoods()`.
- **`settlement.js` auto-sell excess goods**: `Settlement.autoSellExcessGoods()` runs each tick. For resources where `desiredSellProp > 0`, excess production (from `Cumulator.excessAmount`) is sold at market sell price and credited to treasury via `addToTreasury` callback.
- **`game.js` message log**: Added `game.messageLog` (permanent array of `{text, day}` entries) and `game.addGameMessage(message)` helper. All game messages now go through this method.
- **`game.js` addToTreasury**: Added `game.addToTreasury(amount, reason)` method for crediting one-off income directly to treasury base value.
- **`gameUI.js` MessageLogPanel**: Added `MessageLogPanel` component below the 3-column layout. Shows full message history (newest first) in a scrollable panel, toggled by a button.
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
- `Character.changeCulture()` swaps cultural traits correctly; resets religion to new culture's default if old religion is incompatible
- `Character.changeReligion()` swaps religious traits correctly
- `Faction.changePrivilegeTentatively()` pauses game clock
- `Faction.confirmPrivilegeChanges()` applies legitimacy malus and unpauses
- `Faction.getNumPrivileges()` returns correct total

### Save/Load
- `saveGame()` / `loadGame()` round-trip preserves `baseValue` and `currentValue`
- Circular references are correctly serialized and restored
- `init()` is called on objects with `hasInit: true`
- Unknown class types in `CLASS_MAP` fall back gracefully
- Loading a save file restores game clock state correctly
