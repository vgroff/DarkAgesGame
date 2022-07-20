import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, VariableModifier, Cumulator, addition} from './UIUtils';
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 600});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 36}),
        ];
        this.totalTax = new SumAggModifier(
            {
                name: "Total tax",
                aggregate: this,
                keys: [
                    ["settlements"],
                    ["tax"],
                ],
                type: addition
            }
        );

        this.constModifier = new VariableModifier({name:'const modifier', type:addition, startingValue:3});
        this.treasury = new Cumulator({name: 'Treasury', startingValue: 100, timer:this.gameClock, modifiers:[this.constModifier, this.totalTax]});
    }
}

export default Game;

// Stuff for now:
// - Research system
//     - Make it actually cost research points and check it works properly
//     - Split up the sections on the gui properly
//     - Make research depend on other research do its enabled incrementally
// - Add a "smallest trend" thing to trending variables where once they are within a certain distance of the target they will just switch to it
// - Hook up the upgrade buttons
// - Coal demand will need to depend on season (notes in rationing) - make a change to the ideal demand is the nicest way of doing this
// - Potential simple/important buildings: storage(not trivial but important), weavers (trivial), tavern (trivial), library (trivial), construction site (trivial), church (trivial), cemetery(trivial), bathhouse(trivial), suclpture/artists studio(trivial), sportsballfield(trivial), roads(not too trivial)
// - Add a history to variables - short term, long term and super long term. Plot them?
// - Add a world market for buying/selling at bad prices. Calculate prices from productionRatios. Limit the quantities that can be bought. Both price and quantity depend on some tradeFactor variable.

// Next up:
// - Add a world market for buying/selling at bad prices. Calculate prices from productionRatios. Limit the quantities that can be bought. Both price and quantity depend on some tradeFactor variable.
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Basic event system with user responses and success chances depending on character - crop failures, wolf attacks etc... check phone for ideas
// - Add civilian and military rebellions - add a legitimacy system and low legitmacy+happiness triggers rebellions

// Requirements for MVP:
// - Should test balance with tests -> set up conditions and measure happiness
// - Basic settlement management
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Saving/Loading system?
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


