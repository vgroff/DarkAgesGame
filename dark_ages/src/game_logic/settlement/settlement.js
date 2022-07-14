import {VariableModifier, multiplication, subtraction, Variable, castInt, addition, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, LumberjacksHut, CharcoalKiln, Quarry, ResourceBuilding, ResourceBuildingComponent, Stonecutters} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent } from './resource.js';
import { Cumulator } from '../UIUtils.js';
import { UnaryModifier } from '../variable/modifier.js';
import { SumAggModifier } from '../variable/sumAgg.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: 1});
        this.gameClock = props.gameClock;
        this.populationSizeDecline = new Variable({owner:this, name:"population decline", startingValue: 0.0001,
            displayRound: 5,
            modifiers: []
        });
        this.populationSizeGrowth = new Variable({owner:this, name:"population growth", startingValue: 1.00015,
            displayRound: 5,
            modifiers: []
        });
        this.immigrationFactor = new Variable({owner:this, name:"immigrationFactor", startingValue: 1.0,
            modifiers: []
        });
        this.populationSizeChange = new Variable({owner:this, name:"population rate of change", startingValue: 0,
            displayRound: 5,
            modifiers: [
                new VariableModifier({variable: this.populationSizeGrowth, type: addition}),
                new VariableModifier({variable: this.populationSizeDecline, type: subtraction}),
                new VariableModifier({variable: this.immigrationFactor, type: multiplication}) // Causes higher growth and higher decline intentionally
            ]
        });
        this.populationSizeInternal = new Cumulator({owner: this, name:`population_size_internal`, startingValue: props.startingPopulation,
            modifiers: [new VariableModifier({variable: this.populationSizeGrowth, type: multiplication})],
            timer: this.gameClock
        });
        this.populationSizeExternal = new Variable({owner:this, name:"population size", startingValue: 0,
            modifiers: [
                new VariableModifier({variable: this.populationSizeInternal, type:addition}),
                new UnaryModifier({type: castInt, priority: 10})
            ]
        }); 
        this.storageSize = new Variable({owner: this, name:`storage size`, startingValue: 1});
        this.resourceStorages = Object.entries(Resources).map(([resourceName, resource]) => {
            return new ResourceStorage({resource: resource, size: this.storageSize, startingAmount: 2 / resource.productionRatio, gameClock: this.gameClock})
        });
        this.resourceBuildings = [] // Keep resource buildings separate for jobsTaken
        this.jobsTaken = new Variable({owner: this, name:`jobs taken`, startingValue: 0, modifiers: []});
        this.addBuilding(new Farm({startingSize: 3, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new LumberjacksHut({startingSize: 3, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new CharcoalKiln({startingSize: 3, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Quarry({startingSize: 3, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Stonecutters({startingSize: 3, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.jobsAvailable = new SumAggModifier(
            {
                name: "Jobs available",
                aggregate: this,
                keys: [
                    ["resourceBuildings"],
                    ["totalJobs"],
                ],
                type: addition
            }
        ); 
        this.jobsTaken = new SumAggModifier(
            {
                name: "Jobs taken",
                aggregate: this,
                keys: [
                    ["resourceBuildings"],
                    ["filledJobs"],
                ],
                type: addition
            }
        ); 
        this.unemployed = new Variable({name: "Unemployed", startingValue: 0, modifiers: [
            new VariableModifier({variable: this.populationSizeExternal, type:addition}),
            new VariableModifier({variable: this.jobsTaken.variable, type:subtraction})
        ]})
    }
    addBuilding(building) {
        if (building instanceof ResourceBuilding) {
            this.resourceBuildings.push(building);
        }
    }
    addWorkersToBuilding(building, amount) {
        if (amount > 0 && amount > this.unemployed.currentValue) {
            amount = this.unemployed.currentValue;
        }
        building.setNewFilledJobs(building.filledJobs.currentValue + amount);
    }
    getBuildings() {
        return this.resourceBuildings;
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.tax]);
    }
    addToBuilding(event, building, direction) {

        event.stopPropagation();
     
        let amount = 1;
        if (event.ctrlKey) {
            amount = 5;
        } else if (event.shiftKey) {
            amount = 10;
        }
        this.settlement.addWorkersToBuilding(building, amount*direction)
    }
    childRender() {
        return <Grid container justifyContent="center" alignItems="center"  style={{alignItems: "center", justifyContent: "center"}} >
        <Grid item xs={12}>
            <h4>Information</h4>
            <span>{this.settlement.name}</span><br />
            <VariableComponent showOwner={false} variable={this.settlement.tax} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.populationSizeExternal} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.populationSizeChange} /><br /> 
            <VariableComponent showOwner={false} variable={this.settlement.jobsTaken.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.jobsAvailable.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.unemployed} /><br />
        </Grid>
        <Grid item xs={12} justifyContent="center" alignItems="center" style={{border:"1px solid grey", padding:"5px", textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <h4>Buildings</h4>
            <Grid container spacing={3} justifyContent="center" alignItems="center" style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
                {this.settlement.getBuildings().map((building, i) => {
                    return <Grid item xs={4} key={i} style={{alignItems: "center", justifyContent: "center"}}>
                        <ResourceBuildingComponent building={building} addWorkers={(e, direction) => {this.addToBuilding(e, building, direction)}}/>
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

