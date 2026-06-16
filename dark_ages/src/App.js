import './App.css';
import {Timer} from './game_logic/timer.js'
import GameUI from './game_logic/gameUI.js'
import React from 'react';
import { saveGame, loadGame } from './game_logic/save_load';
import Game from './game_logic/game';
import ScenarioSelectUI from './game_logic/ScenarioSelectUI';
import { ThemeContext, getTheme, THEME_LIST } from './game_logic/theme';

function App() {
    const [timer] = React.useState(() => {
        const timer = new Timer({name: 'Internal timer', every: 500});
        timer.startTimer();
        return timer;
    });
    const [game, setGame] = React.useState(null);
    // null = show scenario select; non-null = game is running
    const [scenarioChosen, setScenarioChosen] = React.useState(false);
    const [uiState, setUiState] = React.useState({
        openPanels: new Set(),
        selectedTabs: new Map(),
        scrollPositions: new Map()
    });
    const fileInputRef = React.useRef(null);

    // Theme state — persisted in localStorage so it survives page reloads
    const [themeId, setThemeId] = React.useState(() => {
        return localStorage.getItem('darkAgesTheme') || 'parchment';
    });
    const theme = getTheme(themeId);

    const handleThemeChange = (id) => {
        setThemeId(id);
        localStorage.setItem('darkAgesTheme', id);
    };

    /**
     * Called when the player clicks "Begin" on the scenario select screen.
     * Creates a new Game with the chosen scenario config.
     * The game clock is NOT started here — the player uses the HUD Play button.
     */
    const handleScenarioStart = (scenarioConfig) => {
        const newGame = new Game(scenarioConfig);
        setGame(newGame);
        setScenarioChosen(true);
    };

    const handleSave = () => {
        if (!game) return;
        // Save game state and UI state together
        const saveData = {
            version: '1.0',
            timestamp: Date.now(),
            gameState: saveGame(game),
            uiState: {
                openPanels: Array.from(uiState.openPanels),
                selectedTabs: Object.fromEntries(uiState.selectedTabs),
                scrollPositions: Object.fromEntries(uiState.scrollPositions)
            }
        };
        
        // Create and trigger download
        const blob = new Blob([JSON.stringify(saveData)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dark_ages_save_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleLoad = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const saveData = JSON.parse(e.target.result);
                
                // Pause game during load
                if (game) {
                    game.gameClock.stopTimer();
                }
                
                // Load game state
                const loadedGame = loadGame(saveData.gameState);
                
                // Restore UI state
                if (saveData.uiState) {
                    setUiState({
                        openPanels: new Set(saveData.uiState.openPanels),
                        selectedTabs: new Map(Object.entries(saveData.uiState.selectedTabs)),
                        scrollPositions: new Map(Object.entries(saveData.uiState.scrollPositions))
                    });
                }
                
                // Initialize game with restored state
                loadedGame.init();
                setGame(loadedGame);
                setScenarioChosen(true); // Skip scenario select when loading a save
                
            } catch (error) {
                console.error('Failed to load save file:', error);
                alert('Failed to load save file: ' + error.message);
            }
        };
        
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleScroll = (id, position) => {
        setUiState(prevState => ({
            ...prevState,
            scrollPositions: new Map(prevState.scrollPositions).set(id, position)
        }));
    };
    
    const togglePanel = (panelId) => {
        setUiState(prevState => {
            const newOpenPanels = new Set(prevState.openPanels);
            if (newOpenPanels.has(panelId)) {
                newOpenPanels.delete(panelId);
            } else {
                newOpenPanels.add(panelId);
            }
            return {
                ...prevState,
                openPanels: newOpenPanels
            };
        });
    };

    // Show scenario select screen until the player has chosen a scenario
    if (!scenarioChosen) {
        return (
            <div>
                <ScenarioSelectUI onStart={handleScenarioStart} />
                {/* Allow loading a save from the scenario select screen too */}
                <div style={{
                    position: 'fixed', bottom: '16px', right: '16px',
                    backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 12px',
                    borderRadius: '4px', fontSize: '12px', color: '#ccc'
                }}>
                    <span style={{ marginRight: '8px' }}>Load save:</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleLoad}
                        accept=".json"
                        style={{ color: '#ccc', fontSize: '12px' }}
                    />
                </div>
            </div>
        );
    }

    if (!game) {
        return <div>Loading...</div>;
    }

    return (
        <ThemeContext.Provider value={theme}>
            {/* Root page background */}
            <div style={{ minHeight: '100vh', backgroundColor: theme.colors.pageBg }}>
                <GameUI 
                    internalTimer={timer}
                    game={game}
                    uiState={uiState}
                    onScroll={handleScroll}
                    onPanelToggle={togglePanel}
                />
                {/* Bottom toolbar: save/load, scenario select, theme switcher — fixed to bottom of viewport */}
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 200,
                    margin: '0',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: theme.colors.hudBg,
                    borderTop: `1px solid ${theme.colors.hudBorder}`,
                    flexWrap: 'wrap',
                }}>
                    <button
                        onClick={handleSave}
                        style={{
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.btnBorder}`,
                            color: theme.colors.btnText,
                            padding: '3px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                        }}
                    >
                        Save Game
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleLoad}
                        accept=".json"
                        style={{ color: theme.colors.textMuted, fontSize: '12px' }}
                    />
                    <button
                        onClick={() => {
                            // Return to scenario select — stop current game clock first
                            if (game) game.gameClock.stopTimer();
                            setGame(null);
                            setScenarioChosen(false);
                        }}
                        style={{
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.colors.btnBorder}`,
                            color: theme.colors.textMuted,
                            padding: '3px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                        }}
                    >
                        ↩ Scenario Select
                    </button>

                    {/* Theme switcher */}
                    <div style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <span style={{ fontSize: '11px', color: theme.colors.textMuted }}>Theme:</span>
                        {THEME_LIST.map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleThemeChange(t.id)}
                                title={t.description}
                                style={{
                                    backgroundColor: themeId === t.id ? theme.colors.accent : 'transparent',
                                    border: `1px solid ${themeId === t.id ? theme.colors.accent : theme.colors.btnBorder}`,
                                    color: themeId === t.id ? theme.colors.accentText : theme.colors.btnText,
                                    padding: '3px 10px',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: themeId === t.id ? 'bold' : 'normal',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </ThemeContext.Provider>
    );
}

export default App;
