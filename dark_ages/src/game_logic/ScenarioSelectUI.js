/**
 * ScenarioSelectUI.js
 *
 * Scenario selection screen shown before the game starts.
 *
 * Layout:
 *   - Scenario cards (New Game, Bandit Raid Playtest, ...)
 *   - When "New Game" is selected:
 *       - Difficulty preset buttons (Intended / Easy)
 *       - Difficulty options panel (sliders for gold, research rate, productivity,
 *         legitimacy, event grace period; skip trait selection checkbox)
 *         Sliders have tight limits: min = Intended values, max = Easy values.
 *         Choosing a preset snaps all sliders to that preset's values.
 *   - Debug options panel (collapsible): force events on day 1, bandit raid ban days
 *
 * Props:
 *   onStart: (scenarioConfig) => void  — called when the player clicks "Begin"
 *
 * The scenarioConfig passed to onStart is a merged object ready for new Game(config).
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
import { SCENARIO_LIST, SCENARIOS, DIFFICULTY_PRESETS, DIFFICULTY_SLIDER_LIMITS, TERRAIN_OPTIONS } from './scenarios';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a difficulty field value to a slider number.
 * Fields that use `null` to mean "no modifier" are mapped to their numeric equivalent.
 */
function toSliderValue(field, value) {
    if (value === null || value === undefined) {
        return DIFFICULTY_SLIDER_LIMITS[field].nullMeaning ?? DIFFICULTY_SLIDER_LIMITS[field].default;
    }
    return value;
}

/**
 * Convert a slider number back to the scenario field value.
 * If the value equals the "null meaning" for that field, store null (no modifier).
 */
function fromSliderValue(field, sliderVal) {
    const limits = DIFFICULTY_SLIDER_LIMITS[field];
    if (limits.nullMeaning !== undefined && sliderVal === limits.nullMeaning) {
        return null;
    }
    return sliderVal;
}

/**
 * Build the initial difficulty state from a scenario (or preset).
 * playerTerrain is not part of presets — it is preserved separately.
 */
function difficultyFromScenario(scenario, currentTerrain) {
    return {
        startingTreasury:         scenario.startingTreasury ?? DIFFICULTY_SLIDER_LIMITS.startingTreasury.default,
        researchRateMultiplier:   toSliderValue('researchRateMultiplier',   scenario.researchRateMultiplier),
        generalProductivityBonus: toSliderValue('generalProductivityBonus', scenario.generalProductivityBonus),
        legitimacyBonus:          toSliderValue('legitimacyBonus',          scenario.legitimacyBonus),
        eventBanUntilDay:         scenario.eventBanUntilDay ?? DIFFICULTY_SLIDER_LIMITS.eventBanUntilDay.default,
        skipTraitSelection:       scenario.skipTraitSelection ?? false,
        // Terrain is not part of difficulty presets — preserve current selection or use scenario default
        playerTerrain:            currentTerrain ?? scenario.playerTerrain ?? 'Marshlands',
    };
}

// ─── component ──────────────────────────────────────────────────────────────

class ScenarioSelectUI extends React.Component {
    constructor(props) {
        super(props);

        // Difficulty state is initialised to the "Intended" preset values
        const intendedPreset = DIFFICULTY_PRESETS.intended;

        this.state = {
            selectedId: SCENARIOS.newGame.id,

            // Difficulty options — only relevant when selectedId === 'newGame'
            difficulty: difficultyFromScenario(intendedPreset),
            // Which preset is currently active (null if sliders have been manually adjusted)
            // Note: terrain changes do NOT clear the active preset
            activePreset: 'intended',

            // Debug overrides
            debugOverrides: {
                forceEventsOnDayOne: [],
                banditRaidBanDays: null,
            },
            showDebug: false,
        };
    }

    getSelectedScenario() {
        return SCENARIO_LIST.find(s => s.id === this.state.selectedId) || SCENARIOS.newGame;
    }

    // ── difficulty helpers ──────────────────────────────────────────────────

    applyPreset(presetId) {
        const preset = DIFFICULTY_PRESETS[presetId];
        if (!preset) return;
        this.setState(prev => ({
            // Preserve current terrain when switching presets — terrain is independent of difficulty
            difficulty: difficultyFromScenario(preset, prev.difficulty.playerTerrain),
            activePreset: presetId,
        }));
    }

    setDifficultyField(field, sliderVal) {
        const isTerrain = field === 'playerTerrain';
        this.setState(prev => ({
            difficulty: { ...prev.difficulty, [field]: sliderVal },
            // Terrain changes don't clear the active preset; other changes do
            activePreset: isTerrain ? prev.activePreset : null,
        }));
    }

    // ── debug helpers ───────────────────────────────────────────────────────

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

    // ── config builder ──────────────────────────────────────────────────────

    /**
     * Build the final config by merging the selected scenario with difficulty
     * options (for newGame) and debug overrides.
     */
    buildFinalConfig() {
        const scenario = this.getSelectedScenario();
        const { difficulty, debugOverrides } = this.state;
        const isNewGame = scenario.id === 'newGame';

        const merged = { ...scenario };

        // Apply difficulty options for New Game
        if (isNewGame) {
            merged.startingTreasury         = difficulty.startingTreasury;
            merged.researchRateMultiplier   = fromSliderValue('researchRateMultiplier',   difficulty.researchRateMultiplier);
            merged.generalProductivityBonus = fromSliderValue('generalProductivityBonus', difficulty.generalProductivityBonus);
            merged.legitimacyBonus          = fromSliderValue('legitimacyBonus',          difficulty.legitimacyBonus);
            merged.eventBanUntilDay         = difficulty.eventBanUntilDay;
            merged.skipTraitSelection       = difficulty.skipTraitSelection;
            merged.playerTerrain            = difficulty.playerTerrain;
        }

        // Debug: forceEventsOnDayOne — union of scenario's list and debug additions
        const debugForced = debugOverrides.forceEventsOnDayOne || [];
        merged.forceEventsOnDayOne = [
            ...new Set([...(scenario.forceEventsOnDayOne || []), ...debugForced])
        ];

        // Debug: banditRaidBanDays override
        if (debugOverrides.banditRaidBanDays !== null) {
            merged.banditRaidBanDays = debugOverrides.banditRaidBanDays;
        }

        return merged;
    }

    // ── render ──────────────────────────────────────────────────────────────

    render() {
        const { selectedId, difficulty, activePreset, showDebug, debugOverrides } = this.state;
        const selectedScenario = this.getSelectedScenario();
        const isNewGame = selectedId === 'newGame';
        const debugForced = debugOverrides.forceEventsOnDayOne || [];

        const FORCEABLE_EVENTS = [
            { name: 'BanditRaid',     label: 'Bandit Raid' },
            { name: 'CropBlight',     label: 'Crop Blight' },
            { name: 'Pestilence',     label: 'Pestilence' },
            { name: 'WarmSpell',      label: 'Warm Spell' },
            { name: 'Blizzard',       label: 'Blizzard' },
            { name: 'NomadsArrive',   label: 'Nomads Arrive' },
            { name: 'MerchantBoom',   label: 'Merchant Boom' },
            { name: 'CourtIntrigue',  label: 'Court Intrigue' },
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

                    {/* ── Scenario cards ── */}
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

                                {/* ── Difficulty options (only under New Game card) ── */}
                                {scenario.id === 'newGame' && selectedId === 'newGame' && (
                                    <DifficultyPanel
                                        difficulty={difficulty}
                                        activePreset={activePreset}
                                        onApplyPreset={(id) => this.applyPreset(id)}
                                        onSetField={(field, val) => this.setDifficultyField(field, val)}
                                    />
                                )}
                            </Grid>
                        ))}
                    </Grid>

                    <Divider sx={{ borderColor: '#c8b880', marginBottom: '16px' }} />

                    {/* ── Debug options toggle ── */}
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                            </Box>
                        )}
                    </Box>

                    {/* ── Begin button ── */}
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

// ─── DifficultyPanel ─────────────────────────────────────────────────────────

/**
 * Difficulty options panel shown beneath the New Game card when it is selected.
 *
 * Props:
 *   difficulty    — current difficulty state object (slider values as numbers + playerTerrain string)
 *   activePreset  — id of the currently active preset, or null if sliders manually adjusted
 *   onApplyPreset — (presetId: string) => void
 *   onSetField    — (field: string, value: any) => void
 */
function DifficultyPanel({ difficulty, activePreset, onApplyPreset, onSetField }) {
    const lim = DIFFICULTY_SLIDER_LIMITS;

    return (
        <Box sx={{
            marginTop: '8px',
            padding: '16px 18px',
            backgroundColor: '#f0ebe0',
            border: '1px solid #c8b880',
            borderRadius: '3px',
        }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#3d2b00', marginBottom: '10px' }}>
                Difficulty Options
            </Typography>

            {/* Preset buttons */}
            <Box sx={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {Object.values(DIFFICULTY_PRESETS).map(preset => (
                    <Box key={preset.id} sx={{ flex: 1 }}>
                        <Button
                            variant={activePreset === preset.id ? 'contained' : 'outlined'}
                            size="small"
                            fullWidth
                            onClick={() => onApplyPreset(preset.id)}
                            sx={{
                                borderColor: '#8b6914',
                                color: activePreset === preset.id ? '#fff8e8' : '#6b5020',
                                backgroundColor: activePreset === preset.id ? '#8b6914' : 'transparent',
                                fontSize: '12px',
                                fontWeight: activePreset === preset.id ? 'bold' : 'normal',
                                '&:hover': {
                                    backgroundColor: activePreset === preset.id ? '#a07820' : '#fff8e8',
                                    borderColor: '#a07820',
                                },
                            }}
                        >
                            {preset.label}
                        </Button>
                        <Typography sx={{ fontSize: '11px', color: '#888', marginTop: '3px', lineHeight: 1.3 }}>
                            {preset.description}
                        </Typography>
                    </Box>
                ))}
            </Box>

            <Divider sx={{ borderColor: '#d8cfa8', marginBottom: '14px' }} />

            {/* Starting gold */}
            <DifficultySlider
                label="Starting gold"
                value={difficulty.startingTreasury}
                min={lim.startingTreasury.min}
                max={lim.startingTreasury.max}
                step={lim.startingTreasury.step}
                formatValue={v => `${v} gold`}
                onChange={v => onSetField('startingTreasury', v)}
            />

            {/* Event grace period */}
            <DifficultySlider
                label="Event grace period"
                value={difficulty.eventBanUntilDay}
                min={lim.eventBanUntilDay.min}
                max={lim.eventBanUntilDay.max}
                step={lim.eventBanUntilDay.step}
                formatValue={v => `${v} days (${v / 12} year${v === 12 ? '' : 's'})`}
                onChange={v => onSetField('eventBanUntilDay', v)}
                hint="No settlement events fire before this day."
            />

            {/* Research rate */}
            <DifficultySlider
                label="Research rate bonus"
                value={difficulty.researchRateMultiplier}
                min={lim.researchRateMultiplier.min}
                max={lim.researchRateMultiplier.max}
                step={lim.researchRateMultiplier.step}
                formatValue={v => v === 1.0 ? 'None' : `+${Math.round((v - 1) * 100)}%`}
                onChange={v => onSetField('researchRateMultiplier', v)}
                hint="Multiplier on Library research production."
            />

            {/* General productivity bonus */}
            <DifficultySlider
                label="Productivity bonus"
                value={difficulty.generalProductivityBonus}
                min={lim.generalProductivityBonus.min}
                max={lim.generalProductivityBonus.max}
                step={lim.generalProductivityBonus.step}
                formatValue={v => v === 1.0 ? 'None' : `+${Math.round((v - 1) * 100)}%`}
                onChange={v => onSetField('generalProductivityBonus', v)}
                hint="Multiplier on settlement general productivity."
            />

            {/* Legitimacy bonus */}
            <DifficultySlider
                label="Legitimacy bonus"
                value={difficulty.legitimacyBonus}
                min={lim.legitimacyBonus.min}
                max={lim.legitimacyBonus.max}
                step={lim.legitimacyBonus.step}
                formatValue={v => v === 0 ? 'None' : `+${Math.round(v * 100)}%`}
                onChange={v => onSetField('legitimacyBonus', v)}
                hint="Additive bonus to your character's legitimacy."
            />

            {/* Skip trait selection */}
            <FormControlLabel
                control={
                    <Checkbox
                        checked={difficulty.skipTraitSelection}
                        onChange={e => onSetField('skipTraitSelection', e.target.checked)}
                        size="small"
                        sx={{ padding: '2px 4px', color: '#8b6914', '&.Mui-checked': { color: '#8b6914' } }}
                    />
                }
                label={
                    <Typography sx={{ fontSize: '13px', color: '#3d2b00' }}>
                        Auto-fill traits (skip trait selection on day 1)
                    </Typography>
                }
                sx={{ display: 'block', marginTop: '6px', marginLeft: 0 }}
            />

            <Divider sx={{ borderColor: '#d8cfa8', marginTop: '14px', marginBottom: '14px' }} />

            {/* Terrain selection */}
            <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#3d2b00', marginBottom: '8px' }}>
                Settlement Terrain
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TERRAIN_OPTIONS.map(terrain => {
                    const isSelected = difficulty.playerTerrain === terrain.id;
                    return (
                        <Box
                            key={terrain.id}
                            onClick={() => onSetField('playerTerrain', terrain.id)}
                            sx={{
                                padding: '8px 12px',
                                border: isSelected ? '2px solid #8b6914' : '1px solid #c8b880',
                                borderRadius: '3px',
                                backgroundColor: isSelected ? '#fff8e8' : '#faf6ec',
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                '&:hover': {
                                    backgroundColor: '#fff8e8',
                                    borderColor: '#a07820',
                                },
                            }}
                        >
                            <Typography sx={{
                                fontSize: '13px',
                                fontWeight: isSelected ? 'bold' : 'normal',
                                color: '#3d2b00',
                                marginBottom: '2px',
                            }}>
                                {terrain.label}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b5020', lineHeight: 1.3 }}>
                                {terrain.description}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

// ─── DifficultySlider ────────────────────────────────────────────────────────

/**
 * A labelled slider row for a single difficulty field.
 *
 * Props:
 *   label       — display label
 *   value       — current numeric value
 *   min/max/step — slider bounds
 *   formatValue — (number) => string for the value display
 *   onChange    — (number) => void
 *   hint        — optional small grey description text
 */
function DifficultySlider({ label, value, min, max, step, formatValue, onChange, hint }) {
    return (
        <Box sx={{ marginBottom: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                <Typography sx={{ fontSize: '13px', color: '#3d2b00' }}>
                    {label}
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#5a3e00', minWidth: '80px', textAlign: 'right' }}>
                    {formatValue(value)}
                </Typography>
            </Box>
            {hint && (
                <Typography sx={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>
                    {hint}
                </Typography>
            )}
            <Slider
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(_, val) => onChange(val)}
                sx={{ color: '#8b6914', padding: '8px 0' }}
                valueLabelDisplay="off"
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{formatValue(min)}</Typography>
                <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{formatValue(max)}</Typography>
            </Box>
        </Box>
    );
}

// ─── ScenarioTag ─────────────────────────────────────────────────────────────

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
