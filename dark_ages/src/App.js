import './App.css';
import {Timer} from './game_logic/timer.js'
import GameUI from './game_logic/gameUI.js'
import React from 'react';
import { saveGame, loadGame } from './game_logic/save_load';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.timer = new Timer({name: 'Internal timer', every: 500});
        this.timer.startTimer();
        this.state = {
            ready: false,
            uiState: {
                openPanels: new Set(),
                selectedTabs: new Map(),
                scrollPositions: new Map()
            }
        };
    }

    stateSetter = () => {
        this.setState({
            timer: this.timer,
            ready: true
        });
    }

    componentDidMount() {
        this.timer.startTimer();
        this.callback = this.timer.subscribe(this.stateSetter, 'main loop timer');
    }

    componentWillUnmount() {
        if (this.callback) {
            this.timer.unsubscribe(this.callback);
        }
        this.timer.stopTimer();
    }

    handleSave = () => {
        // Capture current UI state
        const currentUiState = {
            openPanels: Array.from(this.state.uiState.openPanels),
            selectedTabs: Object.fromEntries(this.state.uiState.selectedTabs),
            scrollPositions: Object.fromEntries(this.state.uiState.scrollPositions)
        };
        
        const saveData = {
            gameState: saveGame(this.game),
            uiState: currentUiState,
            timestamp: Date.now()
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
    };
    
    handleLoad = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const saveData = JSON.parse(e.target.result);
                
                // Pause game during load
                this.game.gameClock.stopTimer();
                
                // Load game state
                const loadedGame = loadGame(saveData.gameState);
                
                // Restore UI state
                if (saveData.uiState) {
                    this.setState({
                        uiState: {
                            openPanels: new Set(saveData.uiState.openPanels),
                            selectedTabs: new Map(Object.entries(saveData.uiState.selectedTabs)),
                            scrollPositions: new Map(Object.entries(saveData.uiState.scrollPositions))
                        }
                    });
                }
                
                // Initialize game with restored state
                loadedGame.init();
                
                this.game = loadedGame;
                
            } catch (error) {
                console.error('Failed to load save file:', error);
                alert('Failed to load save file');
            }
        };
        
        reader.readAsText(file);
    };
    
    handleScroll = (id, position) => {
        this.setState(prevState => ({
            uiState: {
                ...prevState.uiState,
                scrollPositions: new Map(prevState.uiState.scrollPositions).set(id, position)
            }
        }));
    };
    
    togglePanel = (panelId) => {
        this.setState(prevState => {
            const newOpenPanels = new Set(prevState.uiState.openPanels);
            if (newOpenPanels.has(panelId)) {
                newOpenPanels.delete(panelId);
            } else {
                newOpenPanels.add(panelId);
            }
            return {
                uiState: {
                    ...prevState.uiState,
                    openPanels: newOpenPanels
                }
            };
        });
    };

    render() {
        if (this.state.ready) {
            return (
                <div>
                    <GameUI 
                        internalTimer={this.state.timer}
                        uiState={this.state.uiState}
                        onScroll={this.handleScroll}
                        onPanelToggle={this.togglePanel}
                    />
                    <div>
                        <button onClick={this.handleSave}>Save Game</button>
                        <input type="file" onChange={this.handleLoad} accept=".json" />
                    </div>
                </div>
            );
        } else {
            return (
                <div>
                    Not ready
                </div> 
            );
        }
    }
}

export default App;
