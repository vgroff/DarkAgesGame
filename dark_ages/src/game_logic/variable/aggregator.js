import { VariableModifier } from "./modifier";
import { Variable } from "./variable";


export class AggregatorModifier extends VariableModifier {
    constructor(props) {
        super(props);
        this.aggregatorCallback = props.aggregatorCallback;
        this.aggregatorList = props.aggregatorList;
        if (this.aggregatorList && props.aggregate) {
            throw Error("Cant have both");
        }
        if (this.aggregatorList === undefined && props.aggregate) {
            this.aggregatorList = [props.aggregate];
        }
        this.keys = props.keys;
        if (this.aggregatorCallback === undefined || this.aggregatorList === undefined || this.keys === undefined) {
            throw Error("need callback and aggregate list and keys (even if empty)")
        }
        if (!Array.isArray(this.keys)) {
            throw Error('aggregator keys should be an array')
        }
        this.variableSubscriptions = [];
        this.variables = [];
        this.resubscribeToVariables(0);
    }

    modify(value, indent=0) {
        this.resubscribeToVariables(indent); //  Need to resub in case the aggregates have changed?
        return super.modify(value, indent);
    }

    aggregate(indent=0) {
        let result = this.aggregatorCallback(this.variable, this.variables);
        if (result.modifiers) {
            this.variable.setModifiers(result.modifiers, indent);
        } else {
            this.variable.setNewBaseValue(result.value, result.explanation, indent);
        }
    }

    getVariables(aggregatorList, keysList) {
        let variables = [];
        for (const [index, obj] of aggregatorList.entries()) {
            let variable = obj;
            for (let keys of keysList[index]) {
                if (!Array.isArray(keys)) {
                    keys = [keys];
                }
                for (const key of keys) {
                    variable = variable[key];
                }
                if (variable === undefined) {
                    throw Error("undefined variable");
                }
            }
            if (variable instanceof Variable) {
                variables.push(variable);
            } else {
                throw Error("expect variable");
            }
        }
        return variables;
    }
 
    resubscribeToVariables(indent=0) {
        for (let i = 0; i < this.variable.length; i++) {
            this.variableSubscriptions.forEach(sub => this.variables[i].unsubscribe(sub));
        }
        this.variables = this.getVariables(this.aggregatorList, this.keys);
        this.variableSubscriptions = [];
        this.variableSubscriptions = this.variables.map(variable => variable.subscribe((indent) => {this.aggregate(indent)}, 'aggregator'));
        this.aggregate(indent);
    }
}
