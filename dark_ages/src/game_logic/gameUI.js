import UIBase from './UIBase';
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'
import {SidePanel} from './sidePanelUI'
import { Box, Button, Modal, Typography } from '@mui/material';
import { CustomTooltip } from './utils';
import React from 'react';
import { FactionResearchComponent } from './character';

class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.gameClock = this.game.gameClock;
        this.addVariables([props.internalTimer]);
        // Navigation history: array of selected items, index into it
        this._navHistory = [props.game.playerCharacter];
        this._navIndex = 0;
    }
    setSelected(selected) {
        // Truncate forward history when navigating to a new item
        this._navHistory = this._navHistory.slice(0, this._navIndex + 1);
        this._navHistory.push(selected);
        this._navIndex = this._navHistory.length - 1;
        this.setState({ selected });
    }
    navBack() {
        if (this._navIndex > 0) {
            this._navIndex -= 1;
            this.setState({ selected: this._navHistory[this._navIndex] });
        }
    }
    navForward() {
        if (this._navIndex < this._navHistory.length - 1) {
            this._navIndex += 1;
            this.setState({ selected: this._navHistory[this._navIndex] });
        }
    }
    childRender() {
        const showLog = this.state.showMessageLog || false;
        const showResearch = this.state.showResearch || false;
        const canBack = this._navIndex > 0;
        const canForward = this._navIndex < this._navHistory.length - 1;
        const faction = this.game.playerCharacter.faction;
        return <div>
            <Grid container spacing={2}>
                {this.game.gameMessages.length > 0
                    ? <GameMessage gameMessage={this.game.gameMessages[0]} timer={this.gameClock} readGameMessage={() => this.game.messageRead()}/>
                    : null}
                <Grid item xs={2}>
                    <SidePanel setSelected={(selected) => { this.setState({ showResearch: false }); this.setSelected(selected); }} game={this.game} internalTimer={this.props.internalTimer}/>
                </Grid>
                <Grid item xs={8}>
                    <div>
                        <HUD gameClock={this.gameClock} treasury={this.game.treasury} harvestEvent={this.game.harvestEvent}/>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={!canBack || showResearch}
                            onClick={() => this.navBack()}
                            sx={{ minWidth: '32px', padding: '2px 6px', fontSize: '16px' }}
                        >←</Button>
                        <Button
                            variant="outlined"
                            size="small"
                            disabled={!canForward || showResearch}
                            onClick={() => this.navForward()}
                            sx={{ minWidth: '32px', padding: '2px 6px', fontSize: '16px' }}
                        >→</Button>
                        <Button
                            variant={showResearch ? "contained" : "outlined"}
                            size="small"
                            onClick={() => this.setState({ showResearch: !showResearch })}
                            sx={{ padding: '2px 10px', fontSize: '12px', marginLeft: '8px' }}
                        >Research</Button>
                    </div>
                    <div>
                        {showResearch
                            ? <FactionResearchComponent faction={faction} internalTimer={this.props.internalTimer} />
                            : <MainUI selected={this.state.selected || this.game.playerCharacter} setSelected={(selected) => this.setSelected(selected)} gameClock={this.gameClock} internalTimer={this.props.internalTimer} game={this.game}/>
                        }
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
