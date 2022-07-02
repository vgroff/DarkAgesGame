import {AggregatorModifier, VariableModifier, Variable, Cumulator, additive, VariableComponent} from '../utils.js';

class Settlement {
    constructor(name, tax) {
        this.name = name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: tax});
    }
}

export default Settlement;