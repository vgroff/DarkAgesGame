import React from 'react';
import { Variable } from './variable';

export const multiplicative = 'multiplicative';
export const additive = 'additive';

export class AbstractModifier {
    constructor(props) {
        this.name = props.name;
        this.state = {};
        this.subscriptions = [];
        this.type = props.type;
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
        // console.log("subs to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    callSubscribers(callback, depth) {
        this.subscriptions.forEach(subscription => subscription())
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
    subscribe(callback) {
        // console.log('subbed to ' + this.name);
        this.subscriptions.push(callback);
        return callback;
    }
    callSubscribers(callback, depth) {
        this.subscriptions.forEach(subscription => subscription());
    }
    modify(value) {
        if (this.type === additive) {
            return value + this.variable.currentValue;
        } else if (this.type === multiplicative) {
            return value*this.variable.currentValue;
        } else {
            throw Error("what");
        }
    }
}

