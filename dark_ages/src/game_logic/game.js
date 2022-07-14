import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, VariableModifier, Cumulator, addition} from './UIUtils';
import {Timer} from './timer'
import { SumAggModifier } from "./variable/sumAgg";

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 20}),
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

// - Add building upkeep - going to need that trending cumulator variable
// - Build a basic demand system for the population + a rationing system
//     - Show the ideal ration along the other two
//     - Create+display happiness variable
//     - Health needs to be a trending variable
//     - Some resources aren't cumulative (e.g. construction time/hygiene) might actually be easier to keep construciton time cumulative
//     - Coal demand will need to depend on season (notes in rationing)
// - Hook up the "upgrade" button - add a construction building/resource?
// - Build housing?

// - Now build a demand system:
//   - 2 classes: artisans and labourers. Both have the same demand system, but they get different wages
//   - Demand is broken up by priority - simply a resource, an amount and a happiness achieved
//   - always fulfill the best price-value ratio for a given priority
// - variables
//   - Making a trending variable - gonna be very similar to cumulator
//   - Need some more specific aggregators - use ListAggregator to make Sum, Mean etc...
//   - Don't show it in the tooltip when adding 0 or multiplying by 1 -> i.e. give an empty explain
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods
