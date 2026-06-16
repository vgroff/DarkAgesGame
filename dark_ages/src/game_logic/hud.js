import UIBase from './UIBase';
import { CumulatorComponent } from './UIUtils';
import { TimerComponent } from './timer';
import Button from '@mui/material/Button';
import config from './config.js'
import Grid from  '@mui/material/Grid';
import { CustomTooltip, titleCase } from './utils';
import { successToQualityText } from './rolling';
import { Logger } from './logger';
import { ThemeContext } from './theme';


class HUD extends UIBase {
    constructor(props) {
        super(props);
        this.harvestEvent = props.harvestEvent;
        this.addVariables([this.props.treasury, this.props.gameClock]);
    }
    childRender() {
        const theme = this.context;
        const c = theme ? theme.colors : null;

        let harvestQuality = successToQualityText(this.props.harvestEvent.harvestSuccess);

        // HUD buttons — larger, filled with accent colour when active so they stand out
        const activeHudBtnSx = c ? {
            backgroundColor: c.accent,
            color: c.accentText,
            fontSize: '15px',
            padding: '5px 18px',
            fontFamily: 'serif',
            letterSpacing: '0.03em',
            border: `1px solid ${c.accent}`,
            '&:hover': { backgroundColor: c.accentHover, borderColor: c.accentHover },
        } : { fontSize: '15px', padding: '5px 18px' };

        const disabledHudBtnSx = c ? {
            backgroundColor: 'transparent',
            color: c.textMuted,
            fontSize: '15px',
            padding: '5px 18px',
            fontFamily: 'serif',
            letterSpacing: '0.03em',
            border: `1px solid ${c.borderLight}`,
            '&.Mui-disabled': { color: c.textMuted, borderColor: c.borderLight },
        } : { fontSize: '15px', padding: '5px 18px' };

        const isRunning = this.props.gameClock.isRunning();
        const isForceStopped = this.props.gameClock.isForceStopped();

        const timerStyle = {
            color: c ? c.hudText : 'inherit',
            fontSize: '18px',
            fontFamily: 'serif',
            letterSpacing: '0.04em',
            fontWeight: 'bold',
        };

        const harvestStyle = {
            color: c ? c.hudText : '#888',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: 0.85,
        };

        const treasuryStyle = {
            color: c ? c.hudText : 'inherit',
            fontSize: '22px',
            fontWeight: 'bold',
            fontFamily: 'serif',
            letterSpacing: '0.03em',
        };

        const forceStopTooltip = isForceStopped
            ? ['Game clock force stopped by: '].concat(this.props.gameClock.forceStops)
            : null;

        return (
            <Grid container spacing={2}>
                <Grid item xs={6} style={{ textAlign: 'center', margin: 'auto' }}>
                    <Grid container spacing={1} style={{ textAlign: 'center', margin: 'auto' }}>
                        <Grid item xs={12} style={{ textAlign: 'center', margin: 'auto' }}>
                            <span style={timerStyle}>
                                <TimerComponent variable={this.props.gameClock} unit='days' meaning='current day'/>
                            </span>
                            <br />
                            <CustomTooltip
                                items={this.props.harvestEvent.getText()}
                                style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <span
                                    style={harvestStyle}
                                    onClick={() => { Logger.setInspect(this.props.harvestEvent); }}
                                >
                                    Harvest this year: {titleCase(harvestQuality)}
                                </span>
                            </CustomTooltip>
                        </Grid>

                        {/* Play button — active (filled) when clock is stopped and not force-stopped */}
                        <Grid item xs={4} style={{ textAlign: 'center', margin: 'auto' }}>
                            <CustomTooltip
                                items={forceStopTooltip || ['Play']}
                                style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Button
                                    variant={isRunning || isForceStopped ? 'disabled' : 'contained'}
                                    onClick={this.props.gameClock.startTimer.bind(this.props.gameClock)}
                                    sx={isRunning || isForceStopped ? disabledHudBtnSx : activeHudBtnSx}
                                >▶ Play</Button>
                            </CustomTooltip>
                        </Grid>

                        {/* Pause button — active (filled) when clock is running */}
                        <Grid item xs={4} style={{ textAlign: 'center', margin: 'auto' }}>
                            <CustomTooltip
                                items={forceStopTooltip || ['Pause']}
                                style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Button
                                    variant={!isRunning ? 'disabled' : 'contained'}
                                    onClick={this.props.gameClock.stopTimer.bind(this.props.gameClock)}
                                    sx={!isRunning ? disabledHudBtnSx : activeHudBtnSx}
                                >⏸ Pause</Button>
                            </CustomTooltip>
                        </Grid>

                        {/* Next Day button — active when clock is stopped */}
                        <Grid item xs={4} style={{ textAlign: 'center', margin: 'auto' }}>
                            <CustomTooltip
                                items={forceStopTooltip || ['Next Day']}
                                style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Button
                                    variant={isRunning ? 'disabled' : 'contained'}
                                    onClick={this.props.gameClock.forceTick.bind(this.props.gameClock)}
                                    sx={isRunning ? disabledHudBtnSx : activeHudBtnSx}
                                >🌅 Next Day</Button>
                            </CustomTooltip>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid item xs={6} style={{ textAlign: 'center', margin: 'auto' }}>
                    <span style={treasuryStyle}>
                        🪙 <CumulatorComponent variable={this.props.treasury} timer={this.props.gameClock}/>
                    </span>
                    {/* §7.4 Treasury countdown: show days until bankruptcy when declining */}
                    {(() => {
                        const treasury = this.props.treasury;
                        if (treasury.expectedChange < 0 && treasury.baseValue > 0) {
                            const daysLeft = Math.floor(treasury.baseValue / Math.abs(treasury.expectedChange));
                            const color = daysLeft < 10 ? '#ff4444' : daysLeft < 30 ? 'orange' : '#b8a000';
                            return (
                                <span style={{ fontSize: '13px', color, fontWeight: 'bold', display: 'block' }}>
                                    Bankrupt in ~{daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                </span>
                            );
                        }
                        return null;
                    })()}
                </Grid>
            </Grid>
        );
    }
}

HUD.contextType = ThemeContext;

export default HUD;
