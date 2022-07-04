import UIBase from './UIBase';
import Game from './game.js'
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'


class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = new Game();
        this.gameClock = this.game.gameClock;

        this.addVariables([props.internalTimer]);
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={2}></Grid>
                <Grid item xs={8}>
                    <div>
                        <HUD gameClock={this.gameClock} treasury={this.game.treasury}/>
                    </div>
                    <div>
                        <MainUI gameClock={this.gameClock} internalTimer={this.props.internalTimer} game={this.game} currentSettlement={0}/>
                    </div>
                </Grid>
            <Grid item xs={2}>
                <LoggerComponent logger={Logger.getLogger()}/>
            </Grid>
        </Grid>
    }
}


export default GameUI;