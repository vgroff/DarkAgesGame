import Settlement from "./settlement/settlement";
import {AggregatorModifier, ListAggModifier, VariableModifier, Variable, Cumulator, additive, VariableComponent, CumulatorComponent} from './utils.js';
 

class Game {
    constructor(gameClock) {
        this.settlements = [
            new Settlement('Capital City', 1),
        ];
        this.gameClock = gameClock;
        this.totalTax = new ListAggModifier(
            {
                name: "Total tax",
                object: this,
                keys: [
                    ["settlements"],
                    ["tax"],
                ],
                type: additive,
                aggregatorCallback: (variable, variables, modifiers=true) => {
                    if (!modifiers) {
                        return {
                            value: variables.reduce((partial_sum, variable) => partial_sum + variable.currentValue, 0),
                            explanation: variables.reduce((partial_sum, variable) => `${partial_sum} ${variable.owner.name} ${variable.name}: ${variable.currentValue},`, "Sum of: "),
                        }
                    } else {
                        return {
                            modifiers: variables.map(variable => new VariableModifier({variable, type:'additive'}))
                        };
                    }
                }
            }
        );

        this.constModifier = new VariableModifier({name:'const modifier', type:additive, startingValue:3});
        this.treasury = new Cumulator({name: 'Treasury', startingValue: 100, timer:this.gameClock, modifiers:[this.constModifier, this.totalTax]});
    }
}

export default Game;

// - variables
//   - Play/pause button
//   - Need some more specific aggregators - ListAggregator that only needs one entry in keys, Sum, Mean etc...
//   - Don't show it in the tooltip when adding 0 or multiplying by 1 -> i.e. don't give an explanation
// - Aggregator has to constantly re-subscribe - not obvious that there's a better way to do this, besides writing cusotm List/Objects with subscribe methods
