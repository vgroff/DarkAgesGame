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
    addDemand(name, totalDemand, desiredProp, priority) {
        let demandPropFulfilled = new Variable({name: "demand prop fulfilled", startingValue: 0});
        this.demands.push({
            totalDemand: totalDemand, 
            desiredProp: desiredProp, 
            demandPropFulfilled: demandPropFulfilled, 
            priority: priority,
            totalDemandCb: totalDemand.subscribe(() => this.updateDemands()),
            desiredPropCb: desiredProp.subscribe(() => this.updateDemands())
        });
        this.demands.sort((a, b) => {
            return a.priority - b.priority;
        });
        this.demand.variable.addModifier(new VariableModifier({name: `${name} demand`, startingValue:0, type:addition, modifiers: [
            new VariableModifier({variable: totalDemand, type: addition}),
            new VariableModifier({variable: demandPropFulfilled, type: multiplication})
        ]}));
        this.updateDemands();
        return demandPropFulfilled;
    }
    removeDemand(desiredProp) {
        let demandObj = this.demands.find(demand => demand.desiredProp === desiredProp);
        this.demands = this.demands.filter(demand => demand.desiredProp !== desiredProp);
        this.demand.variable.removeModifier(this.demand.variable.modifiers.find(modifier => modifier.variable.modifiers.find(modifier => modifier.variable === demandObj.demandPropFulfilled)));
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
        this.amount.setNewBaseValue(amountAtTurnStart - amount, "Turn start");
        return amount;
    }
    addSupply(supplyVariable) {
        this.supply.variable.addModifier(new VariableModifier({variable: supplyVariable, type:addition}));
    }
    removeSupply(supplyVariable) {
        this.supply.variable.removeModifier(this.supply.variable.modifiers.find(modifier => modifier.variable === supplyVariable));
    }
    updateDemands(indent) {
        let amountAtTurnStart = this.resource.cumulates ? this.amount.baseValue : 0;
        let totalSupply = amountAtTurnStart + this.supply.variable.currentValue;
        this.demands.forEach(demandObj => {
            let demand = demandObj.totalDemand.currentValue * demandObj.desiredProp.currentValue;
            if (demand === 0) {
                demandObj.demandPropFulfilled.setNewBaseValue(0, "new demand calculated", indent);
            } else if (totalSupply >= demand) {
                totalSupply -= demand;
                demandObj.demandPropFulfilled.setNewBaseValue(demandObj.desiredProp.currentValue, "new demand calculated", indent);
            } else {
                demandObj.demandPropFulfilled.setNewBaseValue(demandObj.desiredProp.currentValue * totalSupply / demand, "new demand calculated", indent);
                totalSupply = 0;
            }
            if (isNaN(demand) || isNaN(totalSupply)) {
                debugger;
                throw Error('nans');
            }
        });
    }
}

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
        if (this.resourceStorage.cumulates) {
            return <span style={{alignItems: "center", justifyContent: "center"}}>
                <CustomTooltip items={this.toolTipVars}><span onClick={() => {Logger.setInspect(this.resourceStorage)}}>{titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
                <CumulatorComponent variable={this.resourceStorage.amount} showName={false}/><br />
            </span>
        } else {
            return <span style={{alignItems: "center", justifyContent: "center"}}>
                <CustomTooltip items={this.toolTipVars}><span onClick={() => {Logger.setInspect(this.resourceStorage)}}>Excess {titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
                <VariableComponent variable={this.resourceStorage.amount} showName={false}/><br />
            </span>
        }
    }
}

export const Resources = {
    food: new Resource({name: "food", storageMultiplier: 450, productionRatio: 1.0, description: "keeps your villagers alive"}),
    coal: new Resource({name: "coal", storageMultiplier: 200, productionRatio: 3.0, description: "for smithing and keeping warm"}),
    housing: new Resource({name: "housing", storageMultiplier: null, cumulates: false, productionRatio: 1.0, description: "for living in"}),
    beer: new Resource({name: "beer", storageMultiplier: 450, productionRatio: 3.0, description: "helps keep your villagers happy"}),
    medicinalHerbs: new Resource({name: "medicinal herbs", storageMultiplier: 200, productionRatio: 12.0, description: "helps keep your villagers healthy"}),
    labourTime: new Resource({name: "labour time", storageMultiplier: 0, productionRatio: 1.0, startingAmount: 1000, description: "used for building, upkeep and upgrading"}),
    research: new Resource({name: "research", storageMultiplier: null, productionRatio: 1.0, startingAmount: 1000, description: "for new research developements"}),
    wood: new Resource({name: "wood", storageMultiplier: 200, productionRatio: 1.0, startingAmount: 0, description: "for building, upkeep and fuel"}),
    dirtPathAccess: new Resource({name: "dirt path access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    gravelPathAccess: new Resource({name: "gravel path access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    brickRoadAccess: new Resource({name: "brick road access", storageMultiplier: null, cumulates: false, productionRatio: 1.0, startingAmount: 0, description: "improves general productivity and trade"}),
    stone: new Resource({name: "stone", storageMultiplier: 150, productionRatio: 1.0, startingAmount: 0, description: "for building and bricks"}),
    stoneBricks: new Resource({name: "stone bricks", storageMultiplier: 200, productionRatio: 1.0, description: "for building and upkeep"}),
    iron: new Resource({name: "iron", storageMultiplier: 200, productionRatio: 1.0, startingAmount: 0, description: "for tools and weapons"}),
    stoneTools: new Resource({name: "stone tools", storageMultiplier: 200, productionRatio: 15.0, startingAmount: 0, description: "improves productivity"}),
    ironTools: new Resource({name: "iron tools", storageMultiplier: 200, productionRatio: 15.0, startingAmount: 0, description: "improves productivity"}),
    steelTools: new Resource({name: "steel tools", storageMultiplier: 200, productionRatio: 15.0, startingAmount: 0, description: "improves productivity"}),
};