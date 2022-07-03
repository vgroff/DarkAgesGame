import {Settlement, SettlementComponent} from "./settlement/settlement";
import {AggregatorModifier, ListAggModifier, VariableModifier, Variable, Cumulator, addition, VariableComponent, CumulatorComponent} from './utils.js';
import {Timer} from './timer'

class Game {
    constructor(gameClock) {
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day"});
        this.settlements = [
            new Settlement({name: 'Village 1', gameClock: this.gameClock}),
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
                            explanation: variables.reduce((partial_sum, variable) => `${partial_sum} ${variable.owner.name} ${variable.name}: ${variable.currentValue},`, "Sum of: "),
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

// - variables
//   - Making a trending variable - gonna be very similar to cumulator
//   - Need some more specific aggregators - use ListAggregator to make Sum, Mean etc...
//   - Don't show it in the tooltip when adding 0 or multiplying by 1 -> i.e. give an empty explain
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods
