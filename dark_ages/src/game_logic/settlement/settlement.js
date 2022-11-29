import {VariableModifier, multiplication, subtraction, division, makeTextFile, greaterThan, lesserThan,  exponentiation, max, priority, roundTo, scaledAddition, UnaryModifier, scaledMultiplication, invLogit, min, Variable, castInt, addition, TrendingVariable, TrendingVariableComponent, VariableComponent} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import {FormControlLabel} from '@mui/material';
import React from 'react';
import UIBase from '../UIBase';
import {Storage, Farm, LumberjacksHut, Brewery, CharcoalKiln, Quarry, Housing, ResourceBuilding, BuildingComponent, Stonecutters, HuntingCabin, Apothecary, ConstructionSite, Library, Roads, IronMine, Toolmaker, Church, Tavern, CoalMine, Bowyer, WeaponMaker} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent } from './resource.js';
import { Cumulator } from '../UIUtils.js';
import { SumAggModifier } from '../variable/sumAgg.js';
import { getBasePopDemands, RationingComponent, applyRationingModifiers } from './rationing.js';
import { createResearchTree, ResearchComponent } from './research.js';
import { AddNewBuildingBonus, SettlementBonus } from './bonus.js';
import { Market, MarketResourceComponent } from './market.js';
import { titleCase } from '../utils.js';
import { winter, summer, seasonToTempFactor  } from '../seasons.js';
import { TerrainComponent } from './terrain.js';
import { CropBlight, EventComponent } from '../events.js';
import { DefaultBuildings } from './default_buildings.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.autoManageUnemployed = false;
        this.gameClock = props.gameClock;
        this.populationSizeDecline = new Variable({owner:this, name:"population decline", startingValue: 0.00005,
            displayRound: 5,
            modifiers: []
        });
        this.populationSizeGrowth = new Variable({owner:this, name:"population growth", startingValue: 0.00035, //0.00015
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
                new VariableModifier({startingValue: 4, type: roundTo, customPriority: 99}),
            ],
            timer: this.gameClock
        });
        this.populationSizeExternal = new Variable({owner:this, name:"population size", startingValue: 0,
            modifiers: [
                new VariableModifier({variable: this.populationSizeInternal, type:addition}),
                new UnaryModifier({type: castInt, customPriority: 10})
            ]
        }); 
        this.otherBuildings = [];
        let storageBuilding = new Storage({startingSize: 1});
        this.addBuilding(storageBuilding);
        this.storageSize = storageBuilding.size;
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
        this.addBuilding(new LumberjacksHut({startingSize: 2, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new ConstructionSite({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Library({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Tavern({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Church({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Toolmaker({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Roads({startingSize: 1, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Brewery({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Apothecary({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Quarry({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Stonecutters({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new IronMine({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new CoalMine({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new Bowyer({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        this.addBuilding(new WeaponMaker({startingSize: 0, productivityModifiers: [], resourceStorages: this.resourceStorages}));
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
        ], visualAlerts:(variable) => variable.currentValue > 0 ? ['Try to give everyone a job'] : null});
        let baseHappiness = 0.05; // Neutral happiness boost (could change with difficulty)
        let zero = new Variable({name: "zero", startingValue: 0});
        let one = new Variable({name: "one", startingValue: 1});
        this.happiness = new TrendingVariable({name: "happiness", startingValue: baseHappiness, trendingRoundTo: 3, timer: this.gameClock, min: zero, trendingUpSpeed: 0.1, trendingDownSpeed: 0.2, smallestTrend: 0.009});
        this.health = new TrendingVariable({name: "health", timer: this.gameClock, trendingRoundTo: 3, startingValue: 1, trendingUpSpeed: 0.05, trendingDownSpeed: 0.15, smallestTrend: 0.009});
        this.unhealth = new Variable({name: "unhealth", startingValue: 1, min: zero, max: one, modifiers: [
            new VariableModifier({variable: this.health, type: subtraction}),
            new VariableModifier({startingValue: 3, type: roundTo, customPriority: 99}),
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
        this.tradeFactor = new Variable({name:"trade factor", startingValue: 0});
        this.research = createResearchTree();
        this.popDemands = getBasePopDemands();
        this.terrain = props.terrain;
        this.populateBuildings();
        this.rationResources = [];
        this.rationsDemanded = [];
        this.rationsAchieved = [];
        this.idealRations = [];
        this.totalHousedInternal = new Variable({name: "Total housed", modifiers: []});
        for (const [key, demand] of Object.entries(this.popDemands)) {
            let desiredRationProp = new Variable({name: `${demand.resource.name} ration (% of ideal)`, startingValue: 1, max: one, min: zero});
            let desiredRation = new Variable({name: `${demand.resource.name} ration`, startingValue: 0, min: zero, modifiers: [
                    new VariableModifier({variable: desiredRationProp, type: addition}),
                    new VariableModifier({variable: demand.idealAmount, type: multiplication}),
                    new VariableModifier({variable: this.populationSizeExternal, type: multiplication})
                ]
            });
            let idealProportion = new Variable({name: `ideal ${demand.resource.name} proportion`, startingValue: 1});
            let actualProportion = new Variable({name: `${demand.resource.name} proportion`, startingValue: 1});
            let resourceStorage = this.resourceStorages.find(resourceStorage => resourceStorage.resource === demand.resource);
            let actualRationProp = resourceStorage.addDemand(`${demand.resource.name} ration`, desiredRation, idealProportion, actualProportion, 2).actualDesiredPropFulfilled; // 2 because citizens go after businesses
            let rationAchieved = new Variable({name: `Actual ${demand.resource.name} ration`, startingValue: 0, modifiers: [
                new VariableModifier({variable:desiredRationProp, type: addition}),
                new VariableModifier({variable: demand.idealAmount, type: multiplication}),
                new VariableModifier({variable:actualRationProp, type: multiplication})
            ]})
            if (demand.resource === Resources.mudHuts || demand.resource === Resources.woodenHuts || demand.resource === Resources.brickHouses) {
                let housed = new VariableModifier({type: addition, name: "housed", modifiers: [
                    new VariableModifier({type: addition, variable: actualRationProp}),
                    new VariableModifier({type: multiplication, variable: this.populationSizeInternal}),
                ]});
                this.totalHousedInternal.addModifier(housed);
            } else if (demand.resource === Resources.coal) {
                this.gameClock.subscribe(() => {
                    if (this.gameClock.translatedTime.season === winter) {
                        demand.idealAmount.setNewBaseValue(1.5, 'winter amount');
                    } else if (this.gameClock.translatedTime.season === summer) {
                        demand.idealAmount.setNewBaseValue(0.5, 'summer amount');
                    } else {
                        demand.idealAmount.setNewBaseValue(1.0, 'normal amount');
                    }
                })
            }
            if (!demand.alwaysFullRations) {
                this.rationsAchieved.push(rationAchieved);
                this.rationsDemanded.push(desiredRationProp);
                this.idealRations.push(demand.idealAmount);
                this.rationResources.push(demand.resource);
            }
            applyRationingModifiers(rationAchieved, demand, this.health, this.happiness, this.generalProductivity, this.tradeFactor);
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
        ], visualAlerts:(variable) => variable.currentValue > 0 ? ['Try to give everyone a house (build more housing)'] : null});
        this.homelessness = new Variable({name: "Homelessness", min: zero, modifiers: [
            new VariableModifier({type: addition, variable: this.homeless}),
            new VariableModifier({type: division, variable: this.populationSizeInternal})
        ]});
        this.happiness.addModifier(new VariableModifier({variable: this.homelessness, type: scaledAddition, priority: addition, offset:0, bias: 0.0, scale: -0.75, exponent:1 }));
        this.health.addModifier(new VariableModifier({variable: this.homelessness, type: scaledMultiplication, priority: addition, offset:0, bias: 1.0, scale: -0.35, exponent:1.5 }));

        this.populationSizeDecline.addModifier(new VariableModifier({name: "Homelessness", variable: this.homelessnessInternal, type: scaledAddition, priority: addition, offset:0,  bias: 0.0, scale: 0.05, exponent:1.2}));
        Variable.logText += "\n\nSetting jobs here";
        this.populationSizeExternal.subscribe(() => {
            if (this.autoManageUnemployed || this.unemployed.currentValue < 0) {
                Variable.logText += `\nSetting jobs here ${this.gameClock.currentValue}`;
                this.adjustJobs();
            }
        });
        this.totalJobs.subscribe(() => {
            if (this.autoManageUnemployed || this.unemployed.currentValue < 0) {
                Variable.logText += `\nSetting jobs here ${this.gameClock.currentValue}`;
                this.adjustJobs();
            }
        });
        this.unemployed.subscribe(() => {
            // Searching for some kind of bug, should be fixed now
            if (this.unemployed.currentVariable < 0) {
                debugger;
            }
        });
        this.logHref = makeTextFile(Variable.logText);
        this.logTextLength = 0;
        if (Variable.logging) {
            this.gameClock.subscribe(() => { 
                let extraLength = Variable.logText.length - this.logTextLength;
                Variable.logText += `\n\nNew turn here ${this.gameClock.currentValue}, lines today: ${extraLength / 1000}\n`;
                this.logTextLength = Variable.logText.length;
                this.logHref = makeTextFile(Variable.logText);
            });
        }
        this.activateTerrain(props.terrain);
        this.health.forceResetTrend();
        this.happiness.forceResetTrend(); // Start health and happiness off with values from this
        this.health.forceResetTrend();
        this.happiness.forceResetTrend(); // Twice for good measure

        this.idealPrices = {};
        this.localPriceModifiers = {};
        DefaultBuildings.forEach(building => {
            this.idealPrices[building.outputResource.name] = building.getIdealisedPrice(this.localPriceModifiers)
        });
        this.market = new Market({population: this.populationSizeExternal, idealPrices: this.idealPrices, resourceStorages: this.resourceStorages, tradeFactor: this.tradeFactor, bankrupt: props.bankrupt});

        this.settlementEvents = [
            new CropBlight({settlements: [this], timer: this.gameClock})
        ];
        this.tempFactor = seasonToTempFactor(this.gameClock.translatedTime.season);
        this.adjustCoalDemand();
        this.gameClock.subscribe(() => {
            this.adjustCoalDemand();
        });
    }
    addBuilding(building) {
        console.log(`Adding ${building.name}`);
        if (building instanceof ResourceBuilding) {
            this.resourceBuildings.push(building);
            building.productivity.addModifier(this.generalProductivityModifier)
        } else {
            this.otherBuildings.push(building);
        }
    }
    populateBuildings() {
        this.adjustJobs();
    }
    adjustCoalDemand() {
        let tempFactor = seasonToTempFactor(this.gameClock.translatedTime.season);
        if (tempFactor !== this.tempFactor) {
            this.popDemands.coal.idealAmount.setNewBaseValue(1 - 0.5*tempFactor, 'determined by season');
            this.tempFactor = tempFactor;
        }
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
        priority *= ration ? priority > 0 ? 1.5 : 0.66 : 1;
        let propDemandsSatisfied = building.minPropDemandSatisfied.currentValue;
        priority *= propDemandsSatisfied ? 0.1 : 1;
        return {
            building,
            priority
        }
    }
    adjustJobs() {
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
                    let alertsBefore = priority.building.alerts.length;
                    this.addWorkersToBuilding(priority.building, direction);
                    let alertsAfter = priority.building.alerts.length;
                    // console.log(`adding ${direction} to ${priority.building.name} alerts ${alertsAfter}, ${alertsBefore}`);
                    if  (alertsBefore < alertsAfter) {
                        this.addWorkersToBuilding(priority.building, -direction);
                        // console.log(`removing from ${priority.building.name} alerts ${alertsAfter}, ${alertsBefore}`);
                    } else if (this.unemployed.currentValue !== unemployed) {
                        allJobsFilled = false;
                        break;
                    }
                }
            }
        }
    }
    addToDesiredRation(ration, amount) {
        ration.setNewBaseValue(ration.currentValue + amount, "user set new ration", 0);
    }
    addToBuildingSize(building, direction) {
        if (direction === 1) {
            building.build(this.resourceStorages);
        } else if (direction === -1 ) {
            building.demolish();
        } else {
            throw Error("dont know what do");
        }
    }
    upgradeBuilding(building, direction) {
        if (direction === 1) {
            building.upgrade(this.resourceStorages, direction);
        } else if (direction === -1 ) {
            building.downgrade(this.resourceStorages, direction);
        } else {
            throw Error("dont know what do");
        }
    }
    canResearch(research) {
        if (research.researched) {
            return false;
        }
        let researchStorage = this.resourceStorages.find(resourceStorage => resourceStorage.resource === Resources.research);
        if (researchStorage.amount.baseValue >= research.researchCost) {
            return true;
        }
        return false;
    }
    activateResearch(research) {
        let researchStorage = this.resourceStorages.find(resourceStorage => resourceStorage.resource === Resources.research);
        if (!this.canResearch(research)) {
            return;
        }
        researchStorage.oneOffDemand(research.researchCost);
        for (const researchBonus of research.researchBonuses) {
            this.activateBonus(researchBonus);
        }
        research.researched = true;
    }
    activateTerrain(terrain) {
        for (const bonus of terrain.bonuses) {
            this.activateBonus(bonus);
        }
    }
    activateBonus(bonus) {
        if (bonus instanceof AddNewBuildingBonus) {
            this.addBuilding(new bonus.buildingType({startingSize: bonus.size, unlocked:bonus.unlocked, productivityModifiers: [], resourceStorages: this.resourceStorages}));
        } else if (bonus instanceof SettlementBonus) {
            bonus.activate(this);
        } else {
            throw Error("not implemented");
        }
    }
    deactivateBonus(bonus) {
        if (bonus instanceof SettlementBonus) {
            bonus.deactivate(this);
        } else {
            throw Error("not implemented");
        }
    }
    addLocalPriceModifier(resource, modifier) {
        if (!(modifier instanceof VariableModifier)) {
            throw Error("should be a variable modifier")
        }
        if (!(resource.name in this.localPriceModifiers)) {
            this.localPriceModifiers[resource.name] = new Variable({startingValue:1})
        }
        this.localPriceModifiers[resource.name].addModifier(modifier)
        this.recalculatePrices();
    }
    removeLocalPriceModifier(resource, modifier) {
        if (!(modifier instanceof VariableModifier)) {
            throw Error("should be a variable")
        }
        this.localPriceModifiers[resource.name].removeModifier(modifier)
        this.recalculatePrices();
    }
    recalculatePrices(bankrupt) {
        DefaultBuildings.forEach(building => {
            this.idealPrices[building.outputResource.name] = building.getIdealisedPrice(this.localPriceModifiers);
        })
        this.market.setNewIdealPrices(this.idealPrices);
    }
    addPriceModifier(resource, modifier) {

    }
    getBuildings() {
        return this.otherBuildings.concat(this.resourceBuildings);
    }
    getBuildingByName(name) {
        for (const building of this.resourceBuildings) {
            if (building.name === name) {
                return building;
            }
        }
        return null;
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.happiness, this.settlement.unemployed]);
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
    upgradeBuilding(event, building, direction) {
        this.settlement.upgradeBuilding(building, direction);
    }
    addToRation(event, ration, direction) {
        this.settlement.addToDesiredRation(ration, this.getAmount(event, direction, 0.01));
    }
    buyFromMarket(event, marketResource, direction) {
        let amount = this.getAmount(event, direction, 0.01);
        if (amount > 0) {
            if (marketResource.buyProp.currentValue > 0 || marketResource.desiredSellProp.currentValue === 0) {
                marketResource.buyProp.setNewBaseValue(marketResource.buyProp.baseValue + amount, 'set by player');
            } else {
                marketResource.desiredSellProp.setNewBaseValue(marketResource.desiredSellProp.baseValue - amount, 'set by player');
            }
        } else {
            if (marketResource.desiredSellProp.currentValue > 0 || marketResource.buyProp.currentValue === 0) {
                marketResource.desiredSellProp.setNewBaseValue(marketResource.desiredSellProp.baseValue - amount, 'set by player');
            } else {
                marketResource.buyProp.setNewBaseValue(marketResource.buyProp.baseValue + amount, 'set by player');
            }
        }
    }
    childRender() {
        return <Grid container justifyContent="center" alignItems="center"  style={{alignItems: "center", justifyContent: "center"}} >
        <Grid item xs={12}>
            <h4>Information</h4>
            <span>{this.settlement.name}</span><br />
            <TerrainComponent terrain={this.settlement.terrain} prefix={true} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.populationSizeExternal} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.populationSizeChange} /><br /> 
            <VariableComponent showOwner={false} variable={this.settlement.totalJobs.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.jobsTaken.variable} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.unemployed} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.homeless} /><br />
            <TrendingVariableComponent showOwner={false} variable={this.settlement.happiness} /><br />
            <TrendingVariableComponent showOwner={false} variable={this.settlement.health} /><br />
            <VariableComponent showOwner={false} variable={this.settlement.generalProductivity} /><br />
            <a href={this.settlement.logHref}>{Variable.logging ? 'Calculation Log' : 'logging is off'}</a><br />
            <FormControlLabel control={<Checkbox onChange={(e, value) => {
                this.settlement.autoManageUnemployed = value;
                if (this.settlement.autoManageUnemployed) {
                    this.settlement.adjustJobs();
                }
            }}/>} label="Auto-assign unemployed"  style={{maxHeight:'80%', minHeight:'80%'}}/>
        </Grid>
        <Grid item xs={12}>
            <h4>Active Events</h4>
            {this.settlement.settlementEvents.filter(events => events.isActive()).map((ev, i) => {
                return <EventComponent key={`${ev.name}_${i}`} event={ev}/>
            })}
        </Grid>
        <Grid item xs={12} justifyContent="center" alignItems="center" style={{border:"1px solid grey", padding:"5px", textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <h4>Buildings</h4>
            <Grid container spacing={3} justifyContent="center" alignItems="center" style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
                {this.settlement.getBuildings().filter((building) => building.unlocked).map((building, i) => {
                    return <Grid item xs={4} key={building.name} style={{alignItems: "center", justifyContent: "center"}}>
                        {building instanceof ResourceBuilding ? <BuildingComponent building={building} 
                            buildText={building.getBuildText(this.settlement.resourceStorages)}
                            canBuild={building.canBuild(this.settlement.resourceStorages)}
                            canDemolish={building.size.currentValue > 0}
                            canAddWorkers={building.totalJobs.currentValue > 0 && this.settlement.unemployed.currentValue > 0}
                            canRemoveWorkers={building.filledJobs.currentValue > 0}
                            addWorkers={(e, direction) => {this.addToBuilding(e, building, direction)}}
                            addToBuildingSize={(e, direction) => {this.addToBuildingSize(e, building, direction)}}
                            canUpgrade={building.canUpgrade(this.settlement.resourceStorages)}
                            canDowngrade={building.canDowngrade(this.settlement.resourceStorages)}
                            upgradeBuilding={(e, direction) => {this.upgradeBuilding(e, building, direction)}}
                            upgradeText={building.getUpgradeText(this.settlement.resourceStorages, building)}
                        /> :  <BuildingComponent building={building} 
                            buildText={building.getBuildText(this.settlement.resourceStorages)}
                            canBuild={building.canBuild(this.settlement.resourceStorages)}
                            canDemolish={building.size.currentValue > 0}
                            addToBuildingSize={(e, direction) => {this.addToBuildingSize(e, building, direction)}}
                            canUpgrade={building.canUpgrade(this.settlement.resourceStorages)}
                            canDowngrade={building.canDowngrade(this.settlement.resourceStorages)}
                            upgradeBuilding={(e, direction) => {this.upgradeBuilding(e, building, direction)}}
                            upgradeText={building.getUpgradeText(this.settlement.resourceStorages, building)}
                        /> }
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
                    {this.settlement.rationsDemanded.filter((ration, i) => {
                        return this.settlement.resourceBuildings.find(building => building.outputResource === this.settlement.rationResources[i] && building.unlocked)
                    }).map((ration, i) => {
                        return  <Grid item xs={4} key={this.settlement.rationResources[i].name} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <RationingComponent demandedRation={ration} recievedRation={this.settlement.rationsAchieved[i]} idealRation={this.settlement.idealRations[i]} addRations={(e, direction) => {this.addToRation(e, ration, direction)}}/>
                        </Grid>
                    })}
                </Grid>
        </Grid>
        <Grid item xs={12}>
            <h4>Market</h4>
                <Grid container spacing={2} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}} >
                    {this.settlement.market.marketResources.filter(marketResource => {
                        return this.settlement.resourceBuildings.find(building => building.outputResource === marketResource.resource && building.unlocked)
                    }).map((marketResource, i) => {
                        return  <Grid item xs={4} key={marketResource.resource.name} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <MarketResourceComponent marketResource={marketResource} 
                            buyFromMarket={(e, direction) => {this.buyFromMarket(e, marketResource, direction)}}
                            />
                        </Grid>
                    })}
                </Grid>
        </Grid>
        <Grid item xs={12}>
            <h4>Resources</h4>
                <Grid container spacing={2} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}} >
                    {this.settlement.resourceStorages.filter(resourceStorage => {
                        return resourceStorage.amount.currentValue !== 0 || this.settlement.resourceBuildings.find(building => building.outputResource === resourceStorage.resource && building.unlocked)
                    }).map((resourceStorage, i) => {
                        return  <Grid item xs={4} key={resourceStorage.resource.name} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <ResourceStorageComponent resourceStorage={resourceStorage} />
                        </Grid>
                    })}
                </Grid>
        </Grid>
        <Grid item xs={12}>
            <h4>Research</h4>
                <Grid container spacing={2} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}} >
                    {Object.entries(this.settlement.research).map(([key, researchList], i) => {
                        return <Grid item xs={6} key={i} justifyContent="center" alignItems="center" style={{alignItems: "center", justifyContent: "center"}}>
                            <h5>{titleCase(key)}</h5>
                            {researchList.map((research, i) => {
                                let visible = false;
                                if (research.researched || i === 0 || researchList[i-1].researched) {
                                    visible = true;
                                }
                                return visible ? <ResearchComponent key={i} research={research} 
                                        canResearch={this.settlement.canResearch(research)}
                                        visible={visible}
                                        activateResearch={() => {this.settlement.activateResearch(research)}}
                                    /> : null
                            })}
                        </Grid>
                    })}
                </Grid>
        </Grid>
    </Grid>
    }
}

