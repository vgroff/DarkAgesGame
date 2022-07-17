import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, VariableModifier, Cumulator, addition} from './UIUtils';
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800});
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
// - Build a basic demand system for the population + a rationing system
//     - Some resources aren't cumulative (e.g. construction time/hygiene) might actually be easier to keep construciton time cumulative
//     - Coal demand will need to depend on season (notes in rationing) - make the ideal demand change is the nicest way of doing this
//          - Makes more sense for rations to be set as a proportion of ideal demand - change the ration behaviour to do this
// - Hook up the "upgrade" button - add a construction building/resource?
// - Add a history to variables - short term, long term and super long term. Plot them?
// - Deal with people born/dying from jobs - remove someone at random/add someone at random - do it with probabilities
// - Build housing?
// - Research system
// - Could have conditional variables -> they take either a single true/false variable or two variables to compare and then return different results depending on the outcome

// Stuff for later builds:
// - Add building upkeep
// - Add food decay

// AI reinforcement learning:
// - job setting: iterate through buildings, one NN each, inputs are: demand, stockpile, productivity, unemployed, happiness, health, behaviour/strategy inputs. output is % of unemployed to set to job
// - ration setting: iterate through rations, one NN each, inputs are happiness, health, demand. output is ration %
//    - this one could be trained by running many "simulations" where it has to optimally distributed resources given supply+production
// - building/upgrading: have a nn who's job it is to decide what to build/upgrade (if anything) and to pass that onto job setting NN?

//  Stuff for way later builds:
// - Now build a demand system:
//   - 2 classes: artisans and labourers. Both have the same demand system, but they get different wages
//   - Demand is broken up by priority - simply a resource, an amount and a happiness achieved
//   - always fulfill the best price-value ratio for a given priority
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods

