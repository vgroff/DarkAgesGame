import {VariableModifier, Variable, addition, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, ResourceBuilding, ResourceBuildingComponent} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent } from './resource.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: 0});
        this.gameClock = props.gameClock;
        this.storageSize = new Variable({owner: this, name:`storage size`, startingValue: 1});
        this.resourceStorages = Object.entries(Resources).map(([resourceName, resource]) => {
            return new ResourceStorage({resource: resource, size: this.storageSize, startingAmount: 200, gameClock: this.gameClock})
        });
        this.buildings = []
        this.addBuilding(new Farm({startingSize: 3, productivityModifiers: []}));
    }
    addBuilding(building) {
        this.buildings.push(building);
        if (building instanceof ResourceBuilding) {
            let resourceStorage = this.resourceStorages.find(resourceStorage => building.resource === resourceStorage.resource);
            resourceStorage.amount.addModifier(new VariableModifier({variable: building.production, type:addition}));
        }
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.tax]);
    }
    render() {
        return <Grid container spacing={2}>
        <Grid item xs={12}>
            <VariableComponent variable={this.settlement.tax} />
            <ResourceBuildingComponent building={this.settlement.buildings[0]}/>
            <ResourceStorageComponent resourceStorage={this.settlement.resourceStorages[0]}/>
        </Grid>
    </Grid>
    }
}

