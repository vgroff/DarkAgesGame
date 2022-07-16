import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, VariableModifier, Cumulator, addition} from './UIUtils';
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 35}),
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
//     - For health effects, introduce an inverse logit modifier y=1/(1+(x^0.9/(1-x^0.9))^-2), y=.5 at x0 set r=-log(2)/log(x0)
//          - Do they need to be variables? Seems overkill but I guess not a real issue
//     - Hook up health to population growth/death
//     - Health needs to be a trending variable
//     - Some resources aren't cumulative (e.g. construction time/hygiene) might actually be easier to keep construciton time cumulative
//     - Coal demand will need to depend on season (notes in rationing)
// - Hook up the "upgrade" button - add a construction building/resource?
// - Add a history to variables - short term, long term and super long term. Plot them?
// - Deal with people born/dying from jobs - remove someone at random/add someone at random - do it with probabilities
// - Build housing?
// - Amount of input resources should also depend on productivity (if it doesnt already?)


// Stuff for later builds:
// - Add building upkeep - going to need that trending cumulator variable

//  Stuff for way later builds:
// - Now build a demand system:
//   - 2 classes: artisans and labourers. Both have the same demand system, but they get different wages
//   - Demand is broken up by priority - simply a resource, an amount and a happiness achieved
//   - always fulfill the best price-value ratio for a given priority
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods
