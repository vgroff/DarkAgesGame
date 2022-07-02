import React from 'react'
import ReactTooltip from 'react-tooltip';

export class Variable {
    constructor(props) {
        // console.log('new var created ' + this.name);
        if (props.name.includes('tax')) {
            console.log(props.name);
        }
        const unnamed = 'unnamed variable'
        this.name = props.name || unnamed;
        if (this.name === unnamed) {
            console.log('Unnamed variable;')
        }
        this.owner = props.owner || '';
        this.baseValue = props.startingValue || 0;
        this.currentValue = this.baseValue;
        this.subscriptions = [];
        this.currentDepth = 0;
        this.explanations = [];
        this.baseValueExplanations = [];

        this.modifiers = [];
        this.modifierCallbacks = [];
        this.setModifiers(props.modifiers || []);
        this.recalculate();
    }
    componentDidCatch(err) {
        console.log("ERR" + err.stack);
    }
    clearSubscriptions() {
        this.subscriptions = [];
    }
    setNewBaseValue(baseValue, explanations) {
        this.baseValue = baseValue;
        this.baseValueExplanations = explanations;
        if (explanations === undefined) {
            throw Error("Need explanation")
        }
        if (explanations === null) {
            this.baseValueExplanations = [];
        } else if (!(typeof(explanations) == Array)) {
            this.baseValueExplanations = [explanations];
        }
        this.recalculate();
    }
    setModifiers(modifiers) {
        for (const [i, modifier] of this.modifiers.entries()) {
            modifier.unsubscribe(this.modifierCallbacks[i]);
        }
        this.modifierCallbacks = [];
        this.modifiers = modifiers;
        this.subscribeToModifiers();
        this.recalculate();
    }
    subscribeToModifiers() {
        let self = this;
        for (let modifier of this.modifiers) {
            this.modifierCallbacks.push(modifier.subscribe((depth) => {
                self.recalculate();
            }));
        }
    }
    subscribe(callback, reason = '') {
        if (this.name.includes('tax')) {
            console.log('subbing to ' + this.name);
        }
        this.subscriptions.push(callback);
        // console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length + ' ' + reason)
        return callback;
        // console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    unsubscribe(callback) {
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    callSubscribers(callback, depth) {
        // console.log("Calling subs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(force=false) {
        if (this.name.includes('otal')) {
            console.log('calc ' + this.name);
        }
        this.modifiers.sort((a, b) => {
            return a.priority() > b.priority();
        });
        let value = this.baseValue;
        let explanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        for (let modifier of this.modifiers) {
            let result = modifier.modify(value);
            value = result.result;
            explanations.push(result.explanation);
        }
        if (this.currentValue !== value) {
            this.currentValue = value;
            this.explanations = explanations;
            this.currentDepth += 1;
            if (this.currentDepth < 3) {
                this.callSubscribers(this.currentDepth);
            }
            this.currentDepth = 0;
            if (isNaN(this.currentValue)) {
                throw Error("nan number");
            }
        }
    }
}

export class VariableComponent extends React.Component {
    constructor(props) {
        if (props.variable === undefined) {
            throw Error('need a variable to show')
        }
        super(props);
        this.subscribed = false;
        this.ingestProps(props, false);
        if (this.variable) {
            this.state = {variable: this.variable};
        } else {
            this.state = {variable: 'nan'};
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
        if (wasSubscribed || forceSubscribe) {
            this.trySubscribe();
        }
        // console.log('new props on var ' + this.variable.name);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.variable !== this.props.variable) {
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
        }
    }
    trySubscribe() {
        if (!this.subscribed) {
            let self = this;
            if (this.variable) {
                this.callback = this.variable.subscribe(() => {
                    self.setState({variable:self.variable})
                }, 'display');
                this.subscribed = true;
            }
        }
    }
    render () {
        let displayValue = Math.round(this.state.variable.currentValue, 3);
        let content = this.variable.explanations.join("\n")
        if (this.props.showName) {
            return <span>
                <p title={content}> {this.variable.name}: {displayValue} </p>
            </span>
        } else {
            return <span>
                Current value: {displayValue} 
            </span>
        }
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

VariableComponent.defaultProps = {
    showName: true
};

// - variables
//   - finish explain/aggregate work
//   - We need the modifiers to have an explain method and for the variable to collect them as modify()s
//   - build the tooltip system for showing modifiers
//   - Refactor the PlayUI into a base class
//   - Don't show the tooltip when adding 0 or multiplying by 1
