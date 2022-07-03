import {AggregatorModifier, titleCase, VariableModifier, Variable, Cumulator, addition, multiplication, VariableComponent} from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';
import { CustomTooltip  } from '../UIUtils';

export class Resource {
    constructor(props) {
        this.name = props.name;
    }
}

export class ResourceStorage {
    constructor(props) {
        this.resource = props.resource;
        this.amount = Cumulator({name: `${this.resource.name} storage`, startingValue: 0, timer:this.gameClock});
    }
}

export class ResourceStorageComponent extends UIBase {
    constructor(props) {
        super(props);
        this.resource = props.resource;
        this.toolTipVars = [
            this.building.size,
            this.building.production
        ]
        this.addVariables([this.building.filledJobs,this.building.totalJobs,...this.toolTipVars]);
    }
    childRender() {
        return <span><CustomTooltip title={Object.entries(this.toolTipVars).map(([i,variable]) => {
            return <span  key={i}><VariableComponent variable={variable}/><br /></span>
        })}>
            <span>{titleCase(this.building.name)} {this.building.filledJobs.currentValue}/{this.building.totalJobs.currentValue}</span>
        </CustomTooltip>
        </span>
    }
}

export const Resources = {
    food: new Resource("food"),
    wood: new Resource("wood")
};