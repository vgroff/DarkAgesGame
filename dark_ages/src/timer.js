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
        console.log("attempt Stop timer " + this.timerNumber);
        if (this.started) {
            console.log("Stop timer " + this.timerNumber);
            clearInterval(this.intervalID);
            this.started = false;
        }
    };
    startTimer() {
        console.log("attempt Starting timer " + this.timerNumber);
        if (!this.started) {
            console.log("Starting timer " + this.timerNumber);
            let self = this;
            this.intervalID = setInterval(() => {
                self.setNewBaseValue(self.currentValue + 1);
            }, 1000);
            this.started = true;
        }
    };
}

export class TimerComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    componentdidCatch(err, errInfo) {
        console.log("ERR catch" + errInfo);
    }
    static getDerivedStateFromError(err, errInfo) {
        console.log("ERR " + err);
    }
    render () {
        return <div>
            <Variable variable={this.props.variable}/> days
        </div>
    }
}