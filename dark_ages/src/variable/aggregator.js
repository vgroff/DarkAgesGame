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
        if (result.modifiers) {
            this.variable.setModifiers(result.modifiers);
        } else {
            this.variable.setNewBaseValue(result.value, result.explanation);
        }
        // if result returns a bunch of variableModifiers instead, we can attach them to this.variable
        // we just need to do it so that this.variable handles it correctly

        // setNewBaseValue doesn't trigger a modify so no explanations accrue
        // even if we force pushed new updates, how would we clear out old ones?
        // IDEA: aggregator callback could return a list of modifiers instead?
        // OTHER PROBS BETTER IDEA: have an explanation with setBaseValue() and have a separate explanations array for the base value and tell
        //       it whether to wipe the base value explanation history or not (by default it will)
        // CONTRARY: idk, doing it properly with a list of modifiers could genuinely be better
        // It would just need to be able to set modifiers and clear modifiers on this.variable in the subscribeToVariables() method
        // It would be quite simple and would carry over well
        // COMPROMISE: do both/either
        // how to hook in the modify? Need to attach it to the variable
        // Maybe shouldnt extend the VariableModifier, maybe they should do it's own thing
    }
 
    subscribeToVariables() {
        for (let i = 0; i < this.variable.length; i++) {
            this.variableSubscriptions.forEach(sub => this.variables[i].unsubscribe(sub));
        }
        this.variableSubscriptions = [];
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
