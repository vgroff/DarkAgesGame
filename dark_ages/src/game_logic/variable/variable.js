import React from 'react'
import { AbstractModifier } from './modifier';
import { roundNumber, HTMLTooltip, titleCase } from '../utils';
import {Logger} from '../logger'

const unnamedVariableName = 'unnamed variable';

export class Variable {
    static maxStackTrack = 1;
    constructor(props) {
        this.name = props.name || unnamedVariableName;
        if (this.name === unnamedVariableName) {
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
        let self = this;
        if (this.max) {
            this.max.subscribe(() => self.recalculate());
        }
        if (this.min) {
            this.min.subscribe(() => self.recalculate());
        }
        this.printSubs = props.printSubs || false;
        this.displayRound = props.displayRound || 2;

        this.modifiers = [];
        this.modifierCallbacks = [];
        let startingValue = props.startingValue || 0
        this.setNewBaseValue( startingValue, `base value: ${roundNumber(startingValue, this.displayRound)}`);
        if (props.modifiers) {
            this.setModifiers(props.modifiers);
        }
        this.recalculate();
    }
    clearSubscriptions() {
        this.subscriptions = [];
    }
    setNewBaseValue(baseValue, explanations) {
        if (this.name.includes("stone daily demand")) {
            // debugger;
            console.log(`${this.name} base being set to ${baseValue}`);
        }
        if (isNaN(baseValue)) {
            debugger;
            throw Error("nan number");
        }
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
    addModifiers(modifiers) {
        for (const modifier of modifiers) {
            this.addModifier(modifier)
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
        if (modifiers.length === 0 && this.modifiers.length === 0) {
            return;
        }
        if (modifiers.length === this.modifierCallbacks.length) {
            let sameArray = true;
            for (const [i, modifier] of modifiers.entries()) {
                if (modifier !== modifiers[i]) {
                    sameArray = false;
                    break;
                }
            }
            if (sameArray) {
                // console.log("Ignoring call to set modiifers")
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
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        if (this.printSubs) {
            console.log("unsubs from "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        }
    }
    callSubscribers(depth) {
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(quietly=false) {
        //var trace = printStackTrace();
        // if (trace.length > Variable.maxStackTrace) {
        //     Variable.maxStackTrace = trace.length;
        //     console.log(Variable.maxStackTrace);
        // } 
        if (!quietly) {
            this.currentDepth += 1;
        }
        this.modifiers.sort((a, b) => {
            return a.priority() - b.priority();
        });
        let value = this.baseValue;
        let explanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        for (let modifier of this.modifiers) {
            let result = modifier.modify(value, this.displayRound);
            value = result.result;
            if (isNaN(result.result)) {
                throw Error("nan number");
            }
            explanations.push({text: result.text, variable: result.variable, type:modifier.type, textPriority: result.textPriority});
        }
        if (this.max && value > this.max.currentValue) {
            value = this.max.currentValue;
            explanations.push({text: `max value is ${this.max.currentValue}`})
        } else if (this.min && value < this.min.currentValue) {
            value = this.min.currentValue;
            explanations.push({text: `min value is ${this.min.currentValue}`})
        }
        let eps = 1e-8;
        if (!this.currentValue || Math.abs(this.currentValue - value) > eps) {
            this.currentValue = value;
            this.explanations = explanations;
            if (this.currentDepth < 3 && !quietly) {
                this.callSubscribers(this.currentDepth);
            }
            if (isNaN(this.currentValue)) {
                debugger;
                throw Error("nan number");
            }
        } else if (explanations.length !== this.explanations.length) {
            this.explanations = explanations;
        }
        if (!quietly) {
            this.currentDepth = 0;
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
    render (extraChildren, extraStyle) {
        let ownerText = (this.variable.owner && this.props.showOwner && this.variable.owner.name !== unnamedVariableName) ? `${this.variable.owner.name}'s ` : '';
        let nameText = (this.props.showName && this.variable.name !== unnamedVariableName) ? <span>{ownerText ? this.variable.name : titleCase(this.variable.name)}: </span> : '';
        let displayValue = roundNumber(this.props.showBase ? this.variable.baseValue : this.variable.currentValue, this.variable.displayRound);
        let explanations = this.variable.explanations.map((explanation, i) => {
            if (explanation.variable && explanation.textPriority) {
                return <span style={{textAlign: "right"}} key={i} onClick={() => {Logger.setInspect(explanation.variable)}}>{titleCase(explanation.text)}<br /></span> 
            } else if (explanation.variable) {
                return <span style={{textAlign: "right"}} key={i} onClick={() => {Logger.setInspect(explanation.variable)}}>{titleCase(explanation.type)} with <VariableComponent variable={explanation.variable}/><br /></span>
            } else if (explanation.text) {
                return <span style={{textAlign: "right"}} key={i} >{titleCase(explanation.text)}<br /></span>
            } else if (typeof(explanation) === 'string') {
                return <span style={{textAlign: "right"}} key={i} >{titleCase(explanation)}<br /></span>;
            } else if (explanation === null) {
                return null;
            } else {
                throw Error('what');
            }
        });
        if (!this.props.expanded) {
            return <HTMLTooltip title={explanations} style={{textAlign: "right"}}>
                <span style={{"textAlign": "center", ...this.props.style, ...extraStyle}}>
                    <span key={0} onClick={() => {Logger.setInspect(this.variable.owner)}}>{ownerText}</span>
                    <span key={1} onClick={() => {Logger.setInspect(this.variable)}}>{nameText}{displayValue}{this.props.children}{extraChildren}</span>
                </span>
                </HTMLTooltip>
        } else {
            return <div>
                <div style={{"textAlign": "right", ...this.props.style, ...extraStyle}}>
                    <span key={0} onClick={() => {Logger.setInspect(this.variable.owner)}}>{ownerText}</span>
                    <span key={1} onClick={() => {Logger.setInspect(this.variable)}}>{nameText}{displayValue}{this.props.children}{extraChildren}</span>
                </div>
                <div style={{"textAlign": "center", "fontWeight": "bold", ...this.props.style}}>
                    <span style={{}}>Explanation:</span> <br/>
                </div>
                <div style={{"textAlign": "right", ...this.props.style}}>
                    {explanations}
                </div>
                < br/>
                <div style={{"textAlign": "left", ...this.props.style}} onClick={() => {Logger.setInspect({logVar:this.variable})}}>
                    {nameText} Object access
                </div>
            </div>
        }
    }
}

Variable.defaultProps = {
    modifiers: []
};

VariableComponent.defaultProps = {
    showName: true,
    showOwner: true,
    showBase: false,
    expanded: false
};

