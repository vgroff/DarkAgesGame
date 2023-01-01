import { ListAggModifier } from "./listAggModifier";
import { VariableModifier } from "./modifier";

export class SumAggModifier extends ListAggModifier { 

    constructor(props) {
        props.aggregatorCallback = (variable, variables, modifiers=props.useModifiers) => {
            if (modifiers === undefined) {modifiers = true}
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
        super(props);
    }
}