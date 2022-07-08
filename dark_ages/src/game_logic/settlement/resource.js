import {VariableModifier, Variable, Cumulator, subtraction, addition, CumulatorComponent, multiplication } from '../UIUtils.js';
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
    }
}

export class ResourceStorage {
    constructor(props) {
        this.resource = props.resource;
        this.size = props.size;
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
        this.amount = new Cumulator({name: `${this.resource.name} amount`, startingValue: props.startingAmount || 0, 
            min: zero, max: this.totalStorage, timer:props.gameClock, modifiers: [this.supply, this.demand]});
        this.amountAtTurnStart = this.amount.baseValue;
        props.gameClock.subscribe(() => {
            if (this.amountAtTurnStart !== this.amount.currentValue) {
                this.amountAtTurnStart = this.amount.currentValue;
                this.updateDemands();
            }
        });
        let self = this;
        this.supply.subscribe(() => {
            self.updateDemands();
        })
        this.demand.subscribe(() => {
            self.updateDemands();
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
            priority: priority
        });
        totalDemand.subscribe(() => this.updateDemands());
        desiredProp.subscribe(() => this.updateDemands());
        this.demands.sort((a, b) => {
            return a.priority > b.priority;
        });
        this.demand.variable.addModifier(new VariableModifier({name: `${name} demand`, startingValue:0, type:addition, modifiers: [
            new VariableModifier({variable: totalDemand, type: addition}),
            new VariableModifier({variable: demandPropFulfilled, type: multiplication})
        ]}));
        this.updateDemands();
        return demandPropFulfilled;
    };
    addSupply(supplyVariable) {
        this.supply.variable.addModifier(new VariableModifier({variable: supplyVariable, type:addition}));
    }
    updateDemands() {
        // debugger;
        let totalSupply = this.amountAtTurnStart + this.supply.variable.currentValue;
        this.demands.forEach(demandObj => {
            let demand = demandObj.totalDemand.currentValue * demandObj.desiredProp.currentValue;
            if (demand === 0) {
                demandObj.demandPropFulfilled.setNewBaseValue(0, "new demand calculated");
            } else if (totalSupply >= demand) {
                totalSupply -= demand;
                demandObj.demandPropFulfilled.setNewBaseValue(demandObj.desiredProp.currentValue, "new demand calculated");
            } else {
                demandObj.demandPropFulfilled.setNewBaseValue(demandObj.desiredProp.currentValue * totalSupply / demand, "new demand calculated");
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
        return <span style={{alignItems: "center", justifyContent: "center"}}>
            <CustomTooltip items={this.toolTipVars}><span onClick={() => {Logger.setInspect(this.resourceStorage)}}>{titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
            <CumulatorComponent variable={this.resourceStorage.amount} showName={false}/><br />
        </span>
    }
}

export const Resources = {
    food: new Resource({name: "food", storageMultiplier: 450, productionRatio: 1.03, description: "keeps your villagers alive"}),
    wood: new Resource({name: "wood", storageMultiplier: 200, productionRatio: 1.0, description: "for building, upkeep and fuel"}),
    coal: new Resource({name: "coal", storageMultiplier: 200, productionRatio: 1.0, description: "for smithing and fuel"}),
    stone: new Resource({name: "stone", storageMultiplier: 150, productionRatio: 1.0, description: "for building and bricks"}),
    stoneBricks: new Resource({name: "stone bricks", storageMultiplier: 200, productionRatio: 1.0, description: "for building and upkeep"}),
};