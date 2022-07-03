import UIBase from './UIBase';
import Settlement from './settlement/settlement';
import {AggregatorModifier, VariableModifier, Variable, Cumulator, addition, VariableComponent, CumulatorComponent} from './utils.js';
import { Timer } from './timer';
import Game from './game.js'
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import { SettlementComponent } from './settlement/settlement';



class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day"});
        this.game = new Game(this.gameClock);

        this.addVariables([props.internalTimer]);
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={3}></Grid>
                <Grid item xs={6}>
                    <div>
                        <HUD gameClock={this.gameClock} treasury={this.game.treasury}/>
                    </div>
                    <div>
                        <MainUI internalTimer={this.props.internalTimer} game={this.game} currentSettlement={0}/>
                    </div>
                </Grid>
            <Grid item xs={3}></Grid>
        </Grid>
    }
}


export default GameUI;