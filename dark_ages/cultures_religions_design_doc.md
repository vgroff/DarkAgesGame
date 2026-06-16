# Cultures & Religions Design Document

> **Status: DRAFT v2 — awaiting final approval before implementation.**
>
> This document is for review and discussion. Please edit it directly or leave comments, and we will iterate before any code is written.

---

## Part 1: New Cultures

### How Cultures Work (existing system)

Each `Culture` subclass implements `getTraits()`, returning a list of `Trait` objects. Each `Trait` holds an array of `Bonus` objects (from `bonus.js`). When a character's culture is set, all cultural traits are activated on all of the character's settlements. The available bonus types are:

- `LegitimacyBonus` — adds/multiplies the character's `legitimacy` Variable
- `StrategyBonus` — adds/multiplies the character's `strategy` Variable
- `DiplomacyBonus` — adds/multiplies the character's `diplomacy` Variable
- `AdministrationBonus` — adds/multiplies the character's `administration` Variable
- `GeneralProductivityBonus` — adds/multiplies the settlement's `generalProductivity`
- `HealthBonus` — adds/multiplies the settlement's `health`
- `HappinessBonus` — adds/multiplies the settlement's `happiness`
- `SpecificBuildingProductivityBonus` — multiplies a named building's `productivity`
- `SimpleSettlementModifier` — adds/multiplies any named settlement Variable (e.g. `tradeFactor`, `support`)

The existing cultures for reference:
- **Celtic**: elected kings (legitimacy ×0.95), druidic traditions (Apothecary ×1.25, health ×1.03), foresters (LumberjacksHut ×1.15, HuntingCabin ×1.1)
- **Roman**: dying empire (legitimacy ×0.95), obsolete military tactics (strategy ×0.85), academic traditions (Library ×1.2), roman plumbing (health ×1.05), rhetorical training (diplomacy ×1.1)

**Note on "popular support" mechanic**: The rebellion system works as follows:
```
support = happiness + localLegitimacy + diplomacyEffect - 1
rebellionSupport = -support   (positive when support < 0)
totalRebellionSupport (Cumulator, min=0) accumulates rebellionSupport each tick
```
A `SimpleSettlementModifier` on `support` (addition, negative value) directly reduces support, making rebellions accumulate faster when things go bad. This is the intended approach for "volatile" cultures.

---

### 1.1 Byzantine

**Flavour**: A sophisticated, bureaucratic civilisation with deep merchant traditions, but plagued by court intrigue and factional infighting.

| Trait Name | Effect | Bonus Type | Value | Notes |
|---|---|---|---|---|
| State Bureaucracy | Administration boost | `AdministrationBonus` (addition) | +0.15 | Boosts `administrativeEfficiency` → settlement productivity |
| Merchant Civilisation | Trade factor boost | `SimpleSettlementModifier` on `tradeFactor` (multiplication) | ×1.2 | Multiplier — amplifies existing trade, no effect without roads |
| Incessant Infighting | Support reduction | `SimpleSettlementModifier` on `support` (addition) | −0.05 | Reduces popular support directly; rebellions accumulate faster when things go bad |

---

### 1.2 Germanic

**Flavour**: Fierce warriors who toppled the Roman Empire, organised around strength and kinship rather than bureaucracy. Skilled hunters and fighters, but poor administrators. High base legitimacy from their warrior prestige, but volatile — once things go wrong, they go wrong fast.

| Trait Name | Effect | Bonus Type | Value | Notes |
|---|---|---|---|---|
| Modern Tactics | Strategy boost | `StrategyBonus` (multiplication) | ×1.2 | |
| Slayers of Emperors | Legitimacy flat boost | `LegitimacyBonus` (addition) | +0.15 | Higher base legitimacy from warrior prestige |
| Rule by the Fittest | Support multiplier (penalty) | `SimpleSettlementModifier` on `support` (multiplication) | ×0.9 | Amplifies negative support — once things go bad, they spiral faster |
| Hunters | Hunting Cabin boost | `SpecificBuildingProductivityBonus` on `HuntingCabin` | ×1.2 | |
| Decentralised Administration | Admin penalty | `AdministrationBonus` (multiplication) | ×0.85 | |

**Net legitimacy feel**: High base legitimacy (+0.15) but a support multiplier that makes rebellions spiral faster once support goes negative. Stable when things are good; volatile when things go bad.

> **Note on "Rule by the Fittest" as a support multiplier**: `support` can be positive or negative. A ×0.9 multiplier on `support` would *reduce* positive support (slightly bad) and *amplify* negative support (making rebellions worse). This gives the intended feel — Germanics are fine when happy but dangerous when unhappy. However, multiplying a Variable that can be negative requires care in implementation (a `multiplication` modifier on `support` would need to handle the sign correctly). **Flag for implementation: confirm this is the right approach or use a `scaledMultiplication` instead.**

---

### 1.3 Viking

**Flavour**: Warrior-seafarers whose reputation for violence precedes them. Excellent fighters and weapon-makers, but their culture of raiding makes them feared rather than trusted as trading partners, and their warrior ethos means fewer people work the fields. Legitimacy comes from strength, not divine right — which makes succession dangerous.

| Trait Name | Effect | Bonus Type | Value | Notes |
|---|---|---|---|---|
| Warrior Society | Strategy boost + productivity drop | `StrategyBonus` (multiplication) + `GeneralProductivityBonus` (multiplication) | ×1.25 strategy, ×0.93 productivity | One trait, two effects |
| Legitimacy Through Blood | Legitimacy flat drop | `LegitimacyBonus` (addition) | −0.08 | Kept modest so it's not crippling on its own |
| Feared | Weaker trade factor | `SimpleSettlementModifier` on `tradeFactor` (multiplication) | ×0.8 | Multiplier — proportionally reduces trade benefit from roads |
| Weaponsmiths | Weapon Maker production boost | `SpecificBuildingProductivityBonus` on `WeaponMaker` | ×1.3 | |

**Note**: "Legitimacy Through Blood" appears only on the Viking *culture*, not on Norse Pagan religion (see Part 2). The religion does not double up on this penalty.

---

## Part 2: Religion System

### How Religion Would Work (proposed)

Religion is a new mechanic that sits alongside Culture. Each character would have a `Religion` in addition to a `Culture`. Like `Culture`, a `Religion` class implements `getTraits()` returning a list of `Trait` objects with `Bonus` effects.

The existing `religion` resource (produced by the `Church` building) already exists as a flow resource that adds to happiness. The religion *mechanic* proposed here is separate — it's a character-level property giving passive bonuses/penalties, not tied to the Church building's output level.

**Implementation approach**:
- New `Religion` abstract class (parallel to `Culture`) in `character.js`
- `Character` gains a `religion` property
- Religious traits activated/deactivated the same way cultural traits are
- UI: dropdown in `CharacterComponent` (same pattern as culture), editable for player only
- Scenario system: `playerReligion` field added to scenario config as a behind-the-scenes pre-fill (same pattern as `playerTraits` — not shown in the scenario selector UI, just used to pre-set the character editor state for scenarios like `banditRaid` that pre-configure the player character). The player can still change it in the character editor.
- NPC characters: assigned a random religion from their culture's allowed set at construction

---

### 2.1 Celtic Pagan

**Flavour**: Decentralised, personal relationship with nature spirits and local gods. No organised church hierarchy.

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| Personal Gods | Happiness boost | `HappinessBonus` (multiplication) | ×1.05 |
| Decentralised Religion | Church productivity drop | `SpecificBuildingProductivityBonus` on `Church` | ×0.8 |

---

### 2.2 German Pagan

**Flavour**: Similar to Celtic Pagan — tribal, personal, no organised hierarchy. Kept as a separate class for future divergence.

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| Personal Gods | Happiness boost | `HappinessBonus` (multiplication) | ×1.05 |
| Decentralised Religion | Church productivity drop | `SpecificBuildingProductivityBonus` on `Church` | ×0.8 |

> **Implementation note**: Identical effects to Celtic Pagan. Implemented as two separate classes (both extending `Religion`) so they can diverge in future without breaking saves.

---

### 2.3 Christianity

**Flavour**: Organised, hierarchical church with strong institutional legitimacy and productive religious infrastructure.

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| Render unto Caesar | Legitimacy flat boost | `LegitimacyBonus` (addition) | +0.15 |
| Organised Religion | Church productivity boost | `SpecificBuildingProductivityBonus` on `Church` | ×1.3 |

---

### 2.4 Roman Pagan

**Flavour**: State religion tied to imperial authority. Legitimises the ruler but is an elite affair — the common people don't benefit.

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| State Religion | Legitimacy boost | `LegitimacyBonus` (addition) | +0.1 |
| Elite Religion | Happiness reduction | `HappinessBonus` (multiplication) | ×0.95 |

---

### 2.5 Celtic Christianity

**Flavour**: A syncretic blend of Celtic Pagan traditions and Christian theology. Retains some personal/nature spirituality while accepting Christian institutional legitimacy — but the Caesar effect is weaker than in full Roman Christianity. Neutral on religious buildings (no penalty, no bonus).

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| Pagan Syncreticism | Happiness boost | `HappinessBonus` (multiplication) | ×1.03 |
| Render unto Caesar (partial) | Legitimacy flat boost (smaller) | `LegitimacyBonus` (addition) | +0.08 |

---

### 2.6 Norse Pagan

**Flavour**: The Viking religion — glory in battle, Valhalla awaits the worthy. Legitimacy comes from strength, not divine right. **Note**: "Legitimacy Through Blood" is a Viking *culture* trait, not a Norse Pagan trait — it does not appear here to avoid doubling up.

| Trait Name | Effect | Bonus Type | Value |
|---|---|---|---|
| Valhalla | Strategy boost | `StrategyBonus` (multiplication) | ×1.1 |

---

## Part 3: Culture × Religion Compatibility Matrix

The following matrix defines which religion options are available for each culture. The goal is to be liberal but not silly.

| Culture | Celtic Pagan | German Pagan | Christianity | Roman Pagan | Celtic Christianity | Norse Pagan |
|---|---|---|---|---|---|---|
| **Celtic** | ✅ Default | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Roman** | ❌ | ❌ | ✅ | ✅ Default | ❌ | ❌ |
| **Byzantine** | ❌ | ❌ | ✅ Default | ✅ | ❌ | ❌ |
| **Germanic** | ❌ | ✅ Default | ✅ | ❌ | ❌ | ❌ |
| **Viking** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ Default |

**Rationale:**
- **Celtic**: Naturally Celtic Pagan; Christianity spread to Celtic peoples historically; Celtic Christianity is a natural syncretic path.
- **Roman**: Roman Pagan is the default; Christianity spread through the Roman Empire (Constantine).
- **Byzantine**: Christianity is the default (Eastern Orthodox); Roman Pagan is a historical holdover option.
- **Germanic**: German Pagan is the default; Christianity spread to Germanic peoples.
- **Viking**: Norse Pagan is the default; Christianity allowed (e.g. Harald Bluetooth, Christianisation of Scandinavia).

---

## Part 4: Stacking Analysis

### Viking (culture) + Norse Pagan (religion)
- Strategy: ×1.25 (culture) — religion adds ×1.1 → combined ×1.375
- Legitimacy: −0.08 (culture only; religion has no legitimacy penalty)
- Starting legitimacy is 0.1, so net legitimacy = 0.02. Very low but not negative.
- Trade: ×0.8 on `tradeFactor`

### Germanic (culture) + Christianity (religion)
- Strategy: ×1.2
- Legitimacy: +0.15 (culture) + +0.15 (religion) = +0.30 flat boost. Strong.
- Support multiplier: ×0.9 (volatile when unhappy)
- Admin: ×0.85

### Byzantine (culture) + Christianity (religion)
- Admin: +0.15
- Trade: ×1.2 on `tradeFactor`
- Support: −0.05 flat
- Legitimacy: +0.15 (religion)

### Celtic (culture) + Celtic Christianity (religion)
- Legitimacy: ×0.95 (culture) + +0.08 (religion) — slight legitimacy penalty from culture, partial offset from religion
- Happiness: ×1.03 (religion)
- Apothecary: ×1.25, Health: ×1.03, LumberjacksHut: ×1.15, HuntingCabin: ×1.1 (all from culture)

---

## Part 5: Implementation Checklist (for when approved)

- [ ] Add `Religion` abstract class to `character.js` (parallel to `Culture`)
- [ ] Add 6 `Religion` subclasses: `CelticPagan`, `GermanPagan`, `Christianity`, `RomanPagan`, `CelticChristianity`, `NorsePagan`
- [ ] Add 3 `Culture` subclasses: `Byzantine`, `Germanic`, `Viking`
- [ ] Add `religion` property to `Character` constructor; activate/deactivate religious traits alongside cultural traits
- [ ] Add `CULTURE_RELIGION_COMPATIBILITY` map (culture class → allowed religion classes + default)
- [ ] Update `CharacterComponent` to show religion dropdown (editable for player, display-only for NPCs)
- [ ] Add optional `playerReligion` field to scenario config shape (same pattern as `playerTraits` — pre-fills character editor state, not shown in scenario selector UI; player can still change it)
- [ ] Update `_applyScenario()` in `game.js` to handle `playerReligion`
- [ ] Update NPC character construction to assign a random religion from allowed set
- [ ] Add new `Culture`/`Religion` classes to `CLASS_MAP` in `save_load.js`
- [ ] Update all relevant `knowledge.md` files

---

## Open Questions (resolved)

| # | Question | Answer |
|---|---|---|
| 1 | Rebellion mechanic for Byzantine/Germanic | Modify `support` directly (not `totalRebellionSupport` or `legitimacy`) |
| 2 | Byzantine trade boost: flat or multiplier? | Multiplier (×1.2 on `tradeFactor`) |
| 3 | Germanic legitimacy balance | Higher base legitimacy (+0.15 flat) but support multiplier (×0.9) makes things spiral when bad |
| 4 | Viking legitimacy stacking | "Legitimacy Through Blood" only on culture (−0.08), not on Norse Pagan religion |
| 5 | Vikings and Christianity | Allowed |
| 6 | Religion UI | Dropdown in `CharacterComponent`, same as culture |
| 7 | German Pagan vs Celtic Pagan | Identical effects, separate classes for future divergence |
| 8 | "Warrior Society" — one trait or two? | One trait, two effects |
| 9 | NPC religions | Randomly assigned from culture's allowed set |
| 10 | Scenario integration | `playerReligion` field in scenario config pre-fills character editor (not shown in scenario selector UI — religion is always set via the character editor dropdown) |
