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
};

// Properties that should not be serialized
const EXCLUDED_PROPS = new Set([
    'component',
    'react',
    '_reactInternals',
    'logHref',  // This is regenerated on load
]);

// Properties that need special handling for serialization
const SPECIAL_PROPS = new Set([
    'subscriptions',
    'subscribed',
    'callback',
    'modifierCallbacks',
    '_subscriptionSources',
    '_initializing',
    'currentDepth'
]);

export function saveGame(game) {
    try {
        return serializeObject(game);
    } catch (error) {
        console.error('Error saving game:', error);
        throw new Error('Failed to save game: ' + error.message);
    }
}

export function loadGame(gameState) {
    try {
        return deserializeObject(gameState);
    } catch (error) {
        console.error('Error loading game:', error);
        throw new Error('Failed to load game: ' + error.message);
    }
}

function serializeObject(obj, seen = new WeakMap()) {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle circular references
    if (seen.has(obj)) {
        return { $ref: seen.get(obj) };
    }

    // Generate unique ID for this object
    const id = seen.size;
    seen.set(obj, id);

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => serializeObject(item, seen));
    }

    // Handle Date objects
    if (obj instanceof Date) {
        return { $type: 'Date', $value: obj.toISOString() };
    }

    // Handle Set objects
    if (obj instanceof Set) {
        return { 
            $type: 'Set', 
            $value: Array.from(obj).map(item => serializeObject(item, seen))
        };
    }

    // Handle Map objects
    if (obj instanceof Map) {
        return { 
            $type: 'Map', 
            $value: Array.from(obj.entries()).map(([k, v]) => ({
                key: serializeObject(k, seen),
                value: serializeObject(v, seen)
            }))
        };
    }

    // Handle Variable objects specially
    if (obj instanceof Variable) {
        const serialized = {
            $type: obj.constructor.name,
            $id: id,
            $data: {
                name: obj.name,
                baseValue: obj.baseValue,
                currentValue: obj.currentValue,
                displayRound: obj.displayRound,
                owner: serializeObject(obj.owner, seen),
                modifiers: serializeObject(obj.modifiers, seen),
                min: serializeObject(obj.min, seen),
                max: serializeObject(obj.max, seen),
                explanations: serializeObject(obj.explanations, seen),
                abridgedExplanations: serializeObject(obj.abridgedExplanations, seen),
                baseValueExplanations: serializeObject(obj.baseValueExplanations, seen),
                visualAlerts: obj.visualAlerts,
                // Save subscription priorities for reconstruction
                subscriptionPriorities: obj.subscriptions?.map(sub => ({
                    priority: sub.priority,
                    reason: sub.reason
                }))
            }
        };
        return serialized;
    }

    // Create serializable version
    const serialized = {
        $type: obj.constructor.name,
        $id: id,
        $data: {}
    };

    // Serialize each property
    for (const [key, value] of Object.entries(obj)) {
        // Skip excluded properties and functions
        if (EXCLUDED_PROPS.has(key) || typeof value === 'function') {
            continue;
        }

        // Handle special properties
        if (SPECIAL_PROPS.has(key)) {
            if (key === 'subscriptions' && Array.isArray(value)) {
                serialized.$data[key + '_info'] = value.map(sub => ({
                    priority: sub.priority,
                    reason: sub.reason
                }));
            }
            continue;
        }

        try {
            serialized.$data[key] = serializeObject(value, seen);
        } catch (error) {
            console.warn(`Failed to serialize property ${key}:`, error);
        }
    }

    return serialized;
}

function deserializeObject(serialized, seen = new Map()) {
    // Handle null/undefined
    if (serialized === null || serialized === undefined) {
        return serialized;
    }

    // Handle primitive types
    if (typeof serialized !== 'object') {
        return serialized;
    }

    // Handle circular references
    if (serialized.$ref !== undefined) {
        const cached = seen.get(serialized.$ref);
        if (!cached) {
            throw new Error(`Invalid reference: ${serialized.$ref}`);
        }
        return cached;
    }

    // Handle arrays
    if (Array.isArray(serialized)) {
        return serialized.map(item => deserializeObject(item, seen));
    }

    // Handle special types
    if (serialized.$type === 'Date') {
        return new Date(serialized.$value);
    }

    if (serialized.$type === 'Set') {
        return new Set(deserializeObject(serialized.$value, seen));
    }

    if (serialized.$type === 'Map') {
        return new Map(
            deserializeObject(serialized.$value, seen).map(({key, value}) => [
                deserializeObject(key, seen),
                deserializeObject(value, seen)
            ])
        );
    }

    // If not a serialized object with type info, return as-is
    if (!serialized.$type) {
        return serialized;
    }

    // Get constructor
    const constructor = CLASS_MAP[serialized.$type];
    if (!constructor) {
        console.warn(`Unknown class type: ${serialized.$type}, returning raw data`);
        return serialized.$data;
    }

    // Create instance
    const instance = Object.create(constructor.prototype);
    seen.set(serialized.$id, instance);

    // Deserialize properties
    for (const [key, value] of Object.entries(serialized.$data)) {
        try {
            instance[key] = deserializeObject(value, seen);
        } catch (error) {
            console.warn(`Failed to deserialize property ${key}:`, error);
        }
    }

    // Special handling for Variable objects
    if (instance instanceof Variable && serialized.$data.subscriptionPriorities) {
        // Store subscription priorities for init() to use
        instance._savedSubscriptionPriorities = serialized.$data.subscriptionPriorities;
    }

    // Initialize runtime state
    if (instance.init) {
        instance.init();
    }

    return instance;
}