import React from 'react'
import { AbstractModifier } from './modifier';
import { roundNumber, HTMLTooltip, titleCase } from '../utils';

export class Variable {
    constructor(props) {
        // console.log('new var created ' + this.name);
        const unnamed = 'unnamed variable'
        this.name = props.name || unnamed;
        if (this.name === unnamed) {
            console.log('Unnamed variable;')
        }
        this.owner = props.owner || '';
        this.currentValue = this.baseValue;
        this.subscriptions = [];
        this.currentDepth = 0;
        this.explanations = [];
        this.baseValueExplanations = [];
        this.max = props.max;
        this.min = props.min;
        this.printSubs = props.printSubs || false;

        this.modifiers = [];
        this.modifierCallbacks = [];
        let startingValue = props.startingValue || 0
        this.setNewBaseValue( startingValue, `base value: ${roundNumber(startingValue)}`);
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
        if (this.max && baseValue > this.max.currentValue) {
            baseValue = this.max.currentValue;
        } else if (this.min && baseValue < this.min.currentValue) {
            baseValue = this.min.currentValue;
        }
        let recalculate = true;
        if (baseValue === this.baseValue) {
            recalculate = false;
        }
        this.baseValue = baseValue;
        this.baseValueExplanations = explanations;
        if (explanations === undefined) {
            throw Error("Need explanation")
        }
        if (this.baseValueExplanations === null) {
            this.baseValueExplanations = [];
        } else if (!Array.isArray(this.baseValueExplanations)) {
            this.baseValueExplanations = [explanations];
        }
        if (recalculate) {
            this.recalculate();
        }
    }
    addModifier(modifier) {
        if (!(modifier instanceof AbstractModifier)) {
            throw Error('not a modifier');
        }
        let modifiers = this.modifiers.map(modifier => modifier);
        modifiers.push(modifier);
        this.setModifiers(modifiers)
    }
    setModifiers(modifiers) {
        if (modifiers.length === this.modifierCallbacks.length) {
            let sameArray = true;
            for (const [i, modifier] of modifiers.entries()) {
                if (modifier !== modifiers[i]) {
                    sameArray = false;
                    break;
                }
            }
            if (sameArray) {
                return; // No need to update
            }
        }
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
            if (modifier === undefined) {
                throw Error('undefined modifier');
            }
            this.modifierCallbacks.push(modifier.subscribe((depth) => {
                self.recalculate();
            }));
        }
    }
    subscribe(callback, reason = '') {
        this.subscriptions.push(callback);
        if (this.printSubs) {
            console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length + ' ' + reason)
        }
        return callback;
    }
    unsubscribe(callback) {
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        if (this.printSubs) {
            console.log("unsubs from "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        }
    }
    callSubscribers(depth) {
        // console.log("Calling subs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(force=false) {
        this.modifiers.sort((a, b) => {
            return a.priority() > b.priority();
        });
        let value = this.baseValue;
        let explanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        for (let modifier of this.modifiers) {
            // if (this.name.includes("production")) {
            //     debugger;
            // }
            let result = modifier.modify(value);
            value = result.result;
            explanations.push({text: result.text, variable: result.variable});
        }
        if (this.max && value > this.max.currentValue) {
            value = this.max.currentValue;
        } else if (this.min && value < this.min.currentValue) {
            value = this.min.currentValue;
        }
        if (this.currentValue !== value) {
            // if (this.name.includes("work")) {
            //     debugger;
            // }
            // if (this.name.includes("production")) {
            //     debugger;
            // }
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
        this.printSubs = props.printSubs || false;
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
            if (this.printSubs) {
                console.log(`${this.name} component unsubscribed from ${this.variable.name}`)
            }
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
                if (this.printSubs) {
                    console.log(`Component subscribed to ${this.variable.name}`)
                }
            }
        }
    }
    render () {
        let ownerText = this.variable.owner ? (this.props.showOwner ? `${this.variable.owner.name}'s ` : '') : '';
        let nameText = this.props.showName ? <span>{this.props.showOwner ? this.variable.name : titleCase(this.variable.name)}: </span> : '';
        let displayValue = parseFloat(this.state.variable.currentValue.toFixed(3));
        return <HTMLTooltip title={
                this.variable.explanations.map((explanation, i) => {
                    if (explanation.variable) {
                        return <span  key={i}><VariableComponent variable={explanation.variable}/><br /></span>
                    } else if (explanation.text) {
                        return <span key={i} >{explanation.text}<br /></span>
                    } else if (typeof(explanation) === 'string') {
                        return <span key={i} >{explanation}<br /></span>;
                    } else if (explanation === null) {
                        return null;
                    } else {
                        throw Error('what');
                    }
                })
            }>
            <span style={{"textAlign": "center"}} >{ownerText}{nameText}{displayValue}{this.props.children}</span>
            </HTMLTooltip>
    }
}

Variable.defaultProps = {
    modifiers: []
};

VariableComponent.defaultProps = {
    showName: true,
    showOwner: true
};

