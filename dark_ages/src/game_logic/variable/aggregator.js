import { VariableModifier } from "./modifier";
import { Variable } from "./variable";


export class AggregatorModifier extends VariableModifier {
    constructor(props) {
        super(props);
        this.aggregatorCallback = props.aggregatorCallback;
        this.objectList = props.objectList;
        if (this.objectList && props.object) {
            throw Error("Cant have both");
        }
        if (this.objectList === undefined && props.object) {
            this.objectList = [props.object];
        }
        this.keys = props.keys;
        if (this.aggregatorCallback === undefined || this.objectList === undefined || this.keys === undefined) {
            throw Error("need callback and object list and keys (even if empty)")
        }
        if (!Array.isArray(this.keys)) {
            throw Error('aggregator keys should be an array')
        }
        this.variableSubscriptions = [];
        this.variables = [];
        this.variables = this.resubscribeToVariables();
    }

    modify(value) {
        this.resubscribeToVariables(); //  Need to resub in case the objects have changed?
        return super.modify(value);
    }

    aggregate() {
        let result = this.aggregatorCallback(this.variable, this.variables);
        if (result.modifiers) {
            this.variable.setModifiers(result.modifiers);
        } else {
            this.variable.setNewBaseValue(result.value, result.explanation);
        }
    }

    getVariables(objectList, keysList) {
        let variables = [];
        for (const [index, obj] of objectList.entries()) {
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
 
    resubscribeToVariables() {
        for (let i = 0; i < this.variable.length; i++) {
            this.variableSubscriptions.forEach(sub => this.variables[i].unsubscribe(sub));
        }
        this.variables = this.getVariables(this.objectList, this.keys);
        this.variableSubscriptions = [];
        this.variableSubscriptions = this.variables.map(variable => variable.subscribe(() => this.aggregate()));
        this.aggregate();
    }
}
