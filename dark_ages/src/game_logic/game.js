import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, Variable, VariableModifier, Cumulator, addition} from './UIUtils';
import { titleCase } from "./utils";
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";
import { integerPropType } from "@mui/utils";
import {daysInYear, seasons} from './seasons'
import { Farmlands, Marshlands, NoTerrain } from "./settlement/terrain";
import { HarvestEvent } from "./events";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800, timeTranslator:(value) => {
            let year = parseInt(value/daysInYear) + 1;
            let day = value - (year - 1)*daysInYear + 1;
            let season = seasons[parseInt((day-1)*4/daysInYear)]
            return {day, season, year, text: `Day ${day}, ${titleCase(season)}, Year ${year}`}
        }});
        this.bankrupt = new Variable({name: 'bankruptcy (binary)', startingValue: 0})
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 37, terrain: new Marshlands(), bankrupt: this.bankrupt}),
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
                this.bankrupt.setNewBaseValue(1, 'user bankrupt');
            } else if (this.treasury.baseValue > 0 && this.bankrupt.currentValue !== 0){
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
}

export default Game;

// Stuff for now:
// - Events:
//     - Some events might want to pause when they fire but not force-pause
//     - Time-based bonuses, e.g. a happiness bonus that falls off over the period of 1 season - just use the timer variable? Need to deactivate it at some point?
//     - Make a wolf attack event!!!!
//         - should use the forcePause variable to force a pause and give the user some choices
//                - Choices should have transparent success chances??
//     - More basic events: 
//          - blizzard - increased coal demand and massively increase trade costs, 
//          - mining accident - reduce mine size or face unhappiness, 
//          - rats in storage - lose food, can perhaps mitigate somehow?
//          - landslide: spend money or face unhappinness, 
//          - warm spell: happiness, less coal
//          - merchant boom: trading factor increase
//          - hunting game surplus: hunter's hut increase
//          - dry hunting lands: hunters hut significant decrease
//          - local miracle: boost to happiness and (and immigration?)
//          - fire: destroyed buildings (this one should pause)
//          - large group of nomads arrives: take them in, trade with them, send them away (force pause this one?) 
// - auto-sell excess goods to the market - important! else they get wasted
// - Potential simple/important buildings: cemetery(trivial), bathhouse(trivial), suclpture/artists studio(trivial), sportsballfield(trivial)
// - Add a history to variables - short term, long term and super long term. Plot them?
// - resource buildings should show a productivity breakdown so that user can easily see effect of terrain, crop blight etc...
// - Add rebellions % chance using happiness+legitimacy(comes from character?)
// - Move to the character system!
// - Add a coastal terrain with fishin wharf + higher raid chance
// - Should be able to buy resources on the market that you need as inputs even if you don't produce them (e.g. no iron mine?) 
// - UI needs serious improvement to be playable
// Thoughts on easy UI improvements to make it playable:
// - Move resource storage to the side like in kitten games
// - Move research into it's own tab - maybe it should use the sum of the research from all settlements? since research isn't per-settlement

// Next up:
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Basic event system with user responses and success chances depending on character - crop failures, wolf attacks etc... check phone for ideas
// - Add civilian and military rebellions - add a legitimacy system and low legitmacy+happiness triggers rebellions
// - Semi-tutorial system: give hints and introduce new buildings gardually (through research unlocks?)

// Requirements for MVP:
// - Should test balance with tests -> set up conditions and measure happiness
// - Basic settlement management
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Saving/Loading system? -> 
//     - I can probably do a lot of this with Object.entries(). I need to make sure that any objects that are present in multiple places are reconstructed correctly, so I probably need some global Set() object that get populated/read from
//     - Biggest problem is going to be making sure that stored functions are copied over correctly? can we find a way of storing a re-viving subscriptions for example? is that enough?
//          - It feels like just reconstructing the objects and then overwriting the k,v pairs would work for this though? We would just have to copy over all the subscribers afterwards
//               - Does this work for the lambdas related to events? I think so right? So long as the timer and all the data is right?
//     - Otherwise, potentially slightly more painful solutions:
//          - Could change the constructor to recieve props,loadedObject and then read everything you can from the loadedObject instead, but still do all the constructing as usual - this way all the lambdas are correctly hooked up?
//          - If the only real problem is with serialising stored functions in subscribe() fashion, can we find a way of storing a re-viving subscriptions?
//          - https://github.com/denostack/superserial this sounds like it might help maybe? not sure it deals with functions though 
//          - https://github.com/iconico/JavaScript-Serializer or this? might actually deal with functions
//          - https://www.npmjs.com/package/javascript-serializer maybe this? not sure it handles functions tbh
// - Do some UX improvement work
// - Playtesting! Myself and friends

// Stuff for later builds:
// - Diplomacy system
// - "Fake" AI settlements that are really just characters that do combat/diplomacy but don't actually do the settlement management
// - Could have conditional variables -> they take either a single true/false variable or two variables to compare and then return different results depending on the outcome
// - Add building upkeep
// - Add food decay

// AI reinforcement learning:
// - job setting: iterate through buildings, one NN each, inputs are: demand, stockpile, productivity, unemployed, happiness, health, behaviour/strategy inputs. output is % of unemployed to set to job
// - ration setting: iterate through rations, one NN each, inputs are happiness, health, demand. output is ration %
//    - this one could be trained by running many "simulations" where it has to optimally distributed resources given supply+production
// - building/upgrading: have a nn who's job it is to decide what to build/upgrade (if anything) and to pass that onto job setting NN?


