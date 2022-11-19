import { Timer } from "../timer";
import { Variable } from "../UIUtils";
import { Farm, LumberjacksHut, WeaponMaker, CharcoalKiln, Brewery, Apothecary, Quarry, Stonecutters, IronMine, CoalMine, Toolmaker, Bowyer } from "./building";
import { Resources, ResourceStorage } from "./resource";

let dummyResourceStorages = Object.entries(Resources).map(([resourceName, resource]) => {
    return new ResourceStorage({resource: resource, size: new Variable({startingValue: 1}), gameClock: new Timer({name: "fake", every: 100000})})
});
let dummyFarm = new Farm({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyLumberjacksHut = new LumberjacksHut({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyCharcoalKiln = new CharcoalKiln({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyBrewery = new Brewery({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyApothecary = new Apothecary({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyQuarry = new Quarry({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyStonecutters = new Stonecutters({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyIronMine = new IronMine({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyBowyer = new Bowyer({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyWeaponMaker = new WeaponMaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyToolmaker = new Toolmaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
let dummyIronWeaponMaker = new WeaponMaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
dummyIronWeaponMaker.upgrade(dummyResourceStorages, true);
let dummySteelWeaponMaker = new WeaponMaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
dummySteelWeaponMaker.upgrade(dummyResourceStorages, true);
dummySteelWeaponMaker.upgrade(dummyResourceStorages, true);
let dummyIronToolMaker = new Toolmaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
dummyIronToolMaker.upgrade(dummyResourceStorages, true);
let dummySteelToolMaker = new Toolmaker({startingSize: 0, productivityModifiers: [], resourceStorages: dummyResourceStorages});
dummySteelToolMaker.upgrade(dummyResourceStorages, true);
dummySteelToolMaker.upgrade(dummyResourceStorages, true);
export const DefaultBuildings = [
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
    dummyIronWeaponMaker,
    dummySteelToolMaker,
    dummySteelWeaponMaker,
];
DefaultBuildings.forEach( building => {
    Object.entries(Resources).forEach(([_, resource]) => {
        if (resource === building.outputResource) {
            resource.defaultBuilding = building;
        }
    })
});