import './App.css';
import {Variable, VariableComponent} from './variable/variable.js'
import {Aggregator, AggregatorComponent} from './variable/aggregator'
import {additive, multiplicative, VariableModifier} from './variable/modifier.js'
import {Timer, TimerComponent} from './timer.js'
import React from 'react';


class App extends React.Component {
  constructor(props) {
    super(props);
    this.gameClock = new Timer({name: 'Game timer'});
    this.gameClock.startTimer();
    this.timer = new Timer({name: 'Internal timer'});
    this.timer.startTimer();
    this.variableModifier = new VariableModifier({name:'timer-based modifier', variable: this.timer, type:multiplicative});
    this.constModifier = new VariableModifier({name:'const modifier', type:additive, startingValue:3});
    this.value = new Variable({name:'var1', startingValue: 2, modifiers:[this.variableModifier, this.constModifier]});
    this.treasury = new Aggregator({name: 'Treasury', startingValue: 100, timer:this.timer, modifiers:[this.constModifier]});
    this.state = {
      value: this.value,
      timer: this.timer,
      ready: false
    };
  }
  stateSetter() {
    // if (this.state.value) {
    //   console.log("state", this.value.subscriptions.length);
    //   console.log("state", this.state.value.subscriptions.length);
    // } else {
    //   console.log('state NO VALUE');
    // }
    this.setState({
      timer: this.timer,
      value: this.value,
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
          <div><AggregatorComponent treasury={this.state.value}/></div>
          <div><VariableComponent variable={this.state.value}/></div>
          <div><TimerComponent variable={this.state.timer}/></div>
          <div><TimerComponent variable={this.state.gameTimer}/></div>
        </div>
      ); 
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
