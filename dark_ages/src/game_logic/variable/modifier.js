import React from 'react';
import { Variable } from './variable';
import { roundNumber } from '../utils'

export const multiplication = 'multiplication';
export const addition = 'addition';
export const subtraction = 'subtraction';
export const division = 'division';
export const exponentiation = 'exponentiation';
export const min = 'min';
export const max = 'max';
export const castInt = 'castInt';

export const priority = {
    addition: 1,
    subtraction: 2,
    multiplication: 3,
    division: 4
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
    subscribe(callback) {
        this.subscriptions.push(callback);
        return callback;
        // console.log("subs to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    callSubscribers(callback, depth) {
        this.subscriptions.forEach(subscription => subscription())
    }
    unsubscribe(callback) {
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        // console.log("subs to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
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
        if (!props.priority) {
            throw Error("need priority");
        }
    }
    modify(value) {
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
        this.resubscribeToVariable();
    }   
    modify(value) {
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
        } else if (this.type === subtraction) {
            return {
                result: value - this.variable.currentValue, 
                text: `Subtracted by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            };
        } else if (this.type === multiplication) {
            return {
                result: value*this.variable.currentValue, 
                text: `Multiplied by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            };
        } else if (this.type === division) {
            return {
                result: value/this.variable.currentValue, 
                text: `Divided by ${ownerText}${this.variable.name}: ${roundNumber(this.variable.currentValue, this.variable.displayRound)}`,
                variable: this.variable
            }; 
        } else if (this.type === max) {
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
        } else {
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
    resubscribeToVariable() {
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
        this.variableSubscription = this.variable.subscribe((depth) => {
            self.callSubscribers(depth);
        }, 'modifier value ' + this.name);
        self.callSubscribers(0); // new variable -> call subs again
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

// Dont think the below serves any purpose - can just use the VariableComponent instead
// export class VariableModifierComponent extends React.Component {
//     constructor(props) {
//         if (props.modifier === undefined) {
//             throw Error('need a variable to show')
//         }
//         super(props);
//         this.subscribed = false;
//         this.ingestProps(props, false);
//         if (this.modifier) {
//             this.state = {currentValue: this.modifier.variable.currentValue};
//         } else {
//             this.state = {currentValue: 'nan'};
//         }
//         // console.log('new var created ' + this.variable.name + ' subbed: ' + this.variable.subscriptions);
//     }
//     ingestProps(props, forceSubscribe=false) {
//         let wasSubscribed = this.subscribed;
//         if (wasSubscribed) {
//             this.modifier.unsubscribe(this.callback);
//             this.subscribed = false
//         }
//         this.modifier = props.modifier;
//         if (wasSubscribed || forceSubscribe) {
//             this.trySubscribe();
//         }
//         // console.log('new props on var ' + this.variable.name);
//     }
//     componentDidUpdate(prevProps) {
//         if (prevProps.modifier !== this.props.modifier) {
//             if (!this.props.modifier) {
//                 throw Error('no modifier');
//             }
//             this.ingestProps(this.props);
//         }
//     }
//     componentDidMount() {
//         this.trySubscribe();
//     }
//     componentWillUnmount() {
//         if (this.subscribed) {
//             this.modifier.unsubscribe(this.callback);
//             this.subscribed = false            
//         }
//     }
//     trySubscribe() {
//         if (!this.subscribed) {
//             let self = this;
//             if (this.modifier) {
//                 this.callback = this.modifier.subscribe(() => {
//                     self.setState({currentValue:self.modifier.variable.currentValue})
//                 }, 'display');
//                 this.subscribed = true;
//             }
//         }
//     }
//     render () {
//         return <VariableComponent variable={this.variable}/>
//         // return <CustomTooltip title={''}>
//         //     {this.props.showName ? <span>{this.variable.name}</span> : ''}{this.variable.currentValue} 
//         // </CustomTooltip>
//     }
// }
