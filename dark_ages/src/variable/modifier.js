import React from 'react';

export const multiplicative = 'multiplicative';
export const additive = 'additive';

export class AbstractModifier extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        let self = this;
        this.subscriptions = [];
        this.value.subscribe((depth) => {
            self.callSubscribers(depth);
        });
        this.type = props.type;
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
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
        this.value = props.value;
    }
    subscribe(callback) {
        this.subscriptions.push(callback);
    }
    callSubscribers(callback, depth) {
        this.subscriptions.forEach(subscription => subscription())
    }
    modify(value) {
        if (super.type === additive) {
            return value + this.value.currentValue;
        } else if (super.type === multiplicative) {
            return value*this.value.currentValue;
        } else {
            throw Error("what");
        }
    }
    render () {
        return <div>
            Modifer: {this.value}
        </div>
    }
}

