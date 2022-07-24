import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, Variable, VariableModifier, Cumulator, addition} from './UIUtils';
import { titleCase } from "./utils";
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";
import { integerPropType } from "@mui/utils";
import {seasons} from './seasons'

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 600, timeTranslator:(value) => {
            let daysInYear = 12;
            let year = parseInt(value/daysInYear) + 1;
            let day = value - (year - 1)*daysInYear + 1;
            let season = seasons[parseInt((day-1)*4/daysInYear)]
            return {day, season, year, text: `Day ${day}, ${titleCase(season)}, Year ${year}`}
        }});
        this.bankrupt = new Variable({name: 'bankruptcy (binary)', startingValue: 0})
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 36, bankrupt: this.bankrupt}),
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
    }
}

export default Game;

// Stuff for now:
// - Note from phone: setting a new base value on amount needs a new demands calculation
// - Tools resource depends on iron+wood and boosts productivity like 20% or something?
//       - Having the two input resources doesnt seem to work well => the changeInputResources() function doesnt quite work
//             - should manually subscribe to propSatisfied, and if it doesn't match desired then alter the other propDesireds but not the current one
//       - Have stone, iron and steel tools as upgrades and test them - make sure to destroy the leftovers resource when upgrading (convert it back to raw resources)
//       - Should be able to buy resources on the market that you need as inputs even if you don't produce them (e.g. no iron mine?)
// - Potential simple/important buildings: storage(not trivial but important), weavers (trivial - maybe don't bother with this yet), tavern (trivial), church (trivial), cemetery(trivial), bathhouse(trivial), suclpture/artists studio(trivial), sportsballfield(trivial)
// - Add upgrades for housing - wood to stone brick+wood
// - Add a history to variables - short term, long term and super long term. Plot them?
// - Add a terrain for each settlement that affects building possibilities and building productivities
//      - e.g. -> get coalfields/pig iron in marshland but lower farming yield and labour time, get coal mines and higher mining yield and apothecary in mountains but lower farming and woodcutter yield and labour time,
//            get higher farming yield in farmland but lower iron yield, apothecary and woodcutter yield, get fishing warfs and higher farming by the river but lower mining yield,
//            get higher woodcutting, apothecary and hunting in the forest but lower farming and labour time
// - Determine quality of the harvest at the beginning of the year
// - Add rebellions % chance using happiness+legitimacy
// - Move to the character system!
// - Build weapons

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
//     - Looks like I will need to do this somewhat manually, I can probably do a lot of this with Object.entries() and then handling each case. I need to make sure that single variables that are present in multiple places are reconstructed correctly, so I probably need some global Set() object that get populated/read from
//     - Get the data of the object (all key: value pairs, including Variables initialised correctly) and then change the constructor to recieve props,loadedObject and then read everything you can from the loadedObject instead, but still do all the constructing as usual
// - Do some UX improvement work
// - Playtesting! Myself and friends

// Stuff for later builds:
// - Could make a more complex research system?
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


