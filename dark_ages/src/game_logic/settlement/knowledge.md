# Settlement System

Settlement management, resource production, buildings, market, research, and terrain. All files in `src/game_logic/settlement/`.

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
| `settlement.js` | `Settlement` class + `SettlementComponent` (tabbed UI) |
| `building.js` | `Building`, `ResourceBuilding`, all concrete building classes |
| `resource.js` | `Resource`, `ResourceStorage`, `Resources` constants |
| `bonus.js` | `Bonus` hierarchy: settlement bonuses, character bonuses, temporary bonuses |
| `market.js` | `Market` class + `MarketResourceComponent` |
| `rationing.js` | `getBasePopDemands()`, `applyRationingModifiers()`, `RationingComponent` |
| `research.js` | `Research`, `ResearchComponent`, `createResearchTree()` |
| `terrain.js` | `Terrain` subclasses + `TerrainComponent` |
| `default_buildings.js` | Dummy building instances for price calculation |
| `faction.js` | *(empty / unused — Faction is in `character.js`)* |

---

## `settlement.js` — Settlement Class

### Construction Order (important for understanding dependencies)

1. **Population variables**: `populationSizeDecline`, `populationSizeGrowth`, `immigrationFactor`, `populationSizeChange`, `populationSizeInternal` (Cumulator), `populationSizeExternal` (castInt of internal)
2. **Buildings**: Storage first (to get `storageSize`), then all resource buildings and other buildings
3. **Resource storages**: one `ResourceStorage` per `Resources` entry
4. **Job aggregators**: `totalJobs` and `jobsTaken` as `SumAggModifier` over `resourceBuildings`
5. **`generalProductivity`**: starts at 1; health/happiness/leader effects added later
6. **`happiness`** and **`health`**: `TrendingVariable`s; health affects growth/decline
7. **`unhealth`** = 1 - health (clamped 0..1)
8. **Population modifiers**: health and homelessness effects on growth/decline
9. **`generalProductivity` modifiers**: health invLogit curve, happiness invLogit curve
10. **`tradeFactor`**: starts at 0; boosted by roads via rationing modifiers
11. **Research tree** and **pop demands** (`getBasePopDemands()`)
12. **Rationing loop**: for each pop demand, creates ration Variables and calls `applyRationingModifiers()`
13. **Housing tracking**: `totalHousedInternal`, `homelessInternal`, `homelessness`
14. **Job auto-assignment subscriptions**
15. **Terrain activation**
16. **`forceResetTrend()`** called twice each for health and happiness
17. **Ideal prices** and **Market** construction
18. **Settlement events** (currently only `CourtIntrigue`)
19. **Leader assignment** via `setLeader()`
20. **Coal demand adjustment** subscription
21. **Auto-sell excess goods** subscription (calls `autoSellExcessGoods()` each tick)

### Constructor Props

- `addToTreasury`: optional callback `(amount, reason) => void`. If provided, `autoSellExcessGoods()` will call it when excess goods are sold. Pass `game.addToTreasury.bind(game)` for player settlements; omit for NPC settlements.

### Population System

```
populationSizeChange = immigrationFactor * (1 + growth) - decline
populationSizeInternal[t+1] = populationSizeInternal[t] * populationSizeChange
populationSizeExternal = castInt(populationSizeInternal)
```

- `populationSizeGrowth` base: 0.00035/tick; modified by health (scaledMultiplication, exponent 1.5 and 0.3)
- `populationSizeDecline` base: 0.00005/tick; modified by unhealth (two scaledAddition terms: "poor health" offset 0.267, "catastrophic health" offset 0.4) and homelessness
- `immigrationFactor` base: 1.0 (currently unmodified — immigration not yet implemented)
- `populationSizeInternal` is a `Cumulator` with `roundTo 4` modifier — population is tracked to 4 decimal places internally

### Happiness & Health

Both are `TrendingVariable`s:
- `happiness`: trendingRoundTo=3, trendingUpSpeed=0.1, trendingDownSpeed=0.2, smallestTrend=0.009, min=0
- `health`: trendingRoundTo=3, trendingUpSpeed=0.05, trendingDownSpeed=0.15, smallestTrend=0.009

Happiness modifiers (added via `applyRationingModifiers`):
- Food, coal, beer, wooden huts, brick houses, religion, entertainment, dirt/gravel/brick roads → additive happiness bonuses
- Homelessness → scaledAddition (scale=-0.75)
- Health penalty → multiplicative invLogit curve

Health modifiers:
- Food, coal, medicinal herbs → additive health bonuses
- Beer → negative additive health bonus
- Homelessness → scaledMultiplication (scale=-0.35, exponent=1.5)

`generalProductivity` modifiers from happiness/health:
- Health: invLogit curve, speed=3.5, max penalty=65% (bias=0.35, scale=0.65)
- Happiness: invLogit curve, speed=4, max penalty=25% (bias=0.75, scale=0.25)

### Rebellion System

```
support = happiness + localLegitimacy + diplomacyEffect - 1
rebellionSupport = -support  (i.e. positive when support < 0)
totalRebellionSupport (Cumulator, min=0) += rebellionSupport each tick
```

When `totalRebellionSupport.valueAtTurnStart >= 1`, `rebel()` fires:
- Creates a new `Character` with the same culture as the old leader
- Calls `setLeader(newLeader)` — replaces leader and re-creates support/rebellion Variables
- If old leader was the player, calls `handleRebellion(this)`

`localLegitimacy` = leader's `legitimacy` Variable (additive). Leader's `diplomacy` adds a scaled bonus to `support` (scale=0.1).

### Job Assignment (`adjustJobs()`)

Called when `populationSizeExternal` or `totalJobs` changes (if `autoManageUnemployed` or `unemployed < 0`).

Priority calculation per building:
- `-i/20` (prefer buildings earlier in array)
- `+filledJobs/totalJobs` (prefer buildings already staffed)
- `-0.2 * amount/storageSizeMultiplier` or `-amount/population` (prefer buildings whose output is low)
- `+0.3` if building produces a pop demand resource
- `×1.5` or `×0.66` if pop demand resource (amplifies priority)
- `×0.1` if `minPropDemandSatisfied < 1` (deprioritize buildings lacking inputs)

Loop: repeatedly assigns/removes 1 worker to highest-priority building until unemployed=0 or no valid moves. Checks `alerts` before/after to avoid assigning workers to buildings that would trigger an alert.

### Building Management

- `addBuilding(building)`: if `ResourceBuilding`, adds to `resourceBuildings` and adds `generalProductivityModifier`; otherwise adds to `otherBuildings`
- `addToBuildingSize(building, direction)`: calls `build()` or `demolish()`
- `upgradeBuilding(building, direction)`: calls `upgrade()` or `downgrade()`
- `activateBonus(bonus)`: dispatches `AddNewBuildingBonus` (adds building) or `SettlementBonus.activate(this)`
- `deactivateBonus(bonus)`: calls `SettlementBonus.deactivate(this)`

### Price System

`idealPrices` dict: maps resource name → idealised price from `DefaultBuildings`.
`localPriceModifiers` dict: maps resource name → Variable with price multipliers.
`recalculatePrices()` recomputes `idealPrices` and calls `market.setNewIdealPrices()`.

### Army Strength & Military System
- `this.armyStrength` — `Variable` summing all armed unit attack values, modified by leader strategy via invLogit (bias=0.8, scale=0.45, speed=3, priority exponentiation+1)
- `this.armyStrengthStrategyModifier` — the strategy `VariableModifier` stored for reference
- `this._unitModifiers` — dict mapping unit resource name → array of `{ modifier, count }` entries for disarming
- `armSoldiers(unitResource, count)` — converts weapons → armed soldiers, adds attack modifier to `armyStrength`
- `disarmSoldiers(unitResource, count)` — reverses conversion, returns weapons, removes/shrinks modifier

### Coal Demand Adjustment

`adjustCoalDemand()` is called on construction and every tick:
- Winter: `coal.idealAmount = 1.5`
- Summer: `coal.idealAmount = 0.5`
- Spring/Autumn: `coal.idealAmount = 1.0`

Note: there is also a duplicate subscription in the rationing loop (lines 180-188) that does the same thing — coal demand is adjusted twice per tick.

### `SettlementComponent` — Tabbed UI

`SettlementComponent` renders the settlement view in three tabs using MUI `Tabs`/`Tab`:

| Tab | Label | Content |
|-----|-------|---------|
| 0 | **Production** | Key stats with `CustomTooltip` descriptions, auto-assign checkbox, all unlocked buildings |
| 1 | **Distribution** | Rationing controls + resource storage levels (player settlements only) |
| 2 | **Trading** | Market buy/sell controls; gated behind Roads size > 0 (player settlements only) |

- Research tab removed — research is now faction-level, accessed via the "Research" button in `GameUI`
- Header (always visible): settlement name, leader name (clickable → `setSelected`), terrain, active events
- NPC settlement tabs 1–2 show a grey "managed by NPC leader" message
- Tab state stored in `this.state.tab` (default 0); clamped to max 2 in `childRender`
- Trading tab: if `getBuildingByName(Roads.name).size.currentValue === 0`, shows "Build Roads to unlock trading"
- All key stat variables in Production tab wrapped in `CustomTooltip` with plain-English descriptions
- Imports `Tab`, `Tabs` from `@mui/material`; `CustomTooltip` from `../utils.js`

### Known Issues

4. **`autoManageUnemployed` default false**: the auto-assign checkbox is only shown for player settlements; NPC settlements never auto-assign workers unless `unemployed < 0`
5. **`setLeader()` creates new Variables**: every time a leader changes, new `localLegitimacy`, `support`, `rebellionSupport`, `totalRebellionSupport` Variables are created — old ones are not cleaned up, potentially leaking subscriptions
6. **`removeLeader()`**: creates a new `support` Variable with `startingValue: 0` but does not clean up `localLegitimacy`, `rebellionSupport`, or `totalRebellionSupport`

---

## `building.js` — Buildings

### `Building` (base class)

Props: `name`, `displayName`, `startingSize`, `maxSize`, `buildInputs`, `upgrades`, `flammable`.

- `size`: Variable with min=0, optional max
- `unlocked`: true if `startingSize > 0` or explicitly set
- `upgrades`: array of `BuildingUpgrade` instances
- `currentUpgradeIndex`: tracks which upgrade level is active

Methods:
- `canBuild(resourceStorages)`: checks max size and resource availability (uses `baseValue` not `currentValue`)
- `build(resourceStorages)`: deducts resources via `oneOffDemand`, increments size
- `demolish()`: decrements size
- `forceNewSize(newSize)`: used by events to change size directly
- `upgrade(resourceStorages, force)` / `downgrade(resourceStorages)`: delegates to `BuildingUpgrade`

### `ResourceBuilding` (extends `Building`)

Additional props: `outputResource`, `productivityModifiers`, `sizeJobsMultiplier`, `startingProductivity`, `passiveProductionPerSize`, `inputResources`.

Key Variables:
- `productivity`: starts at `startingProductivity` (default 1); receives `generalProductivityModifier` from settlement. **Always has a `roundTo(3dp)` modifier at priority 200** — added in `ResourceBuilding` constructor to reduce subscriber cascade frequency (optimisation).
- `totalJobs` = `startingJobs + sizeJobsMultiplier × size`
- `filledJobs`: clamped 0..totalJobs; subscriber reduces to max if size shrinks
- `emptyJobs` = totalJobs - filledJobs
- `workerProduction` = `outputResource.productionRatio × filledJobs × productivity`
- `theoreticalProduction` = workerProduction + passiveProduction (if any)
- `totalProduction` = theoreticalProduction × minPropDemandSatisfied
- `efficiency`: starts at 1 (currently unmodified — efficiency system not fully implemented)

Input resource demand system:
- Each input resource creates `idealPropDemandDesired` and `actualPropDemandDesired` Variables
- `propDemandsSatisfied`: array of `{idealDesiredPropFulfilled, actualDesiredPropFulfilled}` from `resourceStorage.addDemand()`
- `minPropDemandSatisfied` = min of all `actualDesiredPropFulfilled` — limits production
- `actualPropDemandsDesired[i]` = min of all OTHER `idealDesiredPropFulfilled` — limits demand on each input by the bottleneck of other inputs

`getIdealisedPrice(localPriceModifiers)`:
- `outputProductionRatio = localPriceModifier / outputResource.productionRatio`
- `inputCost = sum(inputMultiplier × inputResource.defaultBuilding.getIdealisedPrice(...))`
- Returns `outputProductionRatio + inputCost`

`changeOutputResource(newResource, resourceStorages, destroyOld)`:
- Removes supply from old resource storage, adds to new
- If `destroyOld`, calls `oneOffDemand` to zero out old resource

`changeInputResources(newInputResources, resourceStorages)`:
- Removes old demand registrations
- Registers new demands and recalculates `minPropDemandSatisfied` and `actualPropDemandsDesired`

### `BuildingUpgrade`

- `canUpgrade(resourceStorages, building)`: checks `unlocked`, not already upgraded, and resource costs (per size unit)
- `upgrade(resourceStorages, building, force)`: deducts resources, activates all `changes`, saves old `buildInputs`
- `downgrade(resourceStorages, building)`: deactivates all `changes`, restores old `buildInputs`

### `BuildingUpgradeChange` subclasses

- `NewOutputResource`: saves old resource, calls `changeOutputResource` on activate/deactivate
- `NewInputResources`: saves old resources, calls `changeInputResources` on activate/deactivate

### Concrete Buildings

| Building | Output | sizeJobsMultiplier | Build Cost | Notes |
|----------|--------|-------------------|------------|-------|
| `Storage` | — | — | 25 labour, 50 wood | Not a ResourceBuilding |
| `Farm` | food | 5 | 5 labour, 5 wood | flammable |
| `HuntingCabin` | food | 3 | 20 labour, 25 wood | maxSize=3, productivity=1.45, flammable |
| `Housing` | mudHuts | 0 | 30 labour | passive 10/size, flammable; upgrades to woodenHuts, brickHouses |
| `LumberjacksHut` | wood | 3 | 25 labour, 40 wood | flammable |
| `CharcoalKiln` | coal | 3 | 20 labour, 30 wood | input: 0.3 wood/unit |
| `Brewery` | beer | 3 | 35 labour, 50 wood | input: 0.2 food/unit, flammable |
| `Apothecary` | medicinalHerbs | 2 | 15 labour, 25 wood | flammable |
| `Library` | research | 2 | 50 labour, 35 wood | flammable |
| `ConstructionSite` | labourTime | 5 | 5 labour, 5 wood | |
| `Church` | religion | 1 | 100 labour, 75 stone | flammable |
| `Tavern` | entertainment | 2 | 50 labour, 50 wood | inputs: 0.1 food + 0.1 beer/unit, flammable |
| `Roads` | dirtPathAccess | 0 | 20 labour | passive 20/size; upgrades to gravelPath, brickRoads |
| `Quarry` | stone | 3 | 100 labour, 50 wood | |
| `Stonecutters` | stoneBricks | 3 | 25 labour, 25 wood | inputs: 2 stone + 2 wood/unit |
| `IronMine` | iron | 3 | 130 labour, 50 wood | |
| `BogIronPit` | iron | 4 | 40 labour, 20 wood | maxSize=2, productivity=1.35; terrain-only |
| `CoalMine` | coal | 3 | 100 labour, 50 wood | maxSize=4, productivity=1.35 |
| `CoalPit` | coal | 4 | 30 labour, 20 wood | maxSize=2, productivity=1.65; terrain-only |
| `PeatBog` | coal | 3 | 30 labour | maxSize=2; terrain-only |
| `Toolmaker` | stoneTools | 2 | 25 labour, 25 wood, 20 stone | inputs: 0.05 stone + 0.05 wood; upgrades to ironTools, steelTools |
| `Bowyer` | bows | 2 | 25 labour, 25 wood, 5 stone | input: 0.2 wood/unit |
| `WeaponMaker` | stoneWeaponry | 2 | 25 labour, 25 wood, 20 stone | inputs: 0.2 stone + 0.15 wood; upgrades to ironWeaponry, steelWeaponry |

### `BuildingComponent`

- Subscribes to `size`, `filledJobs`, `totalJobs`, `totalProduction` (for ResourceBuildings)
- Shows building name with filled/total jobs or passive production or size
- Tooltip shows output resource, production per worker, input requirements, alerts
- Buttons: +/- workers (ResourceBuilding only), Build, Demolish, Upgrade, Downgrade
- All buttons disabled for non-player settlements (`isPlayerOwned` prop)

### Known Issues

1. **`SpecificBuildingEfficiencyBonus`** (bonus.js lines 128-154): adds modifier to `building.productivity` instead of `building.efficiency` — efficiency bonus actually changes productivity
2. **`Building.canBuild()`** uses `resourceStorage.amount.baseValue` not `currentValue` — correct for Cumulators (baseValue = start of turn amount) but may be confusing
3. **`ResourceBuilding.filledJobs` subscriber**: reduces `filledJobs` to `max` when size shrinks, but this fires synchronously during size change which may cause re-entrancy issues
4. **`BuildingComponent` tooltip**: `extraVars` includes `outputPerWorker` calculation that divides by `filledJobs.currentValue` — will be `NaN` or `Infinity` when `filledJobs = 0`

---

## `resource.js` — Resources

### `Resource`

Props: `name`, `storageMultiplier`, `productionRatio`, `description`, `cumulates` (default true), `startingAmount`, `defaultBuilding`.

- `storageMultiplier`: storage capacity per storage building size unit (null = no storage limit / flow resource)
- `productionRatio`: units produced per worker per tick (used in `workerProduction`)
- `cumulates`: if false, resource is a flow (recalculated each tick, not accumulated)
- `defaultBuilding`: set by `default_buildings.js` for price calculation

### `ResourceStorage`

Props: `resource`, `size` (Variable), `gameClock`.

Key Variables:
- `totalStorage` = `storageMultiplier × size`
- `supply`: `VariableModifier` (addition) — sum of all building `totalProduction` values
- `demand`: `VariableModifier` (subtraction) — sum of all demand amounts
- `change` = supply - demand (prospective change, not applied directly)
- `amount`: `Cumulator` (if cumulates) or `Variable` (if not); min=0, max=totalStorage (if storageMultiplier set)

On each timer tick: `updateDemands(0)` is called to redistribute supply.
Also subscribes to `supply` and `demand` changes to call `updateDemands`.

### `addDemand(name, totalDemand, idealDesiredProp, actualDesiredProp, priority)`

Registers a demand with a priority level. Returns `{idealDesiredPropFulfilled, actualDesiredPropFulfilled}`.

Priority levels used in practice:
- 1: building input resources
- 2: citizen rations
- 3: market selling

Adds a modifier to `demand.variable`: `totalDemand × actualDesiredPropFulfilled`.

### `updateDemands(indent)`

Distributes available supply across demands in priority order:
```
totalSupply = amountAtTurnStart + supply.variable.currentValue
for each demand (sorted by priority):
    idealDemand = totalDemand × idealDesiredProp
    actualDemand = totalDemand × actualDesiredProp
    if totalSupply >= actualDemand:
        actualDesiredPropFulfilled = actualDesiredProp
        totalSupply -= actualDemand
    else:
        actualDesiredPropFulfilled = actualDesiredProp × totalSupply / actualDemand
        totalSupply = 0
```

`idealDesiredPropFulfilled` is set independently (not consuming supply) — used to limit other demands.

### `oneOffDemand(amount, explanation)`

Immediately reduces `amount.baseValue` by `amount`. Used for building costs and research costs. Only works for cumulating resources.

### `addSupply(supplyVariable)` / `removeSupply(supplyVariable)`

Adds/removes a `VariableModifier` to `supply.variable`.

### `removeDemand(idealDesiredProp)`

Finds demand by `idealDesiredProp` reference, removes the modifier from `demand.variable`, unsubscribes callbacks.

### Military Unit Resources
10 unit resources added (§4.1): `stoneSpears`, `stoneSwords`, `ironSpears`, `ironSwords`, `steelSpears`, `steelShortSwords`, `steelLongSwords`, `shortbowmen`, `warbowmen`, `longbowmen`. All have `cumulates: true`.

Exported constants:
- `UNIT_ATTACK_VALUES` — `{ 'stone spears': 0.6, ... }` attack value per unit
- `UNIT_WEAPON_COSTS` — `{ 'stone spears': { resourceName: 'stoneWeaponry', amount: 1 }, ... }` weapon cost per unit
- `MELEE_UNIT_NAMES` — array of melee unit resource names
- `BOW_UNIT_NAMES` — array of bow unit resource names

`ironWeaponry.startingAmount = 5` (player starts with 5 iron weapons).

### `Resources` Constants

25 resource types:

**Food/Survival**: `food` (×450 storage), `coal` (×200)

**Housing** (flow, no storage): `mudHuts`, `woodenHuts`, `brickHouses`

**Happiness** (flow): `beer` (×450), `religion` (no storage), `entertainment` (no storage)

**Health**: `medicinalHerbs` (×200)

**Infrastructure** (flow): `labourTime` (×0 storage, starts 1000), `research` (no storage, starts 1000), `dirtPathAccess`, `gravelPathAccess`, `brickRoadAccess`

**Materials**: `wood` (×200, starts 100), `stone` (×150, starts 100), `stoneBricks` (×200, starts 100), `iron` (×200, starts 100)

**Tools** (flow): `stoneTools` (×200), `ironTools` (×200), `steelTools` (×200)

**Military**: `stoneWeaponry` (×50), `bows` (×50), `ironWeaponry` (×50), `steelWeaponry` (×50)

### `ResourceStorageComponent`

- Subscribes to `resourceStorage.amount`
- Cumulating resources: shows `CumulatorComponent` (with expected change)
- Flow resources: shows `VariableComponent` with "Excess" prefix
- Tooltip shows resource description

### Known Issues

1. **`updateDemands` called on every supply/demand change**: can cause cascading recalculations; the `indent` parameter is passed through to `setNewBaseValue` to help track depth
2. **`labourTime` has `storageMultiplier: 0`**: `totalStorage = 0 × size = 0` — labour time storage is always 0, meaning `amount` is always clamped to 0 by the max. This seems intentional (labour time is a flow) but the `storageMultiplier: 0` is confusing vs `null`
3. **`research` has `storageMultiplier: null`**: no max storage, so research accumulates indefinitely — this is intentional
4. **`ResourceStorage` subscribes to `supply` and `demand` changes**: but `supply` and `demand` are `VariableModifier`s (not Variables), so their `subscribe` method is `AbstractModifier.subscribe` which has the priority bug (see variable system notes)

---

## `rationing.js` — Rationing System

### `getBasePopDemands()`

Returns a dict of demand objects, one per consumable resource. Each demand has:
- `resource`: the `Resource` object
- `idealAmount`: Variable (units per person per tick at full rations)
- `effects`: array of effect descriptors
- `alwaysFullRations`: if true, excluded from the rationing UI (always demands full amount)

Resources with `alwaysFullRations`: mudHuts, woodenHuts, brickHouses, religion, entertainment, dirtPathAccess, gravelPathAccess, brickRoadAccess, stoneTools, ironTools, steelTools.

Resources the player can ration: food, coal, beer, medicinalHerbs.

### Effect Descriptor Formats

Three formats for `effects` entries:

**Additive with coefficient and exponent**:
```js
{ type: addition, on: "happiness"|"health"|"productivity"|"tradeFactor",
  coefficient: Variable, exponent: Variable, offsetProportion?: number }
```
Result: `(offsetProportion + (rationAchieved/idealAmount)^exponent) × coefficient`

**Multiplicative with offset and exponent**:
```js
{ type: multiplication, on: "happiness"|"health",
  offset: number, exponent: Variable }
```
Result: `offset + (rationAchieved/idealAmount)^exponent × (1 - offset)`

**Multiplicative with S-curve (invLogit)**:
```js
{ type: multiplication, on: "happiness"|"health",
  offset: number, midpoint: Variable, speed: number }
```
Result: `offset + invLogit(rationAchieved/idealAmount, midpoint, speed) × (1 - offset)`

### `applyRationingModifiers(rationAchieved, demand, health, happiness, productivity, tradeFactor)`

For each effect in `demand.effects`, creates a Variable with the appropriate modifier chain and adds it to the target Variable (`health`, `happiness`, `productivity`, or `tradeFactor`).

### Resource Effects Summary

| Resource | Effect on Happiness | Effect on Health | Effect on Productivity |
|----------|--------------------|-----------------|-----------------------|
| food | +additive (coeff=0.2, exp=1.25) | +additive (coeff=0.2, exp=2, offset=-0.35) + ×S-curve (offset=0.05, mid=0.3, speed=3) | — |
| coal | +additive (coeff=0.25, exp=1.25) + ×exp (offset=0.5, exp=0.5) | +additive (coeff=0.2, exp=2, offset=-0.35) + ×S-curve (offset=0.3, mid=0.25, speed=2.5) | — |
| beer | +additive (coeff=0.2, exp=0.5) | -additive (coeff=-0.12, exp=1.5) | — |
| medicinalHerbs | — | +additive (coeff=0.25, exp=1.35) | — |
| woodenHuts | +additive (coeff=0.15, exp=1.5) | — | — |
| brickHouses | +additive (coeff=0.25, exp=1.5) | — | — |
| religion | +additive (coeff=0.15, exp=0.8) | — | — |
| entertainment | +additive (coeff=0.1, exp=0.65) | — | — |
| dirtPathAccess | — | — | +additive (coeff=0.05, exp=0.75) + tradeFactor +additive (coeff=0.2, exp=0.4) |
| gravelPathAccess | — | — | +additive (coeff=0.125, exp=0.75) + tradeFactor +additive (coeff=0.35, exp=0.4) |
| brickRoadAccess | — | — | +additive (coeff=0.2, exp=0.75) + tradeFactor +additive (coeff=0.5, exp=0.4) |
| stoneTools | — | — | +additive (coeff=0.2, exp=0.8) |
| ironTools | — | — | +additive (coeff=0.3, exp=0.8) |
| steelTools | — | — | +additive (coeff=0.4, exp=0.8) |

### `RationingComponent`

Shows `idealRation`, `demandedRation`, `recievedRation` (note: misspelled) with +/- buttons.
Amount per click: 0.01, Ctrl=0.05, Shift=0.10.

### Known Issues

1. **`recievedRation`** is misspelled throughout (should be `receivedRation`)
2. **`getBasePopDemands()` must be called per settlement**: it creates new Variable instances each call. If called once and shared, all settlements would share the same `idealAmount` Variables — the function comment correctly notes this

### Fixed

- **Coal demand set twice** (`settlement.js`): the rationing loop previously subscribed to `gameClock` to set `coal.idealAmount` on every tick, duplicating the work already done by `adjustCoalDemand()`. The redundant subscription in the rationing loop has been removed; `adjustCoalDemand()` is the sole owner of this logic.

---

## `research.js` — Research Tree

### `Research`

Props: `name`, `researchCost`, `researchBonuses`.
- `researched`: boolean flag (not a Variable)
- `getEffectList()`: returns array of effect text strings for tooltip

### `createResearchTree()`

Returns object with 12 research categories, each an ordered array of `Research` objects. Must research earlier items in a category before later ones (enforced in `SettlementComponent` render).

### Research Categories & Costs

| Category | Items | Costs |
|----------|-------|-------|
| agriculture | Larger Plough, Selective Breeding, Heavy Plough, Better Irrigation, 3 Field Rotation | 100, 200, 200, 450, 700 |
| housing | Wooden Huts, Brick Houses | 75, 250 |
| woodcutting | Larger Axes, Better Axes, Saws, Advanced Saws | 100, 200, 350, 350 |
| charcoal | Larger Kilns, Using the Shavings | 100, 200 |
| brewing | Brewing (unlock), Ageing, Improved Barrels | 35, 150, 300 |
| services | Tavern (unlock), Church Architecture (unlock) | 100, 200 |
| health | Apothecary (unlock) | 35 |
| roads | Gravel Paths, Brick Roads | 150, 350 |
| mining | Quarrying, Stonecutting, Surface Mining, Deep Mining, Deeper Mining, Deepest Mining | 50, 100, 150, 200, 400, 600 |
| tools | Stone Tools (unlock), Iron Tools, Steel Tools | 100, 350, 500 |
| military | Stone Weaponry, Bowyery and Fletching, Iron Weaponry, Steel Weaponry | 30, 100, 300, 500 |
| productivity | Basic Administration, Productivity Incentives, Record Keeping | 150, 400, 500 |

### Known Issues

1. **"Bowyery and Fletching"** (military research): unlocks `WeaponMaker` again — but `WeaponMaker` is already unlocked by "Stone Weaponry". This research has no effect.
2. **Research is not saved/loaded**: `researched` is a plain boolean on the `Research` instance; `Research` is not in `CLASS_MAP` in `save_load.js` — research progress will be lost on save/load

---

## `terrain.js` — Terrain Types

### `Terrain` (base class)

Props: `name`, `bonuses`. Calls `bonus.setOrigin("terrain {name}")` on all bonuses.

### Terrain Types

**`NoTerrain`**: no bonuses. Used for testing.

**`Farmlands`**:
- Adds `CoalPit` (size 0, locked)
- Farm productivity ×1.05
- Apothecary productivity ×0.9
- LumberjacksHut productivity ×0.85

**`Woodlands`**:
- Farm productivity ×0.9
- ConstructionSite productivity ×0.9
- HuntingCabin productivity ×1.25, max size +3
- Apothecary productivity ×1.35
- LumberjacksHut productivity ×1.25

**`Marshlands`**:
- Adds `BogIronPit` (size 0, locked)
- Adds `PeatBog` (size 1, unlocked)
- CoalMine max size +3
- Farm productivity ×0.93
- ConstructionSite productivity ×0.8
- Apothecary productivity ×1.2
- LumberjacksHut productivity ×1.25

**`Mountains`**:
- Adds `CoalMine` (size 1, unlocked)
- CoalMine max size +5
- Farm productivity ×0.9
- ConstructionSite productivity ×0.85
- Apothecary productivity ×1.2
- IronMine productivity ×1.35
- CoalMine productivity ×1.35

### `TerrainComponent`

Simple tooltip showing effect list, clicking sets Logger inspect to terrain object.

### Known Issues

*(none remaining — `SpecificBuildingMaxSizeBonus` now correctly modifies `building.size.max`; `BogIronPit`, `CoalPit`, `PeatBog` are now in `CLASS_MAP`)*

---

## `default_buildings.js` — Price Reference Buildings

Creates dummy building instances (size 0, dummy resource storages, dummy timer) for use in price calculation only. These are never added to any settlement.

`DefaultBuildings` array is used by `Settlement` to calculate `idealPrices` and by `ResourceBuilding.getIdealisedPrice()` for recursive input cost calculation.

After construction, sets `resource.defaultBuilding` for each resource that has a matching building.

### Known Issues

*(none — module-level side effects and timer leak fixed; see Fixed section below)*

### Fixed

- **Dummy timer leak + module-level side effects** (`default_buildings.js`): `DefaultBuildings` was constructed at module import time, creating live `Timer` instances (with `setInterval`) and `ResourceStorage` instances as side effects. Replaced with a `createDefaultBuildings()` factory and a `getDefaultBuildings()` lazy singleton. `settlement.js` updated to call `getDefaultBuildings()` instead of importing `DefaultBuildings` directly. `resource.defaultBuilding` is still set as a side effect of the first call, but this now happens at game construction time rather than at module import time.

---

## Unit Testing Ideas

### `Settlement`
- Population grows at correct rate with full health/happiness
- Population declines with poor health
- Rebellion fires when `totalRebellionSupport >= 1`
- `adjustJobs()` correctly assigns workers to highest-priority buildings
- `adjustJobs()` removes workers when population drops below total jobs
- `setLeader()` correctly wires `localLegitimacy` to new leader's `legitimacy`
- `activateBonus(AddNewBuildingBonus)` adds building to `resourceBuildings`
- `activateBonus(SettlementBonus)` calls `bonus.activate(settlement)`
- `recalculatePrices()` updates market ideal prices

### `ResourceStorage`
- `updateDemands()` distributes supply correctly in priority order
- `updateDemands()` correctly handles partial supply (proportional fulfillment)
- `addDemand()` / `removeDemand()` correctly wire/unwire modifiers
- `oneOffDemand()` reduces `baseValue` by correct amount
- `addSupply()` / `removeSupply()` correctly modify supply variable
- Storage max is respected (amount never exceeds `storageMultiplier × size`)

### `Building`
- `canBuild()` returns false when resources insufficient
- `canBuild()` returns false when at max size
- `build()` deducts correct resources and increments size
- `demolish()` decrements size
- `upgrade()` deducts resources and activates changes
- `downgrade()` deactivates changes and restores build cost
- `BuildingUpgrade.canUpgrade()` returns false when not unlocked
- `BuildingUpgrade.canUpgrade()` returns false when already upgraded

### `ResourceBuilding`
- `workerProduction` = `productionRatio × filledJobs × productivity`
- `totalProduction` = `theoreticalProduction × minPropDemandSatisfied`
- `minPropDemandSatisfied` = min of all input demand fulfillments
- `filledJobs` clamped to `totalJobs` when size decreases
- `changeOutputResource()` correctly moves supply registration
- `changeInputResources()` correctly re-registers demands

### `Market`
- `netMarketIncome` = sell income - buy costs
- `buyProp` zeroed when `bankrupt = 1`
- `marketSellPriceFactor` increases with `tradeFactor`
- `marketBuyPriceFactor` decreases with `tradeFactor`
- `setNewIdealPrices()` updates all price base values

### `Rationing`
- `applyRationingModifiers()` adds correct modifiers to happiness/health/productivity
- Additive effect: correct value at 0%, 50%, 100% ration
- Multiplicative S-curve effect: correct value at 0%, 50%, 100% ration
- `RationingComponent` shows correct ideal/demanded/received values

### `Research`
- `canResearch()` returns false when insufficient research points
- `canResearch()` returns false when already researched
- `activateResearch()` deducts research cost and activates bonuses
- Research tree sequential unlock: item N+1 only visible after item N researched

### `Terrain`
- Each terrain applies correct bonuses on `activateTerrain()`
- `AddNewBuildingBonus` adds building to settlement
- `SpecificBuildingProductivityBonus` modifies correct building's productivity

---

## `bonus.js` — Bonus System

### Hierarchy

```
Bonus (abstract)
├── SettlementBonus (abstract)
│   ├── SimpleSettlementModifier
│   │   ├── GeneralProductivityBonus
│   │   ├── HealthBonus
│   │   ├── HappinessBonus
│   │   └── LocalLegitimacyBonus
│   ├── SpecificBuildingProductivityBonus
│   ├── SpecificBuildingEfficiencyBonus  ← BUG: modifies productivity not efficiency
│   ├── SpecificBuildingMaxSizeBonus     ← BUG: modifies productivity not size.max
│   ├── SpecificBuildingChangeSizeBonus  (one-way, no deactivate)
│   ├── UnlockBuildingBonus
│   ├── UnlockBuildingUpgradeBonus
│   ├── ChangePriceBonus
│   ├── TemporaryModifierBonus
│   │   ├── TemporaryHappinessBonus
│   │   ├── TemporaryHealthBonus
│   │   ├── TemporaryLocalLegitimacyBonus
│   │   └── TemporaryGeneralProductivityBonus
│   └── ChangePopulationBonus           (one-way, no deactivate)
├── AddNewBuildingBonus                  (handled specially in Settlement)
└── CharacterBonus (abstract)
    ├── SimpleCharacterModifier
    │   ├── LegitimacyBonus
    │   ├── StrategyBonus
    │   ├── DiplomacyBonus
    │   └── AdministrationBonus
    └── TemporaryCharacterBonus
        └── TemporaryLegitimacyBonus
```

### `SimpleSettlementModifier`

- `variableAccessor`: string key on settlement (e.g. `"generalProductivity"`)
- `amount`: number or Variable
- `type`: `multiplication` (default) or `addition`
- `activate(settlement)`: creates `VariableModifier` and adds to `settlement[variableAccessor]`
- `deactivate(settlement)`: removes the modifier

### `TemporaryModifierBonus`

Interpolates effect from full to zero over `duration` ticks:
- `durationFactor` = (currentTime - startTime) / duration, clamped 0..1
- For `addition`: modifier = `amount × (1 - durationFactor)`
- For `multiplication`: modifier = `amount + durationFactor × (1 - amount)` (interpolates from `amount` to 1)

Self-removes via timer subscription that returns `false` when `durationFactor >= 1`.

**Note**: `deactivate()` is a no-op — the timer callback handles removal. If the event ends before the timer fires, the modifier persists until the timer naturally expires.

### `ChangePopulationBonus` / `SpecificBuildingChangeSizeBonus`

One-way changes — `deactivate()` is a no-op. These represent permanent changes (deaths, building destruction).

### `AddNewBuildingBonus`

Not a `SettlementBonus` — handled specially in `Settlement.activateBonus()`. Creates a new building instance and calls `addBuilding()`.

### `setOrigin(origin, rename=true)`

Called on all bonuses when they are added to a `Trait` or `Event`. Appends `" from {origin}"` to the bonus name.

### Known Issues

1. **`SpecificBuildingEfficiencyBonus`**: adds modifier to `building.productivity` instead of `building.efficiency` — efficiency system is not functional
2. **`TemporaryModifierBonus.deactivate()`**: no-op — relies on timer callback; if settlement is destroyed or event ends early, modifier may persist
3. **`TemporaryCharacterBonus`**: identical implementation to `TemporaryModifierBonus` but for characters — code duplication that could be unified

---

## `market.js` — Market

### Construction

Per resource (only resources with `storageMultiplier` are tradeable):
- `desiredSellProp`: Variable (0..marketAmountFactor) — player-set sell proportion
- `buyProp`: Variable (0..marketAmountFactor) — player-set buy proportion; zeroed when bankrupt
- `desiredSellAmount` = population × desiredSellProp
- `buyAmount` = population × buyProp
- `actualSellPropProp`: from `resourceStorage.addDemand('market demand', desiredSellAmount, ...)` at priority 3
- `actualSellProp` = desiredSellProp × actualSellPropProp
- `actualSellAmount` = population × actualSellProp
- `marketSellPrice` = idealPrice × marketSellPriceFactor
- `marketBuyPrice` = idealPrice × marketBuyPriceFactor
- `netIncome` = actualSellAmount × marketSellPrice - buyAmount × marketBuyPrice

### Price Factors

`defaultPenalty = 0.35`:
- `marketSellPriceFactor` = 0.65 + tradeFactor × 0.28 (capped at 1.0)
- `marketBuyPriceFactor` = 1.35 - tradeFactor × 0.28 (floored at 1.0)
- `marketAmountFactor` = tradeFactor × 1.0 + 0.25 (max trade volume as proportion of population)

All three use `scaledAddition` with `exp=0.75` on `tradeFactor` — diminishing returns on road investment.

### Bankruptcy

`buyProp` has a `scaledMultiplication` modifier: `bias=1, scale=-1` on `bankrupt` Variable.
- When `bankrupt=0`: multiplier = 1 (no effect)
- When `bankrupt=1`: multiplier = 0 (zeroes out buy proportion)

### `setNewIdealPrices(idealPrices)`

Updates base values of all `marketSellPrice` and `marketBuyPrice` Variables.

### `MarketResourceComponent`

- Subscribes to `buyProp`, `desiredSellProp`, `marketSellPrice`
- Shows sell price, buy price, sell/buy proportions (only if non-zero), net income (only if trading)
- Buy/Sell buttons call `buyFromMarket` prop

### `SettlementComponent` market interaction

`buyFromMarket(event, marketResource, direction)`:
- Positive direction (buy): if `buyProp > 0` or `desiredSellProp = 0`, increase `buyProp`; else decrease `desiredSellProp`
- Negative direction (sell): if `desiredSellProp > 0` or `buyProp = 0`, increase `desiredSellProp`; else decrease `buyProp`
- Amount: 0.01 per click, 0.05 with Ctrl, 0.10 with Shift

### Known Issues

1. **Trade exploit**: settlements with different building productivities will have different ideal prices. A settlement with high farm productivity has cheap food — it can sell food cheaply and buy it back expensively at another settlement, creating an arbitrage loop. Noted in top-level knowledge.md.
2. **`marketAmountFactor` starts at 0.25** even with `tradeFactor=0` — some trading is always possible regardless of roads
3. **Market only shows resources with `storageMultiplier`**: flow resources (housing, roads, tools, etc.) cannot be traded, which is correct but means the market panel is sparse early game

### Developer Notes

> From `handwritten_notes.md`. Do not implement without confirmation.

- **Auto-sell excess goods**: ✅ **Implemented**. When storage is full and production overflows, the excess is automatically sold to the market at the current sell price, but only for resources where the player has set `desiredSellProp > 0`. Income is credited to the treasury via `game.addToTreasury()`. See `Settlement.autoSellExcessGoods()` and `Cumulator.excessAmount`.
- **Buy inputs without producing them**: The developer wants settlements to be able to buy resources on the market even if they don't produce them (e.g. buy iron without an iron mine). Currently market resources are only registered for resources the settlement produces. This would require registering market entries for all tradeable resources regardless of whether a building produces them.
- **Tavern/entertainment should improve trade modifier**: Currently `entertainment` has no effect on `tradeFactor`. The developer intends to add this connection.
- **"Buy/sell now" button**: Allow buying/selling as much as possible immediately from storage. Developer notes this may be unbalanced.
- **Productivity breakdown in building UI**: Resource buildings should show a breakdown of what is affecting their productivity (terrain, crop blight, research, etc.) so the player can understand the numbers.

---

## `rationing.js` — Rationing System

### `getBasePopDemands()`

Returns a dict of demand objects, one per consumable resource. Each demand has:
- `resource`: the `Resource` object
- `idealAmount`: Variable (units per person per tick at full rations)
- `effects`: array of effect descriptors
- `alwaysFullRations`: if true, excluded from the rationing UI (always demands full amount)