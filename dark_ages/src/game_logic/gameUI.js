import UIBase from './UIBase';
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'
import {SidePanel} from './sidePanelUI'
import { Box, Button, Modal, Typography } from '@mui/material';
import { CustomTooltip } from './utils';
import React from 'react';

class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.gameClock = this.game.gameClock;
        this.addVariables([props.internalTimer]);
    }
    setSelected(selected) {
        this.setState({selected: selected});
    }
    childRender() {
        const showLog = this.state.showMessageLog || false;
        return <div>
            <Grid container spacing={2}>
                {this.game.gameMessages.length > 0
                    ? <GameMessage gameMessage={this.game.gameMessages[0]} timer={this.gameClock} readGameMessage={() => this.game.messageRead()}/>
                    : null}
                <Grid item xs={2}>
                    <SidePanel setSelected={(selected) => this.setSelected(selected)} game={this.game} internalTimer={this.props.internalTimer}/>
                </Grid>
                <Grid item xs={8}>
                    <div>
                        <HUD gameClock={this.gameClock} treasury={this.game.treasury} harvestEvent={this.game.harvestEvent}/>
                    </div>
                    <div>
                        <MainUI selected={this.state.selected || this.game.playerCharacter} setSelected={(selected) => this.setSelected(selected)} gameClock={this.gameClock} internalTimer={this.props.internalTimer} game={this.game}/>
                    </div>
                </Grid>
                <Grid item xs={2}>
                    <LoggerComponent logger={Logger.getLogger()}/>
                </Grid>
            </Grid>
            <MessageLogPanel
                messageLog={this.game.messageLog}
                show={showLog}
                onToggle={() => this.setState({ showMessageLog: !showLog })}
            />
        </div>
    }
}

/**
 * A collapsible panel shown below the main 3-column layout.
 * Displays the full permanent message history (newest first).
 * Toggled by a button.
 */
export class MessageLogPanel extends React.Component {
    render() {
        const { messageLog, show, onToggle } = this.props;
        const reversedLog = messageLog ? [...messageLog].reverse() : [];
        return <div style={{ borderTop: '1px solid #ccc', marginTop: '12px', padding: '8px 16px' }}>
            <Button
                variant="outlined"
                size="small"
                onClick={onToggle}
                style={{ marginBottom: show ? '8px' : 0 }}
            >
                {show ? 'Hide Message Log' : `Show Message Log (${messageLog ? messageLog.length : 0})`}
            </Button>
            {show && <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px',
                backgroundColor: '#fafafa',
                fontSize: '13px'
            }}>
                {reversedLog.length === 0
                    ? <span style={{ color: '#888' }}>No messages yet.</span>
                    : reversedLog.map((entry, i) => (
                        <div key={i} style={{ marginBottom: '4px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                            <span style={{ color: '#888', marginRight: '8px', fontSize: '11px' }}>Day {entry.day}</span>
                            <span>{entry.text}</span>
                        </div>
                    ))
                }
            </div>}
        </div>
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
            open = {true}
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
                    <span>{this.gameMessage}</span><br />
                    <Button variant='outlined' onClick={() => this.props.readGameMessage()}>Close</Button>
                </div>
            </Box>
        </Modal></div>
    }
}


export default GameUI;
