import React from 'react';
import { Variable } from './variable';
import { roundNumber } from '../utils'

export const multiplication = 'multiplication';
export const addition = 'addition';
export const subtraction = 'subtraction';
export const division = 'division';
export const exponentiation = 'exponentiation';
export const invLogit = 'invLogit'; // From https://stats.stackexchange.com/questions/214877/is-there-a-formula-for-an-s-shaped-curve-with-domain-and-range-0-1
export const min = 'min';
export const minBase = 'min with base value';
export const max = 'max';
export const castInt = 'castInt';
export const roundTo = 'round to decimal';
export const scaledAddition = 'scaledAddition';
export const scaledMultiplication = 'scaledMultiplication';
export const greaterThan = 'greaterThan';
export const lesserThan = 'lesserThan';

function compare(val1, comparator, val2) {
    return val1 > val2 ? comparator === greaterThan : val1 < val2;
}


export const priority = {
    addition: 1,
    scaledAddition: 1,
    subtraction: 2,
    multiplication: 3,
    scaledMultiplication: 3,
    division: 4,
    exponentiation: 5
};

export class AbstractModifier {
    constructor(props) {
        this.name = props.name || 'unnamed modifier';
        this.subscriptions = [];
        this.type = props.type;
        if (this.type === undefined){
            throw Error('Need this');
        }
    }
    subscribe(callback, proiority=0) {
        let obj = {callback, priority};
        this.subscriptions.push(obj);
        this.subscriptions = this.subscriptions.sort((a,b) => b.priority - a.priority);
        return obj;
    }
    callSubscribers(indent) {
        this.subscriptions.forEach(subscription => subscription.callback(indent))
    }
    unsubscribe(callback) {
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        this.subscriptions = this.subscriptions.sort((a,b) => b.priority - a.priority);
    }
    render () {
        return <div>
            Modifer: {this.value}
        </div>
    }
}

export class UnaryModifier extends AbstractModifier {
    constructor(props) {
        super(props);
        this.customPriority = props.customPriority;
        if (!props.customPriority) {
            throw Error("need priority");
        }
    }
    modify(value, indent=0) {
        if (this.type === castInt) {
            return {
                result: parseInt(value), 
                text: `Cast to integer`
            };
        } else {
            throw Error("what");
        }
    }
    priority() {
        return this.customPriority;
    }
}

export class VariableModifier extends AbstractModifier {
    constructor(props) {
        super(props);
        this.customPriority = props.customPriority;
        this.object = props.object || null;
        this.keys = props.keys || null;
        if (this.keys && !Array.isArray(this.keys)) {
            throw Error('VariableModifier keys should be an array')
        }
        if (props.variable && (props.keys || props.object)) {
            throw Error('cant take both')
        }
        if (this.object && !this.keys) {
            throw Error('inconsistent')
        }
        this.variable = props.variable;
        if (!this.variable && !(this.keys && this.object)) {
            this.variable = new Variable(props);
        }
        if (!(this.variable instanceof Variable)) {
            throw Error("variable should be a variable, is it a modifier? pass modifier.variable instead")
        }
        if (this.name === 'unnamed modifier') {
            this.name = `${this.variable.name} based modifier`
        }
        if (this.type === invLogit) {
            this.invLogitSpeed = props.invLogitSpeed;
            if (this.invLogitSpeed === undefined) {throw Error("need dinvLogitSpeed");}
        }
        if (this.type === invLogit || this.type === scaledAddition || this.type === scaledMultiplication) {
            this.scale = props.scale || 1;
            this.bias = props.bias || 0;
            this.offset = props.offset || null;
            this.exponent = props.exponent || 1;
        }
        this.resubscribeToVariable();
    }
    scaleValue(x) {
        let scaledValue;
        if (this.offset && this.variable.currentValue < this.offset) { 
            x = this.offset;
        }
        if (this.offset) {
            x = (x - this.offset);
        }
        scaledValue = this.bias + this.scale*(x)**this.exponent;

        let scaleText = '';
        if (this.scale !== 1) {
            scaleText = ` with scale ${roundNumber(this.scale, this.variable.displayRound)}`;
        }
        let biasText = '';
        if (this.bias) {
            biasText = ` with bias ${roundNumber(this.bias, this.variable.displayRound)}`;
        }
        let expText = '';
        if (this.exp !== 1) {
            expText = ` with exp ${roundNumber(this.exponent, this.variable.displayRound)}`;
        }
        if (isNaN(scaledValue)) {
            throw Error("nan number");
        }
        return {value: scaledValue, text:`${scaleText}${biasText}${expText}`}
    }
    modify(value, indent=0, displayRound = 3) {
        if (this.keys && this.object) {
            this.resubscribeToVariable();
        }
        let ownerText = this.variable.owner ? `${this.variable.owner.name}'s ` : '';
        if (this.type === addition) {
            return {
                result: value + this.variable.currentValue, 
                text: `Added ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`, 
                variable: this.variable
            };
        } else if (this.type === scaledAddition) {
            const scaledValue = this.scaleValue(this.variable.currentValue);
            const result = value + scaledValue.value;
            return {
                result: result, 
                textPriority: true,
                text: `Added ${ownerText}${this.variable.name} scaled by ${scaledValue.text} ${roundNumber(value, displayRound)}+${roundNumber(scaledValue.value, this.displayRound)} -> ${roundNumber(result, displayRound + 1)}`, 
                variable: this.variable
            };
        } else if (this.type === subtraction) {
            return {
                result: value - this.variable.currentValue, 
                text: `Subtracted by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            };
        } else if (this.type === multiplication) {
            return {
                result: value*this.variable.currentValue, 
                text: `Multiplied by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, displayRound)}`,
                variable: this.variable
            };
        } else if (this.type === scaledMultiplication) {
            const scaledValue = this.scaleValue(this.variable.currentValue);
            const result = value*scaledValue.value;
            return {
                result: result, 
                textPriority: true,
                text: `Multiplied by ${ownerText}${this.variable.name} scaled by ${scaledValue.text} ${roundNumber(value, this.displayRound)}x${roundNumber(scaledValue.value, this.displayRound)} -> ${roundNumber(result, displayRound + 1)}`, 
                variable: this.variable
            };
        }  else if (this.type === division) {
            if (this.variable.currentValue === 0) {
                throw Error("dividing by zero");
            }
            return {
                result: value/this.variable.currentValue, 
                text: `Divided by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        } else if (this.type === exponentiation) {
            return {
                result: value**this.variable.currentValue, 
                text: `To the power of ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        } else if (this.type === invLogit) {
            // From https://stats.stackexchange.com/questions/214877/is-there-a-formula-for-an-s-shaped-curve-with-domain-and-range-0-1
            let r = -Math.log(2) / Math.log(this.variable.currentValue);
            let sCurveResult;
            if (value <= 0) {
                sCurveResult = 0;
            } else if (value >= 1) {
                sCurveResult = 1;
            } else {
                sCurveResult = 1/(1+(value**r/(1-value**r))**(-this.invLogitSpeed));
            }
            sCurveResult = this.scaleValue(sCurveResult);
            if (isNaN(sCurveResult.value)) {
                throw Error("nan");
            }
            return {
                result: sCurveResult.value, 
                text: `S curve with speed ${this.invLogitSpeed} and midpoint ${this.variable.name} and ${sCurveResult.text}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)} -> ${roundNumber(sCurveResult.value, this.variable.displayRound)}`,
            }; 
        }    else if (this.type === max) {
            return {
                result: Math.max(value, this.variable.currentValue), 
                text: `Maxed with ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        } else if (this.type === min) {
            return {
                result: Math.min(value, this.variable.currentValue), 
                text: `Mined with ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        } else if (this.type === minBase) {
            return {
                result: Math.min(value, this.variable.baseValue), 
                text: `Mined with base value of ${ownerText}${this.variable.name}: ${roundNumber(this.variable.baseValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        }  else if (this.type === roundTo) {
            return {
                result: roundNumber(value, this.variable.currentValue), 
                text: `Rounded to ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        }  else {
            throw Error("what");
        }
    }
    priority() {
        if (this.customPriority) {
            return this.customPriority;
        } else if (this.type in priority) {
            return priority[this.type];
        } else {
            throw Error("what");
        }
    }
    resubscribeToVariable(indent = 0) {
        let currentValue = this.variable.currentValue;
        if (this.keys && this.object) {
            let variable = this.getVariable();
            if (this.variable === variable) {
                return; // No need to re sub
            }
            if (this.variable) {
                this.variable.unsubscribe(this.variableSubscription);
            }
            this.variable = variable;
        }
        let self = this;
        this.variableSubscription = this.variable.subscribe((indent) => {
            self.callSubscribers(indent);
        }, 5, 'modifier value ' + this.name);
        let eps = 1e-8;
        if (Math.abs(this.variable.currentValue - currentValue) > eps) {
            self.callSubscribers(0, indent); // new variable -> call subs again
        }
    }
    getVariable() {
        let variable = this.object;
        for (let key of this.keys) {
            variable = variable[key];
            if (variable === undefined) {
                throw Error("undefined variable");
            }
        }
        if (variable instanceof Variable) {
            return variable;
        } else {
            throw Error("expect variable");
        }
    }
}

