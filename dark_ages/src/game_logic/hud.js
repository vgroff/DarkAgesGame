import UIBase from './UIBase';
import { CumulatorComponent } from './UIUtils';
import { TimerComponent } from './timer';
import Button from '@mui/material/Button';
import config from './config.js'
import Grid from  '@mui/material/Grid';
import { CustomTooltip, titleCase } from './utils';
import { successToQualityText } from './rolling';
import { Logger } from './logger';


class HUD extends UIBase {
    constructor(props) {
        super(props);
        // this.props.gameClock.startTimer();
        this.harvestEvent = props.harvestEvent;
        this.addVariables([this.props.treasury, this.props.gameClock]);
    }
    childRender() {
        let harvestQuality=successToQualityText(this.props.harvestEvent.harvestSuccess);
        return <Grid container spacing={2}>
        <Grid item xs={6} style={{"textAlign": "center", margin: "auto"}}>
            <Grid container spacing={1} style={{"textAlign": "center", margin: "auto"}}>
                <Grid item xs={12} style={{"textAlign": "center", margin: "auto"}}>
                    <TimerComponent variable={this.props.gameClock} unit='days' meaning='current day'/><br />
                    <CustomTooltip items={this.props.harvestEvent.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <span onClick={()=>{Logger.setInspect(this.props.harvestEvent)}}>Harvest this year: {titleCase(harvestQuality)}</span>
                    </CustomTooltip>
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <CustomTooltip items={this.props.gameClock.isForceStopped() ? ['Game clock force stopped by: '].concat(this.props.gameClock.forceStops) :['Play'] 
                        } style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <Button variant={this.props.gameClock.isForceStopped() ? 'disabled' : config.buttonVariant} onClick={this.props.gameClock.startTimer.bind(this.props.gameClock)}>Play</Button>
                    </CustomTooltip>
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <CustomTooltip items={this.props.gameClock.isForceStopped() ? ['Game clock force stopped by: '].concat(this.props.gameClock.forceStops) :['Pause'] 
                        } style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <Button variant={config.buttonVariant} onClick={this.props.gameClock.stopTimer.bind(this.props.gameClock)}>Pause</Button>
                    </CustomTooltip>
                </Grid>
                <Grid item xs={4} style={{"textAlign": "center", margin: "auto"}}>
                    <CustomTooltip items={this.props.gameClock.isForceStopped() ? ['Game clock force stopped by: '].concat(this.props.gameClock.forceStops) :['Next Day'] 
                        } style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <Button variant={config.buttonVariant} onClick={this.props.gameClock.forceTick.bind(this.props.gameClock)}>Next Day</Button>
                    </CustomTooltip>
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