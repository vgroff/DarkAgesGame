import UIBase from './UIBase';
import {AggregatorModifier, VariableModifier, Variable, Cumulator, additive, VariableComponent, CumulatorComponent} from './utils.js';
import { TimerComponent } from './timer';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import config from './config.js'

class HUD extends UIBase {
    constructor(props) {
        super(props);
        this.props.gameClock.startTimer();
        this.addVariables([this.props.treasury, this.props.gameClock]);
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={3}></Grid>
            <Grid item xs={6}>
                <Grid container spacing={2} style={{"text-align": "center"}}>
                    <Grid item xs={6}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} style={{"text-align": "center"}}>
                                <TimerComponent variable={this.props.gameClock} unit='days' meaning='current day'/>
                            </Grid>
                            <Grid item xs={6} style={{"text-align": "center"}}>
                                <Button variant={config.buttonVariant}>Play</Button>
                            </Grid>
                            <Grid item xs={6} style={{"text-align": "center"}}>
                                <Button variant={config.buttonVariant}>Pause</Button>
                            </Grid>
                        </Grid>
                   </Grid>
                    <Grid item xs={6}>
                        <CumulatorComponent variable={this.props.treasury} timer={this.props.gameClock}/>
                    </Grid>
                </Grid>
            </Grid>
            <Grid item xs={3}></Grid>
        </Grid>
    }
}

export default HUD;