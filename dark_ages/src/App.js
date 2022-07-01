import './App.css';
import {Variable, VariableComponent} from './variable/variable.js'
import {additive, VariableModifier} from './variable/modifier.js'
import {Timer, TimerComponent} from './timer.js'
import React from 'react';


class App extends React.Component {
  constructor(props) {
    super(props);
    this.timer = new Timer({name: 'Main timer'});
    this.timer.startTimer();
    console.log('Created timer');
    this.variable = new VariableModifier({name:'timer-based modifier', variable: this.timer, type:additive});
    console.log('Created modifier');
    this.value = new Variable({name:'var1', startingValue: 2, modifiers:[new VariableModifier({name:'const modifier', type:additive, startingValue:3}), this.variable]})
    console.log('Created variable');
    this.state = {
      value: this.value,
      timer: this.timer,
      ready: false
    };
  }
  stateSetter() {
    if (this.state.value) {
      console.log("state", this.value.subscriptions.length);
      console.log("state", this.state.value.subscriptions.length);
    } else {
      console.log('state NO VALUE');
    }
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
  // componentDidUpdate() {
  //   let self = this;
  //   this.timer.startTimer();
  //   this.timer.stopTimer();
  //   this.timer.unsubscribe(this.callback);
  //   this.callback = this.timer.subscribe(() => self.stateSetter(), 'main loop timer');
  // }
  componentWillUnmount() {
    this.timer.stopTimer();
    this.timer.unsubscribe(this.callback);
  }
  render() {
    if (this.state.ready) {
      return (
        <div>
          <VariableComponent variable={this.state.value}/>
          <TimerComponent variable={this.state.timer}/>
        </div> //<TimerComponent variable={this.state.timer}/>
      ); //        <VariableComponent variable={this.state.value}/>
      } else {
        return (
          <div>
            Not ready
          </div> //<TimerComponent variable={this.state.timer}/>
        ); 
      }
  }
}

export default App;
