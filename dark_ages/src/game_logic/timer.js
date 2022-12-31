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
        this.timeTranslator = props.timeTranslator;
        this.translatedTime =  this.timeTranslator ? this.timeTranslator(this.currentValue) : {text:`${this.currentValue} ${this.unit}`};
        this.forceStops = [];
    }
    stopTimer() {
        if (this.started && !this.isForceStopped()) {
            clearInterval(this.intervalID);
            this.started = false;
        }
    };
    isForceStopped() {
        return this.forceStops.length !== 0;
    }
    isRunning() {
        return this.started;
    }
    forceStopTimer(reason) {
        if (this.started) {
            clearInterval(this.intervalID);
        }
        this.forceStops.push(reason);
    }
    unforceStopTimer(reason) {
        const index = this.forceStops.indexOf(reason);
        if (index > -1) {
            this.forceStops.splice(index, 1); // 2nd parameter means remove one item only
        }
        if (this.started) {
            this.started = false;
            this.startTimer();
        }
    }
    startTimer() {
        if (!this.started && !this.isForceStopped()) {
            let self = this;
            this.intervalID = setInterval(() => {
                this.forceTick();
            }, this.every);
            this.started = true;
        }
    };
    forceTick() {
        if (this.forceStops.length !== 0) {
            return;
        }
        this.translatedTime = this.timeTranslator ? this.timeTranslator(this.currentValue + 1) : {text:`${this.currentValue + 1} ${this.unit}`};
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
            {this.variable.translatedTime.text}
        </span>
    }
}