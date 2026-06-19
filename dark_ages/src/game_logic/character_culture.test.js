/**
 * character_culture.test.js
 *
 * Unit tests for the Culture/Religion system and leader-change behaviour.
 * Tests that cultural/religious trait modifiers are correctly applied to and
 * removed from settlements when leaders change.
 *
 * Run via:
 *   export PATH="/home/vincent/.nvm/versions/node/v20.17.0/bin:$PATH"
 *   cd dark_ages && node ./node_modules/.bin/react-scripts test --testPathPattern=character_culture --watchAll=false --verbose
 *
 * NOTE on modifier names:
 *   Trait constructor calls `effect.setOrigin(traitName)` which renames the bonus to
 *   `"<variableAccessor> bonus from <traitName>"` (e.g. "tradeFactor bonus from merchant civilisation").
 *   The VariableModifier created in SimpleSettlementModifier.activate() uses this.name,
 *   so modifiers on Variables are named e.g. "tradeFactor bonus from merchant civilisation".
 */

import Game from './game';
import { Logger, LOG_LEVELS } from './logger';
import { SCENARIOS } from './scenarios';
import {
    Character,
    Celtic, Roman, Byzantine, Germanic, Viking,
    CelticPagan, GermanPagan, Christianity, RomanPagan, CelticChristianity, NorsePagan,
    Cultures,
    getAllowedReligions, getDefaultReligion, copyReligion, copyCulture,
    getRandomCharacterName, getRandomSettlementName,
    CULTURE_NAMES,
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

/** Build a minimal Game with the default scenario so we have a real Settlement + gameClock. */
function makeGame() {
    Logger.constructLogger();
    return new Game(SCENARIOS.default);
}

/** Find modifiers on a Variable whose name contains a substring. */
function findModifiers(variable, substring) {
    return variable.modifiers.filter(m => m.name && m.name.includes(substring));
}

// ─── Culture trait tests ───────────────────────────────────────────────────────

describe('Culture traits applied on setLeader', () => {
    test('Byzantine leader: tradeFactor gets merchant civilisation modifier (×1.2)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const byzantineLeader = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(byzantineLeader);
        // Bonus name: "tradeFactor bonus from merchant civilisation"
        // VariableModifier wraps an inner Variable; the value is in modifier.variable.currentValue
        const mods = findModifiers(settlement.tradeFactor, 'merchant civilisation');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(1.2);
    });

    test('Byzantine leader: rebellionSupport gets incessant infighting modifier (×1.5)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const byzantineLeader = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(byzantineLeader);
        const mods = findModifiers(settlement.rebellionSupport, 'incessant infighting');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(1.5);
    });

    test('Viking leader: tradeFactor gets feared modifier (×0.8)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const vikingLeader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(vikingLeader);
        const mods = findModifiers(settlement.tradeFactor, 'feared');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(0.8);
    });

    test('Germanic leader: rebellionSupport gets barracks emperors modifier (×2.0)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const germanicLeader = new Character({
            name: 'Aldric',
            culture: new Germanic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(germanicLeader);
        const mods = findModifiers(settlement.rebellionSupport, 'barracks emperors');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(2.0);
    });
});

describe('Old leader modifiers removed on leader change', () => {
    test('Byzantine → Celtic: tradeFactor merchant civilisation modifier is removed', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const byzantineLeader = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(byzantineLeader);
        expect(findModifiers(settlement.tradeFactor, 'merchant civilisation')).toHaveLength(1);

        const celticLeader = new Character({
            name: 'Cormac',
            culture: new Celtic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(celticLeader);

        // Byzantine modifier should be gone
        expect(findModifiers(settlement.tradeFactor, 'merchant civilisation')).toHaveLength(0);
    });

    test('Byzantine → Celtic: rebellionSupport incessant infighting modifier is removed', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const byzantineLeader = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(byzantineLeader);
        expect(findModifiers(settlement.rebellionSupport, 'incessant infighting')).toHaveLength(1);

        const celticLeader = new Character({
            name: 'Cormac',
            culture: new Celtic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(celticLeader);
        // rebellionSupport is recreated in setLeader — new instance has no incessant infighting modifier
        expect(findModifiers(settlement.rebellionSupport, 'incessant infighting')).toHaveLength(0);
    });

    test('New leader modifiers are applied after leader change', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const celticLeader = new Character({
            name: 'Cormac',
            culture: new Celtic(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(celticLeader);

        const vikingLeader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(vikingLeader);

        // Viking "feared" modifier should now be on tradeFactor
        expect(findModifiers(settlement.tradeFactor, 'feared')).toHaveLength(1);
        // Celtic has no tradeFactor modifier
        expect(findModifiers(settlement.tradeFactor, 'foresters')).toHaveLength(0);
    });
});

// ─── Religion trait tests ──────────────────────────────────────────────────────

describe('Religion traits applied on setLeader', () => {
    test('Christianity leader: legitimacy gets render unto caesar modifier (+0.05)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const christianLeader = new Character({
            name: 'Marcus',
            culture: new Byzantine(),
            religion: new Christianity(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(christianLeader);
        // "render unto caesar" is a LegitimacyBonus (CharacterBonus) — applied to character.legitimacy
        // VariableModifier wraps an inner Variable; the value is in modifier.variable.currentValue
        const mods = findModifiers(christianLeader.legitimacy, 'render unto caesar');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(0.05);
    });

    test('NorsePagan leader: strategy gets valhalla modifier (×1.1)', () => {
        const game = makeGame();
        const settlement = game.settlements[0];
        const norsePaganLeader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            religion: new NorsePagan(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(norsePaganLeader);
        const mods = findModifiers(norsePaganLeader.strategy, 'valhalla');
        expect(mods).toHaveLength(1);
        expect(mods[0].variable.currentValue).toBeCloseTo(1.1);
    });
});

describe('Religion traits removed on leader change', () => {
    test('NorsePagan → Christianity: new leader does not have valhalla modifier', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const norsePaganLeader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            religion: new NorsePagan(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(norsePaganLeader);
        expect(findModifiers(norsePaganLeader.strategy, 'valhalla')).toHaveLength(1);

        const christianLeader = new Character({
            name: 'Marcus',
            culture: new Byzantine(),
            religion: new Christianity(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(christianLeader);

        // New leader should NOT have a valhalla modifier
        expect(findModifiers(christianLeader.strategy, 'valhalla')).toHaveLength(0);
        // New leader should have render unto caesar
        expect(findModifiers(christianLeader.legitimacy, 'render unto caesar')).toHaveLength(1);
    });
});

// ─── changeCulture / changeReligion on a character with settlements ────────────

describe('changeCulture() on a character controlling a settlement', () => {
    test('Old culture modifiers removed, new culture modifiers applied', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const leader = new Character({
            name: 'Konstantinos',
            culture: new Byzantine(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(leader);
        expect(findModifiers(settlement.tradeFactor, 'merchant civilisation')).toHaveLength(1);

        // Change culture to Viking
        leader.changeCulture(new Viking());

        // Byzantine modifier gone
        expect(findModifiers(settlement.tradeFactor, 'merchant civilisation')).toHaveLength(0);
        // Viking "feared" modifier present
        expect(findModifiers(settlement.tradeFactor, 'feared')).toHaveLength(1);
    });

    test('changeCulture resets religion to new default when incompatible', () => {
        const leader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            religion: new NorsePagan(),
            gameClock: null,
        });
        expect(leader.religion).toBeInstanceOf(NorsePagan);

        // Change to Byzantine — NorsePagan is not allowed for Byzantine
        leader.changeCulture(new Byzantine());
        // Should have been reset to Christianity (Byzantine default)
        expect(leader.religion).toBeInstanceOf(Christianity);
    });

    test('changeCulture keeps religion when still compatible', () => {
        const leader = new Character({
            name: 'Marcus',
            culture: new Celtic(),
            religion: new Christianity(),
            gameClock: null,
        });
        expect(leader.religion).toBeInstanceOf(Christianity);

        // Change to Byzantine — Christianity is allowed for Byzantine
        leader.changeCulture(new Byzantine());
        expect(leader.religion).toBeInstanceOf(Christianity);
    });
});

describe('changeReligion() on a character controlling a settlement', () => {
    test('Old religion modifiers removed, new religion modifiers applied', () => {
        const game = makeGame();
        const settlement = game.settlements[0];

        const leader = new Character({
            name: 'Bjorn',
            culture: new Viking(),
            religion: new NorsePagan(),
            gameClock: game.gameClock,
        });
        settlement.setLeader(leader);
        expect(findModifiers(leader.strategy, 'valhalla')).toHaveLength(1);

        // Change religion to Christianity
        leader.changeReligion(new Christianity());

        // NorsePagan modifier gone
        expect(findModifiers(leader.strategy, 'valhalla')).toHaveLength(0);
        // Christianity modifier present
        expect(findModifiers(leader.legitimacy, 'render unto caesar')).toHaveLength(1);
    });
});

// ─── changeCulture/changeReligion with no prior lastTraits (latent bug fix) ────

describe('changeCulture/changeReligion with freshly constructed culture (no lastTraits)', () => {
    test('changeCulture does not throw when old culture has no lastTraits', () => {
        const leader = new Character({
            name: 'Test',
            culture: new Celtic(),
            gameClock: null,
        });
        // Forcibly replace culture with a fresh instance that has no lastTraits
        // (simulates a deserialized state where getTraits() was never called)
        const freshCulture = new Byzantine();
        // freshCulture.lastTraits is undefined at this point
        expect(freshCulture.lastTraits).toBeUndefined();
        leader.culture = freshCulture;
        // Now call changeCulture — should not throw (uses getTraits() fallback)
        expect(() => leader.changeCulture(new Viking())).not.toThrow();
    });

    test('changeReligion does not throw when old religion has no lastTraits', () => {
        const leader = new Character({
            name: 'Test',
            culture: new Viking(),
            religion: new NorsePagan(),
            gameClock: null,
        });
        // Forcibly replace religion with a fresh instance that has no lastTraits
        const freshReligion = new Christianity();
        expect(freshReligion.lastTraits).toBeUndefined();
        leader.religion = freshReligion;
        // Now call changeReligion — should not throw
        expect(() => leader.changeReligion(new NorsePagan())).not.toThrow();
    });
});

// ─── CULTURE_RELIGION_COMPATIBILITY helpers ────────────────────────────────────

describe('getAllowedReligions()', () => {
    test('Celtic allows CelticPagan, CelticChristianity, Christianity', () => {
        const allowed = getAllowedReligions(new Celtic());
        expect(allowed).toContain(CelticPagan);
        expect(allowed).toContain(CelticChristianity);
        expect(allowed).toContain(Christianity);
        expect(allowed).not.toContain(NorsePagan);
    });

    test('Viking allows NorsePagan and Christianity only', () => {
        const allowed = getAllowedReligions(new Viking());
        expect(allowed).toContain(NorsePagan);
        expect(allowed).toContain(Christianity);
        expect(allowed).not.toContain(CelticPagan);
        expect(allowed).not.toContain(GermanPagan);
    });

    test('Byzantine allows Christianity and RomanPagan', () => {
        const allowed = getAllowedReligions(new Byzantine());
        expect(allowed).toContain(Christianity);
        expect(allowed).toContain(RomanPagan);
        expect(allowed).not.toContain(NorsePagan);
    });
});

describe('getDefaultReligion()', () => {
    test('Celtic default is CelticPagan', () => {
        expect(getDefaultReligion(new Celtic())).toBeInstanceOf(CelticPagan);
    });
    test('Byzantine default is Christianity', () => {
        expect(getDefaultReligion(new Byzantine())).toBeInstanceOf(Christianity);
    });
    test('Viking default is NorsePagan', () => {
        expect(getDefaultReligion(new Viking())).toBeInstanceOf(NorsePagan);
    });
    test('Germanic default is GermanPagan', () => {
        expect(getDefaultReligion(new Germanic())).toBeInstanceOf(GermanPagan);
    });
    test('Roman default is RomanPagan', () => {
        expect(getDefaultReligion(new Roman())).toBeInstanceOf(RomanPagan);
    });
});

describe('copyReligion()', () => {
    test('copies NorsePagan correctly', () => {
        const leader = new Character({ name: 'Bjorn', culture: new Viking(), religion: new NorsePagan(), gameClock: null });
        expect(copyReligion(leader)).toBeInstanceOf(NorsePagan);
    });
    test('copies Christianity correctly', () => {
        const leader = new Character({ name: 'Marcus', culture: new Byzantine(), religion: new Christianity(), gameClock: null });
        expect(copyReligion(leader)).toBeInstanceOf(Christianity);
    });
    test('falls back to CelticPagan when no religion set', () => {
        const leader = new Character({ name: 'Test', culture: new Celtic(), gameClock: null });
        leader.religion = null;
        expect(copyReligion(leader)).toBeInstanceOf(CelticPagan);
    });
});

describe('copyCulture()', () => {
    test('copies Byzantine correctly', () => {
        const leader = new Character({ name: 'Konstantinos', culture: new Byzantine(), gameClock: null });
        expect(copyCulture(leader)).toBeInstanceOf(Byzantine);
    });
    test('copies Viking correctly', () => {
        const leader = new Character({ name: 'Bjorn', culture: new Viking(), gameClock: null });
        expect(copyCulture(leader)).toBeInstanceOf(Viking);
    });
});

// ─── Name lists ───────────────────────────────────────────────────────────────

describe('getRandomCharacterName()', () => {
    test('returns a string from the Celtic name list', () => {
        const name = getRandomCharacterName(new Celtic());
        expect(CULTURE_NAMES.Celtic.characterNames).toContain(name);
    });
    test('returns a string from the Viking name list', () => {
        const name = getRandomCharacterName(new Viking());
        expect(CULTURE_NAMES.Viking.characterNames).toContain(name);
    });
    test('returns a string from the Byzantine name list', () => {
        const name = getRandomCharacterName(new Byzantine());
        expect(CULTURE_NAMES.Byzantine.characterNames).toContain(name);
    });
});

describe('getRandomSettlementName()', () => {
    test('returns a string from the Germanic settlement name list', () => {
        const name = getRandomSettlementName(new Germanic());
        expect(CULTURE_NAMES.Germanic.settlementNames).toContain(name);
    });
});

// ─── NPC character construction ───────────────────────────────────────────────

describe('NPC character construction in Game', () => {
    test('npcCharacter has a culture, religion, and name', () => {
        const game = makeGame();
        const npc = game.npcCharacter;
        expect(npc.culture).toBeDefined();
        expect(npc.religion).toBeDefined();
        expect(typeof npc.name).toBe('string');
        expect(npc.name.length).toBeGreaterThan(0);
    });

    test('npcCharacter religion is compatible with its culture', () => {
        const game = makeGame();
        const npc = game.npcCharacter;
        const allowed = getAllowedReligions(npc.culture);
        const isCompatible = allowed.some(R => npc.religion instanceof R);
        expect(isCompatible).toBe(true);
    });
});
