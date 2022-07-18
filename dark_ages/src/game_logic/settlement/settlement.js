import {VariableModifier, multiplication, subtraction, division, greaterThan, lesserThan, scaledMultiplication, invLogit, min, Variable, castInt, addition, TrendingVariable, TrendingVariableComponent, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, LumberjacksHut, Brewery, CharcoalKiln, Quarry, Housing, ResourceBuilding, ResourceBuildingComponent, Stonecutters, HuntingCabin, Apothecary} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent } from './resource.js';
import { Cumulator } from '../UIUtils.js';
import { exponentiation, max, priority, roundTo, scaledAddition, UnaryModifier } from '../variable/modifier.js';
import { SumAggModifier } from '../variable/sumAgg.js';
import { getBasePopDemands, RationingComponent, applyRationingModifiers } from './rationing.js';
import { makeTextFile } from '../variable/variable.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: 1});
        this.gameClock = props.gameClock;
        this.populationSizeDecline = new Variable({owner:this, name:"population decline", startingValue: 0.00005,
            displayRound: 5,
            modifiers: []
        });
        this.populationSizeGrowth = new Variable({owner:this, name:"population growth", startingValue: 0.002, //0.00015
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
                new UnaryModifier({type: castInt, customPriority: 10})
            ]
        }); 
        this.storageSize = new Variable({owner: this, name:`storage size`, startingValue: 1});
        this.resourceStorages = Object.entries(Resources).map(([resourceName, resource]) => {
            return new ResourceStorage({resource: resource, size: this.storageSize, startingAmount: 0, gameClock: this.gameClock})
        });
        this.resourceBuildings = [] // Keep resource buildings separate for jobsTaken
        this.generalProductivity = new Variable({name: "general productivity", owner: this, startingValue: 1});
        this.generalProductivityModifier = new VariableModifier({variable: this.generalProductivity, type: multiplication});
        this.addBuilding(new Farm({startingSize: 4, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Housing({startingSize: 4, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new HuntingCabin({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new CharcoalKiln({startingSize: 2, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new LumberjacksHut({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Brewery({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Apothecary({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Quarry({startingSize: 2, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Stonecutters({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.totalJobs = new SumAggModifier(
            {
                name: "Total Jobs",
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
        ]});
        let baseHappiness = 0.05; // Neutral happiness boost (could change with difficulty)
        let zero = new Variable({name: "zero", startingValue: 0});
        let one = new Variable({name: "one", startingValue: 1});
        this.happiness = new TrendingVariable({name: "happiness", startingValue: baseHappiness, trendingRoundTo: 3, timer: this.gameClock, trendingUpSpeed: 0.1, trendingDownSpeed: 0.35});
        this.health = new TrendingVariable({name: "health", timer: this.gameClock, trendingRoundTo: 3, startingValue: 1, trendingUpSpeed: 0.1, trendingDownSpeed: 0.35});
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
            new VariableModifier({type: invLogit, customPriority: priority.exponentiation + 1, invLogitSpeed: 3.5, bias: 1 - maxHealthProductivityPenalty, scale: maxHealthProductivityPenalty, startingValue: 0.2}),
        ]}))
        let maxHappinessProductivityPenalty = 0.25;
        this.generalProductivity.addModifier(new VariableModifier({type: multiplication, name: "happiness effect", startingValue: 0, modifiers: [
            new VariableModifier({variable: this.happiness, type: addition}),
            new VariableModifier({type: invLogit, customPriority: priority.exponentiation + 1, invLogitSpeed: 4, bias: 1 - maxHappinessProductivityPenalty, scale: maxHappinessProductivityPenalty, startingValue: 0.15})
        ]}))
        this.generalProductivity.addModifier(new VariableModifier({type: roundTo, startingValue: 3, customPriority: 200}));
        this.popDemands = getBasePopDemands();
        this.rationsDemanded = [];
        this.rationsAchieved = [];
        this.idealRations = [];
        for (const [key, demand] of Object.entries(this.popDemands)) {
            let desiredRationProp = new Variable({name: `${demand.resource.name} ration (% of ideal)`, startingValue: 1, max: one, min: zero});
            let desiredRation = new Variable({name: `${demand.resource.name} ration`, startingValue: 0, min: zero, modifiers: [
                    new VariableModifier({variable: desiredRationProp, type: addition}),
                    new VariableModifier({variable: demand.idealAmount, type: multiplication}),
                    new VariableModifier({variable: this.populationSizeExternal, type: multiplication})
                ]
            });
            let proportion = new Variable({name: `${demand.resource.name} proportion`, startingValue: 1});
            let resourceStorage = this.resourceStorages.find(resourceStorage => resourceStorage.resource === demand.resource);
            let actualRationProp = resourceStorage.addDemand(`${demand.resource.name} ration`, desiredRation, proportion, 2); // 1 because citizens go before businesses
            let rationAchieved = new Variable({name: `Actual ${demand.resource.name} ration`, startingValue: 0, modifiers: [
                new VariableModifier({variable:desiredRationProp, type: addition}),
                new VariableModifier({variable: demand.idealAmount, type: multiplication}),
                new VariableModifier({variable:actualRationProp, type: multiplication})
            ]})
            if (demand.resource === Resources.housing) {
                this.totalHousedInternal = new Variable({name: "Total housed", modifiers: [
                    new VariableModifier({type: addition, variable: actualRationProp}),
                    new VariableModifier({type: multiplication, variable: this.populationSizeInternal}),
                ]});
            }
            if (!demand.alwaysFullRations) {
                this.rationsAchieved.push(rationAchieved);
                this.rationsDemanded.push(desiredRationProp);
                this.idealRations.push(demand.idealAmount);
            }
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
        this.homelessInternal = new Variable({name: "Homeless internal", min: zero, modifiers: [
            new VariableModifier({type: addition, variable: this.populationSizeInternal}),
            new VariableModifier({type: subtraction, variable: this.totalHousedInternal}),
        ]});
        this.homelessnessInternal = new Variable({name: "Homelessness internal", min: zero, modifiers: [
            new VariableModifier({type: addition, variable: this.homelessInternal}),
            new VariableModifier({type: division, variable: this.populationSizeInternal}),
        ]});
        this.homeless = new Variable({name: "Homeless", min: zero, modifiers: [
            new VariableModifier({type: addition, variable: this.homelessInternal}),
            new UnaryModifier({type: castInt, customPriority: priority.exponentiation + 1})
        ]});
        this.homelessness = new Variable({name: "Homelessness", min: zero, modifiers: [
            new VariableModifier({type: addition, variable: this.homeless}),
            new VariableModifier({type: division, variable: this.populationSizeInternal})
        ]});
        this.happiness.addModifier(new VariableModifier({variable: this.homelessness, type: scaledAddition, priority: addition, offset:0,  bias: 0.0, scale: -0.75, exponent:1 }));

        this.populationSizeDecline.addModifier(new VariableModifier({name: "Homelessness", variable: this.homelessnessInternal, type: scaledAddition, priority: addition, offset:0,  bias: 0.0, scale: 0.05, exponent:1}));
        Variable.logText += "\n\nSetting jobs here";
        this.populateBuildings(this.resourceBuildings);
        this.populationSizeExternal.subscribe(() => {
            Variable.logText += `\nSetting jobs here ${this.gameClock.currentValue}`;
            this.adjustJobsForPopChange();
        });
        this.totalJobs.subscribe(() => {
            Variable.logText += `\nSetting jobs here ${this.gameClock.currentValue}`;
            this.adjustJobsForPopChange();
        });
        this.unemployed.subscribe(() => {
            // Searching for some kind of bug, should be fixed now
            if (this.unemployed.currentVariable < 0) {
                debugger;
            }
        });
        this.logHref = makeTextFile(Variable.logText);
        this.logTextLength = 0;
        this.gameClock.subscribe(() => { 
            let extraLength = Variable.logText.length - this.logTextLength;
            Variable.logText += `\n\nNew turn here ${this.gameClock.currentValue}, lines today: ${extraLength / 1000}\n`;
            this.logTextLength = Variable.logText.length;
            this.logHref = makeTextFile(Variable.logText);
        });
    }
    addBuilding(building) {
        if (building instanceof ResourceBuilding) {
            this.resourceBuildings.push(building);
            building.productivity.addModifier(this.generalProductivityModifier)
        }
    }
    populateBuildings(buildings) {
        // this.lastJobsPopulation = this.populationSizeExternal.currentValue;
        // buildings.forEach((building) => {
        //     let availableWorkers = this.unemployed.currentValue;
        //     let possibleWorkers = Math.min(availableWorkers, building.emptyJobs.currentValue);
        //     this.addWorkersToBuilding(building, possibleWorkers);
        // });
        this.adjustJobsForPopChange();
        this.happiness.forceResetTrend(); // Start health and happiness off with values from this
        this.health.forceResetTrend();
    }
    addWorkersToBuilding(building, amount) {
        if (amount > 0 && amount > this.unemployed.currentValue && this.unemployed.currentValue >= 0) {
            amount = this.unemployed.currentValue;
        }
        building.setNewFilledJobs(building.filledJobs.currentValue + amount);
    }
    calculateBuildingJobPriority(building, i) {
        let priority = 0;
        priority += -i / 20; // Prefer buildings lower down in the array
        if (building.totalJobs.currentValue) {
            priority += building.filledJobs.currentValue / (building.totalJobs.currentValue); // Prefer buildings with a lot of people already
        }
        let resourceStorage = this.resourceStorages.find((demand) => demand.resource === building.outputResource);
        if (resourceStorage.resource.storageSizeMultiplier) {
            priority -= 0.2*resourceStorage.amount.currentValue / resourceStorage.resource.storageSizeMultiplier;
        } else {
            priority -= resourceStorage.amount.currentValue / this.populationSizeExternal.currentValue;
        }
        let ration = Object.entries(this.popDemands).find(([key, demand]) => demand.resource === building.outputResource);
        priority += ration ? 0.3 : 0;
        priority *= ration ? 1.5 : 1;
        let propDemandsSatisfied = building.minPropDemandSatisfied.currentValue;
        priority *= propDemandsSatisfied ? 0.1 : 1;
        return {
            building,
            priority
        }
    }
    adjustJobsForPopChange() {
        if (this.unemployed.currentValue === 0) {
            return
        }
        let allJobsFilled = false;
        while (this.unemployed.currentValue !== 0 && !allJobsFilled) {
            let unemployed = this.unemployed.currentValue;
            let direction = this.unemployed.currentValue / Math.abs(this.unemployed.currentValue);
            let priorities = this.resourceBuildings.map((building, i) => {
                return this.calculateBuildingJobPriority(building, i);
            });
            priorities = priorities.sort((a, b) => {return direction*(b.priority - a.priority)});
            allJobsFilled = true;
            for (const priority of priorities) {
                if (priority.building.emptyJobs.currentValue >= direction && priority.building.filledJobs.currentValue >= -direction) {
                    // console.log(`trying to add ${direction} to ${priority.building.name}`);
                    this.addWorkersToBuilding(priority.building, direction);
                    if (this.unemployed.currentValue !== unemployed) {
                        allJobsFilled = false;
                        // console.log(`added ${direction} to ${priority.building.name}`);
                        break;
                    }
                }
            }
        }
    }
    addToDesiredRation(ration, amount) {
        ration.setNewBaseValue(ration.currentValue + amount, "user set new ration", 0);
    }
    addToBuildingSize(building, amount) {
        building.size.setNewBaseValue(building.size.currentValue + amount, "user built", 0);
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
    addToBuildingSize(event, building, direction) {
        this.settlement.addToBuildingSize(building, direction);
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
            <VariableComponent showOwner={false} variable={this.settlement.totalJobs.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.jobsTaken.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.unemployed} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.homeless} /><br />
            <TrendingVariableComponent showOwner={false} variable={this.settlement.happiness} /><br />
            <TrendingVariableComponent showOwner={false} variable={this.settlement.health} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.generalProductivity} /><br />
            <a href={this.settlement.logHref}>Calculation Log</a>
        </Grid>
        <Grid item xs={12} justifyContent="center" alignItems="center" style={{border:"1px solid grey", padding:"5px", textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <h4>Buildings</h4>
            <Grid container spacing={3} justifyContent="center" alignItems="center" style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
                {this.settlement.getBuildings().map((building, i) => {
                    return <Grid item xs={4} key={i} style={{alignItems: "center", justifyContent: "center"}}>
                        <ResourceBuildingComponent building={building} 
                            addWorkers={(e, direction) => {this.addToBuilding(e, building, direction)}}
                            addToBuildingSize={(e, direction) => {this.addToBuildingSize(e, building, direction)}}
                        />
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

