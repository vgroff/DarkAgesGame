import React from 'react'
import {Variable, VariableComponent} from './variable/variable.js'



export class Timer extends Variable {
    static timerNumber = 1;
    constructor(props) {
        super(props);
        this.started = false;
        this.every = props.every;
        this.timerNumber = Timer.timerNumber;
        this.unit = props.unit || 'time units';
        this.meaning = props.meaning || 'no timer meaning set';
        Timer.timerNumber += 1;
        console.log(`New timer created ${this.name}, timer number: ${this.timerNumber}`);
    }
    stopTimer() {
        if (this.started) {
            clearInterval(this.intervalID);
            this.started = false;
        }
    };
    startTimer() {
        if (!this.started) {
            let self = this;
            this.intervalID = setInterval(() => {
                self.setNewBaseValue(self.currentValue + 1, [this.meaning], 0);
            }, this.every);
            this.started = true;
        }
    };
    forceTick() {
        this.setNewBaseValue(this.currentValue + 1, [this.meaning], 0);
    }
    killTimer() {
        this.stopTimer();
        this.clearSubscriptions();
    }
}

export class TimerComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    componentDidCatch(err, errInfo) {
        console.log("ERR catch" + errInfo);
    }
    static getDerivedStateFromError(err, errInfo) {
        console.log("ERR " + err);
    }
    render () {
        return <span>
            <VariableComponent variable={this.props.variable} children={<span> days</span>}/> 
        </span>
    }
}