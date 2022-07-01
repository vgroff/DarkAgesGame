import React from 'react'
import {Variable, VariableComponent} from './variable/variable.js'



export class Timer extends Variable {
    static timerNumber = 1;
    constructor(props) {
        super(props);
        this.started = false;
        this.timerNumber = Timer.timerNumber;
        Timer.timerNumber += 1;
        this.name = "Timer " + this.timerNumber;
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
                self.setNewBaseValue(self.currentValue + 1);
            }, 500);
            this.started = true;
        }
    };
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
            <VariableComponent variable={this.props.variable}/> days
        </span>
    }
}