import { Timer } from "../timer";
import { Variable } from "../UIUtils";
import { Farm, LumberjacksHut, WeaponMaker, CharcoalKiln, Brewery, Apothecary, Quarry, Stonecutters, IronMine, Toolmaker, Bowyer } from "./building";
import { Resources, ResourceStorage } from "./resource";

/**
 * Creates the dummy building instances used for idealised price calculation.
 *
 * Previously this ran at module import time, which:
 *   - Created live Timer instances (with setInterval) that were never cleaned up
 *   - Made testing difficult due to side effects on import
 *
 * Now it is called lazily via getDefaultBuildings() on first use.
 * Also sets resource.defaultBuilding on each matching Resource constant so that
 * ResourceBuilding.getIdealisedPrice() can recurse into input costs.
 */
function createDefaultBuildings() {
    // A single dummy timer shared across all dummy resource storages in this set.
    // every: 100000 means it will almost never tick; it is never started externally.
    const dummyTimer = new Timer({ name: "dummy (price calc)", every: 100000 });

    const dummyResourceStorages = Object.entries(Resources).map(([, resource]) => {
        return new ResourceStorage({
            resource,
            size: new Variable({ startingValue: 1 }),
            gameClock: dummyTimer,
        });
    });

    const dummyFarm = new Farm({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyLumberjacksHut = new LumberjacksHut({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyCharcoalKiln = new CharcoalKiln({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyBrewery = new Brewery({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyApothecary = new Apothecary({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyQuarry = new Quarry({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyStonecutters = new Stonecutters({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyIronMine = new IronMine({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyBowyer = new Bowyer({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyWeaponMaker = new WeaponMaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    const dummyToolmaker = new Toolmaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });

    const dummyIronWeaponMaker = new WeaponMaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    dummyIronWeaponMaker.upgrade(dummyResourceStorages, true);

    const dummySteelWeaponMaker = new WeaponMaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    dummySteelWeaponMaker.upgrade(dummyResourceStorages, true);
    dummySteelWeaponMaker.upgrade(dummyResourceStorages, true);

    const dummyIronToolMaker = new Toolmaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    dummyIronToolMaker.upgrade(dummyResourceStorages, true);

    const dummySteelToolMaker = new Toolmaker({ startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages });
    dummySteelToolMaker.upgrade(dummyResourceStorages, true);
    dummySteelToolMaker.upgrade(dummyResourceStorages, true);

    const buildings = [
        dummyFarm,
        dummyLumberjacksHut,
        dummyCharcoalKiln,
        dummyBrewery,
        dummyApothecary,
        dummyQuarry,
        dummyStonecutters,
        dummyIronMine,
        dummyBowyer,
        dummyWeaponMaker,
        dummyToolmaker,
        dummyIronWeaponMaker,
        dummyIronToolMaker,
        dummySteelWeaponMaker,
        dummySteelToolMaker,
    ];

    // Wire resource.defaultBuilding so getIdealisedPrice() can recurse into input costs.
    buildings.forEach(building => {
        Object.entries(Resources).forEach(([, resource]) => {
            if (resource === building.outputResource) {
                resource.defaultBuilding = building;
            }
        });
    });

    return buildings;
}

/** Lazily-initialised singleton — created on first access, never at import time. */
let _defaultBuildings = null;

/**
 * Returns the shared DefaultBuildings array, creating it on first call.
 * Replaces the old module-level `DefaultBuildings` constant.
 */
export function getDefaultBuildings() {
    if (_defaultBuildings === null) {
        _defaultBuildings = createDefaultBuildings();
    }
    return _defaultBuildings;
}
