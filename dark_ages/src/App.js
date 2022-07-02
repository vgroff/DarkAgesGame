import './App.css';
import {Timer} from './game_logic/timer.js'
import GameUI from './game_logic/gameUI.js'
import React from 'react';



class App extends React.Component {
    constructor(props) {
        super(props);
        this.timer = new Timer({name: 'Internal timer'});
        this.timer.startTimer();
        this.state = {ready: false};
    }
    stateSetter() {
        this.setState({
            timer: this.timer,
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
            <div><GameUI variable={this.state.aggregator}/></div>
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
