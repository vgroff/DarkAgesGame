import { Variable } from './variable/variable';
import Game from './game';
import { Settlement } from './settlement/settlement';
import { Character } from './character';
import { Timer } from './timer';

// Map of class names to constructor functions
const CLASS_MAP = {
    Game,
    Settlement,
    Character,
    Variable,
    Timer,
    // Add other classes as needed
};

// Properties that should not be serialized
const EXCLUDED_PROPS = new Set([
    'subscriptions',
    'subscribed',
    'callback',
    'modifierCallbacks',
    'component',
    'react',
    '_reactInternals'
]);

export function saveGame(game) {
    // Convert game state to serializable format
    const gameState = serializeObject(game);
    
    // Create save file with metadata
    const saveData = {
        version: '1.0',
        timestamp: Date.now(),
        state: gameState
    };

    // Convert to JSON string
    return JSON.stringify(saveData);
}

export function loadGame(saveData) {
    const data = JSON.parse(saveData);
    return deserializeObject(data.state);
}

function serializeObject(obj, seen = new WeakMap()) {
    // Handle circular references
    if (seen.has(obj)) {
        return { $ref: seen.get(obj) };
    }

    // Skip null/undefined
    if (!obj) {
        return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
        return obj;
    }

    // Generate unique ID for this object
    const id = seen.size;
    seen.set(obj, id);

    // Create serializable version
    const serialized = {
        $type: obj.constructor.name,
        $id: id,
        $data: {}
    };

    // Serialize each property
    for (const [key, value] of Object.entries(obj)) {
        // Skip excluded properties
        if (EXCLUDED_PROPS.has(key)) {
            continue;
        }

        serialized.$data[key] = serializeObject(value, seen);
    }

    return serialized;
}

function deserializeObject(serialized, seen = new Map()) {
    // Handle circular references
    if (serialized && serialized.$ref !== undefined) {
        return seen.get(serialized.$ref);
    }

    // Skip null/undefined/primitives
    if (!serialized || typeof serialized !== 'object') {
        return serialized;
    }

    // If not a serialized object, return as-is
    if (!serialized.$type) {
        return serialized;
    }

    // Get constructor
    const constructor = CLASS_MAP[serialized.$type];
    if (!constructor) {
        throw new Error(`Unknown class type: ${serialized.$type}`);
    }

    // Create instance
    const instance = Object.create(constructor.prototype);
    seen.set(serialized.$id, instance);

    // Deserialize properties
    for (const [key, value] of Object.entries(serialized.$data)) {
        instance[key] = deserializeObject(value, seen);
    }

    // Initialize subscriptions and other runtime state
    if (instance.init) {
        instance.init();
    }

    return instance;
}