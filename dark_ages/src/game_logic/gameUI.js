import UIBase from './UIBase';
import Game from './game.js'
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'
import {SidePanel} from './sidePanelUI'

class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = new Game();
        this.gameClock = this.game.gameClock;

        this.addVariables([props.internalTimer]);
    }
    setSelected(selected) {
        this.setState({selected: selected});
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={2}>
                <SidePanel setSelected={(selected) => this.setSelected(selected)} game={this.game} internalTimer={this.props.internalTimer}/>
            </Grid>
            <Grid item xs={8}>
                <div>
                    <HUD gameClock={this.gameClock} treasury={this.game.treasury} harvestEvent={this.game.harvestEvent}/>
                </div>
                <div>
                    <MainUI selected={this.state.selected || this.game.playerCharacter} gameClock={this.gameClock} internalTimer={this.props.internalTimer} game={this.game}/>
                </div>
            </Grid>
            <Grid item xs={2}>
                <LoggerComponent logger={Logger.getLogger()}/>
            </Grid>
        </Grid>
    }
}


export default GameUI;