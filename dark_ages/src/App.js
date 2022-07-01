import './App.css';
import {Variable, VariableComponent} from './variable/variable.js'
import {Cumulator, CumulatorComponent} from './variable/cumulator.js'
import { AggregatorModifier } from './variable/aggregator';
import {additive, multiplicative, VariableModifier, VariableModifierComponent} from './variable/modifier.js'
import {Timer, TimerComponent} from './timer.js'
import React from 'react';

class Settlement {
    constructor(name, tax) {
        this.name = name;
        this.tax = new Variable({name:`${this.name} tax`, startingValue: tax});
    }
}

class PlayUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ready: false
        };
        this.subs = [];
        this.variableModifier = new VariableModifier({name:'timer-based modifier', variable: this.timer, type:multiplicative});
        this.constModifier = new VariableModifier({name:'const modifier', type:additive, startingValue:3});
        this.value = new Variable({name:'var1', startingValue: 2, modifiers:[this.variableModifier, this.constModifier]});
    }
    addVarToStateObject(key, variable) {
        this.subs.push({key, variable, callback: variable.subscribe(() => {
            this.setState({ready: true, key: variable});
        })});
    }
    componentDidMount() {
        this.subs.forEach(sub => {
            let state = {ready:true};
            state[sub.key] = sub.variable;
            this.setState(state)
        });
        this.addVarToStateObject('timer', this.props.timer);
        this.addVarToStateObject('value', this.value);
    }
    componentWillUnmount() {
        this.subs.forEach(sub => sub.variable.unsubscribe(sub.callback));
    }
    render() {
        if (this.state.ready) {
            return <div> 
                <div><VariableComponent variable={this.state.value}/></div>
                <div><TimerComponent variable={this.props.timer}/></div>
            </div>
        } else {
            return <div>Not Ready</div>
        }
    }
}


class App extends React.Component {
    constructor(props) {
        super(props);
        this.gameClock = new Timer({name: 'Game timer'});
        this.gameClock.startTimer();
        this.timer = new Timer({name: 'Internal timer'});
        this.timer.startTimer();
        this.settlements = [
            new Settlement('settlement1', 5),
            new Settlement('settlement2',12),
            new Settlement('settlement3',2)
        ];
        this.aggregator = new AggregatorModifier(
            {
                name: "Total tax",
                objectList: [
                    this,
                    this,
                    this
                ],
                keys: [
                    ["settlements", 0, "tax"],
                    ["settlements", 1, "tax"],
                    ["settlements", 2, "tax"]
                ],
                type: additive,
                aggregatorCallback: (variable, variables) => {
                    return {
                        value: variables.reduce((partial_sum, variable) => partial_sum + variable.currentValue, 0),
                        explanation: variables.reduce((partial_sum, variable) => `${partial_sum}, ${variable.name} - ${variable.currentValue}`, "Sum of: "),
                    }
                }
            }
        );
        this.constModifier = new VariableModifier({name:'const modifier', type:additive, startingValue:3});
        this.treasury = new Cumulator({name: 'Treasury', startingValue: 100, timer:this.timer, modifiers:[this.constModifier]});
        this.state = {
            value: this.value,
            timer: this.timer,
            ready: false
        };
    }
    stateSetter() {
        this.setState({
            timer: this.timer,
            value: this.value,
            treasury: this.treasury,
            aggregator: this.aggregator.variable,
            ready: true
        });
    }
    componentDidMount() {
        let self = this;
        this.timer.startTimer();
        this.callback = this.timer.subscribe(() => self.stateSetter(), 'main loop timer');
    }
    componentWillUnmount() {
        this.timer.stopTimer();
        this.timer.unsubscribe(this.callback);
    }
    render() {
        if (this.state.ready) {
        return (
            <div>
            <div><VariableComponent variable={this.state.aggregator}/></div>
            <div><CumulatorComponent variable={this.state.treasury}/></div>
            <div><VariableModifierComponent modifier={this.constModifier}/></div>
            </div>
        ); //<PlayUI timer={this.state.timer} gameTimer={this.state.gameTimer}/>
        } else {
            return (
            <div>
                Not ready
            </div> 
            ); 
        }
    }
    }

    export default App;
