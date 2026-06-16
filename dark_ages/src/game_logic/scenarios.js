/**
 * scenarios.js
 *
 * Scenario definitions for the Dark Ages game.
 *
 * A scenario is a plain object that the Game constructor reads to customise
 * the starting state. It does NOT import any game classes — all interpretation
 * happens in game.js.
 *
 * Shape of a scenario object:
 * {
 *   id: string,                  // unique key
 *   name: string,                // display name
 *   description: string,         // shown in scenario select UI
 *
 *   // --- Settlement setup ---
 *   startingPopulation: number,  // player settlement starting population (default 37)
 *   startingTreasury: number,    // starting treasury gold (default 10)
 *   startingResources: {         // extra resources to add on top of defaults
 *     [resourceName]: number     // e.g. { wood: 200, iron: 50 }
 *   },
 *   startingBuildingSizes: {     // force specific building sizes at start
 *     [buildingName]: number     // e.g. { Farm: 3, Housing: 2 }
 *   },
 *   startingBuildingUpgrades: {  // force building upgrades at start (by upgrade index)
 *     [buildingName]: number     // e.g. { Housing: 1 } means first upgrade applied
 *   },
 *   startingArmy: {              // pre-arm soldiers at start
 *     [unitResourceName]: number // e.g. { 'iron spears': 5 }
 *   },
 *
 *   // --- Research ---
 *   // Array of research item names to pre-research (faction research tree).
 *   // Items are activated in order, so dependencies are satisfied if listed correctly.
 *   preResearched: string[],
 *
 *   // --- Character setup ---
 *   // If true, player character traits are pre-filled with sensible defaults
 *   // so the game doesn't force-stop on day 1 for trait selection.
 *   skipTraitSelection: boolean,
 *   // Pre-set specific trait names (by trait group key). If skipTraitSelection is true
 *   // and this is not set, sensible defaults are chosen automatically.
 *   playerTraits: {
 *     childhoodTrait?: string,
 *     abilityTrait?: string,
 *     personalityTrait?: string,
 *     fameTrait?: string,
 *     trinketTrait?: string,
 *   },
 *
 *   // --- Difficulty modifiers (applied via _applyScenario) ---
 *   researchRateMultiplier: number | null,   // null = no modifier; e.g. 1.15 = +15% research
 *   generalProductivityBonus: number | null, // null = no modifier; multiplicative e.g. 1.05
 *   legitimacyBonus: number | null,          // null = no modifier; additive e.g. 0.05
 *   eventBanUntilDay: number | null,         // null = no ban; number = ban all settlement events until this day
 *
 *   // --- Debug / event forcing ---
 *   // Force specific events to fire on day 1 (by event class name).
 *   forceEventsOnDayOne: string[],
 *   // Override the bandit raid ban period (default: 2 years = 24 ticks).
 *   // Set to 0 to allow bandit raid to fire immediately.
 *   banditRaidBanDays: number | null,
 * }
 */

/**
 * Available terrain options for the player settlement in a New Game.
 * The id must match the class name in terrain.js so game.js can look it up.
 */
export const TERRAIN_OPTIONS = [
    {
        id: 'Marshlands',
        label: 'Marshlands',
        description: 'Bog iron pit and peat bog available. Good for apothecary and lumber. Weaker farming and construction.',
    },
    {
        id: 'Farmlands',
        label: 'Farmlands',
        description: 'Strong farming. Weaker apothecary and lumber. Coal pit available.',
    },
    {
        id: 'Woodlands',
        label: 'Woodlands',
        description: 'Excellent lumber and apothecary. Hunting cabin bonus and extra max size. Weaker farming and construction.',
    },
    {
        id: 'Mountains',
        label: 'Mountains',
        description: 'Coal mine and iron mine bonuses. Weaker farming and construction.',
    },
];

/**
 * Difficulty preset definitions.
 * These are used by ScenarioSelectUI to populate the difficulty preset buttons
 * and to set the slider limits for the "New Game" scenario.
 *
 * The "intended" preset is the hardest allowed (lower bound for sliders).
 * The "easy" preset is the easiest allowed (upper bound for sliders).
 */
export const DIFFICULTY_PRESETS = {
    intended: {
        id: 'intended',
        label: 'Intended',
        description: 'Standard start with a one-year grace period before events begin.',
        startingTreasury: 10,
        researchRateMultiplier: null,
        generalProductivityBonus: null,
        legitimacyBonus: null,
        eventBanUntilDay: 12,   // 1 year = 12 days
        skipTraitSelection: false,
    },
    easy: {
        id: 'easy',
        label: 'Easy',
        description: 'Extra gold, research bonus, productivity boost, legitimacy boost, and two years before events begin.',
        startingTreasury: 30,
        researchRateMultiplier: 1.15,
        generalProductivityBonus: 1.05,
        legitimacyBonus: 0.05,
        eventBanUntilDay: 24,   // 2 years = 24 days
        skipTraitSelection: false,
    },
};

/**
 * Slider limits for the difficulty options panel.
 * Min = hardest allowed (Intended values), Max = easiest allowed (Easy values).
 * These are derived from DIFFICULTY_PRESETS to keep them in sync.
 */
export const DIFFICULTY_SLIDER_LIMITS = {
    startingTreasury:          { min: 10,   max: 30,   step: 5,    default: 10 },
    researchRateMultiplier:    { min: 1.0,  max: 1.15, step: 0.01, default: 1.0,  nullMeaning: 1.0 },
    generalProductivityBonus:  { min: 1.0,  max: 1.05, step: 0.01, default: 1.0,  nullMeaning: 1.0 },
    legitimacyBonus:           { min: 0.0,  max: 0.05, step: 0.01, default: 0.0,  nullMeaning: 0.0 },
    eventBanUntilDay:          { min: 12,   max: 24,   step: 1,    default: 12 },
};

export const SCENARIOS = {
    newGame: {
        id: 'newGame',
        name: 'New Game',
        description: 'Standard start. Set up your leader, then manage your settlement from scratch. Choose a difficulty preset or customise the options below.',
        startingPopulation: 37,
        startingTreasury: 10,
        startingResources: {},
        startingBuildingSizes: {},
        startingBuildingUpgrades: {},
        startingArmy: {},
        preResearched: [],
        skipTraitSelection: false,
        playerTraits: {},
        forceEventsOnDayOne: [],
        banditRaidBanDays: null, // null = use default (2 years)
        // Terrain for the player settlement (class name string, matched in game.js)
        playerTerrain: 'Marshlands',
        // Difficulty modifiers — set to Intended defaults
        researchRateMultiplier: null,
        generalProductivityBonus: null,
        legitimacyBonus: null,
        eventBanUntilDay: 12,   // 1 year grace period (Intended default)
    },

    banditRaid: {
        id: 'banditRaid',
        name: 'Bandit Raid Playtest',
        description: [
            'Skips trait selection and pre-builds a mid-game settlement ready for a bandit raid.',
            'The settlement has decent buildings, research, and a small army.',
            'The bandit raid event fires on day 1.',
        ].join(' '),
        startingPopulation: 80,
        startingTreasury: 500,
        startingResources: {
            wood: 500,
            stone: 300,
            iron: 100,
            food: 800,
            coal: 300,
            stoneWeaponry: 30,
            ironWeaponry: 20,
            bows: 15,
        },
        startingBuildingSizes: {
            // Building names must match the static `name` property on each building class.
            // Scaled for 80 population.
            // Core production
            'farm': 7,
            'Mud Huts': 8,       // upgraded to wooden huts → 10 housing/size → 80 housing for 80 pop
            "lumberjack's hut": 3,
            'charcoal kiln': 3,
            'storage': 5,
            'construction site': 3,
            // Military
            'Stone Weapon Maker': 3,
            'bowyer': 2,
            // Quality of life
            'brewery': 2,
            'apothecary': 1,
            'Roads': 2,
        },
        startingBuildingUpgrades: {
            // Building names must match the static `name` property on each building class.
            // Housing upgraded to wooden huts (upgrade index 0 = first upgrade)
            'Mud Huts': 0,
            // Roads upgraded to gravel paths (upgrade index 0)
            'Roads': 0,
            // WeaponMaker upgraded to iron weaponry (upgrade index 0)
            'Stone Weapon Maker': 0,
        },
        startingArmy: {
            'iron spears': 10,
            'stone swords': 5,
            'shortbowmen': 8,
        },
        preResearched: [
            // Military (needed for iron weaponry upgrade)
            'Stone Weaponry',
            'Bowyery and Fletching',
            'Iron Weaponry',
            // Housing
            'Wooden Huts',
            // Roads
            'Gravel Paths',
            // Agriculture
            'Larger Plough',
            // Tools
            'Stone Tools',
        ],
        skipTraitSelection: true,
        playerTraits: {
            childhoodTrait: 'Military Upbringing',
            abilityTrait: 'Strategic',
            personalityTrait: 'Brave',
            fameTrait: 'Officer',
            trinketTrait: 'Sword',
        },
        forceEventsOnDayOne: ['BanditRaid'],
        banditRaidBanDays: 0, // Allow bandit raid immediately
        researchRateMultiplier: null,
        generalProductivityBonus: null,
        legitimacyBonus: null,
        eventBanUntilDay: null,
    },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
