import UIBase from './UIBase';
import HUD from './hud.js'
import Grid from  '@mui/material/Grid';
import MainUI from './mainUI.js'
import {Logger, LoggerComponent} from './logger'
import {SidePanel} from './sidePanelUI'
import { Box, Button, Modal, Typography } from '@mui/material';
import React from 'react';
import { FactionResearchComponent } from './character';
import { ThemeContext } from './theme';

class GameUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.gameClock = this.game.gameClock;
        this.addVariables([props.internalTimer]);
        // Navigation history: array of selected items, index into it
        this._navHistory = [props.game.playerCharacter];
        this._navIndex = 0;
        // Ref to the sticky header block — used to measure its actual rendered height
        // so the settlement sticky header can use the exact offset to avoid overlap.
        this._stickyHeaderRef = React.createRef();
        this._stickyHeaderHeight = 0;
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
        const theme = this.context;
        const c = theme.colors;

        const showLog = this.state.showMessageLog !== undefined ? this.state.showMessageLog : true;
        const showResearch = this.state.showResearch || false;
        const canBack = this._navIndex > 0;
        const canForward = this._navIndex < this._navHistory.length - 1;
        const faction = this.game.playerCharacter.faction;
        const selected = this.state.selected || this.game.playerCharacter;

        // Shared nav button style
        const navBtnSx = {
            minWidth: '36px',
            padding: '3px 8px',
            fontSize: '18px',
            borderColor: c.btnBorder,
            color: c.btnText,
            '&:hover': { borderColor: c.accentHover, backgroundColor: c.contentBgHover },
            '&.Mui-disabled': { borderColor: c.borderLight, color: c.textMuted },
        };

        // Bottom toolbar height (App.js fixed bar) ≈ 40px; message log panel sits above it.
        // We add paddingBottom to the main scroll column so content isn't hidden behind the fixed bars.
        const msgLogMaxHeight = showLog ? 200 : 0;
        const bottomBarHeight = 40; // approximate height of App.js fixed toolbar
        const fixedBottomHeight = bottomBarHeight + (showLog ? msgLogMaxHeight + 40 : 40); // rough total

        return (
            <div style={{ backgroundColor: c.contentBg, minHeight: '100vh', color: c.textPrimary }}>
                {/* §0.2 Game Over overlay */}
                {this.game.isGameOver && (
                    <Modal open={true}>
                        <Box sx={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 400,
                            bgcolor: c.modalBg,
                            border: `2px solid ${c.modalBorder}`,
                            boxShadow: 24,
                            p: 4,
                            textAlign: 'center',
                        }}>
                            <Typography variant="h4" sx={{ color: 'red', mb: 2, fontFamily: 'serif' }}>
                                Game Over
                            </Typography>
                            <Typography sx={{ mb: 3, color: c.textSecondary }}>
                                You have lost control of all your settlements.
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => window.location.reload()}
                                sx={{
                                    backgroundColor: c.accent,
                                    color: c.accentText,
                                    '&:hover': { backgroundColor: c.accentHover },
                                }}
                            >
                                New Game
                            </Button>
                        </Box>
                    </Modal>
                )}

                <Grid container spacing={0}>
                    {this.game.gameMessages.length > 0
                        ? <GameMessage gameMessage={this.game.gameMessages[0]} timer={this.gameClock} readGameMessage={() => this.game.messageRead()}/>
                        : null}

                    {/* Side panel — includes Research nav item */}
                    <Grid item xs={2} style={{
                        backgroundColor: c.sidePanelBg,
                        borderRight: `1px solid ${c.sidePanelBorder}`,
                        minHeight: '100vh',
                    }}>
                        <SidePanel
                            setSelected={(selected) => this.setSelected(selected)}
                            game={this.game}
                            internalTimer={this.props.internalTimer}
                            showResearch={showResearch}
                            onToggleResearch={() => this.setState({ showResearch: !showResearch })}
                        />
                    </Grid>

                    {/* Main content — uses its own scroll container so sticky children work correctly.
                        paddingBottom reserves space for the fixed message log + bottom toolbar. */}
                    <Grid item xs={8} style={{ padding: '0 8px', height: '100vh', overflowY: 'auto', position: 'relative', paddingBottom: `${fixedBottomHeight}px` }}>
                        {/* Sticky header block: HUD + warning banner + back/forward nav.
                            All three stick together at the top when scrolling.
                            A ref measures the actual rendered height so SettlementComponent
                            can use the exact offset for its own sticky header. */}
                        <div ref={this._stickyHeaderRef} style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 100,
                            backgroundColor: c.hudBg,
                            borderBottom: `1px solid ${c.hudBorder}`,
                        }}>
                            <div style={{ padding: '4px 8px' }}>
                                <HUD gameClock={this.gameClock} treasury={this.game.treasury} harvestEvent={this.game.harvestEvent}/>
                            </div>

                            {/* §2 Warning banner — inside sticky block so it stays visible */}
                            <WarningBanner game={this.game} selected={selected} />

                            {/* Nav bar: back/forward — inside sticky block */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px 4px',
                            }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={!canBack || showResearch}
                                    onClick={() => this.navBack()}
                                    sx={navBtnSx}
                                >←</Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={!canForward || showResearch}
                                    onClick={() => this.navForward()}
                                    sx={navBtnSx}
                                >→</Button>
                            </div>
                        </div>

                        <div>
                            {showResearch
                                ? <FactionResearchComponent faction={faction} internalTimer={this.props.internalTimer} />
                                : <MainUI
                                    selected={selected}
                                    setSelected={(selected) => this.setSelected(selected)}
                                    gameClock={this.gameClock}
                                    internalTimer={this.props.internalTimer}
                                    game={this.game}
                                    stickyHeaderHeight={this._stickyHeaderRef.current ? this._stickyHeaderRef.current.offsetHeight : 165}
                                  />
                            }
                        </div>
                    </Grid>

                    {/* Logger panel */}
                    <Grid item xs={2} style={{
                        backgroundColor: c.contentBgAlt,
                        borderLeft: `1px solid ${c.borderLight}`,
                        minHeight: '100vh',
                        fontSize: '12px',
                    }}>
                        <LoggerComponent logger={Logger.getLogger()}/>
                    </Grid>
                    </Grid>
    
                    {/* Message log — fixed just above the App.js bottom toolbar (bottom: 40px) */}
                    <div style={{
                        position: 'fixed',
                        bottom: 40,
                        left: 0,
                        right: 0,
                        zIndex: 190,
                        backgroundColor: c.contentBgAlt,
                        borderTop: `1px solid ${c.hudBorder}`,
                    }}>
                        <MessageLogPanel
                            logger={Logger.getLogger()}
                            show={showLog}
                            onToggle={() => this.setState({ showMessageLog: !showLog })}
                        />
                    </div>
                </div>
            );
    }
}

// Wire up the theme context for class component access
GameUI.contextType = ThemeContext;


/**
 * §2 Warning banner — shows Paradox-style warnings for critical settlement conditions.
 */
export class WarningBanner extends React.Component {
    render() {
        const { game } = this.props;
        if (!game) return null;

        const theme = this.context;
        const c = theme ? theme.colors : null;

        const warnings = [];

        // Collect warnings from all player settlements
        for (const settlement of game.settlements) {
            if (!settlement.leader || !settlement.leader.isPlayer) continue;
            const sName = settlement.name;

            // Homeless warning
            if (settlement.homeless && settlement.homeless.currentValue > 0) {
                const key = `homeless_${sName}`;
                if (!game.warningsShown.has(key)) {
                    game.warningsShown.add(key);
                    game.addGameMessage(`Warning: ${sName} has ${Math.round(settlement.homeless.currentValue)} homeless people. Build more housing.`);
                }
                warnings.push({ text: `${sName}: ${Math.round(settlement.homeless.currentValue)} homeless`, color: 'orange' });
            }

            // Unemployed warning
            if (settlement.unemployed && settlement.unemployed.currentValue > 0) {
                const key = `unemployed_${sName}`;
                if (!game.warningsShown.has(key)) {
                    game.warningsShown.add(key);
                    game.addGameMessage(`Warning: ${sName} has ${Math.round(settlement.unemployed.currentValue)} unemployed workers.`);
                }
                warnings.push({ text: `${sName}: ${Math.round(settlement.unemployed.currentValue)} unemployed`, color: '#b8a000' });
            }

            // Rebellion risk warning
            if (settlement.totalRebellionSupport && settlement.totalRebellionSupport.currentValue > 0.3) {
                const key = `rebellion_${sName}`;
                if (!game.warningsShown.has(key)) {
                    game.warningsShown.add(key);
                    game.addGameMessage(`Warning: ${sName} is at risk of rebellion! Improve happiness or legitimacy.`);
                }
                warnings.push({ text: `${sName}: rebellion risk ${Math.round(settlement.totalRebellionSupport.currentValue * 100)}%`, color: 'red' });
            }

            // Starvation warning — check food ration
            if (settlement.rationsAchieved && settlement.idealRations && settlement.rationResources) {
                const foodIdx = settlement.rationResources.findIndex(r => r.name === 'food');
                if (foodIdx >= 0) {
                    const achieved = settlement.rationsAchieved[foodIdx];
                    const ideal = settlement.idealRations[foodIdx];
                    if (achieved && ideal && achieved.currentValue < ideal.currentValue * 0.5) {
                        const key = `starvation_${sName}`;
                        if (!game.warningsShown.has(key)) {
                            game.warningsShown.add(key);
                            game.addGameMessage(`Warning: ${sName} is experiencing food shortages!`);
                        }
                        warnings.push({ text: `${sName}: food shortage!`, color: 'red' });
                    }
                }
            }
        }

        // Bankruptcy warning (global)
        if (game.bankrupt && game.bankrupt.currentValue === 1) {
            const key = 'bankrupt';
            if (!game.warningsShown.has(key)) {
                game.warningsShown.add(key);
                game.addGameMessage('Warning: You are bankrupt! Market purchases are disabled.');
            }
            warnings.push({ text: 'BANKRUPT — market purchases disabled', color: 'red' });
        } else if (game.warningsShown.has('bankrupt')) {
            game.warningsShown.delete('bankrupt');
        }

        if (warnings.length === 0) return null;

        const bannerStyle = {
            display: 'flex', flexWrap: 'wrap', gap: '6px',
            padding: '5px 10px', marginBottom: '4px',
            backgroundColor: c ? c.warningBannerBg : '#fff8f0',
            border: `1px solid ${c ? c.warningBannerBorder : '#e0c080'}`,
            borderRadius: '4px',
            fontSize: '14px',  // larger than before (was 12px)
        };

        return (
            <div style={bannerStyle}>
                {warnings.map((w, i) => (
                    <span key={i} style={{
                        color: w.color, fontWeight: 'bold',
                        padding: '3px 8px', border: `1px solid ${w.color}`,
                        borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.3)',
                    }}>⚠ {w.text}</span>
                ))}
            </div>
        );
    }
}
WarningBanner.contextType = ThemeContext;


/**
 * A collapsible panel shown below the main 3-column layout.
 * Displays the full permanent message history (newest first).
 */
/**
 * §3 Message log panel — reads from logger.inGameLog so the log level selector
 * in LoggerComponent actually controls what appears here.
 *
 * Entries in inGameLog have shape: { ts, level, levelName, message, context }
 * Day is stored in context.day when logged via addGameMessage / Logger.info etc.
 */
export class MessageLogPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = { inGameLog: props.logger ? [...props.logger.inGameLog] : [] };
        this._loggerSub = null;
    }

    componentDidMount() {
        const logger = this.props.logger;
        if (!logger) return;
        this._loggerSub = logger.subscribe(() => {
            this.setState({ inGameLog: [...logger.inGameLog] });
        }, 'MessageLogPanel');
    }

    componentWillUnmount() {
        if (this.props.logger && this._loggerSub) {
            this.props.logger.unsubscribe(this._loggerSub);
        }
    }

    render() {
        const { show, onToggle } = this.props;
        const theme = this.context;
        const c = theme ? theme.colors : null;

        const reversedLog = [...this.state.inGameLog].reverse();

        const wrapStyle = {
            borderTop: `1px solid ${c ? c.divider : '#ccc'}`,
            marginTop: '8px',
            padding: '6px 16px',
            backgroundColor: c ? c.contentBgAlt : '#fafafa',
        };

        const panelStyle = {
            maxHeight: '120px',
            overflowY: 'auto',
            border: `1px solid ${c ? c.msgLogBorder : '#ddd'}`,
            borderRadius: '4px',
            padding: '8px',
            backgroundColor: c ? c.msgLogBg : '#fafafa',
            fontSize: '13px',
            color: c ? c.textPrimary : 'inherit',
        };

        const btnSx = c ? {
            borderColor: c.btnBorder,
            color: c.btnText,
            fontSize: '12px',
            '&:hover': { borderColor: c.accentHover, backgroundColor: c.contentBgHover },
        } : {};

        // Level colours for the log entries
        const levelColors = { 0: '#888', 1: 'inherit', 2: '#b8860b', 3: '#cc0000' };

        return (
            <div style={wrapStyle}>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={onToggle}
                    sx={btnSx}
                    style={{ marginBottom: show ? '8px' : 0 }}
                >
                    {show ? 'Hide Message Log' : `Show Message Log (${reversedLog.length})`}
                </Button>
                {show && (
                    <div style={panelStyle}>
                        {reversedLog.length === 0
                            ? <span style={{ color: c ? c.textMuted : '#888' }}>No messages yet.</span>
                            : reversedLog.map((entry, i) => {
                                const day = entry.context?.day;
                                return (
                                    <div key={i} style={{
                                        marginBottom: '4px',
                                        borderBottom: `1px solid ${c ? c.msgLogEntryBorder : '#eee'}`,
                                        paddingBottom: '4px',
                                    }}>
                                        {day != null && (
                                            <span style={{ color: c ? c.msgLogDayColor : '#888', marginRight: '8px', fontSize: '11px' }}>
                                                Day {day}
                                            </span>
                                        )}
                                        <span style={{ color: levelColors[entry.level] ?? 'inherit' }}>
                                            {entry.message}
                                        </span>
                                    </div>
                                );
                            })
                        }
                    </div>
                )}
            </div>
        );
    }
}
MessageLogPanel.contextType = ThemeContext;


export class GameMessage extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([this.props.timer]);
    }
    childRender() {
        const theme = this.context;
        const c = theme ? theme.colors : null;

        this.gameMessage = this.props.gameMessage;
        this.props.timer.stopTimer();

        return (
            <div>
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
                        bgcolor: c ? c.modalBg : 'background.paper',
                        border: c ? `2px solid ${c.modalBorder}` : '2px solid #000',
                        boxShadow: 24,
                        p: 4,
                    }}>
                        <Typography
                            id="modal-modal-title"
                            variant="h6"
                            component="h2"
                            sx={{ color: c ? c.modalTitleColor : 'inherit', fontFamily: 'serif', mb: 1 }}
                        >
                            Game Message
                        </Typography>
                        <div>
                            <span style={{ color: c ? c.textSecondary : 'inherit' }}>{this.gameMessage}</span>
                            <br />
                            <Button
                                variant="outlined"
                                onClick={() => this.props.readGameMessage()}
                                sx={c ? {
                                    mt: 2,
                                    borderColor: c.btnBorder,
                                    color: c.btnText,
                                    '&:hover': { borderColor: c.accentHover, backgroundColor: c.contentBgHover },
                                } : { mt: 2 }}
                            >
                                Close
                            </Button>
                        </div>
                    </Box>
                </Modal>
            </div>
        );
    }
}
GameMessage.contextType = ThemeContext;


export default GameUI;
