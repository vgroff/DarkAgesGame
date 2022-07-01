import React from 'react'

export class Variable {
    constructor(props) {
        console.log('new var created ' + this.name);
        this.name = props.name || 'unnamed variable';
        this.baseValue = props.startingValue || 0;
        this.currentValue = this.baseValue;
        this.modifiers = props.modifiers || [];
        this.subscriptions = [];
        this.currentDepth = 0;
        this.subscribed = false;
        if (!this.subscribed) {
            let self = this;
            for (let modifier of this.modifiers) {
                // console.log(this.name + ' subbing to ' + modifier.name);
                modifier.subscribe((depth) => {
                    self.recalculate();
                });
            }
        }
        this.recalculate();
    }
    componentDidCatch(err) {
        console.log("ERR" + err.stack);
    }
    setNewBaseValue(baseValue) {
        this.baseValue = baseValue;
        this.recalculate();
    }
    subscribe(callback, reason = '') {
        this.subscriptions.push(callback);
        console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length + ' ' + reason)
        return callback;
        // console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    unsubscribe(callback) {
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    callSubscribers(callback, depth) {
        // console.log("Calling subs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(dontSetState=false) {
        let value = this.baseValue;
        for (let modifier of this.modifiers) {
            let newValue = modifier.modify(value);
            // console.log('added ' + (newValue - value));
            value = newValue;
        }
        if (!dontSetState && this.currentValue !== value) {
            this.currentValue = value;
            this.currentDepth += 1;
            if (this.currentDepth < 3) {
                console.log("calling subs");
                this.callSubscribers(this.currentDepth);
            }
            this.currentDepth = 0;
        }
    }
}

export class VariableComponent extends React.Component {
    constructor(props) {
        super(props);
        this.subscribed = false;
        this.ingestProps(props, false);
        if (this.variable) {
            this.state = {currentValue: this.variable.currentValue};
        } else {
            this.state = {currentValue: 'nan'};
        }
        // console.log('new var created ' + this.variable.name + ' subbed: ' + this.variable.subscriptions);
    }
    ingestProps(props, forceSubscribe=false) {
        let wasSubscribed = this.subscribed;
        if (wasSubscribed) {
            this.variable.unsubscribe(this.callback);
            this.subscribed = false
        }
        this.variable = props.variable;
        if (this.variable === undefined) {
            // console.log('new var');
            this.variable = new Variable(props);
        }
        if (wasSubscribed || forceSubscribe) {
            this.trySubscribe();
        }
        // console.log('new props on var ' + this.variable.name);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.variable !== this.props.variable) {
            console.log('NEW PROPS');
            if (!this.props.variable) {
                throw Error('no variable');
            }
            this.ingestProps(this.props);
        }
    }
    componentDidMount() {
        this.trySubscribe();
    }
    componentWillUnmount() {
        if (this.subscribed) {
            this.variable.unsubscribe(this.callback);
            this.subscribed = false            
            console.log("UNSUBSCRIBING TO " + this.variable.name + ' ' + this.variable.subscriptions.length);
        }
    }
    trySubscribe() {
        if (!this.subscribed) {
            let self = this;
            if (this.variable) {
                console.log("SUBSCRIBING TO " + this.variable.name + ' ' + this.variable.subscriptions.length);
                this.callback = this.variable.subscribe(() => {
                    console.log("Variable compenent setting state");
                    self.setState({currentValue:self.variable.currentValue})
                }, 'display');
                this.subscribed = true;
                console.log("SUBSCRIBING TO " + this.variable.name + ' ' + this.variable.subscriptions.length);
            }
        }
    }
    render () {
        return <div>
            Current value: {this.state.currentValue} 
        </div>
    }
}

/* <ol>
{this.props.modifiers.map((modifier, i) => (
<li key={i} ref={i}>{modifier}</li>
))}
</ol>     */

Variable.defaultProps = {
    modifiers: []
};

// The current issue is that we have 2 timers, and the first second one isn't hooked in properly
// 


// What if I actually do what they say though? I could just have the react objects hold the classes?
// - variables
//   - do example cases:
//       - Should defo be able to start with an empty state!!!!!!!!!!!
//       - ORDER THE MODIFIERS CORRECTLY ADDITIVE/MULTIPLICATIVE
//       - Make time of day into a variable
//       - what if the actual list of modifiers changes? would that be handled by props changing? Probs not, might need a separate function
//       - treasury variable increasing by an amount per turn that is the sum of the income variables of a list of settlements
//       - having a modifier depend on another object's variable, e.g. a battle bonus which depend's on the general's culture, where both the general and the culture can change
//       - think about how to use a variable from a completely different place, will it always work? e.g. the 
//   - could try to use the react state object or build my own system
//   - variables depend on modifiers that are either variables or getters
//   - they have a "dirty" boolean
//   - some (most?) variables/modifiers re-calculate each tick, if they need to according to dirtied bool of their modifiers. 
//      Many will accumulate per-tick like gold and resources. 
