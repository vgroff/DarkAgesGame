import { Variable } from './variable/variable';
import Game from './game';
import { Settlement } from './settlement/settlement';
import { Character } from './character';
import { Timer } from './timer';
import { 
    Storage, 
    Farm, 
    LumberjacksHut, 
    Brewery, 
    CharcoalKiln, 
    Quarry, 
    Housing, 
    ResourceBuilding, 
    Building,
    Stonecutters, 
    HuntingCabin, 
    Apothecary, 
    ConstructionSite, 
    Library, 
    Roads, 
    IronMine, 
    Toolmaker, 
    Church, 
    Tavern, 
    CoalMine,
    Bowyer,
    WeaponMaker,
    BogIronPit,
    CoalPit,
    PeatBog
} from './settlement/building';
import { 
    Farmlands, 
    Marshlands, 
    NoTerrain, 
    Mountains, 
    Woodlands 
} from './settlement/terrain';
import { 
    CourtIntrigue, 
    CropBlight, 
    Fire, 
    HarvestEvent, 
    LocalMiracle, 
    MineShaftCollapse, 
    Pestilence, 
    WolfAttack 
} from './events';
import { 
    Bonus,
    SettlementBonus,
    GeneralProductivityBonus,
    HealthBonus,
    LocalLegitimacyBonus,
    SpecificBuildingProductivityBonus,
    SpecificBuildingEfficiencyBonus,
    SpecificBuildingMaxSizeBonus,
    UnlockBuildingBonus,
    UnlockBuildingUpgradeBonus,
    ChangePriceBonus,
    AddNewBuildingBonus,
    TemporaryModifierBonus,
    TemporaryHappinessBonus,
    TemporaryHealthBonus,
    TemporaryLocalLegitimacyBonus,
    TemporaryGeneralProductivityBonus,
    CharacterBonus,
    LegitimacyBonus,
    StrategyBonus,
    DiplomacyBonus,
    AdministrationBonus,
    TemporaryCharacterBonus,
    TemporaryLegitimacyBonus
} from './settlement/bonus';
import { Market } from './settlement/market';
import { Trait, Faction, Celtic, Roman } from './character';
import { SumAggModifier } from './variable/sumAgg';
import {VariableModifier} from './variable/modifier';
import { Cumulator } from './variable/cumulator';

const CLASS_MAP = {
    Game: { constructor: Game, hasInit: true },
    Settlement: { constructor: Settlement, hasInit: true },
    Character: { constructor: Character, hasInit: false },
    Variable: { constructor: Variable, hasInit: true },
    Timer: { constructor: Timer, hasInit: true },
    Market: { constructor: Market, hasInit: false },
    Trait: { constructor: Trait, hasInit: false },
    Faction: { constructor: Faction, hasInit: false },
    Celtic: { constructor: Celtic, hasInit: false },
    Roman: { constructor: Roman, hasInit: false },
    VariableModifier: { constructor: VariableModifier, hasInit: false },
    Cumulator: { constructor: Cumulator, hasInit: true },
    SumAggModifier: { constructor: SumAggModifier, hasInit: true },

    Building: { constructor: Building, hasInit: false },
    ResourceBuilding: { constructor: ResourceBuilding, hasInit: false },
    Storage: { constructor: Storage, hasInit: false },
    Farm: { constructor: Farm, hasInit: false },
    LumberjacksHut: { constructor: LumberjacksHut, hasInit: false },
    Brewery: { constructor: Brewery, hasInit: false },
    CharcoalKiln: { constructor: CharcoalKiln, hasInit: false },
    Quarry: { constructor: Quarry, hasInit: false },
    Housing: { constructor: Housing, hasInit: false },
    Stonecutters: { constructor: Stonecutters, hasInit: false },
    HuntingCabin: { constructor: HuntingCabin, hasInit: false },
    Apothecary: { constructor: Apothecary, hasInit: false },
    ConstructionSite: { constructor: ConstructionSite, hasInit: false },
    Library: { constructor: Library, hasInit: false },
    Roads: { constructor: Roads, hasInit: false },
    IronMine: { constructor: IronMine, hasInit: false },
    Toolmaker: { constructor: Toolmaker, hasInit: false },
    Church: { constructor: Church, hasInit: false },
    Tavern: { constructor: Tavern, hasInit: false },
    CoalMine: { constructor: CoalMine, hasInit: false },
    Bowyer: { constructor: Bowyer, hasInit: false },
    WeaponMaker: { constructor: WeaponMaker, hasInit: false },
    BogIronPit: { constructor: BogIronPit, hasInit: false },
    CoalPit: { constructor: CoalPit, hasInit: false },
    PeatBog: { constructor: PeatBog, hasInit: false },

    Farmlands: { constructor: Farmlands, hasInit: false },
    Marshlands: { constructor: Marshlands, hasInit: false },
    NoTerrain: { constructor: NoTerrain, hasInit: false },
    Mountains: { constructor: Mountains, hasInit: false },
    Woodlands: { constructor: Woodlands, hasInit: false },

    CourtIntrigue: { constructor: CourtIntrigue, hasInit: true },
    CropBlight: { constructor: CropBlight, hasInit: true },
    Fire: { constructor: Fire, hasInit: true },
    HarvestEvent: { constructor: HarvestEvent, hasInit: true },
    LocalMiracle: { constructor: LocalMiracle, hasInit: true },
    MineShaftCollapse: { constructor: MineShaftCollapse, hasInit: true },
    Pestilence: { constructor: Pestilence, hasInit: true },
    WolfAttack: { constructor: WolfAttack, hasInit: true },

    Bonus: { constructor: Bonus, hasInit: false },
    SettlementBonus: { constructor: SettlementBonus, hasInit: false },
    GeneralProductivityBonus: { constructor: GeneralProductivityBonus, hasInit: false },
    HealthBonus: { constructor: HealthBonus, hasInit: false },
    LocalLegitimacyBonus: { constructor: LocalLegitimacyBonus, hasInit: false },
    SpecificBuildingProductivityBonus: { constructor: SpecificBuildingProductivityBonus, hasInit: false },
    SpecificBuildingEfficiencyBonus: { constructor: SpecificBuildingEfficiencyBonus, hasInit: false },
    SpecificBuildingMaxSizeBonus: { constructor: SpecificBuildingMaxSizeBonus, hasInit: false },
    UnlockBuildingBonus: { constructor: UnlockBuildingBonus, hasInit: false },
    UnlockBuildingUpgradeBonus: { constructor: UnlockBuildingUpgradeBonus, hasInit: false },
    ChangePriceBonus: { constructor: ChangePriceBonus, hasInit: false },
    AddNewBuildingBonus: { constructor: AddNewBuildingBonus, hasInit: false },
    TemporaryModifierBonus: { constructor: TemporaryModifierBonus, hasInit: false },
    TemporaryHappinessBonus: { constructor: TemporaryHappinessBonus, hasInit: false },
    TemporaryHealthBonus: { constructor: TemporaryHealthBonus, hasInit: false },
    TemporaryLocalLegitimacyBonus: { constructor: TemporaryLocalLegitimacyBonus, hasInit: false },
    TemporaryGeneralProductivityBonus: { constructor: TemporaryGeneralProductivityBonus, hasInit: false },
    CharacterBonus: { constructor: CharacterBonus, hasInit: false },
    LegitimacyBonus: { constructor: LegitimacyBonus, hasInit: false },
    StrategyBonus: { constructor: StrategyBonus, hasInit: false },
    DiplomacyBonus: { constructor: DiplomacyBonus, hasInit: false },
    AdministrationBonus: { constructor: AdministrationBonus, hasInit: false },
    TemporaryCharacterBonus: { constructor: TemporaryCharacterBonus, hasInit: false },
    TemporaryLegitimacyBonus: { constructor: TemporaryLegitimacyBonus, hasInit: false }
};

const EXCLUDED_PROPS = new Set([
    'component',
    'react',
    '_reactInternals',
    'logHref'
]);

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
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    if (seen.has(obj)) {
        return { $ref: seen.get(obj) };
    }

    const id = seen.size;
    seen.set(obj, id);

    if (Array.isArray(obj)) {
        return obj.map(item => serializeObject(item, seen));
    }

    if (obj instanceof Date) {
        return { $type: 'Date', $value: obj.toISOString() };
    }

    if (obj instanceof Set) {
        return { 
            $type: 'Set', 
            $value: Array.from(obj).map(item => serializeObject(item, seen))
        };
    }

    if (obj instanceof Map) {
        return { 
            $type: 'Map', 
            $value: Array.from(obj.entries()).map(([k, v]) => ({
                key: serializeObject(k, seen),
                value: serializeObject(v, seen)
            }))
        };
    }

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
                subscriptionPriorities: obj.subscriptions?.map(sub => ({
                    priority: sub.priority,
                    reason: sub.reason
                }))
            }
        };
        return serialized;
    }

    const serialized = {
        $type: obj.constructor.name,
        $id: id,
        $data: {}
    };

    for (const [key, value] of Object.entries(obj)) {
        if (EXCLUDED_PROPS.has(key) || typeof value === 'function') {
            continue;
        }

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
    if (serialized === null || serialized === undefined) {
        return serialized;
    }

    if (typeof serialized !== 'object') {
        return serialized;
    }

    if (serialized.$ref !== undefined) {
        const cached = seen.get(serialized.$ref);
        if (!cached) {
            throw new Error(`Invalid reference: ${serialized.$ref}`);
        }
        return cached;
    }

    if (Array.isArray(serialized)) {
        return serialized.map(item => deserializeObject(item, seen));
    }

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

    if (serialized.$type === 'Variable') {
        const instance = Object.create(Variable.prototype);
        seen.set(serialized.$id, instance);

        instance._savedSubscriptionPriorities = serialized.$data.subscriptionPriorities;
        instance.modifiers = [];
        instance._subscriptionSources = new WeakMap();

        for (const [key, value] of Object.entries(serialized.$data)) {
            try {
                if (key === 'modifiers' && Array.isArray(value)) {
                    instance[key] = value.map(m => deserializeObject(m, seen)).filter(Boolean);
                } else {
                    instance[key] = deserializeObject(value, seen);
                }
            } catch (error) {
                console.warn(`Failed to deserialize property ${key}:`, error);
            }
        }

        if (instance.init) {
            try {
                instance.init();
            } catch (error) {
                console.error(`Failed to initialize ${serialized.$type}:`, error);
            }
        }

        return instance;
    }

    const classInfo = CLASS_MAP[serialized.$type];
    if (!classInfo) {
        console.warn(`Unknown class type: ${serialized.$type}, returning raw data`);
        return serialized.$data;
    }

    const instance = Object.create(classInfo.constructor.prototype);
    seen.set(serialized.$id, instance);

    for (const [key, value] of Object.entries(serialized.$data)) {
        try {
            instance[key] = deserializeObject(value, seen);
        } catch (error) {
            console.warn(`Failed to deserialize property ${key}:`, error);
        }
    }

    if (classInfo.hasInit && instance.init) {
        try {
            instance.init();
        } catch (error) {
            console.error(`Failed to initialize ${serialized.$type}:`, error);
        }
    }

    return instance;
}