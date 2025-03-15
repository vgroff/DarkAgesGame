import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, Variable, VariableModifier, Cumulator, addition} from './UIUtils';
import { titleCase } from "./utils";
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";
import { integerPropType } from "@mui/utils";
import {daysInYear, seasons} from './seasons'
import { Farmlands, Marshlands, NoTerrain } from "./settlement/terrain";
import { HarvestEvent } from "./events";
import { Celtic, Character, Cultures } from "./character";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800, timeTranslator:(value) => {
            let year = parseInt(value/daysInYear) + 1;
            let day = value - (year - 1)*daysInYear + 1;
            let season = seasons[parseInt((day-1)*4/daysInYear)]
            return {day, season, year, text: `Day ${day}, ${titleCase(season)}, Year ${year}`}
        }});
        this.gameMessages = [];
        this.bankrupt = new Variable({name: 'bankruptcy (binary)', startingValue: 0})
        this.playerCharacter = new Character({name:"player", culture: new Cultures.Celtic(), isPlayer: true, gameClock: this.gameClock});
        let char2 = new Character({name:"npc 2", culture: new Cultures.Celtic(), gameClock: this.gameClock, randomizeTraits: true});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, leader: this.playerCharacter, startingPopulation: 37, terrain: new Marshlands(), bankrupt: this.bankrupt, handleRebellion: this.handleRebellion.bind(this)}),
            new Settlement({name: 'Village 2', gameClock: this.gameClock, leader: char2, startingPopulation: 35, terrain: new Farmlands(), bankrupt: this.bankrupt, handleRebellion: () => {}})
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

        this.harvestEvent = new HarvestEvent({settlements: this.settlements, timer: this.gameClock});
        this.globalEvents = [
            this.harvestEvent
        ]
        this.globalEvents.forEach(event => {
            if (event.eventShouldFire()) {
                event.fire();
            }
        });
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
        this.gameClock.stopTimer();
        
        // Initialize all game objects first
        this.bankrupt.init();
        this.playerCharacter.init();
        this.settlements.forEach(s => s.init());
        this.treasury.init();
        
        // Initialize and sync all events
        this.globalEvents.forEach(event => {
            event.init();
            
            // Ensure event timing is preserved
            if (event.isActive()) {
                const remaining = event.daysLeft();
                event.eventDuration.setNewBaseValue(remaining, 'restore event duration');
            }
        });
        
        // Restore timer subscriptions
        this.gameClock.subscribe(() => {
            this.triggerChecks();
        });
        
        // Restore treasury subscriptions
        this.treasury.subscribe(() => {
            if (this.treasury.baseValue < 0 && this.bankrupt.currentValue === 0) {
                this.bankrupt.setNewBaseValue(1, 'user bankrupt');
            } else if (this.treasury.baseValue > 0 && this.bankrupt.currentValue !== 0){
                this.bankrupt.setNewBaseValue(0, 'user liquid');
            }
        });
        
        // Restore UI state
        this.selectedSettlement = uiState.selectedSettlement;
        this.selectedCharacter = uiState.selectedCharacter;
        this.openPanels = uiState.openPanels;
        this.scrollPositions = uiState.scrollPositions;
        
        // Resume timer
        this.gameClock.startTimer();
    }
    handleRebellion(settlement) {
        console.log("handleRebellion")
        this.gameMessages.push(`${settlement.name} has rebelled! You have lost control of this settlement.`);
        if (this.playerCharacter.settlements.length === 0) {
            console.log("game over");
            this.gameMessages.push(`You have lost control of all your settlements! \n Game over.`);
        }
    }
    messageRead() {
        this.gameMessages.shift();
    }
}

export default Game;
