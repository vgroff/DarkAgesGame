# Dark Ages — MVP Design Document

> **How to use this document**: Each section is a self-contained task. Developer responses have been incorporated into the spec. Sections marked `[APPROVED]`, `[REJECTED]`, or `[DEFER]` are final. Remaining open questions are marked `[QUESTION]`.

> **UI transparency principle** `[APPROVED]`: All military stats, skill checks, and battle calculations must be exposed as named `Variable`s with `explanation` strings, displayed via `VariableComponent` / `CustomTooltip` in the UI. The player should be able to hover over any number and understand exactly what is contributing to it. Light flavour text accompanies each battle phase. This applies to: army strength, mobilised strength, strategy modifier, ground advantage, bow/melee casualty rates, and the final success chance.

---

## 0. Quick Wins / Bugs to Fix First `[APPROVED]`

### 0.1 Uncomment the settlement events

**File**: [`settlement.js`](dark_ages/src/game_logic/settlement/settlement.js:253)

All six settlement events were commented out — confirmed debug leftover. Uncomment all of them.

```js
this.settlementEvents = [
    new CropBlight({settlements: [this], timer: this.gameClock}),
    new LocalMiracle({settlements: [this], timer: this.gameClock}),
    new MineShaftCollapse({settlements: [this], timer: this.gameClock}),
    new Fire({settlements: [this], timer: this.gameClock}),
    new Pestilence({settlements: [this], timer: this.gameClock}),
    new WolfAttack({settlements: [this], timer: this.gameClock}),
    new CourtIntrigue({settlements: [this], timer: this.gameClock}),
];
```

**Firing rate check** (before uncommenting, verify these are not absurd):

| Event | checkEveryAvg | Fire chance | Expected gap |
|-------|--------------|-------------|--------------|
| CropBlight | 1 year (12 ticks) | 20% | ~5 years |
| LocalMiracle | 4 years | 25% | ~16 years |
| MineShaftCollapse | 2 years | 20% (if mine exists) | ~10 years |
| Fire | 3 years | 25% | ~12 years |
| Pestilence | 4 years | 25% | ~16 years |
| WolfAttack | 3 years | 25% | ~12 years |
| CourtIntrigue | 3.5 years | 35% | ~10 years |

These are reasonable. With 7 events per settlement and 2 settlements, expect roughly 1–2 events per in-game year total. Fine for MVP — tune after playtesting.

---

### 0.2 Game over hard stop `[APPROVED]`

**File**: [`game.js`](dark_ages/src/game_logic/game.js:163)

```js
handleRebellion(settlement) {
    this.addGameMessage(`${settlement.name} has rebelled! You have lost control of this settlement.`);
    if (this.playerCharacter.settlements.length === 0) {
        this.addGameMessage(`You have lost control of all your settlements! Game over.`);
        this.gameClock.forceStopTimer("game over");
        this.isGameOver = true;
    }
}
```

In `GameUI.childRender()`, check `game.isGameOver` and render a simple modal overlay with "Game Over" and a "New Game" button (which reloads the page or re-constructs a `Game` instance).

---

## 1. NPC Settlement AI `[APPROVED]`

**Approach**: Option B (productivity buffer) + Option A (health/happiness floor) + productivity floor.

**File**: [`game.js`](dark_ages/src/game_logic/game.js) — add after settlements are constructed.

```js
// NPC settlement: prevent death spiral and offset lack of management
const npcSettlement = this.settlements[1];

// Floor on happiness and health (prevents collapse)
const npcHappinessFloor = new Variable({ name: "NPC happiness floor", startingValue: 0.35 });
const npcHealthFloor    = new Variable({ name: "NPC health floor",    startingValue: 0.6  });
npcSettlement.happiness.addModifier(
    new VariableModifier({ variable: npcHappinessFloor, type: max, name: "NPC AI floor" })
);
npcSettlement.health.addModifier(
    new VariableModifier({ variable: npcHealthFloor, type: max, name: "NPC AI floor" })
);

// Productivity buffer (offsets poor management) + hard floor
npcSettlement.generalProductivity.addModifier(
    new VariableModifier({
        name: "NPC AI productivity buffer",
        startingValue: 1.15,
        type: multiplication,
        customPriority: 198   // before roundTo at 200
    })
);
npcSettlement.generalProductivity.addModifier(
    new VariableModifier({
        name: "NPC AI productivity floor",
        startingValue: 0.8,
        type: max,
        customPriority: 199   // after buffer, before roundTo
    })
);
```

**Why these numbers**:
- `health floor 0.6`: at this health, the invLogit curve (speed=3.5, bias=0.35, scale=0.65) gives `≈0.9` productivity contribution — NPC runs at ~90% health-adjusted productivity.
- `happiness floor 0.35`: invLogit (speed=4, bias=0.75, scale=0.25) gives `≈0.93` — small but not negligible.
- `1.15 buffer`: partially offsets the worst-case combined penalty (~0.65) without making the NPC invincible.
- `0.8 floor`: hard safety net. Even if everything goes wrong, the NPC doesn't become useless.
- `customPriority 198/199`: both apply after all `addition` (priority 1) and `multiplication` (priority 3) modifiers from rationing, but before the `roundTo` at 200.

### 1.1 NPC Auto-Research `[APPROVED]`

The NPC faction should automatically research the cheapest available item each year.

**File**: [`game.js`](dark_ages/src/game_logic/game.js) — add a `gameClock` subscription after construction:

```js
// NPC auto-research: buy cheapest available item each year
this.gameClock.subscribe(() => {
    if (this.gameClock.currentValue % daysInYear !== 0) return;
    const npcFaction = char2.faction;
    if (!npcFaction) return;
    // Flatten all research items across all categories
    const allItems = Object.values(npcFaction.researchTree).flat();
    // Filter to items that can be researched
    const available = allItems.filter(item => npcFaction.canResearch(item));
    if (available.length === 0) return;
    // Pick cheapest
    available.sort((a, b) => a.researchCost - b.researchCost);
    npcFaction.activateResearch(available[0]);
});
```

**Note**: `char2` needs to be stored on `this` (i.e. `this.npcCharacter = char2`) so the subscription closure can reference it. Currently it's a local variable.

---

## 2. Paradox-Style Warnings `[APPROVED]`

A persistent warning banner rendered between the HUD and the main panel in `GameUI`, plus a one-time pop-up (via `game.addGameMessage`) the first time each warning triggers.

**Warnings**:

| Warning | Condition | Colour |
|---------|-----------|--------|
| Homeless | `settlement.homeless.currentValue > 0` | Orange |
| Unemployed | `settlement.unemployed.currentValue > 0` | Yellow |
| Rebellion risk | `settlement.totalRebellionSupport.currentValue > 0.3` | Red |
| Starvation | food `rationAchieved.currentValue < idealRation.currentValue * 0.5` | Red |
| Bankruptcy | `game.bankrupt.currentValue === 1` | Red |

The component receives `game` and `selected` as props from `GameUI`. Subscribes to `internalTimer`. No new Variables needed.

**First-time pop-up tracking**: Add a `game.warningsShown = new Set()` and check before calling `addGameMessage`. Key by warning name + settlement name.

---

## 3. Events

### 3.1 Uncomment existing events — see §0.1 `[APPROVED]`

### 3.2 Pestilence — severity system `[APPROVED]`

**Current state**: `getBonuses()` already rolls a `successToNumber` to vary `healthDamage` between 0.05 and 0.35. This is good. The "permanent" note in the original handwritten notes was likely a reaction to `TemporaryModifierBonus.deactivate()` being a no-op — the modifier persisted even after the event ended, which felt permanent.

**Proposed change**: Keep it as a `HealthBonus` (permanent multiplicative modifier, removed when event ends) but make the severity more visible to the player. Add a hidden `severity` roll (1–3) at fire time that scales both the penalty and the duration.

**In `Pestilence.getBonuses()`**:
```js
getBonuses() {
    // Roll severity 1-3 (hidden from player — they just see the effects)
    this.severity = Math.ceil(Math.random() * 3); // 1=mild, 2=moderate, 3=severe
    
    // Base health damage scaled by severity
    // severity 1: 0.05–0.12, severity 2: 0.10–0.22, severity 3: 0.18–0.35
    const severityScale = [0.6, 1.0, 1.6][this.severity - 1];
    const success = rollSuccess(0.5);
    const successNumber = successToNumber(success, 2); // -3, -1, 1, 3
    const healthDamage = Math.min(0.35, Math.max(0.05, 0.07 * (2 - 0.7 * successNumber) * severityScale));
    
    // Duration also scales with severity: 0.5, 0.65, 0.85 years
    const durationScale = [0.5, 0.65, 0.85][this.severity - 1];
    this.eventDuration.setNewBaseValue(
        Math.round(daysInYear * durationScale),
        'pestilence severity'
    );
    
    return [new HealthBonus({
        name: "pestilence",
        amount: 1 - healthDamage,
    })];
}
```

**Choices remain the same** (do nothing / quarantine / full quarantine) — the quarantine choices reduce duration via `ChangeEventDuration`, which now interacts meaningfully with the severity-scaled duration.

**Flavour text**: Add `this.bonusFlavourText` based on severity so the player gets a hint: "A mild illness is spreading through the settlement" / "A serious pestilence has broken out" / "A devastating plague has struck".

### 3.3 New events `[APPROVED]`

#### Warm Spell

```js
export class WarmSpell extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "warm spell",
            checkEveryAvg: daysInYear * 2,
            variance: 0.4,
            eventDuration: daysInYear / 2,
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [
            new TemporaryHappinessBonus({
                name: "warm spell happiness",
                amount: 0.08,
                duration: this.eventDuration.currentValue,
                timer: this.timer
            }),
            // Reduce coal demand: add a negative modifier to coal idealAmount
            // This is handled directly on the settlement's popDemands.coal.idealAmount
            // See implementation note below
        ];
    }
}
```

**Coal demand reduction**: `TemporaryModifierBonus` doesn't support arbitrary Variable targets. The cleanest approach is to add a `fire_()` override that directly adds a `VariableModifier` to `settlement.popDemands.coal.idealAmount` and stores it for removal in `end_()`. This is the same pattern as `adjustCoalDemand()`.

```js
fire_() {
    // Standard bonus application
    let bonuses = this.getBonuses();
    bonuses.forEach(bonus => {
        bonus.setOrigin("Event:" + this.name);
        this.settlements.forEach(s => s.activateBonus(bonus));
    });
    this.lastBonuses = bonuses;
    // Coal demand reduction
    this._coalModifier = new VariableModifier({
        name: "warm spell coal reduction",
        startingValue: -0.4,
        type: addition
    });
    this.settlements.forEach(s => {
        s.popDemands.coal.idealAmount.addModifier(this._coalModifier);
    });
}
end_() {
    this.deactivateBonusesAndEventEffects();
    if (this._coalModifier) {
        this.settlements.forEach(s => {
            s.popDemands.coal.idealAmount.removeModifier(this._coalModifier);
        });
        this._coalModifier = null;
    }
}
```

#### Merchant Boom

```js
export class MerchantBoom extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "merchant boom",
            checkEveryAvg: daysInYear * 3,
            variance: 0.35,
            eventDuration: Math.round(daysInYear / 3),
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SimpleSettlementModifier({
            name: "merchant boom trade factor",
            variableAccessor: "tradeFactor",
            amount: 0.3,
            type: addition
        })];
    }
}
```

#### Hunting Game Surplus / Dry Hunting Lands

```js
export class HuntingGameSurplus extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "hunting game surplus",
            checkEveryAvg: daysInYear * 2,
            variance: 0.4,
            eventDuration: daysInYear / 2,
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SpecificBuildingProductivityBonus({
            name: "hunting game surplus",
            building: HuntingCabin.name,
            amount: 1.3
        })];
    }
}

export class DryHuntingLands extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "dry hunting lands",
            checkEveryAvg: daysInYear * 2.5,
            variance: 0.4,
            eventDuration: Math.round(daysInYear * 0.65),
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SpecificBuildingProductivityBonus({
            name: "dry hunting lands",
            building: HuntingCabin.name,
            amount: 0.5
        })];
    }
}
```

#### Blizzard

Developer note: should affect farm productivity and lower general productivity by ~15%. Hook into the season system.

```js
export class Blizzard extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "blizzard",
            checkEveryAvg: daysInYear,
            variance: 0.3,
            eventDuration: 3,
            ...props
        });
    }
    eventShouldFire_() {
        // Only fires in winter
        if (this.timer.translatedTime.season !== winter) return false;
        return successToTruthy(rollSuccess(0.2));
    }
    getEventChoices() { return []; }
    getBonuses() {
        return [
            // Farm productivity hit (frozen ground)
            new SpecificBuildingProductivityBonus({
                name: "blizzard farm penalty",
                building: Farm.name,
                amount: 0.75
            }),
            // General productivity hit (people can't work properly)
            new GeneralProductivityBonus({
                name: "blizzard productivity penalty",
                amount: 0.85
            })
        ];
    }
    fire_() {
        let bonuses = this.getBonuses();
        bonuses.forEach(bonus => {
            bonus.setOrigin("Event:" + this.name);
            this.settlements.forEach(s => s.activateBonus(bonus));
        });
        this.lastBonuses = bonuses;
        // Increase coal demand
        this._coalModifier = new VariableModifier({
            name: "blizzard coal demand",
            startingValue: 1.0,
            type: addition
        });
        // Reduce trade factor
        this._tradeModifier = new VariableModifier({
            name: "blizzard trade penalty",
            startingValue: -0.5,
            type: addition
        });
        this.settlements.forEach(s => {
            s.popDemands.coal.idealAmount.addModifier(this._coalModifier);
            s.tradeFactor.addModifier(this._tradeModifier);
        });
    }
    end_() {
        this.deactivateBonusesAndEventEffects();
        this.settlements.forEach(s => {
            if (this._coalModifier) s.popDemands.coal.idealAmount.removeModifier(this._coalModifier);
            if (this._tradeModifier) s.tradeFactor.removeModifier(this._tradeModifier);
        });
        this._coalModifier = null;
        this._tradeModifier = null;
    }
}
```

**Note on `seasonToTempFactor`**: The existing `adjustCoalDemand()` already uses `seasonToTempFactor` to set coal demand. The blizzard adds on top of that — in winter the base coal demand is already 1.5, blizzard pushes it to 2.5. This is intentional.

#### Rats in Storage

```js
export class RatsInStorage extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "rats in storage",
            checkEveryAvg: daysInYear * 2,
            variance: 0.5,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.2)); }
    getEventChoices() { return []; }
    getBonuses() {
        const settlement = this.settlements[0];
        const foodStorage = settlement.resourceStorages.find(rs => rs.resource.name === 'food');
        const currentFood = foodStorage ? foodStorage.amount.baseValue : 0;
        const foodLost = Math.round(currentFood * (0.1 + 0.1 * Math.random())); // 10–20%
        this.bonusFlavourText = `Rats got into the food stores and ate ${foodLost} units of food.`;
        // Direct oneOffDemand — not a bonus, applied immediately in fire_()
        this._foodLost = foodLost;
        return [];
    }
    fire_() {
        this.getBonuses(); // sets this._foodLost and bonusFlavourText
        const settlement = this.settlements[0];
        const foodStorage = settlement.resourceStorages.find(rs => rs.resource.name === 'food');
        if (foodStorage && this._foodLost > 0) {
            foodStorage.oneOffDemand(this._foodLost, 'rats in storage');
        }
        this.lastBonuses = [];
    }
    end_() { /* nothing to clean up */ }
}
```

#### Nomads Arrive `[APPROVED — modified]`

Three choices: take them in, send them away, rob them (if army is strong enough).

```js
export class NomadsArrive extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "nomads arrive",
            checkEveryAvg: daysInYear * 3,
            variance: 0.4,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
        this.nomadGroupSize = 0;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getBonuses() { return []; }
    getEventChoices() {
        const settlement = this.settlements[0];
        this.nomadGroupSize = Math.round(5 + Math.random() * 10); // 5–15 nomads
        const choices = [
            new EventChoice({name: `Take them in (+${this.nomadGroupSize} population)`, effects: [
                new ChangePopulationBonus({ name: "nomads taken in", amount: this.nomadGroupSize }),
                new TemporaryHappinessBonus({
                    name: "disruption from nomads", amount: -0.05,
                    duration: Math.round(daysInYear * 0.25), timer: this.timer
                }),
                new TemporaryLocalLegitimacyBonus({
                    name: "nobles unhappy about nomads", amount: -0.03,
                    duration: Math.round(daysInYear * 0.2), timer: this.timer
                })
            ]}),
            new EventChoice({name: "Send them away", effects: []})
        ];
        // Rob them — only available if army strength is sufficient
        const armyStrength = settlement.armyStrength ? settlement.armyStrength.currentValue : 0;
        const robThreshold = this.nomadGroupSize * 1.5; // need a decent army
        if (armyStrength >= robThreshold) {
            const goldGained = Math.round(this.nomadGroupSize * 2);
            choices.push(new EventChoice({name: `Rob them (gain ~${goldGained} gold, reduces future nomad visits)`, effects: [
                // Gold gain handled in applyChoice override — see implementation note
                new TemporaryLocalLegitimacyBonus({
                    name: "reputation for robbing nomads", amount: -0.04,
                    duration: daysInYear * 2, timer: this.timer
                })
            ]}));
            this._robGold = goldGained;
        }
        return choices;
    }
    // Override applyChoice to handle gold gain and event ban for robbing
    applyChoice(eventChoice) {
        super.applyChoice(eventChoice);
        if (eventChoice.name.startsWith("Rob them")) {
            // Gold gain — needs access to game.addToTreasury
            // Pass addToTreasury as a prop to the event, same pattern as Settlement
            if (this.addToTreasury) {
                this.addToTreasury(this._robGold, 'robbed nomads');
            }
            // Reduce future nomad visits
            this.setEventBan(daysInYear * 2);
        }
    }
}
```

**Implementation note**: `NomadsArrive` needs `addToTreasury` passed as a prop (same pattern as `Settlement`). Add it when constructing the event in `settlement.js`.

---

## 4. Military System

### 4.1 Military unit types `[APPROVED — modified]`

Units are **weapons converted to armed soldiers** (stockpile approach). Resources represent the armed soldiers, not the weapons themselves. The player explicitly converts weapons → soldiers. Weapons are named by type, not by soldier type.

**New entries in `Resources`** ([`resource.js`](dark_ages/src/game_logic/settlement/resource.js)):

```js
// Stone weapon soldiers (weakest)
stoneSpears:    new Resource({ name: "stone spears",    storageMultiplier: 50, productionRatio: 1, cumulates: true, description: "Armed with stone spears (1 stone weapon each). Attack: 0.6" }),
stoneSwords:    new Resource({ name: "stone swords",    storageMultiplier: 30, productionRatio: 1, cumulates: true, description: "Armed with stone swords (2 stone weapons each). Attack: 0.9" }),

// Iron weapon soldiers
ironSpears:     new Resource({ name: "iron spears",     storageMultiplier: 50, productionRatio: 1, cumulates: true, description: "Armed with iron spears (1 iron weapon each). Attack: 1.2" }),
ironSwords:     new Resource({ name: "iron swords",     storageMultiplier: 30, productionRatio: 1, cumulates: true, description: "Armed with iron swords (2 iron weapons each). Attack: 1.8" }),

// Steel weapon soldiers (best melee)
steelSpears:    new Resource({ name: "steel spears",    storageMultiplier: 50, productionRatio: 1, cumulates: true, description: "Armed with steel spears (1 steel weapon each). Attack: 2.0" }),
steelShortSwords: new Resource({ name: "steel short swords", storageMultiplier: 25, productionRatio: 1, cumulates: true, description: "Armed with short swords (4 steel weapons each). Attack: 4.0" }),
steelLongSwords:  new Resource({ name: "steel long swords",  storageMultiplier: 10, productionRatio: 1, cumulates: true, description: "Armed with long swords (10 steel weapons each). Attack: 10.0" }),

// Bow soldiers
shortbowmen:    new Resource({ name: "shortbowmen",     storageMultiplier: 50, productionRatio: 1, cumulates: true, description: "Armed with shortbows (1 bow each). Attack: 1.2" }),
warbowmen:      new Resource({ name: "warbowmen",       storageMultiplier: 25, productionRatio: 1, cumulates: true, description: "Armed with warbows (3 bows each). Attack: 2.5" }),
longbowmen:     new Resource({ name: "longbowmen",      storageMultiplier: 10, productionRatio: 1, cumulates: true, description: "Armed with longbows (5 bows each). Attack: 4.0" }),
```

**Conversion costs** (weapons consumed per soldier):

| Unit | Weapon source | Cost |
|------|--------------|------|
| stone spears | stoneWeaponry | 1 |
| stone swords | stoneWeaponry | 2 |
| iron spears | ironWeaponry | 1 |
| iron swords | ironWeaponry | 2 |
| steel spears | steelWeaponry | 1 |
| steel short swords | steelWeaponry | 4 |
| steel long swords | steelWeaponry | 10 |
| shortbowmen | bows | 1 |
| warbowmen | bows | 3 |
| longbowmen | bows | 5 |

**Attack values** are chosen so that upgrading is always worth it per-weapon: 1 iron weapon → 1.2 attack vs 1 stone weapon → 0.6 attack. Steel is roughly 2× iron.

### 4.2 Army strength Variable `[APPROVED — modified]`

Army strength is a `Variable` that sums all unit counts weighted by their attack value. Units are added as `VariableModifier`s dynamically when the player arms soldiers (and removed when disarmed). Strategy modifies the total via an invLogit curve.

**In `Settlement` constructor** (after military resources are set up):

```js
// Army strength: sum of (unit count × attack value), modified by leader strategy
this.armyStrength = new Variable({ name: "Army strength", owner: this, startingValue: 0 });

// Strategy modifier: invLogit centred at 0.5, speed 3
// At strategy=0.5: ×1.0 (neutral). At strategy=1.0: ×~1.25. At strategy=0.1: ×~0.8
// bias=0.75, scale=0.25 → range 0.75..1.0 from invLogit, then we want 0.8..1.25
// Use: bias=0.8, scale=0.45, speed=3, midpoint=0.5
this.armyStrengthStrategyModifier = new VariableModifier({
    name: "strategy army modifier",
    type: multiplication,
    startingValue: 0,
    modifiers: [
        new VariableModifier({ variable: this.leader.strategy, type: addition }),
        new VariableModifier({
            type: invLogit,
            invLogitSpeed: 3,
            bias: 0.8,
            scale: 0.45,
            startingValue: 0.5,  // midpoint
            customPriority: priority.exponentiation + 1
        })
    ]
});
this.armyStrength.addModifier(this.armyStrengthStrategyModifier);
```

When the player arms soldiers (e.g. converts 5 iron weapons → 5 iron spears), the UI calls:
```js
// settlement.armSoldiers(unitResource, count)
armSoldiers(unitResource, count) {
    const weaponCost = UNIT_WEAPON_COSTS[unitResource.name]; // { resource, amount }
    const weaponStorage = this.resourceStorages.find(rs => rs.resource === weaponCost.resource);
    if (weaponStorage.amount.baseValue < weaponCost.amount * count) return false;
    weaponStorage.oneOffDemand(weaponCost.amount * count, `arm ${unitResource.name}`);
    const unitStorage = this.resourceStorages.find(rs => rs.resource === unitResource);
    unitStorage.amount.setNewBaseValue(unitStorage.amount.baseValue + count, `arm ${unitResource.name}`);
    // Add attack modifier to armyStrength
    const attackValue = UNIT_ATTACK_VALUES[unitResource.name];
    const modifier = new VariableModifier({
        name: `${unitResource.name} attack`,
        startingValue: attackValue * count,
        type: addition
    });
    this.armyStrength.addModifier(modifier);
    // Store modifier reference for disarming
    this._unitModifiers = this._unitModifiers || {};
    this._unitModifiers[unitResource.name] = this._unitModifiers[unitResource.name] || [];
    this._unitModifiers[unitResource.name].push({ modifier, count });
    return true;
}
```

**`UNIT_ATTACK_VALUES`** and **`UNIT_WEAPON_COSTS`** are constants defined alongside the Resources.

### 4.3 Military tab in SettlementComponent `[APPROVED]`

New 4th tab: **Military**. Shows:
- Weapon stockpiles (stone/iron/steel weaponry, bows) with current amounts
- Conversion section: for each unit type, show current count, "Arm N" button (disabled if insufficient weapons), "Disarm N" button
- Total army strength (`VariableComponent` for `armyStrength`)
- Active bandit threat indicator (if `BanditRaid` event is active)

### 4.4 Mobilisation `[APPROVED]`

At raid time, civilians can be mobilised. Calculated at the moment of the raid:

```js
getMobilisedStrength(settlement) {
    const pop = settlement.populationSizeExternal.currentValue;
    const mobilisedProp = 0.30; // 30% of population can be called up
    // Legitimacy modifier: range 0.7–1.0 (slightly modified, not dominant)
    const legitimacyMod = 0.7 + 0.3 * Math.min(1, settlement.localLegitimacy.currentValue);
    const effectiveMobilised = Math.floor(pop * mobilisedProp * legitimacyMod);
    // Unarmed civilians contribute 0.5 attack each
    return effectiveMobilised * 0.5;
}
```

**Justification**: At starting legitimacy 0.1, `legitimacyMod = 0.73` — 73% turnout. At legitimacy 1.0, 100% turnout. The difference is ~8 people at pop 37, which is meaningful but not decisive. The 0.5 attack per civilian represents an untrained mob — useful in numbers but weak individually.

---

## 4.5 Battle System — Generic Multi-Stage Combat `[APPROVED]`

The battle system is designed as a **generic reusable mechanic** that can be passed any two armies. The `BanditRaid` event uses it, and future military events (sieges, wars) will too.

---

### Battle flow — event-driven phases

**The battle is not resolved in one go.** Each phase is a separate `forcePause` event that the player must respond to before the game advances. This means the battle unfolds as a sequence of modals, each showing the current state (army strengths, ground advantage, casualties so far) and offering the player a choice.

The flow is:

```
[BanditRaid fires]
    → Player chooses "Fight them off"
    → BattleSkirmish event fires (forcePause)
        → Shows: both bow strengths, ground advantage, projected casualties
        → Strategy check resolves automatically (no player input — just shown)
        → Bow exchange resolves, casualties applied
        → Player choices:
            A) "Move in" → triggers BattleClash event
            B) "Continue skirmishing" → triggers another BattleSkirmish event
            C) "Flee" → triggers raid (worse outcome)

    → [If "Move in" chosen]:
        → BattleClash event fires (forcePause)
            → Shows: melee strengths, bow support (reduced), ground advantage, projected casualties
            → Melee exchange resolves
            → Player choices:
                A) "Attempt a manoeuvre" (strategy check — see below)
                B) "Hold the line" → another BattleClash round
                C) "Flee" → triggers raid (worse outcome)
            → Repeat until one side is destroyed or flees

    → [Battle ends]:
        → Victory: weapons recovered, aftermath bonuses applied
        → Defeat/flee: weapons lost, raid effects applied, aftermath penalties applied
```

**Maximum rounds**: 8 total (skirmish + clash combined). After round 8, the weaker side (lower `totalStrength`) flees automatically. This prevents infinite battles.

**Bandits flee automatically** when their `totalStrength` drops below 20% of their starting value — they don't wait for the player to finish them off.

**Bandits move in automatically** when their `bowCount` reaches 0 — they have no reason to stay in the skirmish phase. This is not a player choice; it happens at the start of the next round. Flavour text: "With no archers left, the enemy charges." The player still gets to choose their response (hold the line, manoeuvre, or flee) but the phase transition is forced.

---

### Strategy's role at each step

Strategy (`settlement.leader.strategy`, range 0–1) affects the battle in three distinct ways:

1. **Ground advantage check** (on the first skirmish round, automatically): Both sides roll `rollSuccess(strategySkill)`. The delta between results shifts `groundAdvantage` by ±0.15 to ±0.225. A high-strategy leader consistently wins these checks, accumulating ground advantage that amplifies bow effectiveness.

2. **Army strength multiplier** (persistent, from §4.2): `armyStrength` has an invLogit strategy modifier (bias=0.8, scale=0.45, speed=3, midpoint=0.5). At strategy=0.5: ×1.025 (near-neutral). At strategy=1.0: ×1.25. At strategy=0.1: ×0.80. This is always visible in the Military tab before the battle starts.

3. **Manoeuvre check** (player-initiated, clash phase only): The player can choose "Attempt a manoeuvre" instead of "Hold the line". This triggers a `rollSuccess(strategySkill)` check:
   - Major success: `groundAdvantage += 0.25` ("Your general executed a brilliant flanking move.")
   - Success: `groundAdvantage += 0.15` ("Your forces found a better position.")
   - Failure: `groundAdvantage -= 0.05` ("The manoeuvre was disrupted.")
   - Major failure: `groundAdvantage -= 0.15` ("The manoeuvre backfired — your lines are exposed.")
   
   The manoeuvre option is always available but risky at low strategy. The success chance is shown as a `Variable` with tooltip before the player commits.

---

### The move-in penalty

When the player chooses "Move in" (transitioning from skirmish to clash phase), **the player's bow strength is penalised for the first clash round** because archers must stop firing to avoid hitting their own infantry:

- Player bow effectiveness in the first clash round: ×0.2 (instead of the normal ×0.4 vs infantry)
- Enemy bow effectiveness in the first clash round: ×0.5 (they can still fire freely at the advancing infantry)

This penalty only applies to the **first clash round**. From round 2 onward, both sides use the standard ×0.4 vs-infantry rate.

**Flavour text**: "Your archers hold their fire as your infantry advances into the fray."

This creates a meaningful decision: staying in the skirmish phase is safer if you have strong bows, but you can never win by skirmishing alone (the enemy won't flee from bow fire alone — only from melee defeat or reaching the 20% strength threshold).

---

### UI transparency principle (applies throughout this section)

Every stat shown during a battle must be a named `Variable` rendered via `VariableComponent` or `CustomTooltip`. The player must be able to hover over any number and see exactly what is contributing to it. Flavour text accompanies each phase. Specifically:

- **`playerBowStrength`**, **`playerMeleeStrength`**, **`playerTotalStrength`** — Variables with named modifiers for each unit type and the strategy multiplier
- **`groundAdvantage`** — Variable, shown as a labelled bar or ±% value; tooltip explains which strategy roll produced it
- **`effectiveBowStrength`** — Variable = bowStrength × (1 + groundAdvantage); tooltip shows the ground advantage contribution
- **`casualtyRate`** — Variable shown as a percentage; tooltip shows enemy strength vs total strength
- **`successChance`** (for the final fight-or-flee roll) — Variable with tooltip showing all modifiers

All of these are constructed fresh at the start of each battle and discarded after. They are not stored on the settlement permanently.

---

### Core data structures

```js
// BattleArmy — constructed at battle start, holds Variables for UI display
class BattleArmy {
    constructor({ name, settlement, isPlayer }) {
        this.name = name;
        this.isPlayer = isPlayer;

        // Bow strength: sum of bow unit Variables × attack values
        // Each unit type contributes a named VariableModifier so the tooltip is readable
        this.bowStrength = new Variable({ name: `${name} bow strength`, startingValue: 0 });
        // (modifiers added per unit type in buildPlayerArmy / buildBanditArmy)

        // Melee strength: armed soldiers + mobilised civilians
        this.meleeStrength = new Variable({ name: `${name} melee strength`, startingValue: 0 });

        // Total strength = bow + melee (used for casualty rate calculation)
        this.totalStrength = new Variable({ name: `${name} total strength`, startingValue: 0, modifiers: [
            new VariableModifier({ variable: this.bowStrength,   type: addition }),
            new VariableModifier({ variable: this.meleeStrength, type: addition }),
        ]});

        // Unit counts (plain numbers, updated as casualties occur)
        this.bowCount   = 0;
        this.meleeCount = 0;

        // Strategy skill (Variable so it can be shown in tooltip)
        this.strategySkill = new Variable({ name: `${name} leader strategy`, startingValue: 0 });
    }
}

// BattleState — passed between rounds
// {
//   playerArmy: BattleArmy,
//   enemyArmy: BattleArmy,
//   groundAdvantage: Variable,  // -0.5..+0.5, positive = player advantage
//   phase: 'skirmish' | 'clash',
//   round: number,
//   log: string[]               // flavour text log shown in the battle UI
// }
```

---

### Building the player army

```js
function buildPlayerArmy(settlement) {
    const army = new BattleArmy({ name: settlement.name, settlement, isPlayer: true });

    // Bow strength: each unit type adds a named modifier
    const BOW_UNITS = [
        { name: 'shortbowmen', attack: 1.2 },
        { name: 'warbowmen',   attack: 2.5 },
        { name: 'longbowmen',  attack: 4.0 },
    ];
    BOW_UNITS.forEach(({ name, attack }) => {
        const count = settlement.resourceStorages.find(rs => rs.resource.name === name)?.amount.baseValue || 0;
        if (count > 0) {
            army.bowStrength.addModifier(new VariableModifier({
                name: `${count} ${name} (×${attack} each)`,
                startingValue: count * attack,
                type: addition
            }));
            army.bowCount += count;
        }
    });

    // Melee strength: armed soldiers
    const MELEE_UNITS = [
        { name: 'stone spears', attack: 0.6 }, { name: 'stone swords', attack: 0.9 },
        { name: 'iron spears',  attack: 1.2 }, { name: 'iron swords',  attack: 1.8 },
        { name: 'steel spears', attack: 2.0 }, { name: 'steel short swords', attack: 4.0 },
        { name: 'steel long swords', attack: 10.0 },
    ];
    MELEE_UNITS.forEach(({ name, attack }) => {
        const count = settlement.resourceStorages.find(rs => rs.resource.name === name)?.amount.baseValue || 0;
        if (count > 0) {
            army.meleeStrength.addModifier(new VariableModifier({
                name: `${count} ${name} (×${attack} each)`,
                startingValue: count * attack,
                type: addition
            }));
            army.meleeCount += count;
        }
    });

    // Mobilised civilians: 30% of pop × legitimacy modifier, 0.5 attack each
    const pop = settlement.populationSizeExternal.currentValue;
    const legitimacyMod = 0.7 + 0.3 * Math.min(1, settlement.localLegitimacy.currentValue);
    const mobilised = Math.floor(pop * 0.30 * legitimacyMod);
    if (mobilised > 0) {
        army.meleeStrength.addModifier(new VariableModifier({
            name: `${mobilised} mobilised civilians (×0.5 each, legitimacy ${Math.round(legitimacyMod * 100)}%)`,
            startingValue: mobilised * 0.5,
            type: addition
        }));
        army.meleeCount += mobilised;
    }

    // Strategy: leader's strategy Variable feeds directly in
    army.strategySkill.addModifier(new VariableModifier({
        name: `${settlement.leader.name} strategy`,
        variable: settlement.leader.strategy,
        type: addition
    }));

    return army;
}
```

---

### Building the bandit army

```js
function buildBanditArmy(settlement) {
    const pop = settlement.populationSizeExternal.currentValue;
    const playerUnitCount = /* sum of all player unit counts */;
    const banditCount = Math.max(
        Math.floor(pop * 0.15),
        Math.floor(playerUnitCount * 0.8)
    );

    const spearCount = Math.floor(banditCount * 0.6);
    const bowCount   = Math.floor(banditCount * 0.3);
    const swordCount = banditCount - spearCount - bowCount;
    const banditStrategy = 0.1 + Math.random() * 0.15; // weak leader

    const army = new BattleArmy({ name: "Bandit Warband", isPlayer: false });

    army.bowStrength.addModifier(new VariableModifier({
        name: `${bowCount} bandit shortbowmen (×1.2 each)`,
        startingValue: bowCount * 1.2, type: addition
    }));
    army.meleeStrength.addModifier(new VariableModifier({
        name: `${spearCount} bandit spearmen (×1.0 each)`,
        startingValue: spearCount * 1.0, type: addition
    }));
    army.meleeStrength.addModifier(new VariableModifier({
        name: `${swordCount} bandit swordsmen (×2.0 each)`,
        startingValue: swordCount * 2.0, type: addition
    }));
    army.strategySkill.addModifier(new VariableModifier({
        name: `bandit leader strategy (poor)`,
        startingValue: banditStrategy, type: addition
    }));
    army.bowCount   = bowCount;
    army.meleeCount = spearCount + swordCount;

    return army;
}
```

---

### Battle phases

#### Phase 1 — Skirmish (archery exchange)

Each skirmish round produces a `groundAdvantage` Variable and `effectiveBowStrength` Variables that are shown in the UI.

```js
function resolveSkirmishRound(state) {
    const { playerArmy, enemyArmy } = state;

    // Step 1: Strategy check — who gets the high ground?
    // Both sides roll; the delta shifts groundAdvantage
    const playerStratRoll = rollSuccess(Math.min(0.85, Math.max(0.1, playerArmy.strategySkill.currentValue)));
    const enemyStratRoll  = rollSuccess(Math.min(0.85, Math.max(0.1, enemyArmy.strategySkill.currentValue)));
    const playerStratNum  = successToNumber(playerStratRoll, 0.5);  // -1.5, -1, +1, +1.5
    const enemyStratNum   = successToNumber(enemyStratRoll,  0.5);
    const groundDelta     = (playerStratNum - enemyStratNum) * 0.15; // ±0.15 to ±0.225 per round

    // groundAdvantage is a Variable so it can be displayed with tooltip
    state.groundAdvantage.setNewBaseValue(
        Math.max(-0.5, Math.min(0.5, state.groundAdvantage.currentValue + groundDelta)),
        `Round ${state.round}: your general rolled ${playerStratRoll}, enemy rolled ${enemyStratRoll}`
    );

    // Step 2: Effective bow strengths (Variables, shown in UI)
    // playerEffBow = bowStrength × (1 + groundAdvantage)
    const playerEffBow = new Variable({ name: "Your effective bow strength", startingValue: 0, modifiers: [
        new VariableModifier({ variable: playerArmy.bowStrength, type: addition }),
        new VariableModifier({
            name: `ground advantage (${state.groundAdvantage.currentValue >= 0 ? '+' : ''}${Math.round(state.groundAdvantage.currentValue * 100)}%)`,
            startingValue: 1 + state.groundAdvantage.currentValue,
            type: multiplication
        })
    ]});
    const enemyEffBow = new Variable({ name: "Enemy effective bow strength", startingValue: 0, modifiers: [
        new VariableModifier({ variable: enemyArmy.bowStrength, type: addition }),
        new VariableModifier({
            name: `ground disadvantage`,
            startingValue: 1 - state.groundAdvantage.currentValue,
            type: multiplication
        })
    ]});

    // Step 3: Casualty rates (Variables, shown as percentages in UI)
    const totalBow = playerEffBow.currentValue + enemyEffBow.currentValue + 5; // +5 dampens early carnage
    const playerBowCasualtyRate = new Variable({ name: "Your archer casualty rate", startingValue: 0, modifiers: [
        new VariableModifier({ name: "enemy bow pressure", startingValue: enemyEffBow.currentValue / totalBow, type: addition })
    ]});
    const enemyBowCasualtyRate = new Variable({ name: "Enemy archer casualty rate", startingValue: 0, modifiers: [
        new VariableModifier({ name: "your bow pressure", startingValue: playerEffBow.currentValue / totalBow, type: addition })
    ]});

    // Apply casualties (fractional accumulation)
    state.playerBowCasualties = (state.playerBowCasualties || 0) + playerArmy.bowCount * playerBowCasualtyRate.currentValue;
    state.enemyBowCasualties  = (state.enemyBowCasualties  || 0) + enemyArmy.bowCount  * enemyBowCasualtyRate.currentValue;
    const playerBowDead = Math.floor(state.playerBowCasualties);
    const enemyBowDead  = Math.floor(state.enemyBowCasualties);
    state.playerBowCasualties -= playerBowDead;
    state.enemyBowCasualties  -= enemyBowDead;

    // Update army counts and strengths
    if (playerBowDead > 0) {
        playerArmy.bowCount = Math.max(0, playerArmy.bowCount - playerBowDead);
        // Scale down bow strength proportionally
        const scale = playerArmy.bowCount / (playerArmy.bowCount + playerBowDead);
        playerArmy.bowStrength.setNewBaseValue(playerArmy.bowStrength.currentValue * scale, `${playerBowDead} archers lost`);
    }
    if (enemyBowDead > 0) {
        enemyArmy.bowCount = Math.max(0, enemyArmy.bowCount - enemyBowDead);
        const scale = enemyArmy.bowCount / (enemyArmy.bowCount + enemyBowDead);
        enemyArmy.bowStrength.setNewBaseValue(enemyArmy.bowStrength.currentValue * scale, `${enemyBowDead} archers lost`);
    }

    // Flavour text
    const groundText = groundDelta > 0 ? "Your general seized the high ground." :
                       groundDelta < 0 ? "The enemy took the better position." :
                       "Neither side gained a positional advantage.";
    state.log.push(`Skirmish round ${state.round}: ${groundText} ${playerBowDead} of your archers fell, ${enemyBowDead} enemy archers fell.`);

    state.round++;
    return state;
}
```

#### Phase 2 — Main Clash (melee)

Triggered when the player chooses "Move in" after a skirmish round.

```js
function resolveMeleeRound(state) {
    const { playerArmy, enemyArmy } = state;

    // Bows fire at infantry at 40% effectiveness (harder to hit armoured infantry)
    const playerBowVsMelee = new Variable({ name: "Your bows vs infantry", startingValue: 0, modifiers: [
        new VariableModifier({ variable: playerArmy.bowStrength, type: addition }),
        new VariableModifier({ name: "vs infantry penalty (×0.4)", startingValue: 0.4, type: multiplication }),
        new VariableModifier({ name: `ground advantage`, startingValue: 1 + state.groundAdvantage.currentValue, type: multiplication })
    ]});
    const enemyBowVsMelee = new Variable({ name: "Enemy bows vs infantry", startingValue: 0, modifiers: [
        new VariableModifier({ variable: enemyArmy.bowStrength, type: addition }),
        new VariableModifier({ name: "vs infantry penalty (×0.4)", startingValue: 0.4, type: multiplication }),
        new VariableModifier({ name: `ground disadvantage`, startingValue: 1 - state.groundAdvantage.currentValue, type: multiplication })
    ]});

    // Total attack Variables — shown in UI with full breakdown
    const playerTotalAttack = new Variable({ name: "Your total attack this round", startingValue: 0, modifiers: [
        new VariableModifier({ variable: playerArmy.meleeStrength, type: addition, name: "melee strength" }),
        new VariableModifier({ variable: playerBowVsMelee,         type: addition, name: "bow support" }),
    ]});
    const enemyTotalAttack = new Variable({ name: "Enemy total attack this round", startingValue: 0, modifiers: [
        new VariableModifier({ variable: enemyArmy.meleeStrength, type: addition, name: "melee strength" }),
        new VariableModifier({ variable: enemyBowVsMelee,         type: addition, name: "bow support" }),
    ]});

    const totalAttack = playerTotalAttack.currentValue + enemyTotalAttack.currentValue + 10; // +10 dampens carnage

    // Casualty rate Variables — shown as percentages
    const playerMeleeCasualtyRate = new Variable({ name: "Your casualty rate", startingValue: 0, modifiers: [
        new VariableModifier({ name: "enemy attack pressure", startingValue: enemyTotalAttack.currentValue / totalAttack, type: addition })
    ]});
    const enemyMeleeCasualtyRate = new Variable({ name: "Enemy casualty rate", startingValue: 0, modifiers: [
        new VariableModifier({ name: "your attack pressure", startingValue: playerTotalAttack.currentValue / totalAttack, type: addition })
    ]});

    // Apply casualties (fractional accumulation)
    state.playerMeleeCasualties = (state.playerMeleeCasualties || 0) + playerArmy.meleeCount * playerMeleeCasualtyRate.currentValue;
    state.enemyMeleeCasualties  = (state.enemyMeleeCasualties  || 0) + enemyArmy.meleeCount  * enemyMeleeCasualtyRate.currentValue;
    const playerMeleeDead = Math.floor(state.playerMeleeCasualties);
    const enemyMeleeDead  = Math.floor(state.enemyMeleeCasualties);
    state.playerMeleeCasualties -= playerMeleeDead;
    state.enemyMeleeCasualties  -= enemyMeleeDead;

    if (playerMeleeDead > 0) {
        playerArmy.meleeCount = Math.max(0, playerArmy.meleeCount - playerMeleeDead);
        const scale = playerArmy.meleeCount / (playerArmy.meleeCount + playerMeleeDead);
        playerArmy.meleeStrength.setNewBaseValue(playerArmy.meleeStrength.currentValue * scale, `${playerMeleeDead} soldiers lost`);
    }
    if (enemyMeleeDead > 0) {
        enemyArmy.meleeCount = Math.max(0, enemyArmy.meleeCount - enemyMeleeDead);
        const scale = enemyArmy.meleeCount / (enemyArmy.meleeCount + enemyMeleeDead);
        enemyArmy.meleeStrength.setNewBaseValue(enemyArmy.meleeStrength.currentValue * scale, `${enemyMeleeDead} soldiers lost`);
    }

    // Flavour text
    const advantage = playerTotalAttack.currentValue > enemyTotalAttack.currentValue ? "Your forces have the upper hand." :
                      playerTotalAttack.currentValue < enemyTotalAttack.currentValue ? "The enemy is pressing hard." :
                      "The lines are evenly matched.";
    state.log.push(`Melee round ${state.round}: ${advantage} ${playerMeleeDead} of your soldiers fell, ${enemyMeleeDead} enemy soldiers fell.`);

    state.round++;
    return state;
}
```

---

### Battle end conditions

- One side's `totalStrength.currentValue` reaches 0 → that side is destroyed
- Either side chooses to flee → see flee rules below
- Maximum 8 rounds (prevents infinite battles; after 8 rounds the weaker side flees automatically)

### Flee rules `[APPROVED]`

If the **player flees**:
- Bandits get a free raid
- Civilian death rate ×1.5, building destruction chance ×1.5 vs a normal lost fight

If the **bandits flee** (their `totalStrength` drops below 20% of starting value):
- Player wins, no raid
- Surviving soldiers return weapons to storage (weapons recovered)

### Casualty resolution after battle `[APPROVED]`

**Unit death is permanent.** Whether weapons are recovered depends on outcome:
- **Player wins**: surviving soldiers disarm, weapons returned to storage
- **Player loses or flees**: weapons lost (bandits take them)

**Wounded soldiers** — each "dead" unit rolls for severity before being counted as a population loss:
- 30% chance: outright dead → `ChangePopulationBonus(-1)`, weapon lost regardless
- 50% chance: wounded, severity 1–3
  - Severity 1 (mild): recovers in 2 days, no population loss
  - Severity 2 (moderate): 50% recovery chance (3 days), else `ChangePopulationBonus(-1)`
  - Severity 3 (severe): 20% recovery chance (5 days), else `ChangePopulationBonus(-1)`
- Recovery chance modified by: player won (+20%), medicinal herbs at full rations (+10%)

**Implementation**: `settlement.wounded` array of `{ severity, daysRemaining, recoveryChance }`. Checked in a `gameClock` subscription each tick. Deaths applied via `ChangePopulationBonus`.

**UI**: The wounded list is shown in the Military tab as a small table: "3 soldiers recovering (2 mild, 1 severe)". Each entry shows days remaining and recovery chance as a `Variable` with tooltip.

### Happiness/health aftermath `[APPROVED]`

Applied after battle resolution:

```js
function applyBattleAftermath(settlement, playerWon, playerFled, totalPlayerDead, timer) {
    const pop = settlement.populationSizeExternal.currentValue;
    const deathRate = totalPlayerDead / Math.max(1, pop);

    if (playerWon) {
        // Victory: happiness and legitimacy boost
        // Flavour: "Your forces have driven off the attackers. The settlement celebrates."
        new TemporaryHappinessBonus({
            name: "victory celebration", amount: 0.06,
            duration: daysInYear, timer
        }).activate(settlement);
        new TemporaryLocalLegitimacyBonus({
            name: "defended the settlement", amount: 0.05,
            duration: daysInYear * 2, timer
        }).activate(settlement);
    } else {
        // Loss/flee: penalties scaled by death rate
        // deathRate 0.05 → happinessPenalty -0.125, healthPenalty -0.065
        // deathRate 0.15 → happinessPenalty -0.175, healthPenalty -0.095
        const happinessPenalty = -(0.1 + deathRate * 0.5);  // -0.1 to -0.35
        const healthPenalty    = -(0.05 + deathRate * 0.3); // -0.05 to -0.20
        // Flavour: "The settlement mourns its losses." / "The people are shaken by the attack."
        new TemporaryHappinessBonus({
            name: "mourning battle losses", amount: happinessPenalty,
            duration: daysInYear, timer
        }).activate(settlement);
        new TemporaryHealthBonus({
            name: "injuries from battle", amount: healthPenalty,
            duration: Math.round(daysInYear * 0.5), timer
        }).activate(settlement);
        if (playerFled) {
            // Extra legitimacy hit: "The people lost faith in your leadership."
            new TemporaryLocalLegitimacyBonus({
                name: "fled from battle", amount: -0.08,
                duration: daysInYear, timer
            }).activate(settlement);
        }
    }
}
```

**Parameter justification**:
- `happinessPenalty` range -0.1 to -0.35: at 5% deaths (small skirmish loss) the penalty is -0.125, which is noticeable but recoverable. At 15% deaths (catastrophic) it's -0.175, which combined with the health penalty will push happiness well below the rebellion threshold.
- `healthPenalty` range -0.05 to -0.20: health trends slowly (trendingDownSpeed=0.15), so even a -0.20 penalty takes several ticks to fully manifest — giving the player time to respond with medicinal herbs.
- Victory boost +0.06 happiness / +0.05 legitimacy: meaningful reward for investing in military without being game-breaking.

---

## 4.6 Bandit Raid Event `[APPROVED — modified]`

```
checkEveryAvg: 4 years
variance: 40%
forcePause: true
fire chance: 30%
bannedUntil: first 2 years (24 ticks) — set in constructor
```

**Starting conditions**: Player starts with 5 iron weapons in storage (enough to arm 5 iron spearmen). This gives the player a fighting chance on an early raid without making military trivial.

**Fire sequence**:
1. Game pauses. Message: "A bandit warband has been spotted near [settlement]. They demand tribute."
2. Player sees choices:
   - **Pay tribute** (`population × 0.8` gold — expensive, safe, small legitimacy hit)
   - **Fight them off** → enters multi-stage battle system (§4.5)
   - **Do nothing** → automatic raid after 1 day (same as losing the fight, but no battle casualties)

**Tribute effects**:
- Treasury reduced by `Math.round(population × 0.8)`
- `TemporaryLocalLegitimacyBonus(-0.05, 4 years)` — seen as weak

**Raid effects** (do nothing / flee / lose fight):
- All resource storages zeroed via `oneOffDemand`
- Treasury set to 0
- Building destruction: 1–3 random flammable buildings lose 1 size (weighted by size)
- If fled: ×1.5 chance of civilian deaths (5–12% of pop), ×1.5 building destruction
- If lost fight: 5–8% civilian deaths, standard building destruction
- `TemporaryHappinessBonus` and `TemporaryHealthBonus` scaled by death rate (see §4.5)

**Constructor**:
```js
export class BanditRaid extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "bandit raid",
            checkEveryAvg: daysInYear * 4,
            variance: 0.4,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
        // Don't fire for first 2 years
        this.bannedUntil = daysInYear * 2;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    // ... getEventChoices(), getBonuses(), etc.
}
```

---

## 5. Diplomacy — Resource Trade Deal `[APPROVED — modified]`

The player can propose a resource-for-resource exchange with the NPC settlement. The NPC accepts based on comparative productivity — they'll trade resources they produce efficiently for ones they produce less efficiently.

### Acceptance logic

```js
// NPC accepts if their productivity for the offered resource > their productivity for the requested resource
// "Productivity" here = building productivity × building size / population
// i.e. how many units per person per tick they produce of each resource

function npcWillAcceptTrade(npcSettlement, offeredResource, requestedResource, offeredAmount, requestedAmount) {
    const offeredBuilding   = npcSettlement.resourceBuildings.find(b => b.outputResource === offeredResource);
    const requestedBuilding = npcSettlement.resourceBuildings.find(b => b.outputResource === requestedResource);
    if (!offeredBuilding || !requestedBuilding) return false;

    const offeredProd   = offeredBuilding.totalProduction.currentValue   / npcSettlement.populationSizeExternal.currentValue;
    const requestedProd = requestedBuilding.totalProduction.currentValue / npcSettlement.populationSizeExternal.currentValue;

    // NPC accepts if they produce the offered resource at least 1.2× more efficiently than the requested one
    // (they need a clear advantage, not just marginal)
    return offeredProd >= requestedProd * 1.2;
}
```

### TradeAgreement class

```js
class TradeAgreement {
    constructor({ fromSettlement, toSettlement, fromResource, fromAmount, toResource, toAmount, gameClock }) {
        this.fromSettlement = fromSettlement;
        this.toSettlement   = toSettlement;
        this.fromResource   = fromResource;
        this.fromAmount     = fromAmount; // units per year
        this.toResource     = toResource;
        this.toAmount       = toAmount;   // units per year
        this.active         = true;
        gameClock.subscribe(() => {
            if (gameClock.currentValue % daysInYear !== 0) return;
            if (!this.active) return;
            // Transfer resources
            const fromStorage = fromSettlement.resourceStorages.find(rs => rs.resource === fromResource);
            const toStorage   = toSettlement.resourceStorages.find(rs => rs.resource === toResource);
            if (fromStorage.amount.baseValue >= fromAmount) {
                fromStorage.oneOffDemand(fromAmount, 'trade agreement');
                toStorage.amount.setNewBaseValue(toStorage.amount.baseValue + toAmount, 'trade agreement');
            } else {
                // Can't fulfil — cancel agreement
                this.active = false;
                // TODO: notify player
            }
        });
    }
    cancel() { this.active = false; }
}
```

**UI**: A "Propose Trade" button on the NPC settlement view. Opens a modal where the player selects:
- Resource to offer + amount per year
- Resource to request + amount per year
- NPC response shown immediately based on `npcWillAcceptTrade()`

**Trade agreement cap** `[APPROVED]`: Maximum 2 active trade agreements simultaneously. Prevents the player from trivially solving all resource shortages via trade. Enforced in the UI (button disabled when 2 agreements active) and in `TradeAgreement` constructor (throws if cap exceeded).

---

## 6. Balance Concerns `[DEFER — playtest first]`

§6.1 (event frequency), §6.2 (trade exploit), §6.3 (research bonuses) — all deferred to playtesting per developer instruction.

---

## 7. UX / Polish

### 7.1 Rebellion warning `[APPROVED]`

Add `visualAlerts` to `totalRebellionSupport` in [`settlement.js`](dark_ages/src/game_logic/settlement/settlement.js):

```js
this.totalRebellionSupport = new Cumulator({
    // ... existing props ...
    visualAlerts: (variable) => variable.currentValue > 0.3
        ? [`Rebellion risk: ${Math.round(variable.currentValue * 100)}% — improve happiness or legitimacy`]
        : null
});
```

Include in the warning banner (§2) with red colour when `> 0.3`.

### 7.2 Settlement event list — clickable `[APPROVED]`

In `SettlementComponent` header, render each active event name as a `Button` (or styled `span`) that opens the event's modal. The `EventComponent` already handles modal rendering — just need to expose a way to trigger it from outside (e.g. a `forceOpen` prop or a ref).

### 7.3 "Next Year" button `[REJECTED]`

### 7.4 Treasury "days until bankruptcy" `[APPROVED]`

In [`hud.js`](dark_ages/src/game_logic/hud.js), below the treasury display, add:

```js
// Only show when treasury is declining
if (treasury.expectedChange < 0 && treasury.baseValue > 0) {
    const daysLeft = Math.floor(treasury.baseValue / Math.abs(treasury.expectedChange));
    // Render: "Bankrupt in ~{daysLeft} days" in red/orange
}
```

---

## 8. Deferred (not MVP)

- Save/Load
- Variable history / plotting
- Coastal terrain
- New buildings (Cemetery, Bathhouse, etc.)
- More cultures/traits
- Conditional variables
- Building upkeep / food decay
- Buy inputs without producing them
- Tavern → trade factor

---

## Summary: Recommended order of work

| # | Task | Est. time | Status |
|---|------|-----------|--------|
| 1 | §0.1 Uncomment events | 10 min | `[APPROVED]` |
| 2 | §0.2 Game over hard stop | 30 min | `[APPROVED]` |
| 3 | §1 NPC AI (floor + buffer + auto-research) | 1–2 hrs | `[APPROVED]` |
| 4 | §2 Warning banner | 2–3 hrs | `[APPROVED]` |
| 5 | §3.2 Pestilence severity | 30 min | `[APPROVED]` |
| 6 | §3.3 New events (Warm Spell, Merchant Boom, Hunting, Blizzard, Rats) | 3–4 hrs | `[APPROVED]` |
| 7 | §4.1–4.3 Military resources + army strength + tab | 3–4 hrs | `[APPROVED]` |
| 8 | §4.5 Battle system | 1–2 days | `[APPROVED]` |
| 9 | §4.6 Bandit Raid event | 3–4 hrs | `[APPROVED]` |
| 10 | §3.3 Nomads event | 2–3 hrs | `[APPROVED]` |
| 11 | §5 Trade deal diplomacy | 3–4 hrs | `[APPROVED]` |
| 12 | §7 UX polish (warnings, clickable events, treasury countdown) | 2–3 hrs | `[APPROVED]` |
| 13 | Playtest + balance tuning | ongoing | — |

**Total estimated time to showable state**: ~4–6 days of focused work.