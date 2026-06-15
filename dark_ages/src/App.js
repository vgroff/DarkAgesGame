import './App.css';
import {Timer} from './game_logic/timer.js'
import GameUI from './game_logic/gameUI.js'
import React from 'react';
import { saveGame, loadGame } from './game_logic/save_load';
import Game from './game_logic/game';
import ScenarioSelectUI from './game_logic/ScenarioSelectUI';

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
        <div>
            <GameUI 
                internalTimer={timer}
                game={game}
                uiState={uiState}
                onScroll={handleScroll}
                onPanelToggle={togglePanel}
            />
            <div style={{ margin: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={handleSave}>
                    Save Game
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleLoad}
                    accept=".json"
                />
                <button
                    onClick={() => {
                        // Return to scenario select — stop current game clock first
                        if (game) game.gameClock.stopTimer();
                        setGame(null);
                        setScenarioChosen(false);
                    }}
                    style={{ marginLeft: '8px', color: '#888', fontSize: '12px' }}
                >
                    ↩ Scenario Select
                </button>
            </div>
        </div>
    );
}

export default App;
