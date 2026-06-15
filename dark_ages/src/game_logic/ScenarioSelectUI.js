/**
 * ScenarioSelectUI.js
 *
 * Scenario selection screen shown before the game starts.
 * Lets the player pick a scenario and configure debug options.
 *
 * Props:
 *   onStart: (scenarioConfig) => void  — called when the player clicks "Start"
 *
 * The scenarioConfig passed to onStart is a merged object:
 *   { ...selectedScenario, ...debugOverrides }
 * so the caller (App.js) can pass it straight to new Game(scenarioConfig).
 */

import React from 'react';
import {
    Box,
    Button,
    Checkbox,
    Divider,
    FormControlLabel,
    Grid,
    Slider,
    Typography,
} from '@mui/material';
import { SCENARIO_LIST, SCENARIOS } from './scenarios';

class ScenarioSelectUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedId: SCENARIOS.default.id,
            // Debug overrides — these are layered on top of the selected scenario
            debugOverrides: {
                forceEventsOnDayOne: [],
                banditRaidBanDays: null,
                skipTraitSelection: false,
                startingTreasury: null,   // null = use scenario default
            },
            showDebug: false,
        };
    }

    getSelectedScenario() {
        return SCENARIO_LIST.find(s => s.id === this.state.selectedId) || SCENARIOS.default;
    }

    /**
     * Build the final config by merging the scenario with any debug overrides
     * that the user has explicitly set.
     */
    buildFinalConfig() {
        const scenario = this.getSelectedScenario();
        const { debugOverrides } = this.state;

        const merged = { ...scenario };

        // forceEventsOnDayOne: union of scenario's list and debug additions
        const debugForced = debugOverrides.forceEventsOnDayOne || [];
        merged.forceEventsOnDayOne = [
            ...new Set([...(scenario.forceEventsOnDayOne || []), ...debugForced])
        ];

        // banditRaidBanDays: debug override takes precedence if not null
        if (debugOverrides.banditRaidBanDays !== null) {
            merged.banditRaidBanDays = debugOverrides.banditRaidBanDays;
        }

        // skipTraitSelection: OR of scenario and debug
        if (debugOverrides.skipTraitSelection) {
            merged.skipTraitSelection = true;
        }

        // startingTreasury: debug override takes precedence if not null
        if (debugOverrides.startingTreasury !== null) {
            merged.startingTreasury = debugOverrides.startingTreasury;
        }

        return merged;
    }

    toggleDebugEvent(eventName) {
        this.setState(prev => {
            const current = prev.debugOverrides.forceEventsOnDayOne || [];
            const next = current.includes(eventName)
                ? current.filter(e => e !== eventName)
                : [...current, eventName];
            return {
                debugOverrides: { ...prev.debugOverrides, forceEventsOnDayOne: next }
            };
        });
    }

    setDebugOverride(key, value) {
        this.setState(prev => ({
            debugOverrides: { ...prev.debugOverrides, [key]: value }
        }));
    }

    render() {
        const { selectedId, showDebug, debugOverrides } = this.state;
        const selectedScenario = this.getSelectedScenario();
        const debugForced = debugOverrides.forceEventsOnDayOne || [];

        const FORCEABLE_EVENTS = [
            { name: 'BanditRaid', label: 'Bandit Raid' },
            { name: 'CropBlight', label: 'Crop Blight' },
            { name: 'Pestilence', label: 'Pestilence' },
            { name: 'WarmSpell', label: 'Warm Spell' },
            { name: 'Blizzard', label: 'Blizzard' },
            { name: 'NomadsArrive', label: 'Nomads Arrive' },
            { name: 'MerchantBoom', label: 'Merchant Boom' },
            { name: 'CourtIntrigue', label: 'Court Intrigue' },
        ];

        return (
            <Box sx={{
                minHeight: '100vh',
                backgroundColor: '#1a1208',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
            }}>
                <Box sx={{
                    maxWidth: 700,
                    width: '100%',
                    backgroundColor: '#f5f0e8',
                    border: '2px solid #8b6914',
                    borderRadius: '4px',
                    padding: '32px',
                }}>
                    <Typography variant="h4" sx={{
                        fontFamily: 'serif',
                        color: '#3d2b00',
                        textAlign: 'center',
                        marginBottom: '8px',
                        letterSpacing: '0.05em',
                    }}>
                        Dark Ages
                    </Typography>
                    <Typography sx={{
                        color: '#6b5020',
                        textAlign: 'center',
                        marginBottom: '28px',
                        fontSize: '14px',
                        fontStyle: 'italic',
                    }}>
                        Choose a scenario to begin
                    </Typography>

                    {/* Scenario list */}
                    <Grid container spacing={2} sx={{ marginBottom: '24px' }}>
                        {SCENARIO_LIST.map(scenario => (
                            <Grid item xs={12} key={scenario.id}>
                                <Box
                                    onClick={() => this.setState({ selectedId: scenario.id })}
                                    sx={{
                                        padding: '14px 18px',
                                        border: selectedId === scenario.id
                                            ? '2px solid #8b6914'
                                            : '1px solid #c8b880',
                                        borderRadius: '3px',
                                        backgroundColor: selectedId === scenario.id
                                            ? '#fff8e8'
                                            : '#faf6ec',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        '&:hover': {
                                            backgroundColor: '#fff8e8',
                                            borderColor: '#a07820',
                                        },
                                    }}
                                >
                                    <Typography sx={{
                                        fontWeight: selectedId === scenario.id ? 'bold' : 'normal',
                                        color: '#3d2b00',
                                        fontSize: '15px',
                                        marginBottom: '4px',
                                    }}>
                                        {scenario.name}
                                    </Typography>
                                    <Typography sx={{
                                        color: '#6b5020',
                                        fontSize: '13px',
                                        lineHeight: 1.4,
                                    }}>
                                        {scenario.description}
                                    </Typography>
                                    {/* Quick summary tags */}
                                    <Box sx={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {scenario.skipTraitSelection && (
                                            <ScenarioTag label="Traits pre-set" color="#4a7c59" />
                                        )}
                                        {scenario.preResearched && scenario.preResearched.length > 0 && (
                                            <ScenarioTag label={`${scenario.preResearched.length} researched`} color="#4a5c7c" />
                                        )}
                                        {scenario.forceEventsOnDayOne && scenario.forceEventsOnDayOne.length > 0 && (
                                            <ScenarioTag label={`Day 1: ${scenario.forceEventsOnDayOne.join(', ')}`} color="#7c4a4a" />
                                        )}
                                        {scenario.startingTreasury > 10 && (
                                            <ScenarioTag label={`${scenario.startingTreasury} gold`} color="#7c6a2a" />
                                        )}
                                        {scenario.startingPopulation !== 37 && (
                                            <ScenarioTag label={`Pop: ${scenario.startingPopulation}`} color="#5a4a7c" />
                                        )}
                                    </Box>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    <Divider sx={{ borderColor: '#c8b880', marginBottom: '16px' }} />

                    {/* Debug options toggle */}
                    <Box sx={{ marginBottom: '20px' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => this.setState({ showDebug: !showDebug })}
                            sx={{
                                borderColor: '#8b6914',
                                color: '#6b5020',
                                fontSize: '12px',
                                '&:hover': { borderColor: '#a07820', backgroundColor: '#fff8e8' },
                            }}
                        >
                            {showDebug ? '▲ Hide Debug Options' : '▼ Debug Options'}
                        </Button>

                        {showDebug && (
                            <Box sx={{
                                marginTop: '12px',
                                padding: '16px',
                                backgroundColor: '#f0ebe0',
                                border: '1px solid #c8b880',
                                borderRadius: '3px',
                            }}>
                                <Typography sx={{ fontSize: '12px', color: '#888', marginBottom: '12px', fontStyle: 'italic' }}>
                                    Debug overrides are layered on top of the selected scenario.
                                </Typography>

                                {/* Force events on day 1 */}
                                <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#3d2b00', marginBottom: '6px' }}>
                                    Force events on Day 1:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                                    {FORCEABLE_EVENTS.map(ev => {
                                        const isFromScenario = (selectedScenario.forceEventsOnDayOne || []).includes(ev.name);
                                        const isFromDebug = debugForced.includes(ev.name);
                                        const isChecked = isFromScenario || isFromDebug;
                                        return (
                                            <FormControlLabel
                                                key={ev.name}
                                                control={
                                                    <Checkbox
                                                        checked={isChecked}
                                                        disabled={isFromScenario}
                                                        onChange={() => this.toggleDebugEvent(ev.name)}
                                                        size="small"
                                                        sx={{ padding: '2px 4px' }}
                                                    />
                                                }
                                                label={
                                                    <Typography sx={{
                                                        fontSize: '12px',
                                                        color: isFromScenario ? '#888' : '#3d2b00',
                                                        fontStyle: isFromScenario ? 'italic' : 'normal',
                                                    }}>
                                                        {ev.label}{isFromScenario ? ' (scenario)' : ''}
                                                    </Typography>
                                                }
                                                sx={{ margin: 0 }}
                                            />
                                        );
                                    })}
                                </Box>

                                {/* Skip trait selection */}
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={selectedScenario.skipTraitSelection || debugOverrides.skipTraitSelection}
                                            disabled={selectedScenario.skipTraitSelection}
                                            onChange={e => this.setDebugOverride('skipTraitSelection', e.target.checked)}
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '13px', color: '#3d2b00' }}>
                                            Skip trait selection (auto-fill traits)
                                            {selectedScenario.skipTraitSelection && (
                                                <span style={{ color: '#888', fontStyle: 'italic' }}> (scenario)</span>
                                            )}
                                        </Typography>
                                    }
                                    sx={{ display: 'block', marginBottom: '12px' }}
                                />

                                {/* Bandit raid ban override */}
                                <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#3d2b00', marginBottom: '4px' }}>
                                    Bandit raid ban period (days):
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                                    Default: 24 days (2 years). Set to 0 to allow raid on day 1.
                                    {selectedScenario.banditRaidBanDays === 0 && (
                                        <span style={{ fontStyle: 'italic' }}> Scenario already sets this to 0.</span>
                                    )}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                                    <Slider
                                        value={
                                            debugOverrides.banditRaidBanDays !== null
                                                ? debugOverrides.banditRaidBanDays
                                                : (selectedScenario.banditRaidBanDays ?? 24)
                                        }
                                        min={0}
                                        max={48}
                                        step={1}
                                        onChange={(_, val) => this.setDebugOverride('banditRaidBanDays', val)}
                                        sx={{ flex: 1, color: '#8b6914' }}
                                        valueLabelDisplay="auto"
                                    />
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => this.setDebugOverride('banditRaidBanDays', null)}
                                        disabled={debugOverrides.banditRaidBanDays === null}
                                        sx={{ fontSize: '11px', borderColor: '#c8b880', color: '#6b5020', minWidth: '60px' }}
                                    >
                                        Reset
                                    </Button>
                                </Box>

                                {/* Starting treasury override */}
                                <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#3d2b00', marginBottom: '4px' }}>
                                    Starting treasury (gold):
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Slider
                                        value={
                                            debugOverrides.startingTreasury !== null
                                                ? debugOverrides.startingTreasury
                                                : selectedScenario.startingTreasury
                                        }
                                        min={0}
                                        max={2000}
                                        step={10}
                                        onChange={(_, val) => this.setDebugOverride('startingTreasury', val)}
                                        sx={{ flex: 1, color: '#8b6914' }}
                                        valueLabelDisplay="auto"
                                    />
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => this.setDebugOverride('startingTreasury', null)}
                                        disabled={debugOverrides.startingTreasury === null}
                                        sx={{ fontSize: '11px', borderColor: '#c8b880', color: '#6b5020', minWidth: '60px' }}
                                    >
                                        Reset
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>

                    {/* Start button */}
                    <Box sx={{ textAlign: 'center' }}>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => this.props.onStart(this.buildFinalConfig())}
                            sx={{
                                backgroundColor: '#8b6914',
                                color: '#fff8e8',
                                fontFamily: 'serif',
                                fontSize: '16px',
                                letterSpacing: '0.05em',
                                padding: '10px 48px',
                                '&:hover': { backgroundColor: '#a07820' },
                            }}
                        >
                            Begin
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }
}

/**
 * Small coloured tag shown in scenario cards.
 */
function ScenarioTag({ label, color }) {
    return (
        <Box sx={{
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: '10px',
            border: `1px solid ${color}`,
            color: color,
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: `${color}18`,
        }}>
            {label}
        </Box>
    );
}

export default ScenarioSelectUI;
