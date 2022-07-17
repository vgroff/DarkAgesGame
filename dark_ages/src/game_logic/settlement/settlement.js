import {VariableModifier, multiplication, subtraction, division, greaterThan, lesserThan, scaledMultiplication, invLogit, min, Variable, castInt, addition, TrendingVariable, TrendingVariableComponent, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, LumberjacksHut, Brewery, CharcoalKiln, Quarry, ResourceBuilding, ResourceBuildingComponent, Stonecutters, HuntingCabin, Apothecary} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent } from './resource.js';
import { Cumulator } from '../UIUtils.js';
import { exponentiation, max, priority, scaledAddition, UnaryModifier } from '../variable/modifier.js';
import { SumAggModifier } from '../variable/sumAgg.js';
import { getBasePopDemands, RationingComponent, applyRationingModifiers } from './rationing.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: 1});
        this.gameClock = props.gameClock;
        this.populationSizeDecline = new Variable({owner:this, name:"population decline", startingValue: 0.00005,
            displayRound: 5,
            modifiers: []
        });
        this.populationSizeGrowth = new Variable({owner:this, name:"population growth", startingValue: 0.00015,
            displayRound: 5,
            modifiers: []
        });
        this.immigrationFactor = new Variable({owner:this, name:"immigrationFactor", startingValue: 1.0,
            modifiers: []
        });
        this.populationSizeChange = new Variable({owner:this, name:"population rate of change", startingValue: 0,
            displayRound: 5,
            modifiers: [
                new VariableModifier({startingValue: 1, type: addition}),
                new VariableModifier({variable: this.populationSizeGrowth, type: addition}),
                new VariableModifier({variable: this.populationSizeDecline, type: subtraction}),
                new VariableModifier({variable: this.immigrationFactor, type: multiplication}) // Causes higher growth and higher decline intentionally - not sure if we want this?
            ]
        });
        this.populationSizeInternal = new Cumulator({owner: this, name:`population_size_internal`, startingValue: props.startingPopulation + 0.65,
            modifiers: [
                new VariableModifier({variable: this.populationSizeChange, type: multiplication}),
            ],
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
            return new ResourceStorage({resource: resource, size: this.storageSize, startingAmount: 0, gameClock: this.gameClock})
        });
        this.resourceBuildings = [] // Keep resource buildings separate for jobsTaken
        this.generalProductivity = new Variable({name: "general productivity", owner: this, startingValue: 1});
        this.generalProductivityModifier = new VariableModifier({variable: this.generalProductivity, type: multiplication});
        this.jobsTaken = new Variable({owner: this, name:`jobs taken`, startingValue: 0, modifiers: []});
        this.addBuilding(new Farm({startingSize: 4, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new HuntingCabin({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new CharcoalKiln({startingSize: 2, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new LumberjacksHut({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Brewery({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Apothecary({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
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
        let basePopDemands = getBasePopDemands();
        this.rationsDemanded = [];
        this.rationsAchieved = [];
        this.idealRations = [];
        let baseHappiness = 0.05; // Neutral happiness boost (could change with difficulty)
        let zero = new Variable({name: "zero", startingValue: 0});
        let one = new Variable({name: "one", startingValue: 1});
        this.happiness = new TrendingVariable({name: "happiness", startingValue: baseHappiness, timer: this.gameClock, trendingUpSpeed: 0.1, trendingDownSpeed: 0.35});
        this.health = new TrendingVariable({name: "health", timer: this.gameClock, startingValue: 1, trendingUpSpeed: 0.1, trendingDownSpeed: 0.35});
        this.unhealth = new Variable({name: "unhealth", startingValue: 1, min: zero, max: one, modifiers: [
            new VariableModifier({variable: this.health, type: subtraction}),
        ]})
        this.populationSizeGrowth.addModifier(new VariableModifier({variable: this.health, type: scaledMultiplication, priority: addition, bias: 1.0, scale: 0.75, exponent:1.5}));
        this.populationSizeGrowth.addModifier(new VariableModifier({variable: this.health, type: scaledMultiplication, priority: addition, bias: 0.0, scale: 1, exponent:0.3}));
        let maxPopSizeDecline = 0.15; // 15% population death is as bad as it gets
        let healthOffset = 0.4;
        this.populationSizeDecline.addModifier(new VariableModifier({name: "Poor Health", variable: this.unhealth, type: scaledAddition, priority: addition, offset:healthOffset*0.66,  bias: 0.0, scale: 0.25*maxPopSizeDecline/(1-healthOffset), exponent:2}));
        this.populationSizeDecline.addModifier(new VariableModifier({name: "Catastrophic Health", variable: this.unhealth, type: scaledAddition, priority: addition, offset:healthOffset, bias: 0.0, scale: maxPopSizeDecline/(1-healthOffset), exponent:3}));
        let maxHealthProductivityPenalty = 0.65;
        this.generalProductivity.addModifier(new VariableModifier({type: multiplication, name: "health effect", startingValue: 0, modifiers: [
            new VariableModifier({variable: this.health, type: addition}),
            new VariableModifier({type: invLogit, customPriority: priority.exponentiation + 1, invLogitSpeed: 3.5, bias: 1 - maxHealthProductivityPenalty, scale: maxHealthProductivityPenalty, startingValue: 0.2})
        ]}))
        let maxHappinessProductivityPenalty = 0.25;
        this.generalProductivity.addModifier(new VariableModifier({type: multiplication, name: "happiness effect", startingValue: 0, modifiers: [
            new VariableModifier({variable: this.happiness, type: addition}),
            new VariableModifier({type: invLogit, customPriority: priority.exponentiation + 1, invLogitSpeed: 4, bias: 1 - maxHappinessProductivityPenalty, scale: maxHappinessProductivityPenalty, startingValue: 0.15})
        ]}))
        for (const [key, demand] of Object.entries(basePopDemands)) {
            let desiredRationProp = new Variable({name: `${demand.resource.name} ration`, startingValue: 1, max: demand.idealAmount, min: zero});
            let desiredRation = new Variable({name: `${demand.resource.name} ration`, startingValue: 0, min: zero, modifiers: [
                    new VariableModifier({variable: desiredRationProp, type: addition}),
                    new VariableModifier({variable: this.populationSizeExternal, type: multiplication})
                ]
            });
            let proportion = new Variable({name: `${demand.resource.name} proportion`, startingValue: 1});
            let resourceStorage = this.resourceStorages.find(resourceStorage => resourceStorage.resource === demand.resource);
            let actualRationProp = resourceStorage.addDemand(`${demand.resource.name} ration`, desiredRation, proportion, 2); // 1 because citizens go before businesses
            let rationAchieved = new Variable({name: `Actual ${demand.resource.name} ration`, startingValue: 0, modifiers: [
                new VariableModifier({variable:desiredRationProp, type: addition}),
                new VariableModifier({variable:actualRationProp, type: multiplication})
            ]})
            this.rationsAchieved.push(rationAchieved);
            this.rationsDemanded.push(desiredRationProp);
            this.idealRations.push(demand.idealAmount);
            applyRationingModifiers(rationAchieved, demand, this.health, this.happiness);
        }
        this.happiness.addModifier(new VariableModifier({type: multiplication, variable: new Variable({name: "Penalty from health", startingValue: 0,
            modifiers: [
                new VariableModifier({startingValue: 0.1, type: addition}), // offset
                new VariableModifier({variable: this.health, type: addition}),
                new VariableModifier({startingValue: 1, type: min, customPriority: priority.addition+1}),
                new VariableModifier({startingValue: 0.4, exponent: 0.75, type: invLogit, invLogitSpeed: 2.5, customPriority: priority.addition+2})
            ]
        })}));
        this.populateBuildings(this.resourceBuildings);
    }
    addBuilding(building) {
        if (building instanceof ResourceBuilding) {
            this.resourceBuildings.push(building);
            building.productivity.addModifier(this.generalProductivityModifier)
        }
    }
    populateBuildings(buildings) {
        buildings.forEach((building) => {
            let availableWorkers = this.unemployed.currentValue;
            let possibleWorkers = Math.min(availableWorkers, building.emptyJobs.currentValue);
            this.addWorkersToBuilding(building, possibleWorkers);
        });
        this.happiness.forceResetTrend(); // Start health and happiness off with values from this
        this.health.forceResetTrend();
    }
    addWorkersToBuilding(building, amount) {
        if (amount > 0 && amount > this.unemployed.currentValue) {
            amount = this.unemployed.currentValue;
        }
        building.setNewFilledJobs(building.filledJobs.currentValue + amount);
    }
    addToDesiredRation(ration, amount) {
        ration.setNewBaseValue(ration.currentValue + amount, "user set new ration");
    }
    getBuildings() {
        return this.resourceBuildings;
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.tax, this.settlement.happiness]);
    }
    getAmount(event, direction, multiplier) {
        event.stopPropagation();
        let amount = 1;
        if (event.ctrlKey) {
            amount = 5;
        } else if (event.shiftKey) {
            amount = 10;
        }
        return amount*multiplier*direction;
    }
    addToBuilding(event, building, direction) {
        this.settlement.addWorkersToBuilding(building, this.getAmount(event, direction, 1));
    }
    addToRation(event, ration, direction) {
        this.settlement.addToDesiredRation(ration, this.getAmount(event, direction, 0.01));
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
            <TrendingVariableComponent showOwner={false} variable={this.settlement.happiness} /><br />
            <TrendingVariableComponent showOwner={false} variable={this.settlement.health} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.generalProductivity} /><br />
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
            <h4>Rationing</h4>
                <Grid container spacing={2} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}} >
                    {this.settlement.rationsDemanded.map((ration, i) => {
                        return  <Grid item xs={4} key={i} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <RationingComponent demandedRation={ration} recievedRation={this.settlement.rationsAchieved[i]} idealRation={this.settlement.idealRations[i]} addRations={(e, direction) => {this.addToRation(e, ration, direction)}}/>
                        </Grid>
                    })}
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

