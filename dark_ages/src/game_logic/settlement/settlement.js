import {VariableModifier, Variable, addition, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, LumberjacksHut, ResourceBuilding, ResourceBuildingComponent} from './building.js'
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
        this.addBuilding(new LumberjacksHut({startingSize: 3, productivityModifiers: []}));
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
        return <Grid container>
        <Grid item xs={12}>
            <h4>Information</h4>
            <span>{this.settlement.name}</span><br />
            <VariableComponent showOwner={false} variable={this.settlement.tax} />
        </Grid>
        <Grid item xs={12} justifyContent="center" alignItems="center" style={{border:"2px solid black", alignItems: "center", justifyContent: "center"}}>
            <h4>Buildings</h4>
            <Grid container spacing={2} justifyContent="center" alignItems="center">
                {this.settlement.buildings.map((building, i) => {
                    return <Grid item xs={4} key={i}  style={{alignItems: "center", justifyContent: "center"}}>
                        <ResourceBuildingComponent building={building}/>
                    </Grid>
                })}
            </Grid>
            <Grid container spacing={2} justifyContent="center" alignItems="center">
                <Grid item xs={12}><br/></Grid>
            </Grid>
        </Grid>
        <Grid item xs={12}>
            <h4>Resources</h4>
                <Grid container spacing={2} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}} >
                    {this.settlement.resourceStorages.map((resourceStorage, i) => {
                        return  <Grid item xs={4} key={i} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <ResourceStorageComponent resourceStorage={resourceStorage} />
                        </Grid>
                    })}
                </Grid>
        </Grid>
    </Grid>
    }
}

