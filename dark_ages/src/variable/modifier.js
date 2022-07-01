import React from 'react';
import { Variable } from './variable';

export const multiplicative = 'multiplicative';
export const additive = 'additive';

export class AbstractModifier {
    constructor(props) {
        this.name = props.name || 'unnamed modifier';
        this.subscriptions = [];
        this.type = props.type;
        if (this.type === undefined){
            throw Error('Need this');
        }
        this.dirty = true;
    }
    isDirty() {
        return this.dirty;
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
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

export class VariableModifier extends AbstractModifier {
    constructor(props) {
        super(props);
        this.variable = props.variable;
        if (this.variable === undefined) {
            this.variable = new Variable(props);
        }
        let self = this;
        this.variable.subscribe((depth) => {
            self.callSubscribers(depth);
        }, 'modifier value ' + this.name);
    }   
    modify(value) {
        if (this.type === additive) {
            return {
                result: value + this.variable.currentValue, 
                explanation: `Added ${this.variable.name}: ${this.variable.currentValue}`, 
                variable: this.variable
            };
        } else if (this.type === multiplicative) {
            return {
                result: value*this.variable.currentValue, 
                explanation: `Multiplied by ${this.variable.name}: ${this.variable.currentValue}`,
                variable: this.variable
            };
        } else {
            throw Error("what");
        }
    }
    priority() {
        if (this.type === additive) {
            return 0;
        } else if (this.type === multiplicative) {
            return 1;
        } else {
            throw Error("what");
        }
    }
}

export class VariableModifierComponent extends React.Component {
    constructor(props) {
        if (props.modifier === undefined) {
            throw Error('need a variable to show')
        }
        super(props);
        this.subscribed = false;
        this.ingestProps(props, false);
        if (this.modifier) {
            this.state = {currentValue: this.modifier.variable.currentValue};
        } else {
            this.state = {currentValue: 'nan'};
        }
        // console.log('new var created ' + this.variable.name + ' subbed: ' + this.variable.subscriptions);
    }
    ingestProps(props, forceSubscribe=false) {
        let wasSubscribed = this.subscribed;
        if (wasSubscribed) {
            this.modifier.unsubscribe(this.callback);
            this.subscribed = false
        }
        this.modifier = props.modifier;
        if (wasSubscribed || forceSubscribe) {
            this.trySubscribe();
        }
        // console.log('new props on var ' + this.variable.name);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.modifier !== this.props.modifier) {
            if (!this.props.modifier) {
                throw Error('no modifier');
            }
            this.ingestProps(this.props);
        }
    }
    componentDidMount() {
        this.trySubscribe();
    }
    componentWillUnmount() {
        if (this.subscribed) {
            this.modifier.unsubscribe(this.callback);
            this.subscribed = false            
        }
    }
    trySubscribe() {
        if (!this.subscribed) {
            let self = this;
            if (this.modifier) {
                this.callback = this.modifier.subscribe(() => {
                    self.setState({currentValue:self.modifier.variable.currentValue})
                }, 'display');
                this.subscribed = true;
            }
        }
    }
    render () {
        let displayValue = Math.round(this.state.currentValue, 3);
        if (this.props.showName) {
            return <span>
                {this.modifier.name}: {displayValue} 
            </span>
        } else {
            return <span>
                Current value: {displayValue} 
            </span>
        }
    }
}
