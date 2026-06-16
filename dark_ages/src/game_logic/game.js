import {Settlement} from "./settlement/settlement";
import {Variable, VariableModifier, Cumulator, addition, multiplication, max, min} from './UIUtils';
import { titleCase } from "./utils";
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";
import {daysInYear, seasons} from './seasons'
import { Farmlands, Marshlands, Woodlands, Mountains, NoTerrain } from "./settlement/terrain";
import { HarvestEvent, BanditRaid, CropBlight, Pestilence, WarmSpell, Blizzard, NomadsArrive, MerchantBoom, CourtIntrigue } from "./events";
import { Character, Cultures, ChildhoodTraits, AbilityTraits, PersonalityTraits, FameTraits, TrinketTraits } from "./character";
import { TradeAgreement, npcWillAcceptTrade } from "./diplomacy";
import { Resources } from "./settlement/resource";
export { TradeAgreement, npcWillAcceptTrade };

// Map event class names (as strings) to their constructors, for scenario forceEventsOnDayOne
const EVENT_CLASS_MAP = {
    BanditRaid,
    CropBlight,
    Pestilence,
    WarmSpell,
    Blizzard,
    NomadsArrive,
    MerchantBoom,
    CourtIntrigue,
};

// Map trait display names (as used in scenario config) to their constructors
const ALL_TRAIT_CLASSES = [
    ...ChildhoodTraits,
    ...AbilityTraits,
    ...PersonalityTraits,
    ...FameTraits,
    ...TrinketTraits,
];

class Game {
    constructor(scenario) {
        // scenario is an optional plain config object from scenarios.js.
        // If omitted, the default (vanilla) game is constructed.
        this._scenario = scenario || null;

        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800, timeTranslator:(value) => {
            let year = parseInt(value/daysInYear) + 1;
            let day = value - (year - 1)*daysInYear + 1;
            let season = seasons[parseInt((day-1)*4/daysInYear)]
            return {day, season, year, text: `Day ${day}, ${titleCase(season)}, Year ${year}`}
        }});
        this.gameMessages = [];
        this.messageLog = []; // Permanent log — messages are never removed from here
        this.warningsShown = new Set(); // Tracks which first-time warnings have been shown
        this.isGameOver = false;
        this.bankrupt = new Variable({name: 'bankruptcy (binary)', startingValue: 0})

        // Determine starting population from scenario (default 37)
        const startingPop = scenario?.startingPopulation ?? 37;

        // Resolve player terrain from scenario string (default: Marshlands)
        const TERRAIN_CLASS_MAP = { Marshlands, Farmlands, Woodlands, Mountains, NoTerrain };
        const terrainClassName = scenario?.playerTerrain ?? 'Marshlands';
        const TerrainClass = TERRAIN_CLASS_MAP[terrainClassName] || Marshlands;
        if (scenario?.playerTerrain && !TERRAIN_CLASS_MAP[scenario.playerTerrain]) {
            console.warn(`[Scenario] Unknown playerTerrain: "${scenario.playerTerrain}", defaulting to Marshlands`);
        }

        // Create player character. If scenario says skipTraitSelection, we will
        // fill traits after construction (before the timer is released).
        this.playerCharacter = new Character({name:"player", culture: new Cultures.Celtic(), isPlayer: true, gameClock: this.gameClock});
        this.npcCharacter = new Character({name:"npc 2", culture: new Cultures.Celtic(), gameClock: this.gameClock, randomizeTraits: true});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, leader: this.playerCharacter, startingPopulation: startingPop, terrain: new TerrainClass(), bankrupt: this.bankrupt, handleRebellion: this.handleRebellion.bind(this), addToTreasury: this.addToTreasury.bind(this)}),
            new Settlement({name: 'Village 2', gameClock: this.gameClock, leader: this.npcCharacter, startingPopulation: 35, terrain: new Farmlands(), bankrupt: this.bankrupt, handleRebellion: () => {}})
        ];
        this.totalMarketIncome = new SumAggModifier(
            {
                name: "Total market income",
                aggregate: this,
                keys: [
                    ["settlements"],
                    [ "market", "netMarketIncome"],
                ],
                type: addition
            }
        );

        const startingTreasury = scenario?.startingTreasury ?? 10;
        this.treasury = new Cumulator({name: 'Treasury', startingValue: startingTreasury, timer:this.gameClock, modifiers:[this.totalMarketIncome]});
        this.treasury.subscribe(() => {
            if (this.treasury.baseValue < 0 && this.bankrupt.currentValue === 0) {
                console.log("user bankrupt");
                this.bankrupt.setNewBaseValue(1, 'user bankrupt');
            } else if (this.treasury.baseValue > 0 && this.bankrupt.currentValue !== 0){
                console.log("user liquid");
                this.bankrupt.setNewBaseValue(0, 'user liquid');
            }
        });

        // §1 NPC AI: prevent death spiral and offset lack of management
        const npcSettlement = this.settlements[1];
        const npcHappinessFloor = new Variable({ name: "NPC happiness floor", startingValue: 0.35 });
        const npcHealthFloor    = new Variable({ name: "NPC health floor",    startingValue: 0.6  });
        npcSettlement.happiness.addModifier(
            new VariableModifier({ variable: npcHappinessFloor, type: max, name: "NPC AI floor", customPriority: 6 })
        );
        npcSettlement.health.addModifier(
            new VariableModifier({ variable: npcHealthFloor, type: max, name: "NPC AI floor", customPriority: 6 })
        );
        npcSettlement.generalProductivity.addModifier(
            new VariableModifier({
                name: "NPC AI productivity buffer",
                startingValue: 1.15,
                type: multiplication,
                customPriority: 198
            })
        );
        npcSettlement.generalProductivity.addModifier(
            new VariableModifier({
                name: "NPC AI productivity floor",
                startingValue: 0.8,
                type: max,
                customPriority: 199
            })
        );

        // §1.1 NPC auto-research: buy cheapest available item each year
        this.gameClock.subscribe(() => {
            if (this.gameClock.currentValue % daysInYear !== 0) return;
            const npcFaction = this.npcCharacter.faction;
            if (!npcFaction) return;
            const allItems = Object.values(npcFaction.researchTree).flat();
            const available = allItems.filter(item => npcFaction.canResearch(item));
            if (available.length === 0) return;
            available.sort((a, b) => a.researchCost - b.researchCost);
            npcFaction.activateResearch(available[0]);
        });

        this.tradeAgreements = []; // §5 active TradeAgreement instances (max 2)

        this.harvestEvent = new HarvestEvent({
            settlements: this.settlements,
            timer: this.gameClock,
            // Force a decent (not amazing) first harvest if the scenario requests it.
            // This flag is consumed by getBonuses() on the first fire and then cleared.
            forceGoodNextHarvest: scenario?.goodFirstYearHarvest ?? true,
        });
        this.globalEvents = [
            this.harvestEvent
        ];
        
        // Initialize events
        this.initEvents();

        // Apply scenario overrides (building sizes, resources, research, traits, forced events).
        // This runs after all normal construction is complete so all systems are wired up.
        if (scenario) {
            this._applyScenario(scenario);
            // Auto-assign workers once so pre-built buildings are staffed before the player
            // hits Play. Only runs for non-default scenarios (i.e. whenever _applyScenario
            // is called), since the default new game has no pre-built structures to staff.
            this.settlements[0].adjustJobs();
        }

        // ── Day 1 behaviour ────────────────────────────────────────────────────
        //
        // On day 1 we want two things:
        //
        // 1. Trending variables (happiness, health) snap instantly to any change
        //    rather than slowly trending. We subscribe directly to happiness and
        //    health and call forceResetTrend() whenever they recalculate, so any
        //    UI change (rationing, workers, etc.) immediately snaps the displayed
        //    value to the long-term target. A re-entrancy guard prevents the
        //    forceResetTrend() call from triggering itself. Subscriptions are
        //    removed on day 2.
        //
        // 2. No population change on day 1. We add a `min` and `max` modifier to
        //    populationSizeChange that clamps it to exactly 1.0, so the Cumulator
        //    multiplies by 1 and population stays flat. The modifier is removed on
        //    day 2.

        // Population freeze: one modifier per settlement clamping populationSizeChange to 1
        const popFreezeModifiers = this.settlements.map(s => {
            const one = new Variable({ name: "day 1 pop freeze", startingValue: 1 });
            const modMin = new VariableModifier({ variable: one, type: min, name: "day 1 pop freeze min", customPriority: 500 });
            const modMax = new VariableModifier({ variable: one, type: max, name: "day 1 pop freeze max", customPriority: 500 });
            s.populationSizeChange.addModifier(modMin);
            s.populationSizeChange.addModifier(modMax);
            return { settlement: s, modMin, modMax };
        });

        // ── Day 1 instant snap ──────────────────────────────────────────────────
        //
        // Subscribe to happiness and health directly. Whenever either recalculates
        // (triggered by any modifier change — rationing, workers, events, etc.),
        // call forceResetTrend() to snap trendingValueAtTurnStart to the new target.
        // This makes the displayed value immediately reflect the new long-term state.
        //
        // Re-entrancy guard: forceResetTrend() itself calls recalculate(), which
        // would re-trigger this subscription. The `snapping` flag prevents that.
        //
        // Subscriptions are removed on day 2 (first timer tick after Play is pressed).
        const snapSubs = [];
        this.settlements.forEach(s => {
            let snappingHappiness = false;
            let snappingHealth = false;

            const snapHappiness = () => {
                if (snappingHappiness) return;
                snappingHappiness = true;
                s.happiness.forceResetTrend();
                snappingHappiness = false;
            };
            const snapHealth = () => {
                if (snappingHealth) return;
                snappingHealth = true;
                s.health.forceResetTrend();
                snappingHealth = false;
            };

            s.happiness.subscribe(snapHappiness, 1000, 'day 1: snap happiness trend');
            s.health.subscribe(snapHealth, 1000, 'day 1: snap health trend');

            // Snap immediately so the UI shows correct values before Play is pressed.
            // We call recalculate() first to ensure all modifier chains have propagated
            // (some modifiers may not have fired their initial callbacks yet at this point
            // in the constructor), then forceResetTrend() snaps trendingValueAtTurnStart
            // to the fully-settled target value.
            s.happiness.recalculate('day 1 initial snap', 0);
            s.health.recalculate('day 1 initial snap', 0);
            s.happiness.forceResetTrend();
            s.health.forceResetTrend();

            snapSubs.push({ happiness: s.happiness, health: s.health, snapHappiness, snapHealth });
        });

        // Day 1 timer tick: re-snap after all supply/demand calculations have run
        // (fires at priority 1000, before TrendingVariable's own timer subscription)
        const snapTrendsOnDayOne = () => {
            if (this.gameClock.currentValue !== 1) return;
            snapSubs.forEach(({ happiness, health }) => {
                happiness.forceResetTrend();
                health.forceResetTrend();
            });
        };
        this.gameClock.subscribe(snapTrendsOnDayOne, 1000, 'day 1: snap trending on tick');

        // Day 2: remove snap subscriptions and population freeze modifiers
        const restoreOnDayTwo = () => {
            if (this.gameClock.currentValue !== 2) return;
            this.gameClock.unsubscribe(restoreOnDayTwo);
            this.gameClock.unsubscribe(snapTrendsOnDayOne);

            // Remove direct snap subscriptions from happiness/health
            snapSubs.forEach(({ happiness, health, snapHappiness, snapHealth }) => {
                happiness.unsubscribe(snapHappiness);
                health.unsubscribe(snapHealth);
            });

            // Remove population freeze modifiers
            popFreezeModifiers.forEach(({ settlement, modMin, modMax }) => {
                settlement.populationSizeChange.removeModifier(modMin);
                settlement.populationSizeChange.removeModifier(modMax);
            });
        };
        this.gameClock.subscribe(restoreOnDayTwo, 999, 'day 2: remove snap subs and pop freeze');
    }

    /**
     * Apply a scenario config to the freshly-constructed game.
     *
     * Called at the end of the constructor when a scenario is provided.
     * All game systems (settlements, characters, events) are fully wired
     * before this runs, so it is safe to call settlement/character methods.
     *
     * @param {object} scenario — plain config object from scenarios.js
     */
    _applyScenario(scenario) {
        const playerSettlement = this.settlements[0];

        // ── 1. Starting resources ──────────────────────────────────────────────
        if (scenario.startingResources) {
            for (const [resourceName, amount] of Object.entries(scenario.startingResources)) {
                const rs = playerSettlement.resourceStorages.find(
                    s => s.resource.name === resourceName
                );
                if (rs && rs.amount && amount > 0) {
                    rs.amount.setNewBaseValue(
                        rs.amount.baseValue + amount,
                        `scenario starting resource: ${resourceName}`
                    );
                } else if (!rs) {
                    console.warn(`[Scenario] Unknown resource name: "${resourceName}"`);
                }
            }
        }

        // ── 2. Building sizes ──────────────────────────────────────────────────
        // We use forceNewSize() to bypass resource cost checks.
        if (scenario.startingBuildingSizes) {
            for (const [buildingName, targetSize] of Object.entries(scenario.startingBuildingSizes)) {
                const building = playerSettlement.getBuildings().find(b => b.name === buildingName);
                if (building) {
                    if (targetSize !== building.size.currentValue) {
                        building.forceNewSize(targetSize);
                        if (!building.unlocked && targetSize > 0) {
                            building.unlocked = true;
                        }
                    }
                } else {
                    console.warn(`[Scenario] Building not found: "${buildingName}"`);
                }
            }
        }

        // ── 3. Building upgrades ───────────────────────────────────────────────
        // Apply upgrades by index, bypassing resource cost checks (force=true).
        // We must also mark the upgrade as unlocked before forcing it, since
        // BuildingUpgrade.upgrade(force=true) still checks canUpgrade() for the
        // unlocked flag... actually force=true bypasses canUpgrade() entirely.
        // We call Building.upgrade(resourceStorages, force=true) which increments
        // currentUpgradeIndex and updates displayName correctly.
        if (scenario.startingBuildingUpgrades) {
            for (const [buildingName, upgradeIndex] of Object.entries(scenario.startingBuildingUpgrades)) {
                const building = playerSettlement.getBuildings().find(b => b.name === buildingName);
                if (!building) {
                    console.warn(`[Scenario] Building not found for upgrade: "${buildingName}"`);
                    continue;
                }
                // Apply upgrades sequentially up to and including upgradeIndex.
                // Building.upgrade() increments currentUpgradeIndex each call.
                while (building.currentUpgradeIndex <= upgradeIndex && building.upgrades[building.currentUpgradeIndex]) {
                    // Mark unlocked so the upgrade is visible in UI after the fact
                    building.upgrades[building.currentUpgradeIndex].unlocked = true;
                    building.upgrade(playerSettlement.resourceStorages, true);
                }
            }
        }

        // ── 4. Pre-research ────────────────────────────────────────────────────
        // Activate research items by name on the player's faction research tree.
        // Items are activated in the order listed, so dependencies must be listed first.
        if (scenario.preResearched && scenario.preResearched.length > 0) {
            const faction = this.playerCharacter.faction;
            if (faction) {
                const allItems = Object.values(faction.researchTree).flat();
                for (const researchName of scenario.preResearched) {
                    const item = allItems.find(r => r.name === researchName);
                    if (item && !item.researched) {
                        // Bypass cost check — just activate directly
                        item.researched = true;
                        // Apply bonuses to all member settlements
                        for (const settlement of faction.getPlayerSettlements()) {
                            for (const [, researchList] of Object.entries(settlement.research)) {
                                const match = researchList.find(r => r.name === researchName);
                                if (match && !match.researched) {
                                    for (const bonus of match.researchBonuses) {
                                        settlement.activateBonus(bonus);
                                    }
                                    match.researched = true;
                                    break;
                                }
                            }
                        }
                    } else if (!item) {
                        console.warn(`[Scenario] Research item not found: "${researchName}"`);
                    }
                }
            }
        }

        // ── 5. Pre-arm soldiers ────────────────────────────────────────────────
        // armSoldiers() deducts weapons from weapon storage and adds units to unit storage.
        // The startingResources step (above) must have already added the weapon resources.
        if (scenario.startingArmy) {
            for (const [unitName, count] of Object.entries(scenario.startingArmy)) {
                const unitResource = Object.values(Resources).find(r => r.name === unitName);
                if (!unitResource) {
                    console.warn(`[Scenario] Unit resource not found: "${unitName}"`);
                    continue;
                }
                const success = playerSettlement.armSoldiers(unitResource, count);
                if (!success) {
                    console.warn(`[Scenario] armSoldiers failed for "${unitName}" × ${count} — check weapon resources in startingResources`);
                }
            }
        }

        // ── 6. Player traits (skipTraitSelection) ──────────────────────────────
        // If skipTraitSelection is set, fill all trait groups automatically.
        // playerTraits can specify exact trait names; otherwise sensible defaults are used.
        if (scenario.skipTraitSelection) {
            const traitNameMap = {};
            for (const TraitClass of ALL_TRAIT_CLASSES) {
                const instance = new TraitClass();
                traitNameMap[instance.name.toLowerCase()] = TraitClass;
            }

            const traitGroupKeys = ['childhoodTrait', 'abilityTrait', 'personalityTrait', 'fameTrait', 'trinketTrait'];
            const traitGroupChoices = {
                childhoodTrait: ChildhoodTraits,
                abilityTrait: AbilityTraits,
                personalityTrait: PersonalityTraits,
                fameTrait: FameTraits,
                trinketTrait: TrinketTraits,
            };

            for (const groupKey of traitGroupKeys) {
                // Skip if already set (e.g. from culture traits)
                if (this.playerCharacter.traitGroups[groupKey].trait) continue;

                let TraitClass = null;

                // Check if scenario specifies a trait for this group
                if (scenario.playerTraits && scenario.playerTraits[groupKey]) {
                    const specifiedName = scenario.playerTraits[groupKey].toLowerCase();
                    TraitClass = traitNameMap[specifiedName];
                    if (!TraitClass) {
                        console.warn(`[Scenario] Trait not found: "${scenario.playerTraits[groupKey]}" for group "${groupKey}"`);
                    }
                }

                // Fall back to first available choice for this group
                if (!TraitClass) {
                    TraitClass = traitGroupChoices[groupKey][0];
                }

                if (TraitClass) {
                    this.playerCharacter.addTrait(new TraitClass());
                }
            }
            // checkTraitsComplete() is called by addTrait, so the force-stop will be released
            // automatically once all 5 groups are filled.
        }

        // ── 7. Bandit raid ban override ────────────────────────────────────────
        if (scenario.banditRaidBanDays !== null && scenario.banditRaidBanDays !== undefined) {
            const banditRaidEvent = playerSettlement.settlementEvents?.find(
                e => e instanceof BanditRaid
            );
            if (banditRaidEvent) {
                banditRaidEvent.bannedUntil = scenario.banditRaidBanDays;
            }
        }

        // ── 8. Force events on day 1 ───────────────────────────────────────────
        // We subscribe to the game clock and fire the specified events on the first tick.
        if (scenario.forceEventsOnDayOne && scenario.forceEventsOnDayOne.length > 0) {
            const forcedEventNames = new Set(scenario.forceEventsOnDayOne);
            const onDayOne = () => {
                if (this.gameClock.currentValue !== 1) return;
                this.gameClock.unsubscribe(onDayOne);

                for (const settlement of this.settlements) {
                    if (!settlement.settlementEvents) continue;
                    for (const event of settlement.settlementEvents) {
                        const className = event.constructor.name;
                        if (forcedEventNames.has(className)) {
                            // Override lastChecked so triggerChecks() won't block it
                            event.lastChecked = -event.checkEvery;
                            event.bannedUntil = -1e9;
                            // Fire directly
                            if (!event.isActive()) {
                                event.lastTriggered = this.gameClock.currentValue;
                                event.fire();
                                if (event.forcePause) {
                                    this.gameClock.forceStopTimer("Event: " + event.name);
                                } else if (event.pause) {
                                    this.gameClock.stopTimer();
                                }
                                event.read = false;
                            }
                        }
                    }
                }
            };
            // Priority 998 — fires just before the trend reset (999) on day 1
            this.gameClock.subscribe(onDayOne, 998, 'scenario: force events on day 1');
        }

        // ── 9. Research rate multiplier ────────────────────────────────────────
        // Adds a multiplication modifier to the Library building's productivity,
        // which increases the rate at which research points are produced.
        if (scenario.researchRateMultiplier != null) {
            const library = playerSettlement.getBuildings().find(b => b.name === 'library');
            if (library) {
                library.productivity.addModifier(new VariableModifier({
                    name: 'scenario research rate bonus',
                    startingValue: scenario.researchRateMultiplier,
                    type: multiplication,
                    customPriority: 50
                }));
            }
        }

        // ── 10. General productivity bonus ─────────────────────────────────────
        // Adds a multiplication modifier to the settlement's generalProductivity.
        if (scenario.generalProductivityBonus != null) {
            playerSettlement.generalProductivity.addModifier(new VariableModifier({
                name: 'scenario difficulty bonus',
                startingValue: scenario.generalProductivityBonus,
                type: multiplication,
                customPriority: 50
            }));
        }

        // ── 11. Legitimacy bonus ───────────────────────────────────────────────
        // Adds an addition modifier to the player character's legitimacy Variable.
        if (scenario.legitimacyBonus != null) {
            this.playerCharacter.legitimacy.addModifier(new VariableModifier({
                name: 'scenario difficulty bonus',
                startingValue: scenario.legitimacyBonus,
                type: addition,
                customPriority: 50
            }));
        }

        // ── 12. Event ban until day N ──────────────────────────────────────────
        // Sets bannedUntil on all player settlement events so they cannot fire
        // before the specified day. This gives the player a grace period.
        if (scenario.eventBanUntilDay != null && scenario.eventBanUntilDay > 0) {
            for (const settlement of this.settlements) {
                if (!settlement.settlementEvents) continue;
                for (const event of settlement.settlementEvents) {
                    // Don't override a ban that's already longer (e.g. BanditRaid default 2yr ban)
                    if (event.bannedUntil < scenario.eventBanUntilDay) {
                        event.bannedUntil = scenario.eventBanUntilDay;
                    }
                }
            }
        }

        // Note: we do NOT call forceResetTrend() here. The day-1 snap mechanism
        // (trendingUpSpeed/Down = 1 on day 1) handles instant convergence for all
        // settlements on the first tick, including any scenario-applied changes.
    }

    initEvents() {
        if (this.globalEvents) {
            this.globalEvents.forEach(event => {
                if (event && event.eventShouldFire && event.eventShouldFire()) {
                    event.fire();
                }
            });
        }
    }

    init() {
        // Store current UI state before initializing
        const uiState = {
            selectedSettlement: this.selectedSettlement,
            selectedCharacter: this.selectedCharacter,
            openPanels: this.openPanels,
            scrollPositions: this.scrollPositions
        };
        
        // Pause all timers during initialization
        if (this.gameClock) {
            this.gameClock.stopTimer();
        }
        
        // Initialize all game objects first
        if (this.bankrupt) {
            this.bankrupt.init();
        }
        
        // Initialize all settlements
        if (this.settlements) {
            this.settlements.forEach(s => {
                if (s && s.init) {
                    s.init();
                }
            });
        }
        
        // Initialize treasury
        if (this.treasury) {
            this.treasury.init();
        }
        
        // Initialize and sync all events
        if (this.globalEvents) {
            this.globalEvents.forEach(event => {
                if (event && event.init) {
                    event.init();
                }
                
                // Ensure event timing is preserved
                if (event && event.isActive && event.isActive() && event.daysLeft) {
                    const remaining = event.daysLeft();
                    if (event.eventDuration) {
                        event.eventDuration.setNewBaseValue(remaining, 'restore event duration');
                    }
                }
            });
        }
        
        // Restore timer subscriptions
        if (this.gameClock) {
            this.gameClock.subscribe(() => {
                this.triggerChecks();
            });
        }
        
        // Restore treasury subscriptions
        if (this.treasury) {
            this.treasury.subscribe(() => {
                if (this.treasury.baseValue < 0 && this.bankrupt.currentValue === 0) {
                    this.bankrupt.setNewBaseValue(1, 'user bankrupt');
                } else if (this.treasury.baseValue > 0 && this.bankrupt.currentValue !== 0){
                    this.bankrupt.setNewBaseValue(0, 'user liquid');
                }
            });
        }
        
        // Initialize events after everything else is ready
        this.initEvents();
        
        // Restore UI state
        this.selectedSettlement = uiState.selectedSettlement;
        this.selectedCharacter = uiState.selectedCharacter;
        this.openPanels = uiState.openPanels;
        this.scrollPositions = uiState.scrollPositions;
        
        // Resume timer
        if (this.gameClock) {
            this.gameClock.startTimer();
        }
    }

    /**
     * Push a message to both the transient queue (shown as modal) and the permanent log.
     * @param {string} message
     */
    addGameMessage(message) {
        this.gameMessages.push(message);
        this.messageLog.push({ text: message, day: this.gameClock ? this.gameClock.currentValue : 0 });
    }

    handleRebellion(settlement) {
        console.log("handleRebellion")
        this.addGameMessage(`${settlement.name} has rebelled! You have lost control of this settlement.`);
        if (this.playerCharacter.settlements.length === 0) {
            console.log("game over");
            this.addGameMessage(`You have lost control of all your settlements! Game over.`);
            this.gameClock.forceStopTimer("game over");
            this.isGameOver = true;
        }
    }

    /**
     * Add an amount directly to the treasury base value.
     * Used by settlements to credit auto-sold excess goods income.
     * @param {number} amount
     * @param {string} reason
     */
    addToTreasury(amount, reason) {
        if (!this.treasury || amount <= 0) return;
        this.treasury.setNewBaseValue(
            this.treasury.baseValue + amount,
            reason || 'treasury addition'
        );
    }

    messageRead() {
        this.gameMessages.shift();
    }

    triggerChecks() {
        if (this.globalEvents) {
            this.globalEvents.forEach(event => {
                if (event && event.eventShouldFire && event.eventShouldFire()) {
                    event.fire();
                }
            });
        }
    }
}

export default Game;
