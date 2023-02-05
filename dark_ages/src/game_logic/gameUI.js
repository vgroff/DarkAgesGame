import UIBase from './UIBase';
import Game from './game.js'
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'
import {SidePanel} from './sidePanelUI'
import { Box, Button, Modal, Typography } from '@mui/material';
import { CustomTooltip } from './utils';

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
            {this.game.gameMessages.length ? <GameMessage gameMessage={this.game.gameMessages[0]} timer={this.gameClock}/> : null}
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

export class GameMessage extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([this.props.timer]);
    }
    childRender() {
        this.gameMessage = this.props.gameMessage;
        this.props.timer.stopTimer();
        return <div>
            <Modal
            open={true}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
            >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600,
                bgcolor: 'background.paper',
                border: '2px solid #000',
                boxShadow: 24,
                p: 4,
                }}>
                <Typography id="modal-modal-title" variant="h6" component="h2">
                Game Message
                </Typography>
                <div>
                    {this.gameMessage}
                </div>
            </Box>
        </Modal></div>
    }
}


export default GameUI;