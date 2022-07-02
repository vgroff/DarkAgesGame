import UIBase from './UIBase';
import Settlement from './settlement/settlement';
import {AggregatorModifier, VariableModifier, Variable, Cumulator, additive, VariableComponent, CumulatorComponent} from './utils.js';
import { Timer } from './timer';
import Game from './game.js'
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';


class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.gameClock = new Timer({name: 'Game timer', meaning: "Current day"});
        this.game = new Game(this.gameClock);

        this.addVariables([this.gameClock]);
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={3}></Grid>
                <Grid item xs={6}>
                    <HUD style={{display: "grid", "grid-row-start": 1 / 4, "grid-row-end": 1/4}} gameClock={this.gameClock} treasury={this.game.treasury}/>
                </Grid>
            <Grid item xs={3}></Grid>
        </Grid>
    }
}


export default GameUI;