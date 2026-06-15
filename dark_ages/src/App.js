import './App.css';
import {Timer} from './game_logic/timer.js'
import GameUI from './game_logic/gameUI.js'
import React from 'react';
import { saveGame, loadGame } from './game_logic/save_load';
import Game from './game_logic/game';

function App() {
    const [timer] = React.useState(() => {
        const timer = new Timer({name: 'Internal timer', every: 500});
        timer.startTimer();
        return timer;
    });
    const [game, setGame] = React.useState(null);
    const [ready, setReady] = React.useState(false);
    const [uiState, setUiState] = React.useState({
        openPanels: new Set(),
        selectedTabs: new Map(),
        scrollPositions: new Map()
    });
    const fileInputRef = React.useRef(null);

    React.useEffect(() => {
        if (!game) {
            setGame(new Game());
        }
        setReady(true);
    }, [game]);

    const handleSave = () => {
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

    if (!ready || !game) {
        return <div>Not ready</div>;
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
            <div style={{ margin: '10px' }}>
                <button onClick={handleSave} style={{ marginRight: '10px' }}>
                    Save Game
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleLoad}
                    accept=".json"
                />
            </div>
        </div>
    );
}

export default App;
