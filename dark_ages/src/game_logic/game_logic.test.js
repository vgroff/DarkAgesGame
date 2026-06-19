/**
 * game_logic.test.js
 *
 * Broader smoke + integration tests for core game logic.
 * Covers: Game construction, Settlement state, Variable system,
 * save/load round-trip, rebellion, and scenario application.
 *
 * Run via:
 *   export PATH="/home/vincent/.nvm/versions/node/v20.17.0/bin:$PATH"
 *   cd dark_ages && node ./node_modules/.bin/react-scripts test --testPathPattern=game_logic --watchAll=false --verbose
 *
 * NOTE on modifier names:
 *   Trait constructor calls `effect.setOrigin(traitName)` which renames the bonus to
 *   `"<variableAccessor> bonus from <traitName>"`.
 *   The VariableModifier created in SimpleSettlementModifier.activate() uses this.name,
 *   so modifiers on Variables are named e.g. "tradeFactor bonus from merchant civilisation".
 *
 * NOTE on legitimacy values:
 *   Character.legitimacy starts at 0.1 but Faction privilege traits (e.g. "small nobility")
 *   add further modifiers. Tests that check legitimacy values use toBeGreaterThan/LessThan
 *   rather than exact values, or check relative differences.
 */

import Game from './game';
import { Logger, LOG_LEVELS } from './logger';
import { SCENARIOS } from './scenarios';
import { saveGame, loadGame } from './save_load';
import {
    Character,
    Celtic, Roman, Byzantine, Germanic, Viking,
    CelticPagan, Christianity, NorsePagan,
    getAllowedReligions, getDefaultReligion,
} from './character';

// jsdom stubs
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

beforeAll(() => {
    jest.useFakeTimers();
});
afterAll(() => {
    jest.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshGame(scenario = SCENARIOS.default) {
    Logger.constructLogger();
    Logger.getLogger().fileLog.length = 0;
    return new Game(scenario);
}

function getProblems() {
    return Logger.getLogger().fileLog.filter(
        e => e.level >= LOG_LEVELS.WARN && e.level < LOG_LEVELS.GAME_MSG
    );
}

/** Find modifiers on a Variable whose name contains a substring. */
function findModifiers(variable, substring) {
    return variable.modifiers.filter(m => m.name && m.name.includes(substring));
}

// ─── Game construction ────────────────────────────────────────────────────────

describe('Game construction — default scenario', () => {
    test('constructs without WARN/ERROR logs', () => {
        freshGame(SCENARIOS.default);
        const problems = getProblems();
        if (problems.length > 0) {
            problems.forEach(e => console.log(`[${e.levelName}] ${e.message}`, e.context || ''));
        }
        expect(problems).toHaveLength(0);
    });

    test('player settlement exists with positive population', () => {
        const game = freshGame(SCENARIOS.default);
        const s = game.settlements[0];
        expect(s).toBeDefined();
        expect(s.populationSizeExternal.currentValue).toBeGreaterThan(0);
    });

    test('player character has culture and religion', () => {
        const game = freshGame(SCENARIOS.default);
        expect(game.playerCharacter.culture).toBeDefined();
        expect(game.playerCharacter.religion).toBeDefined();
    });

    test('npc character has culture and religion compatible with each other', () => {
        const game = freshGame(SCENARIOS.default);
        const npc = game.npcCharacter;
        expect(npc.culture).toBeDefined();
        expect(npc.religion).toBeDefined();
        const allowed = getAllowedReligions(npc.culture);
        expect(allowed.some(R => npc.religion instanceof R)).toBe(true);
    });

    test('game clock starts at 0', () => {
        const game = freshGame(SCENARIOS.default);
        expect(game.gameClock.currentValue).toBe(0);
    });

    test('treasury is a Variable with a numeric value', () => {
        const game = freshGame(SCENARIOS.default);
        expect(typeof game.treasury.currentValue).toBe('number');
    });
});

describe('Game construction — all scenarios produce no WARN/ERROR', () => {
    Object.entries(SCENARIOS).forEach(([key, scenario]) => {
        test(`scenario: ${key}`, () => {
            freshGame(scenario);
            const problems = getProblems();
            if (problems.length > 0) {
                problems.forEach(e => console.log(`[${e.levelName}] ${e.message}`, e.context || ''));
            }
            expect(problems).toHaveLength(0);
        });
    });
});

// ─── Settlement initial state ─────────────────────────────────────────────────

describe('Settlement initial state', () => {
    test('generalProductivity is between 0 and 2', () => {
        const game = freshGame(SCENARIOS.default);
        const gp = game.settlements[0].generalProductivity.currentValue;
        expect(gp).toBeGreaterThan(0);
        expect(gp).toBeLessThanOrEqual(2);
    });

    test('happiness is between 0 and 1', () => {
        const game = freshGame(SCENARIOS.default);
        const h = game.settlements[0].happiness.currentValue;
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
    });

    test('health is between 0 and 1', () => {
        const game = freshGame(SCENARIOS.default);
        const h = game.settlements[0].health.currentValue;
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
    });

    test('support variable exists', () => {
        const game = freshGame(SCENARIOS.default);
        expect(game.settlements[0].support).toBeDefined();
        expect(typeof game.settlements[0].support.currentValue).toBe('number');
    });

    test('rebellionSupport variable exists and is >= 0', () => {
        const game = freshGame(SCENARIOS.default);
        expect(game.settlements[0].rebellionSupport.currentValue).toBeGreaterThanOrEqual(0);
    });

    test('totalRebellionSupport starts at >= 0', () => {
        const game = freshGame(SCENARIOS.default);
        expect(game.settlements[0].totalRebellionSupport.currentValue).toBeGreaterThanOrEqual(0);
    });

    test('tradeFactor is a Variable', () => {
        const game = freshGame(SCENARIOS.default);
        expect(typeof game.settlements[0].tradeFactor.currentValue).toBe('number');
    });
});

// ─── setLeader ordering: rebellionSupport modifiers work ─────────────────────

describe('setLeader() — rebellionSupport modifier ordering', () => {
    test('Byzantine rebellionSupport incessant infighting modifier (×1.5) is present after setLeader', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        const byz = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(byz);
        const mods = findModifiers(settlement.rebellionSupport, 'incessant infighting');
        expect(mods).toHaveLength(1);
        // VariableModifier wraps an inner Variable; the value is in modifier.variable.currentValue
        expect(mods[0].variable.currentValue).toBeCloseTo(1.5);
    });

    test('Germanic rebellionSupport barracks emperors modifier (×2.0) is present after setLeader', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        const germ = new Character({
            name: 'Aldric',
            culture: new Germanic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(germ);
        const mods = findModifiers(settlement.rebellionSupport, 'barracks emperors');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(2.0);
    });

    test('rebellionSupport is recreated on each setLeader call', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        const ref1 = settlement.rebellionSupport;

        const newLeader = new Character({
            name: 'Cormac',
            culture: new Celtic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(newLeader);
        const ref2 = settlement.rebellionSupport;

        // rebellionSupport should be a new object each time
        expect(ref2).not.toBe(ref1);
    });
});

// ─── Variable system ──────────────────────────────────────────────────────────

describe('Variable system', () => {
    test('Variable modifier addition works', () => {
        const { Variable } = require('./variable/variable');
        const { VariableModifier, addition } = require('./variable/modifier');
        const base = new Variable({ name: 'test', startingValue: 10 });
        const mod = new VariableModifier({ startingValue: 5, type: addition });
        base.addModifier(mod);
        expect(base.currentValue).toBeCloseTo(15);
    });

    test('Variable modifier removal works', () => {
        const { Variable } = require('./variable/variable');
        const { VariableModifier, addition } = require('./variable/modifier');
        const base = new Variable({ name: 'test', startingValue: 10 });
        const mod = new VariableModifier({ startingValue: 5, type: addition });
        base.addModifier(mod);
        base.removeModifier(mod);
        expect(base.currentValue).toBeCloseTo(10);
    });

    test('Variable multiplication modifier works', () => {
        const { Variable } = require('./variable/variable');
        const { VariableModifier, multiplication } = require('./variable/modifier');
        const base = new Variable({ name: 'test', startingValue: 10 });
        const mod = new VariableModifier({ startingValue: 1.5, type: multiplication });
        base.addModifier(mod);
        expect(base.currentValue).toBeCloseTo(15);
    });
});

// ─── Character skills ─────────────────────────────────────────────────────────

describe('Character skills and administrativeEfficiency', () => {
    test('administrativeEfficiency = 0.9 when administration = 0', () => {
        const c = new Character({ name: 'Test', culture: new Celtic(), gameClock: null });
        // administration starts at undefined → 0
        expect(c.administrativeEfficiency.currentValue).toBeCloseTo(0.9);
    });

    test('Byzantine state bureaucracy adds +0.15 to administration', () => {
        const c = new Character({ name: 'Konstantinos', culture: new Byzantine(), gameClock: null });
        // administration base is 0, +0.15 from state bureaucracy
        expect(c.administration.currentValue).toBeCloseTo(0.15);
    });

    test('Germanic bane of the empire adds +0.05 legitimacy modifier', () => {
        // Check the modifier exists and has the right value
        // VariableModifier wraps an inner Variable; the value is in modifier.variable.currentValue
        const germanic = new Character({ name: 'Aldric', culture: new Germanic(), gameClock: null });
        const mods = findModifiers(germanic.legitimacy, 'bane of the empire');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(0.05);
    });

    test('Viking legitimacy through blood adds -0.08 legitimacy modifier', () => {
        const viking = new Character({ name: 'Bjorn', culture: new Viking(), gameClock: null });
        const mods = findModifiers(viking.legitimacy, 'legitimacy through blood');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(-0.08);
    });

    test('Christianity render unto caesar adds +0.05 to legitimacy (relative to NorsePagan)', () => {
        const norsePagan = new Character({ name: 'Bjorn', culture: new Viking(), religion: new NorsePagan(), gameClock: null });
        const christian = new Character({ name: 'Marcus', culture: new Viking(), religion: new Christianity(), gameClock: null });
        // Christianity adds +0.05 legitimacy; NorsePagan adds nothing to legitimacy
        expect(christian.legitimacy.currentValue - norsePagan.legitimacy.currentValue).toBeCloseTo(0.05);
    });
});

// ─── Rebellion ────────────────────────────────────────────────────────────────

describe('Rebellion', () => {
    test('rebel() replaces leader with a new character', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        const originalLeader = settlement.leader;

        // Manually trigger rebellion
        settlement.rebel();

        expect(settlement.leader).not.toBe(originalLeader);
        expect(settlement.leader).toBeDefined();
    });

    test('rebel() new leader has a culture and religion', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        settlement.rebel();
        expect(settlement.leader.culture).toBeDefined();
        expect(settlement.leader.religion).toBeDefined();
    });

    test('rebel() new leader religion is compatible with their culture', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        settlement.rebel();
        const newLeader = settlement.leader;
        const allowed = getAllowedReligions(newLeader.culture);
        expect(allowed.some(R => newLeader.religion instanceof R)).toBe(true);
    });

    test('rebel() new leader has a non-empty name', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        settlement.rebel();
        expect(typeof settlement.leader.name).toBe('string');
        expect(settlement.leader.name.length).toBeGreaterThan(0);
    });

    test('rebel() resets rebellionOngoing flag after completion', () => {
        const game = freshGame(SCENARIOS.default);
        const settlement = game.settlements[0];
        settlement.rebel();
        // rebellionOngoing should be reset so future rebellions can fire
        expect(settlement.rebellionOngoing).toBe(false);
    });
});

// ─── Save / Load round-trip ───────────────────────────────────────────────────

describe('Save / Load round-trip', () => {
    test('saveGame() produces a serializable object (no throw)', () => {
        const game = freshGame(SCENARIOS.default);
        expect(() => saveGame(game)).not.toThrow();
    });

    test('saveGame() output is JSON-serializable', () => {
        const game = freshGame(SCENARIOS.default);
        const saved = saveGame(game);
        expect(() => JSON.stringify(saved)).not.toThrow();
    });

    test('loadGame(saveGame(game)) does not throw', () => {
        const game = freshGame(SCENARIOS.default);
        Logger.getLogger().fileLog.length = 0;
        const saved = saveGame(game);
        expect(() => loadGame(saved)).not.toThrow();
    });

    test('loadGame(saveGame(game)) produces no ERROR logs', () => {
        const game = freshGame(SCENARIOS.default);
        Logger.getLogger().fileLog.length = 0;
        const saved = saveGame(game);
        loadGame(saved);
        const errors = Logger.getLogger().fileLog.filter(e => e.level >= LOG_LEVELS.ERROR && e.level < LOG_LEVELS.GAME_MSG);
        if (errors.length > 0) {
            errors.forEach(e => console.log(`[${e.levelName}] ${e.message}`, e.context || ''));
        }
        expect(errors).toHaveLength(0);
    });

    test('loaded game preserves player character culture name', () => {
        const game = freshGame(SCENARIOS.default);
        const originalCultureName = game.playerCharacter.culture.name;
        const saved = saveGame(game);
        const loaded = loadGame(saved);
        expect(loaded.playerCharacter.culture.name).toBe(originalCultureName);
    });

    test('loaded game preserves player character religion name', () => {
        const game = freshGame(SCENARIOS.default);
        const originalReligionName = game.playerCharacter.religion.name;
        const saved = saveGame(game);
        const loaded = loadGame(saved);
        expect(loaded.playerCharacter.religion.name).toBe(originalReligionName);
    });
});

// ─── Scenario: banditRaid ─────────────────────────────────────────────────────

describe('banditRaid scenario', () => {
    test('no WARN/ERROR logs, unemployed=0, army>0', () => {
        const game = freshGame(SCENARIOS.banditRaid);
        const problems = getProblems();
        if (problems.length > 0) {
            problems.forEach(e => console.log(`[${e.levelName}] ${e.message}`, e.context || ''));
        }
        expect(problems).toHaveLength(0);
        expect(game.settlements[0].unemployed.currentValue).toBe(0);
        expect(game.settlements[0].armyStrength.currentValue).toBeGreaterThan(0);
    });
});
