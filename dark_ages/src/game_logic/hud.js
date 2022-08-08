import UIBase from './UIBase';
import { CumulatorComponent } from './UIUtils';
import { TimerComponent } from './timer';
import Button from '@mui/material/Button';
import config from './config.js'
import Grid from  '@mui/material/Grid';
import { titleCase } from './utils';


class HUD extends UIBase {
    constructor(props) {
        super(props);
        // this.props.gameClock.startTimer();
        this.addVariables([this.props.treasury, this.props.gameClock]);
    }
    childRender() {
        return <Grid container spacing={2}>
        <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
            <Grid container spacing={1} style={{"textAlign": "center", margin: "auto"}}>
                <Grid item xs={12} style={{"textAlign": "center", margin: "auto"}}>
                    <TimerComponent variable={this.props.gameClock} unit='days' meaning='current day'/><br />
                    Harvest this year: {titleCase(this.props.harvestQuality)}
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <Button variant={config.buttonVariant} onClick={this.props.gameClock.startTimer.bind(this.props.gameClock)}>Play</Button>
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <Button variant={config.buttonVariant} onClick={this.props.gameClock.stopTimer.bind(this.props.gameClock)}>Pause</Button>
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <Button variant={config.buttonVariant} onClick={this.props.gameClock.forceTick.bind(this.props.gameClock)}>Next Day</Button>
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