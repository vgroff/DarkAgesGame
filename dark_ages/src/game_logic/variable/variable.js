import React from 'react'
import { AbstractModifier } from './modifier';
import { roundNumber, HTMLTooltip, titleCase } from '../utils';
import {Logger} from '../logger'

export const unnamedVariableName = 'unnamed variable';


var textFile;
export function makeTextFile(text){
    var data = new Blob([text], {type: 'text/plain'});

    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);

    // returns a URL you can use as a href
    console.log(textFile);
    return textFile;
};


export class Variable {
    static logText = '';
    static maxStackTrack = 1;
    static logging = false;
    constructor(props) {
        this.name = props.name || unnamedVariableName;
        if (this.name === unnamedVariableName) {
            // console.log('Unnamed variable;')
        }
        this.owner = props.owner || '';
        this.currentValue = this.baseValue;
        this.subscriptions = [];
        this.currentDepth = 0;
        this.explanations = [];
        this.abridgedExplanations = [];
        this.baseValueExplanations = [];
        this.max = props.max;
        this.min = props.min;
        let self = this;
        if (this.max) {
            this.max.subscribe((indent) => self.recalculate('max changed', indent), 'using as a max', 1);
        }
        if (this.min) {
            this.min.subscribe((indent) => self.recalculate('min changed', indent), 'using as a min', 1);
        }
        this.printSubs = props.printSubs || false;
        this.displayRound = props.displayRound || 2;

        this.modifiers = [];
        this.modifierCallbacks = [];
        let startingValue = props.startingValue || 0
        this.setNewBaseValue( startingValue, `init base value: ${roundNumber(startingValue, this.displayRound)}`, 0);
        if (props.modifiers) {
            this.setModifiers(props.modifiers);
        }
        this.visualAlerts = props.visualAlerts;
        this.recalculate('init', 0);
    }
    clearSubscriptions() {
        this.subscriptions = [];
    }
    setNewBaseValue(baseValue, explanations, indent=0) {
        if (this.name.includes("stone daily demand")) {
            // debugger;
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
            this.recalculate(`set new base value - ${explanations}`, indent);
        }
    }
    removeModifier(removedModifier) {
        if (!(removedModifier instanceof AbstractModifier)) {
            throw Error('not a modifier');
        }
        if (!(this.modifiers.find(modifier => modifier === removedModifier))) {
            throw Error("don't have this");
        }
        let modifiers = this.modifiers.filter(modifier => modifier !== removedModifier);
        this.setModifiers(modifiers)       
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
    setModifiers(modifiers, indent=0) {
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
        if (this.modifierCallbacks.length !== this.modifiers.length || undefined in this.modifierCallbacks) {
            throw Error("what");
        }
        this.recalculate('new modifiers', indent);
    }
    subscribeToModifiers() {
        let self = this;
        for (let modifier of this.modifiers) {
            if (modifier === undefined) {
                throw Error('undefined modifier');
            }
            this.modifierCallbacks.push(modifier.subscribe((indent) => {
                try {
                    self.recalculate(`modifier ${modifier.name} changed`, indent);
                } catch(error) {
                    debugger;
                    throw Error("error")
                }
            }, 10));
        }
    }
    subscribe(callback, priority, reason = '') {
        let obj = {callback, priority};
        this.subscriptions.push(obj);
        this.subscriptions = this.subscriptions.sort((a,b) => b.priority - a.priority);
        if (this.printSubs) {
            console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length + ' ' + reason)
        }
        return obj;
    }
    unsubscribe(callbackOrSub) {
        let previousLen = this.subscriptions.length;
        this.subscriptions = this.subscriptions.filter(c => c !== callbackOrSub && c.callback !== callbackOrSub);
        if (previousLen === this.subscriptions.length) {
            throw Error("failed to unsub");
        }
        this.subscriptions = this.subscriptions.sort((a,b) => b.priority - a.priority);
        if (this.printSubs) {
            console.log("unsubs from "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        }
    }
    callSubscribers(indent) {
        let unsubscribers = this.subscriptions.map(subscription => {
            let result = subscription.callback(indent);
            if (result === false) {
                return subscription.callback;
            } else {
                return null;
            }
        })
        unsubscribers.forEach(unsub => {
            if (unsub !== null) {
                this.unsubscribe(unsub);
            }
        });
    }
    recalculate(reason='', indent=0, quietly=false) {
        if (!quietly) {
            this.currentDepth += 1;
        }
        this.modifiers.sort((a, b) => {
            return a.priority() - b.priority();
        });
        let value = this.baseValue;
        let explanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        let abridgedExplanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        for (let modifier of this.modifiers) {
            let result = modifier.modify(value, indent, this.displayRound);
            if (value !== result.result) {
                abridgedExplanations.push({text: result.text, variable: result.variable, type:modifier.type, textPriority: result.textPriority});
            }
            explanations.push({text: result.text, variable: result.variable, type:modifier.type, textPriority: result.textPriority});
            value = result.result;
            if (isNaN(result.result)) {
                throw Error("nan number");
            }
        }
        if (this.max && value > this.max.currentValue) {
            value = this.max.currentValue;
            explanations.push({text: `max value is ${this.max.currentValue}`})
            abridgedExplanations.push({text: `max value is ${this.max.currentValue}`})
        } else if (this.min && value < this.min.currentValue) {
            value = this.min.currentValue;
            explanations.push({text: `min value is ${this.min.currentValue}`})
            abridgedExplanations.push({text: `max value is ${this.min.currentValue}`})
        }
        let eps = 1e-8;
        let absChange = Math.abs(this.currentValue - value);
        if (this.currentValue === undefined || (Math.abs(absChange) > eps && absChange / Math.abs(this.currentValue) > 2e-5)) {
            if (Variable.logging) {
                Variable.logText += '  '.repeat(indent);
                Variable.logText += `recalculated ${this.name} to ${roundNumber(value, 7)} ${ Math.abs(this.currentValue - value)} - ${reason}`;
            }
            this.currentValue = value;
            this.explanations = explanations;
            this.abridgedExplanations = abridgedExplanations;
            if (this.currentDepth < 2 && !quietly) {
                if (Variable.logging) {
                    Variable.logText += `- calling subscribers\n`;
                }
                this.callSubscribers(indent + 1);
            } else {
                if (Variable.logging) {
                    Variable.logText += `- end recursion here\n`;
                }
            }
            if (isNaN(this.currentValue)) {
                debugger;
                throw Error("nan number");
            }
        } else if (explanations.length !== this.explanations.length) {
            this.explanations = explanations;
            this.abridgedExplanations = abridgedExplanations;
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
                }, 0, 'display');
                this.subscribed = true;
                if (this.printSubs) {
                    console.log(`Component subscribed to ${this.variable.name}`)
                }
            }
        }
    }
    render (extraChildren, extraStyle, miscProps={}) {
        let alerts = this.variable.visualAlerts ? this.variable.visualAlerts(this.variable) : null;
        let extraExtraStyle = alerts ? {color: "red"} : {};
        let ownerText = (this.variable.owner && this.props.showOwner && this.variable.owner.name !== unnamedVariableName) ? `${this.variable.owner.name}'s ` : '';
        let nameText = (this.props.showName && this.variable.name !== unnamedVariableName) ? <span>{ownerText ? this.variable.name : titleCase(this.variable.name)}: </span> : '';
        let displayValue = roundNumber(this.props.showBase ? this.variable.baseValue : this.variable.currentValue, this.variable.displayRound);
        let maxText = (this.props.showMax && this.variable.max) ? `/${this.variable.max.currentValue}` : null;
        function mapExplanationToHTML(explanation, i) {
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
        }
        let explanations = this.variable.explanations.map((explanation, i) => mapExplanationToHTML(explanation, i));
        let abridgedExplanations = this.variable.abridgedExplanations.map((explanation, i) => mapExplanationToHTML(explanation, i));
        explanations = explanations.concat(alerts ? alerts.map(alert => {
            return <span style={{textAlign: "right", ...extraExtraStyle}} key={alert} >{titleCase(alert)}<br /></span>;
        }) : []);
        abridgedExplanations = abridgedExplanations.concat(alerts ? alerts.map(alert => {
            return <span style={{textAlign: "right", ...extraExtraStyle}} key={alert} >{titleCase(alert)}<br /></span>;
        }) : []);
        let preText = miscProps.preText || null;
        if (!this.props.expanded) {
            return <HTMLTooltip title={abridgedExplanations} style={{textAlign: "right"}}>
                <span style={{"textAlign": "center", ...this.props.style, ...extraStyle, ...extraExtraStyle}}>
                    <span key={0} onClick={() => {Logger.setInspect(this.variable.owner)}}>{ownerText}</span>
                    <span key={1} onClick={() => {Logger.setInspect(this.variable)}}>{nameText}{preText}{displayValue}{maxText}{this.props.children}{extraChildren}</span>
                </span>
                </HTMLTooltip>
        } else {
            return <div>
                <div style={{"textAlign": "right", ...this.props.style, ...extraStyle}}>
                    <span key={0} onClick={() => {Logger.setInspect(this.variable.owner)}}>{ownerText}</span>
                    <span key={1} onClick={() => {Logger.setInspect(this.variable)}}>{nameText}{preText}{displayValue}{maxText}{this.props.children}{extraChildren}</span>
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
    showMax: false,
    expanded: false
};

