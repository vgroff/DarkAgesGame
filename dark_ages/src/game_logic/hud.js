import UIBase from './UIBase';
import {AggregatorModifier, VariableModifier, Variable, Cumulator, additive, VariableComponent, CumulatorComponent} from './utils.js';
import { TimerComponent } from './timer';
import Button from '@mui/material/Button';
import config from './config.js'
import Grid from  '@mui/material/Grid';


class HUD extends UIBase {
    constructor(props) {
        super(props);
        this.props.gameClock.startTimer();
        this.addVariables([this.props.treasury, this.props.gameClock]);
    }
    childRender() {
        return <Grid container spacing={2}>
        <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
            <Grid container spacing={2} style={{"textAlign": "center", margin: "auto"}}>
                <Grid item xs={12} style={{"textAlign": "center", margin: "auto"}}>
                    <TimerComponent variable={this.props.gameClock} unit='days' meaning='current day'/>
                </Grid>
                <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
                    <Button variant={config.buttonVariant} onClick={this.props.gameClock.startTimer}>Play</Button>
                </Grid>
                <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
                    <Button variant={config.buttonVariant} onClick={this.props.gameClock.stopTimer}>Pause</Button>
                </Grid>
            </Grid>
        </Grid>
        <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
            <CumulatorComponent variable={this.props.treasury} timer={this.props.gameClock}/>
        </Grid>
    </Grid>
    }
}

export default HUD;