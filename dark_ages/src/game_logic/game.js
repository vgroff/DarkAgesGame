import {Settlement} from "./settlement/settlement";
import {Variable, VariableModifier, Cumulator, addition, multiplication, max} from './UIUtils';
import { titleCase } from "./utils";
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";
import {daysInYear, seasons} from './seasons'
import { Farmlands, Marshlands } from "./settlement/terrain";
import { HarvestEvent } from "./events";
import { Character, Cultures } from "./character";
import { TradeAgreement, npcWillAcceptTrade } from "./diplomacy";
export { TradeAgreement, npcWillAcceptTrade };

class Game {
    constructor(gameClock) {
        this.gameClock = gameClock || new Timer({name: 'Game timer', meaning: "Current day", every: 800, timeTranslator:(value) => {
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
        this.playerCharacter = new Character({name:"player", culture: new Cultures.Celtic(), isPlayer: true, gameClock: this.gameClock});
        this.npcCharacter = new Character({name:"npc 2", culture: new Cultures.Celtic(), gameClock: this.gameClock, randomizeTraits: true});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, leader: this.playerCharacter, startingPopulation: 37, terrain: new Marshlands(), bankrupt: this.bankrupt, handleRebellion: this.handleRebellion.bind(this), addToTreasury: this.addToTreasury.bind(this)}),
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

        this.treasury = new Cumulator({name: 'Treasury', startingValue: 10, timer:this.gameClock, modifiers:[this.totalMarketIncome]});
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

        this.harvestEvent = new HarvestEvent({settlements: this.settlements, timer: this.gameClock});
        this.globalEvents = [
            this.harvestEvent
        ];
        
        // Initialize events
        this.initEvents();

        // On the first tick (day 1), reset trending baselines for happiness and health on all
        // settlements so the player's day-1 setup is treated as the "always was this way" baseline.
        // Without this, TrendingVariable would animate from its initial value toward the real value.
        const resetTrendsOnDayOne = () => {
            if (this.gameClock.currentValue === 1) {
                this.settlements.forEach(s => {
                    s.happiness.forceResetTrend();
                    s.health.forceResetTrend();
                });
                this.gameClock.unsubscribe(resetTrendsOnDayOne);
            }
        };
        this.gameClock.subscribe(resetTrendsOnDayOne, 999, 'reset trends on day 1');
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
