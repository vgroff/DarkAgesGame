import { VariableModifier } from "./modifier";
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
        this.variableSubscriptions = [];
        this.variables = [];
        this.variables = this.subscribeToVariables();
    }

    modify(value) {
        this.aggregate();
        return super.modify(value);
    }

    aggregate() {
        let result = this.aggregatorCallback(this.variable, this.variables);
        this.variable.setNewBaseValue(result.value);
        // setNewBaseValue doesn't trigger a modify so no explanations account
        // even if we force pushed new updates, how would we clear out old ones?
        // IDEA: aggregator callback could return a list of modifiers instead?
    }
 
    subscribeToVariables() {
        for (let i = 0; i < this.variable.length; i++) {
            this.variableSubscriptions.forEach(sub => this.variables[i].unsubscribe(sub));
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
                this.variableSubscriptions.push(variable.subscribe(() => this.aggregate()));
                this.aggregate();
            } else {
                throw Error("expect variable");
            }
        }
        return this.variables;
    }
}
