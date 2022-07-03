import {VariableModifier, Variable, Cumulator, addition, CumulatorComponent, multiplication } from '../UIUtils.js';
import { titleCase, CustomTooltip } from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';

export class Resource {
    constructor(props) {
        this.name = props.name;
        this.storageMultiplier = props.storageMultiplier;
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
        this.totalStorage = new Variable({name: `${this.resource.name} storage`, startingValue: 0, type:addition, modifiers: [
            new VariableModifier({startingValue: this.resource.storageMultiplier, type: addition, modifiers: [
                new VariableModifier({type: multiplication, variable: this.size})
            ]})
        ]});
        this.amount = new Cumulator({name: `${this.resource.name} amount`, startingValue: props.startingAmount || 0, max: this.totalStorage, timer:props.gameClock});
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
        return <span justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
            <CustomTooltip items={this.toolTipVars}><span>{titleCase(this.resourceStorage.resource.name)}: </span></CustomTooltip>
            <CumulatorComponent variable={this.resourceStorage.amount} showName={false}/>
        </span>
    }
}

export const Resources = {
    food: new Resource({name: "food", storageMultiplier: 350, description: "keeps your villagers alive"}),
    wood: new Resource({name: "wood", storageMultiplier: 100, description: "for building, upkeep and fuel"}),
};