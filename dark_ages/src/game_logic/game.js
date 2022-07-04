import {Settlement, } from "./settlement/settlement";
import {ListAggModifier, VariableModifier, Cumulator, addition} from './UIUtils';
import {Timer} from './timer'

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day", every: 800});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock, startingPopulation: 40}),
        ];
        this.totalTax = new ListAggModifier(
            {
                name: "Total tax",
                aggregate: this,
                keys: [
                    ["settlements"],
                    ["tax"],
                ],
                type: addition,
                aggregatorCallback: (variable, variables, modifiers=true) => {
                    if (!modifiers) {
                        return {
                            value: variables.reduce((partial_sum, variable) => partial_sum + variable.currentValue, 0),
                            text: variables.reduce((partial_sum, variable) => `${partial_sum} ${variable.owner.name} ${variable.name}: ${variable.currentValue},`, "Sum of: "),
                        }
                    } else {
                        return {
                            modifiers: variables.map(variable => new VariableModifier({variable, type:'addition'}))
                        };
                    }
                }
            }
        );

        this.constModifier = new VariableModifier({name:'const modifier', type:addition, startingValue:3});
        this.treasury = new Cumulator({name: 'Treasury', startingValue: 100, timer:this.gameClock, modifiers:[this.constModifier, this.totalTax]});
    }
}

export default Game;

// - Inputs into resource buildings => going well, but need to:
//   a) fix the cumulator component so that it shows amountTurnStart and change
//   b) some weird behaviour going on for the quarry+stonecutters near 0 -> should investigate
// - Add building upkeep - going to need that trending cumulator variable
// - Settlement.jobsTaken is a great candidate for the SumAggregetor
// - Deal with the fuel variable issue - give it infinite storage? 
//   Don't bother with making it a resource? Would be easier to apply demand though perhaps? Maybe leave until demand sorted
// - Now build a demand system:
//   - 2 classes: artisans and labourers. Both have the same demand system, but they get different wages
//   - Demand is broken up by priority - simply a resource, an amount and a happiness achieved
//   - always fulfill the best price-value ratio for a given priority
// - Build housing?
// - variables
//   - Making a trending variable - gonna be very similar to cumulator
//   - Need some more specific aggregators - use ListAggregator to make Sum, Mean etc...
//   - Don't show it in the tooltip when adding 0 or multiplying by 1 -> i.e. give an empty explain
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods
