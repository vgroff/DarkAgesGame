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
            return value + this.variable.currentValue;
        } else if (this.type === multiplicative) {
            return value*this.variable.currentValue;
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

