import { additive, multiplicative, VariableModifier } from "./modifier";
import { Variable } from "./variable";


export class AggregatorModifier extends VariableModifier {
    constructor(props) {
        super(props);
        this.aggregatorCallback = props.aggregatorCallback;
        this.objectList = props.objectList;
        this.keys = props.keys;
        if (this.aggregatorCallback === undefined || this.objectList === undefined || this.keys === undefined) {
            throw Error("need callback and object list and keys (even if empty)")
        }
        this.subscriptions = [];
        this.variables = [];
        this.variables = this.subscribeToVariables();
    }

    modify(value) {
        let newVariable = this.aggregatorCallback(this.variable, this.variables);
        this.variable.setNewBaseValue(newVariable);
        return super.modify(value);
    }

    priority() {
        if (this.type === additive) {
            return 0;
        } else if (this.type === multiplicative) {
            return 1;
        } else {
            throw Error("what");
        }
    }

    subscribeToVariables() {
        for (let i = 0; i < this.variable.length; i++) {
            this.subscriptions.forEach(sub => this.variables[i].unsubscribe(sub));
        }
        this.subscriptions = [];
        for (const [index, obj] of this.objectList.entries()) {
            let variable = obj;
            for (let keys of this.keys[index]) {
                if (typeof(keys) !== Array) {
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
                this.variables.push(variable);
                this.subscriptions.push(variable.subscribe(() => this.variable.recalculate()));
            } else {
                throw Error("expect variable");
            }
        }
    }
}
