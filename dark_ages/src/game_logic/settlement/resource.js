import {VariableModifier, Variable, VariableComponent, Cumulator, subtraction, addition, CumulatorComponent, multiplication } from '../UIUtils.js';
import { titleCase, CustomTooltip } from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';
import {Logger} from '../logger.js';

export class Resource {
    constructor(props) {
        this.name = props.name;
        this.storageMultiplier = props.storageMultiplier;
        this.productionRatio = props.productionRatio;
        this.description = props.description || "";
        this.cumulates = props.cumulates === undefined ? true : props.cumulates;
        this.startingAmount = props.startingAmount;
        this.defaultBuilding = props.defaultBuilding || null; // Only needed for traded resources to calculate prices
    }
}

export class ResourceStorage {
    constructor(props) {
        this.resource = props.resource;
        this.size = props.size;
        this.cumulates = props.resource.cumulates;
        if (!(this.size instanceof Variable)) {
            throw Error("need storage size");
        }
        let zero = new Variable({name: 'zero', startingValue: 0});
        this.totalStorage = new Variable({name: `${this.resource.name} storage`, startingValue: 0, type:addition,
            modifiers: [
                new VariableModifier({startingValue: this.resource.storageMultiplier, type: addition, modifiers: [
                new VariableModifier({type: multiplication, variable: this.size})
            ]})
        ]});
        this.supply = new VariableModifier({name: `${this.resource.name} daily production`, startingValue:0, type:addition, modifiers:[]});
        this.demand = new VariableModifier({name: `${this.resource.name} daily demand`, startingValue:0,  type:subtraction, modifiers:[]});
        this.change = new Variable({name: "prospective change", startingValue:0,  type:subtraction, modifiers:[this.supply, this.demand]})
        let amountProps = {name: `${this.resource.name} amount`, startingValue: this.resource.startingAmount || 0, 
        min: zero, max: this.resource.storageMultiplier ? this.totalStorage : undefined, timer:props.gameClock, modifiers: [this.supply, this.demand]};
        if (this.cumulates) {
            this.amount = new Cumulator(amountProps);
        } else {
            amountProps.name = `Excess ${this.resource.name}`
            this.amount = new Variable(amountProps);
        }
        props.gameClock.subscribe(() => {
            this.updateDemands(0);
        });
        let self = this;
        this.supply.subscribe((indent) => {
            self.updateDemands(indent);
        })
        this.demand.subscribe((indent) => {
            self.updateDemands(indent);
        })
        this.demands = [];
        // Stone has supply -> demand can come through -> amount goes down -> no more supply -> demand is zero
        // Need to break this cycle -> maybe separate a variable out for total storage
        // Should subscribe to supply but not to demand -> need to change on others demands tho
        // -> figure out which demands are already distributed?
    }
    addDemand(name, totalDemand, idealDesiredProp, actualDesiredProp, priority) {
        let idealDesiredPropFulfilled = new Variable({name: "ideal demand prop fulfilled", startingValue: 0});
        let actualDesiredPropFulfilled = new Variable({name: "demand prop fulfilled", startingValue: 0});
        this.demands.push({
            totalDemand,
            idealDesiredProp, 
            actualDesiredProp,
            idealDesiredPropFulfilled, 
            actualDesiredPropFulfilled,
            priority,
            totalDemandCb: totalDemand.subscribe(() => this.updateDemands()),
            idealDesiredPropCb: idealDesiredProp.subscribe(() => this.updateDemands()),
            actualDesiredPropCb: actualDesiredProp.subscribe(() => this.updateDemands())
        });
        this.demands.sort((a, b) => {
            return a.priority - b.priority;
        });
        this.demand.variable.addModifier(new VariableModifier({name: `${name} demand`, startingValue:0, type:addition, modifiers: [
            new VariableModifier({variable: totalDemand, type: addition}),
            new VariableModifier({variable: actualDesiredPropFulfilled, type: multiplication})
        ]}));
        this.updateDemands();
        return {idealDesiredPropFulfilled, actualDesiredPropFulfilled};
    }
    removeDemand(idealDesiredProp) {
        let demandObj = this.demands.find(demand => demand.idealDesiredProp === idealDesiredProp);
        this.demands = this.demands.filter(demand => demand.idealDesiredProp !== idealDesiredProp);
        this.demand.variable.removeModifier(this.demand.variable.modifiers.find(modifier => modifier.variable.modifiers.find(modifier => modifier.variable === demandObj.actualDesiredPropFulfilled)));
        demandObj.totalDemand.unsubscribe(demandObj.totalDemandCb);
        demandObj.actualDesiredProp.unsubscribe(demandObj.actualDesiredPropCb);
        demandObj.idealDesiredProp.unsubscribe(demandObj.idealDesiredPropCb);
        this.updateDemands();
    }
    oneOffDemand(amount, explanation) {
        if (!this.cumulates) {
            throw Error("doesnt make sense if variable doesnt cumulates/not implemented?")
        }
        let amountAtTurnStart = this.amount.baseValue;
        if (amount > amountAtTurnStart) {
            amount = amountAtTurnStart
        }
        this.amount.setNewBaseValue(amountAtTurnStart - amount, "Turn start + " + explanation);
        this.updateDemands(0);
        return amount;
    }
    updateDemands(indent) {
        let amountAtTurnStart = this.resource.cumulates ? this.amount.baseValue : 0;
        let totalSupply = amountAtTurnStart + this.supply.variable.currentValue;
        this.demands.forEach(demandObj => {
            let idealDemand = demandObj.totalDemand.currentValue * demandObj.idealDesiredProp.currentValue;
            let actualDemand = demandObj.totalDemand.currentValue * demandObj.actualDesiredProp.currentValue;
            if (idealDemand === 0) {
                demandObj.idealDesiredPropFulfilled.setNewBaseValue(0, "new demand calculated", indent);
            } else if (totalSupply >= idealDemand) {
                demandObj.idealDesiredPropFulfilled.setNewBaseValue(demandObj.idealDesiredProp.currentValue, "new demand calculated", indent);
            } else {
                demandObj.idealDesiredPropFulfilled.setNewBaseValue(demandObj.idealDesiredProp.currentValue * totalSupply / idealDemand, "new demand calculated", indent);
            }
            if (actualDemand === 0) {
                demandObj.actualDesiredPropFulfilled.setNewBaseValue(0, "new demand calculated", indent);
            } else if (totalSupply >= actualDemand) {
                totalSupply -= actualDemand;
                demandObj.actualDesiredPropFulfilled.setNewBaseValue(demandObj.actualDesiredProp.currentValue, "new demand calculated", indent);
            } else {
                demandObj.actualDesiredPropFulfilled.setNewBaseValue(demandObj.actualDesiredProp.currentValue * totalSupply / actualDemand, "new demand calculated", indent);
                totalSupply = 0;
            }
            if (isNaN(idealDemand) || isNaN(actualDemand) || isNaN(totalSupply)) {
                debugger;
                throw Error('nans');
            }
        });
    }
    addSupply(supplyVariable) {
        this.supply.variable.addModifier(new VariableModifier({variable: supplyVariable, type:addition}));
    }
    removeSupply(supplyVariable) {
        this.supply.variable.removeModifier(this.supply.variable.modifiers.find(modifier => modifier.variable === supplyVariable));
    }
}

/**
 * Emoji icons for resources and rationing, keyed by resource name (lowercase).
 * Exported so building.js, rationing.js, and market.js can share the same map.
 */
export const RESOURCE_ICONS = {
    'food':               '🌾',
    'coal':               '🔥',
    'mud huts':           '🏚️',
    'wooden huts':        '🏠',
    'brick houses':       '🏛️',
    'beer':               '🍺',
    'medicinal herbs':    '🌿',
    'religion':           '⛪',
    'entertainment':      '🎭',
    'labour time':        '⚒️',
    'research':           '📚',
    'wood':               '🪵',
    'dirt path access':   '🛤️',
    'gravel path access': '🛤️',
    'brick road access':  '🛤️',
    'stone':              '🪨',
    'stone bricks':       '🧱',
    'iron':               '⛏️',
    'stone tools':        '🔨',
    'iron tools':         '🔨',
    'steel tools':        '🔨',
    'stone weaponry':     '⚔️',
    'iron weaponry':      '⚔️',
    'steel weaponry':     '⚔️',
    'bows':               '🏹',
    'stone spears':       '⚔️',
    'stone swords':       '⚔️',
    'iron spears':        '⚔️',
    'iron swords':        '⚔️',
    'steel spears':       '⚔️',
    'steel short swords': '⚔️',
    'steel long swords':  '⚔️',
    'short bows':         '🏹',
    'war bows':           '🏹',
    'long bows':          '🏹',
};

export class ResourceStorageComponent extends UIBase {
    constructor(props) {
        super(props);
        this.resourceStorage = props.resourceStorage;
        this.toolTipVars = [
            titleCase(this.resourceStorage.resource.description)
        ]
        this.addVariables([this.resourceStorage.amount]);
    }
    childRender() {
        this.resourceStorage = this.props.resourceStorage;
        const icon = RESOURCE_ICONS[this.resourceStorage.resource.name] || '';

        if (this.resourceStorage.cumulates) {
            return <span style={{alignItems: "center", justifyContent: "center"}}>
                <CustomTooltip items={this.toolTipVars}><span onClick={() => {Logger.setInspect(this.resourceStorage)}}>{icon} {titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
                <CumulatorComponent variable={this.resourceStorage.amount} showName={false}/><br />
            </span>
        } else {
            return <span style={{alignItems: "center", justifyContent: "center"}}>
                <CustomTooltip items={this.toolTipVars}><span onClick={() => {Logger.setInspect(this.resourceStorage)}}>{icon} Excess {titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
                <VariableComponent variable={this.resourceStorage.amount} showName={false}/><br />
            </span>
        }
    }
}


export const Resources = {
    food: new Resource({name: "food", storageMultiplier: 450, productionRatio: 1.0, description: "keeps your villagers alive"}),
    coal: new Resource({name: "coal", storageMultiplier: 200, productionRatio: 3.0, description: "for smithing and keeping warm"}),
    mudHuts: new Resource({name: "mud huts", storageMultiplier: null, cumulates: false, productionRatio: 1.0, description: "for living in"}),
    woodenHuts: new Resource({name: "wooden huts", storageMultiplier: null, cumulates: false, productionRatio: 1.0, description: "for living in"}),
    brickHouses: new Resource({name: "brick houses", storageMultiplier: null, cumulates: false, productionRatio: 1.0, description: "for living in"}),
    beer: new Resource({name: "beer", storageMultiplier: 450, productionRatio: 4.0, description: "helps keep your villagers happy"}),
    medicinalHerbs: new Resource({name: "medicinal herbs", storageMultiplier: 200, productionRatio: 12.0, description: "helps keep your villagers healthy"}),
    religion: new Resource({name: "religion", storageMultiplier: null, cumulates: false, productionRatio: 50.0, description: "helps keep your villagers happy"}),
    entertainment: new Resource({name: "entertainment", storageMultiplier: null, cumulates: false, productionRatio: 40.0, description: "helps keep your villagers happy"}),
    labourTime: new Resource({name: "labour time", storageMultiplier: 0, productionRatio: 1.0, startingAmount: 1000, description: "used for building, upkeep and upgrading"}),
    research: new Resource({name: "research", storageMultiplier: null, productionRatio: 1.0, startingAmount: 1000, description: "for new research developements"}),
    wood: new Resource({name: "wood", storageMultiplier: 200, productionRatio: 1.0, startingAmount: 100, description: "for building, upkeep and fuel"}),
    dirtPathAccess: new Resource({name: "dirt path access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    gravelPathAccess: new Resource({name: "gravel path access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    brickRoadAccess: new Resource({name: "brick road access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    stone: new Resource({name: "stone", storageMultiplier: 150, productionRatio: 1.0, startingAmount: 100, description: "for building and bricks"}),
    stoneBricks: new Resource({name: "stone bricks", storageMultiplier: 200, productionRatio: 1.0, startingAmount: 100, description: "for building and upkeep"}),
    iron: new Resource({name: "iron", storageMultiplier: 200, productionRatio: 1.0, startingAmount: 100, description: "for tools and weapons"}),
    stoneTools: new Resource({name: "stone tools", storageMultiplier: 200, productionRatio: 20.0, startingAmount: 0, description: "improves productivity"}),
    ironTools: new Resource({name: "iron tools", storageMultiplier: 200, productionRatio: 20.0, startingAmount: 0, description: "improves productivity"}),
    steelTools: new Resource({name: "steel tools", storageMultiplier: 200, productionRatio: 20.0, startingAmount: 0, description: "improves productivity"}),
    stoneWeaponry: new Resource({name: "stone weaponry", storageMultiplier: 50, productionRatio: 1.0, startingAmount: 0, description: "for fighting"}),
    bows: new Resource({name: "bows", storageMultiplier: 50, productionRatio: 1.0, startingAmount: 0, description: "for fighting"}),
    ironWeaponry: new Resource({name: "iron weaponry", storageMultiplier: 50, productionRatio: 1.0, startingAmount: 5, description: "for fighting"}),
    steelWeaponry: new Resource({name: "steel weaponry", storageMultiplier: 50, productionRatio: 1.0, startingAmount: 0, description: "for fighting"}),
    // §4.1 Military unit resources — armed soldiers (weapons converted to soldiers)
    // storageMultiplier: null so they are excluded from the market (no idealPrice)
    stoneSpears:      new Resource({ name: "stone spears",       storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with stone spears (1 stone weapon each). Attack: 0.6" }),
    stoneSwords:      new Resource({ name: "stone swords",       storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with stone swords (2 stone weapons each). Attack: 0.9" }),
    ironSpears:       new Resource({ name: "iron spears",        storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with iron spears (1 iron weapon each). Attack: 1.2" }),
    ironSwords:       new Resource({ name: "iron swords",        storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with iron swords (2 iron weapons each). Attack: 1.8" }),
    steelSpears:      new Resource({ name: "steel spears",       storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with steel spears (1 steel weapon each). Attack: 2.0" }),
    steelShortSwords: new Resource({ name: "steel short swords", storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with short swords (4 steel weapons each). Attack: 4.0" }),
    steelLongSwords:  new Resource({ name: "steel long swords",  storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with long swords (10 steel weapons each). Attack: 10.0" }),
    shortbowmen:      new Resource({ name: "short bows",         storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with short bows (1 bow each). Attack: 1.2" }),
    warbowmen:        new Resource({ name: "war bows",           storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with war bows (3 bows each). Attack: 2.5" }),
    longbowmen:       new Resource({ name: "long bows",          storageMultiplier: null, productionRatio: 1, cumulates: true, description: "Armed with long bows (5 bows each). Attack: 4.0" }),
};

/**
 * §4.1 Attack values per unit type (used in army strength calculation).
 */
export const UNIT_ATTACK_VALUES = {
    'stone spears':       0.6,
    'stone swords':       0.9,
    'iron spears':        1.2,
    'iron swords':        1.8,
    'steel spears':       2.0,
    'steel short swords': 4.0,
    'steel long swords':  10.0,
    'short bows':         1.2,
    'war bows':           2.5,
    'long bows':          4.0,
};

/**
 * §4.1 Weapon costs per unit type: { resource: Resources.xxx, amount: N }
 * Resolved lazily (after Resources is defined) to avoid circular reference.
 */
export const UNIT_WEAPON_COSTS = {
    'stone spears':       { resourceName: 'stoneWeaponry', amount: 1 },
    'stone swords':       { resourceName: 'stoneWeaponry', amount: 2 },
    'iron spears':        { resourceName: 'ironWeaponry',  amount: 1 },
    'iron swords':        { resourceName: 'ironWeaponry',  amount: 2 },
    'steel spears':       { resourceName: 'steelWeaponry', amount: 1 },
    'steel short swords': { resourceName: 'steelWeaponry', amount: 4 },
    'steel long swords':  { resourceName: 'steelWeaponry', amount: 10 },
    'short bows':         { resourceName: 'bows',          amount: 1 },
    'war bows':           { resourceName: 'bows',          amount: 3 },
    'long bows':          { resourceName: 'bows',          amount: 5 },
};

/** All melee unit resource names (for army building). */
export const MELEE_UNIT_NAMES = ['stone spears','stone swords','iron spears','iron swords','steel spears','steel short swords','steel long swords'];
/** All bow unit resource names (for army building). */
export const BOW_UNIT_NAMES = ['short bows','war bows','long bows'];
