/**
 * scenario_debug.test.js
 *
 * Headless smoke test for the banditRaid scenario.
 * Runs via:
 *   export PATH="/home/vincent/.nvm/versions/node/v20.17.0/bin:$PATH"
 *   cd dark_ages && node ./node_modules/.bin/react-scripts test --testPathPattern=scenario_debug --watchAll=false --verbose
 */

import Game from './game';
import { Logger, LOG_LEVELS } from './logger';
import { SCENARIOS } from './scenarios';

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL — stub them
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

// Suppress setInterval ticking during tests — Timer uses setInterval
beforeAll(() => {
    jest.useFakeTimers();
});
afterAll(() => {
    jest.useRealTimers();
});

test('banditRaid scenario: no WARN/ERROR logs, unemployed=0, army>0', () => {
    // Construct logger fresh
    Logger.constructLogger();
    const logger = Logger.getLogger();
    logger.fileLog.length = 0;

    const scenario = SCENARIOS.banditRaid;
    const game = new Game(scenario);
    const playerSettlement = game.settlements[0];

    // Collect WARN and ERROR entries (exclude GAME_MSG which is player-facing)
    const problems = logger.fileLog.filter(e => e.level >= LOG_LEVELS.WARN && e.level < LOG_LEVELS.GAME_MSG);

    if (problems.length > 0) {
        console.log('=== WARN/ERROR log entries ===');
        problems.forEach(e => {
            console.log(`[${e.levelName}] ${e.message}`, e.context || '');
        });
    }

    const unemployed = playerSettlement.unemployed.currentValue;
    const armyStrength = playerSettlement.armyStrength.currentValue;

    console.log(`unemployed: ${unemployed}, armyStrength: ${armyStrength}, pop: ${playerSettlement.populationSizeExternal.currentValue}`);

    expect(problems).toHaveLength(0);
    expect(unemployed).toBe(0);
    expect(armyStrength).toBeGreaterThan(0);
});
