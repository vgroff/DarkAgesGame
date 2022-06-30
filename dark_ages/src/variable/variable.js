import React from 'react'

export class Variable extends React.Component {
    constructor(props) {
        super(props);
        this.baseValue = props.startingValue;
        this.currentValue = this.baseValue;
        this.modifiers = props.modifiers;
        this.subscriptions = [];
        this.currentDepth = 0;
        this.recalculate(true);
        this.state = {currentValue: this.currentValue};
    }
    setNewBaseVal(baseValue) {
        this.baseValue = baseValue;
        this.recalculate();
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
    }
    callSubscribers(callback, depth) {
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(dontSetState=false) {
        let value = this.baseValue;
        for (let modifier of this.modifiers) {
            value = modifier.type.prototype.modify(value);
        }
        if (!dontSetState && this.currentValue !== value) {
            this.currentValue = value;
            this.currentDepth += 1;
            if (this.currentDepth < 3) {
                this.callSubscribers(this.currentDepth);
                this.setState({currentValue: this.currentValue})
            }
            this.currentDepth = 0;
        }
    }
    render () {
        return <div>
            Current value: {this.state.currentValue}
        </div>
    }
}

Variable.defaultProps = {
    modifiers: []
};

export default Variable;

// - variables
//   - do example cases:
//       - ORDER THE MODIFIERS CORRECTLY ADDITIVE/MULTIPLICATIVE
//       - treasury variable increasing by an amount per turn that is the sum of the income variables of a list of settlements
//       - having a modifier depend on another object's variable, e.g. a battle bonus which depend's on the general's culture, where both the general and the culture can change
//       - think about how to use a variable from a completely different place, will it always work? e.g. the 
//   - could try to use the react state object or build my own system
//   - variables depend on modifiers that are either variables or getters
//   - they have a "dirty" boolean
//   - some (most?) variables/modifiers re-calculate each tick, if they need to according to dirtied bool of their modifiers. 
//      Many will accumulate per-tick like gold and resources. 
