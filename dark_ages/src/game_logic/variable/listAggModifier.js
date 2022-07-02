import { AggregatorModifier } from "./aggregator";
import { Variable } from "./variable";

export class ListAggModifier extends AggregatorModifier {
    constructor(props) {
        super(props);
        this.aggregatorCallback = props.aggregatorCallback;
        if (this.keys.length !== 2) {
            throw Error("keys should be length 2 exactly")
        }
        if (Array.isArray(this.keys[0][0]) || Array.isArray(this.keys[1][0])) {
            throw Error("keys should be 1d for list agg")
        }
        if (this.keys === undefined || this.objectList.length !== 1) {
            throw Error("need key and size 1 objectList")
        }
    }

    getVariables(objectList, keys) {
        let list = objectList[0]; 
        for (let key of keys[0]) {
            list = list[key];
            if (list === undefined) {
                throw Error("undefined variable");
            }
        }
        if (!Array.isArray(list)) {
            throw Error("not a list");
        }
        let variableList = list.map(variable => {
            for (let key of keys[1]) {
                variable = variable[key];
                if (variable === undefined) {
                    throw Error("undefined variable");
                }
            }
            if (!(variable instanceof Variable)) {
                throw Error("not a variable");
            }
            return variable;
        });
        return variableList;
    }
}

