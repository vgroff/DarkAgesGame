import {VariableModifier, multiplication, subtraction, division, makeTextFile, priority, roundTo, scaledAddition, UnaryModifier, scaledMultiplication, invLogit, min, Variable, castInt, addition, TrendingVariable, TrendingVariableComponent, VariableComponent, CumulatorComponent, Cumulator} from '../UIUtils.js';
import Grid from  '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import {FormControlLabel, Tab, Tabs, Modal, Box, Typography} from '@mui/material';
import React from 'react';
import UIBase from '../UIBase';
import { ThemeContext } from '../theme';
import {Storage, Farm, LumberjacksHut, Brewery, CharcoalKiln, Quarry, Housing, ResourceBuilding, BuildingComponent, Stonecutters, HuntingCabin, Apothecary, ConstructionSite, Library, Roads, IronMine, Toolmaker, Church, Tavern, CoalMine, Bowyer, WeaponMaker} from './building.js'
import { Resources, ResourceStorage, ResourceStorageComponent, UNIT_ATTACK_VALUES, UNIT_WEAPON_COSTS } from './resource.js';
import { SumAggModifier } from '../variable/sumAgg.js';
import { getBasePopDemands, RationingComponent, applyRationingModifiers } from './rationing.js';
import { createResearchTree } from './research.js';
import { AddNewBuildingBonus, SettlementBonus } from './bonus.js';
import { Market, MarketResourceComponent } from './market.js';
import { seasonToTempFactor } from '../seasons.js';
import { TerrainComponent } from './terrain.js';
import { CourtIntrigue, CropBlight, EventComponent, Fire, LocalMiracle, MineShaftCollapse, Pestilence, WolfAttack, WarmSpell, MerchantBoom, HuntingGameSurplus, DryHuntingLands, Blizzard, RatsInStorage, NomadsArrive, BanditRaid } from '../events.js';
import { getDefaultBuildings } from './default_buildings.js';
import { Character, copyCulture } from '../character.js';
import { TradeAgreement, npcWillAcceptTrade } from '../diplomacy.js';


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.autoManageUnemployed = false;
        this.gameClock = props.gameClock;
        this.handleRebellion = props.handleRebellion;
        this.addToTreasury = props.addToTreasury || null; // Optional callback: (amount, reason) => void
        if (!this.handleRebellion || !this.gameClock) {
            throw Error("Settlement needs gameClock and handleRebellion");
        }
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
                // Formula: immigrationFactor * (1 + growth) - decline
                // immigrationFactor scales inflow (baseline + births) but not deaths
                new VariableModifier({startingValue: 1, type: addition}),
                new VariableModifier({variable: this.populationSizeGrowth, type: addition}),
                new VariableModifier({variable: this.immigrationFactor, type: multiplication}),
                new VariableModifier({variable: this.populationSizeDecline, type: subtraction}),
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
        for (const [, demand] of Object.entries(this.popDemands)) {
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
        this.happiness.forceResetTrend(); // Snap trending variables to their initial calculated values

        this.idealPrices = {};
        this.localPriceModifiers = {};
        getDefaultBuildings().forEach(building => {
            this.idealPrices[building.outputResource.name] = building.getIdealisedPrice(this.localPriceModifiers)
        });
        this.market = new Market({population: this.populationSizeExternal, idealPrices: this.idealPrices, resourceStorages: this.resourceStorages, tradeFactor: this.tradeFactor, bankrupt: props.bankrupt});

        // Only player settlements get events — NPC settlements have no events for now
        // to avoid invisible forcePause events softlocking the game.
        this.settlementEvents = props.leader?.isPlayer ? [
            new CropBlight({settlements: [this], timer: this.gameClock}),
            new LocalMiracle({settlements: [this], timer: this.gameClock}),
            new MineShaftCollapse({settlements: [this], timer: this.gameClock}),
            new Fire({settlements: [this], timer: this.gameClock}),
            new Pestilence({settlements: [this], timer: this.gameClock}),
            new WolfAttack({settlements:[this], timer: this.gameClock}),
            new CourtIntrigue({settlements: [this], timer: this.gameClock}),
            new WarmSpell({settlements: [this], timer: this.gameClock}),
            new MerchantBoom({settlements: [this], timer: this.gameClock}),
            new HuntingGameSurplus({settlements: [this], timer: this.gameClock}),
            new DryHuntingLands({settlements: [this], timer: this.gameClock}),
            new Blizzard({settlements: [this], timer: this.gameClock}),
            new RatsInStorage({settlements: [this], timer: this.gameClock}),
            new NomadsArrive({settlements: [this], timer: this.gameClock, addToTreasury: this.addToTreasury}),
            new BanditRaid({settlements: [this], timer: this.gameClock, addToTreasury: this.addToTreasury}),
        ] : [];
        this.tempFactor = seasonToTempFactor(this.gameClock.translatedTime.season);

        if (!props.leader) {
            throw Error("no leader");
        } else {
            this.setLeader(props.leader);
        }

        // §4.2 Army strength: sum of (unit count × attack value), modified by leader strategy
        this.armyStrength = new Variable({ name: "Army strength", owner: this, startingValue: 0 });
        this.armyStrengthStrategyModifier = new VariableModifier({
            name: "strategy army modifier",
            type: multiplication,
            startingValue: 0,
            modifiers: [
                new VariableModifier({ variable: this.leader.strategy, type: addition }),
                new VariableModifier({
                    type: invLogit,
                    invLogitSpeed: 3,
                    bias: 0.8,
                    scale: 0.45,
                    startingValue: 0.5,
                    customPriority: priority.exponentiation + 1
                })
            ]
        });
        this.armyStrength.addModifier(this.armyStrengthStrategyModifier);
        this._unitModifiers = {};

        this.adjustCoalDemand();
        this.gameClock.subscribe(() => {
            this.adjustCoalDemand();
        });
        this.gameClock.subscribe(() => {
            this.autoSellExcessGoods();
        });
    }
    addBuilding(building) {
        console.log(`Adding ${building.name}`);
        if (building instanceof ResourceBuilding) {
            this.resourceBuildings.push(building);
            building.productivity.addModifier(this.generalProductivityModifier);
            this.totalJobs.resubscribeToVariables();
            this.jobsTaken.resubscribeToVariables();
        } else {
            this.otherBuildings.push(building);
        }
    }
    setLeader(leader) {
        if (this.leader) {
            this.removeLeader()
        }
        this.leader = leader;
        this.localLegitimacy = new Variable({name: "Local legitimacy", startingValue: 0, modifiers: [
            new VariableModifier({variable: this.leader.legitimacy, type: addition})
        ]});
        this.leader.addSettlement(this);
        let diplomacySupport = new Variable({name: "Leader Diplomacy effect", startingValue:0, modifiers: [
            new VariableModifier({variable: this.leader.diplomacy, type: scaledAddition, 
                priority: addition, offset:0,  bias: 0.0, scale: 0.1
            })
        ]});
        this.support = new Variable({startingValue: -1, name: "popular support", modifiers: [
            new VariableModifier({variable: this.happiness, type: addition}),
            new VariableModifier({variable: this.localLegitimacy, type: addition}),
            new VariableModifier({variable: diplomacySupport, type: addition})
        ]});
        this.rebellionSupport = new Variable({startingValue: 0, name: "rebellion support", min: new Variable({startingValue: 0}), modifiers: [
            new VariableModifier({variable: this.support, type: addition}),
            new VariableModifier({startingValue: -1, type: multiplication})
        ]});
        let zero = new Variable({startingValue: 0});
        this.totalRebellionSupport = new Cumulator({startingValue: 0, name: "total rebellion support",
            min: zero, modifiers: [
            new VariableModifier({variable: this.rebellionSupport, type: addition})
        ], timer: this.gameClock, visualAlerts:(variable) => variable.currentValue > 0.3
            ? [`Rebellion risk: ${Math.round(variable.currentValue * 100)}% — improve happiness or legitimacy`]
            : null});
        this.totalRebellionSupport.subscribe(() => {
            if (this.totalRebellionSupport.valueAtTurnStart >= 1) {
                this.rebel();
            }
        });
    }
    rebel() {
        if (this.rebellionOngoing) {
            return;
        }
        this.rebellionOngoing = true;
        let newLeader = new Character({name:"random npc", culture: copyCulture(this.leader), gameClock: this.gameClock});
        let oldLeader = this.leader;
        this.setLeader(newLeader);
        if (oldLeader.isPlayer) {
            this.handleRebellion(this);
        }
        this.rebellionOngoing = false;
    }
    removeLeader() { // This should never really get called other than by setLeader I guess?
        this.leader.removeSettlement(this);
        this.leader = null;
        this.support = new Variable({startingValue: 0, name: "popular support"})
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
    /**
     * Auto-sell excess goods to the market.
     * Called each tick. For each resource storage whose Cumulator recorded excess this tick
     * (i.e. production overflowed storage), if the player has set a desiredSellProp > 0 for
     * that resource in the market, the excess is sold at the current market sell price and
     * the income is added to the treasury via the addToTreasury callback.
     * Only fires if addToTreasury callback was provided (i.e. player-owned settlement).
     */
    autoSellExcessGoods() {
        if (!this.addToTreasury) return;
        for (const resourceStorage of this.resourceStorages) {
            if (!resourceStorage.cumulates) continue;
            const excess = resourceStorage.amount.excessAmount;
            if (!excess || excess <= 0) continue;
            // Find the corresponding market resource
            const marketResource = this.market.marketResources.find(
                mr => mr.resource === resourceStorage.resource
            );
            if (!marketResource) continue;
            // Only auto-sell if the player has opted into selling this resource
            if (marketResource.desiredSellProp.currentValue <= 0) continue;
            // Sell at the current market sell price
            const income = excess * marketResource.marketSellPrice.currentValue;
            if (income > 0) {
                this.addToTreasury(income, `auto-sold excess ${resourceStorage.resource.name}`);
            }
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
                    if  (alertsBefore < alertsAfter) {
                        this.addWorkersToBuilding(priority.building, -direction);
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
        getDefaultBuildings().forEach(building => {
            this.idealPrices[building.outputResource.name] = building.getIdealisedPrice(this.localPriceModifiers);
        })
        this.market.setNewIdealPrices(this.idealPrices);
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
        for (const building of this.otherBuildings) {
            if (building.name === name) {
                return building;
            }
        }
        return null;
    }

    /**
     * §4.2 Arm soldiers: convert weapons → armed unit resource, add attack modifier to armyStrength.
     * @param {Resource} unitResource - the unit type (e.g. Resources.ironSpears)
     * @param {number} count - number of soldiers to arm
     * @returns {boolean} true if successful
     */
    armSoldiers(unitResource, count) {
        const weaponCostEntry = UNIT_WEAPON_COSTS[unitResource.name];
        if (!weaponCostEntry) return false;
        const weaponResource = Resources[weaponCostEntry.resourceName];
        const weaponStorage = this.resourceStorages.find(rs => rs.resource === weaponResource);
        if (!weaponStorage || weaponStorage.amount.baseValue < weaponCostEntry.amount * count) return false;
        weaponStorage.oneOffDemand(weaponCostEntry.amount * count, `arm ${unitResource.name}`);
        const unitStorage = this.resourceStorages.find(rs => rs.resource === unitResource);
        if (!unitStorage) return false;
        unitStorage.amount.setNewBaseValue(unitStorage.amount.baseValue + count, `arm ${unitResource.name}`);
        // Add attack modifier to armyStrength
        const attackValue = UNIT_ATTACK_VALUES[unitResource.name];
        const modifier = new VariableModifier({
            name: `${unitResource.name} attack`,
            startingValue: attackValue * count,
            type: addition
        });
        this.armyStrength.addModifier(modifier);
        // Store modifier reference for disarming
        if (!this._unitModifiers[unitResource.name]) this._unitModifiers[unitResource.name] = [];
        this._unitModifiers[unitResource.name].push({ modifier, count });
        return true;
    }

    /**
     * §4.2 Disarm soldiers: remove armed unit resource, return weapons to storage, remove attack modifier.
     * @param {Resource} unitResource - the unit type
     * @param {number} count - number of soldiers to disarm
     * @returns {boolean} true if successful
     */
    disarmSoldiers(unitResource, count) {
        const unitStorage = this.resourceStorages.find(rs => rs.resource === unitResource);
        if (!unitStorage || unitStorage.amount.baseValue < count) return false;
        unitStorage.amount.setNewBaseValue(unitStorage.amount.baseValue - count, `disarm ${unitResource.name}`);
        // Return weapons to storage
        const weaponCostEntry = UNIT_WEAPON_COSTS[unitResource.name];
        if (weaponCostEntry) {
            const weaponResource = Resources[weaponCostEntry.resourceName];
            const weaponStorage = this.resourceStorages.find(rs => rs.resource === weaponResource);
            if (weaponStorage) {
                weaponStorage.amount.setNewBaseValue(
                    weaponStorage.amount.baseValue + weaponCostEntry.amount * count,
                    `disarm ${unitResource.name}`
                );
            }
        }
        // Remove attack modifier (remove oldest matching modifier entries first)
        const modifierList = this._unitModifiers[unitResource.name] || [];
        let remaining = count;
        while (remaining > 0 && modifierList.length > 0) {
            const entry = modifierList[modifierList.length - 1];
            if (entry.count <= remaining) {
                this.armyStrength.removeModifier(entry.modifier);
                remaining -= entry.count;
                modifierList.pop();
            } else {
                // Partial disarm: shrink the modifier's internal Variable
                const attackValue = UNIT_ATTACK_VALUES[unitResource.name];
                entry.modifier.variable.setNewBaseValue(attackValue * (entry.count - remaining), `partial disarm ${unitResource.name}`);
                entry.count -= remaining;
                remaining = 0;
            }
        }
        return true;
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.happiness, this.settlement.unemployed]);
        // Default to Production tab (index 0)
        this.state = { ...this.state, tab: 0 };
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
    /** Render the settlement header: name, leader, terrain, key stats, events */
    renderHeader() {
        const s = this.settlement;
        return <Grid item xs={12}>
            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{s.name}</span>
            {' · '}
            <span style={{ color: '#555', cursor: 'pointer' }} onClick={() => this.props.setSelected(s.leader)}>
                {s.leader.name}
            </span>
            {' · '}
            <TerrainComponent terrain={s.terrain} prefix={true} />
            <br />
            {s.settlementEvents.filter(ev => ev.isActive()).map((ev, i) =>
                <span key={`${ev.name}_${i}`} style={{ fontSize: '1.05em', fontWeight: 'bold', marginRight: '8px' }}>
                    <EventComponent event={ev}/>
                </span>
            )}
        </Grid>;
    }
    /** Tab 0 — Production: key stats + buildings */
    /** Compact stats bar shown at the top of every tab — always bolded, support first */
    renderStatsBar() {
        const s = this.settlement;
        const theme = this.context;
        const c = theme ? theme.colors : null;
        const statStyle = { fontSize: '1.05em', color: c ? c.textPrimary : 'inherit' };
        const sepStyle = { color: c ? c.textMuted : '#aaa', margin: '0 8px' };
        const barStyle = {
            borderBottom: `1px solid ${c ? c.borderMid : '#ddd'}`,
            paddingBottom: '6px',
            marginBottom: '6px',
        };
        return <Grid item xs={12} style={barStyle}>
            <span style={statStyle}><VariableComponent showOwner={false} variable={s.support} description="Popular support = happiness + legitimacy + diplomacy effect − 1. Negative support accumulates rebellion pressure." /></span>
            <span style={sepStyle}>|</span>
            <span style={statStyle}><TrendingVariableComponent showOwner={false} variable={s.happiness} description="How content the population is. Affects productivity and rebellion risk." /></span>
            <span style={sepStyle}>|</span>
            <span style={statStyle}><TrendingVariableComponent showOwner={false} variable={s.health} description="Population health. Affects productivity and population growth." /></span>
            <span style={sepStyle}>|</span>
            <span style={statStyle}><VariableComponent showOwner={false} variable={s.generalProductivity} description="Multiplier applied to all building output." /></span>
        </Grid>;
    }
    renderProductionTab() {
        const s = this.settlement;
        const isPlayer = s.leader.isPlayer;
        const theme = this.context;
        const c = theme ? theme.colors : null;

        // Divider between stat groups
        const divider = <div style={{
            borderTop: `1px solid ${c ? c.borderLight : '#e0e0e0'}`,
            margin: '6px 0 4px',
        }} />;

        // Group label style
        const groupLabel = (text) => <div style={{
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: c ? c.textMuted : '#aaa',
            marginBottom: '2px',
            marginTop: '2px',
        }}>{text}</div>;

        return <Grid container justifyContent="center" alignItems="center" spacing={1}>
            <Grid item xs={12}>
                {/* Group 1: Population */}
                {groupLabel('Population')}
                <VariableComponent showOwner={false} variable={s.populationSizeExternal} description="Total number of people living in this settlement." /><br />
                <VariableComponent showOwner={false} variable={s.populationSizeChange} description="Rate of population change per tick. Values above 1 mean growth; below 1 mean decline." /><br />

                {divider}

                {/* Group 2: Jobs & Homes */}
                {groupLabel('Jobs & Homes')}
                <VariableComponent showOwner={false} variable={s.totalJobs.variable} description="Total job slots available across all buildings." /><br />
                <VariableComponent showOwner={false} variable={s.jobsTaken.variable} description="Number of job slots currently filled by workers." /><br />
                <VariableComponent showOwner={false} variable={s.unemployed} description="People without a job. Negative means more jobs than workers." /><br />
                <VariableComponent showOwner={false} variable={s.homeless} description="People without housing. Homelessness reduces happiness, health, and population growth." /><br />

                {divider}

                {/* Group 3: Legitimacy */}
                {groupLabel('Legitimacy')}
                <VariableComponent showOwner={false} variable={s.localLegitimacy} description="How much the population accepts the current leader. Contributes to popular support." /><br />
                <VariableComponent showOwner={false} variable={s.rebellionSupport} description="Instantaneous rebellion pressure this tick (positive = support is negative). Accumulates into total rebellion support." /><br />
                <CumulatorComponent showOwner={false} variable={s.totalRebellionSupport} description="Accumulated rebellion pressure. When this reaches 1, the settlement rebels and the leader is replaced." /><br />

                {divider}

                {/* Controls */}
                <a href={s.logHref}>{Variable.logging ? 'Calculation Log' : 'logging is off'}</a><br />
                {isPlayer ? <FormControlLabel control={<Checkbox onChange={(e, value) => {
                    s.autoManageUnemployed = value;
                    if (s.autoManageUnemployed) s.adjustJobs();
                }}/>} label="Auto-assign unemployed" style={{maxHeight:'80%', minHeight:'80%'}}/> : null}
            </Grid>
            {/* §5 Diplomacy section — shown on NPC settlement view when game prop is available */}
            {!isPlayer && this.props.game && this.renderDiplomacySection()}
            <Grid item xs={12} style={{border:"1px solid grey", padding:"5px", textAlign:"center"}}>
                <Grid container spacing={3} justifyContent="center" alignItems="center" style={{textAlign:"center"}}>
                    {s.getBuildings().filter(b => b.unlocked).map((building, i) =>
                        <Grid item xs={4} key={building.name} style={{alignItems:"center", justifyContent:"center"}}>
                            {building instanceof ResourceBuilding
                                ? <BuildingComponent building={building}
                                    buildText={building.getBuildText(s.resourceStorages)}
                                    canBuild={building.canBuild(s.resourceStorages)}
                                    canDemolish={building.size.currentValue > 0}
                                    canAddWorkers={building.totalJobs.currentValue > 0 && s.unemployed.currentValue > 0}
                                    canRemoveWorkers={building.filledJobs.currentValue > 0}
                                    addWorkers={(e, direction) => this.addToBuilding(e, building, direction)}
                                    addToBuildingSize={(e, direction) => this.addToBuildingSize(e, building, direction)}
                                    canUpgrade={building.canUpgrade(s.resourceStorages)}
                                    canDowngrade={building.canDowngrade(s.resourceStorages)}
                                    isPlayerOwned={isPlayer}
                                    upgradeBuilding={(e, direction) => this.upgradeBuilding(e, building, direction)}
                                    upgradeText={building.getUpgradeText(s.resourceStorages, building)}
                                />
                                : <BuildingComponent building={building}
                                    buildText={building.getBuildText(s.resourceStorages)}
                                    canBuild={building.canBuild(s.resourceStorages)}
                                    canDemolish={building.size.currentValue > 0}
                                    addToBuildingSize={(e, direction) => this.addToBuildingSize(e, building, direction)}
                                    canUpgrade={building.canUpgrade(s.resourceStorages)}
                                    canDowngrade={building.canDowngrade(s.resourceStorages)}
                                    isPlayerOwned={isPlayer}
                                    upgradeBuilding={(e, direction) => this.upgradeBuilding(e, building, direction)}
                                    upgradeText={building.getUpgradeText(s.resourceStorages, building)}
                                />
                            }
                        </Grid>
                    )}
                </Grid>
            </Grid>
            {/* Distribution section — merged below production */}
            {isPlayer && <>
                <Grid item xs={12} style={{borderTop: '1px solid #ccc', marginTop: '8px', paddingTop: '4px'}}>
                    <span style={{fontWeight:'bold', color:'#555'}}>Rationing</span>
                </Grid>
                {s.rationsDemanded.filter((ration, i) =>
                    s.resourceBuildings.find(b => b.outputResource === s.rationResources[i] && b.unlocked)
                ).map((ration, i) =>
                    <Grid item xs={4} key={s.rationResources[i].name} justifyContent="center" alignItems="center" style={{alignItems:"center", justifyContent:"center"}}>
                        <RationingComponent
                            demandedRation={ration}
                            recievedRation={s.rationsAchieved[i]}
                            idealRation={s.idealRations[i]}
                            addRations={(e, direction) => this.addToRation(e, ration, direction)}
                        />
                    </Grid>
                )}
                <Grid item xs={12}><span style={{fontWeight:'bold', color:'#555'}}>Resources</span></Grid>
                {s.resourceStorages.filter(rs =>
                    rs.amount.currentValue !== 0 || s.resourceBuildings.find(b => b.outputResource === rs.resource && b.unlocked)
                ).map((rs, i) =>
                    <Grid item xs={4} key={rs.resource.name} justifyContent="center" alignItems="center" style={{alignItems:"center", justifyContent:"center"}}>
                        <ResourceStorageComponent resourceStorage={rs} />
                    </Grid>
                )}
            </>}
        </Grid>;
    }
    /** Tab 1 — Trading: market. Only shown when Roads building has size > 0 (tradeFactor > 0). */
    renderTradingTab() {
        const s = this.settlement;
        if (!s.leader.isPlayer) {
            return <Grid container spacing={1}><Grid item xs={12}><span style={{color:'#888'}}>Trading is managed by the NPC leader.</span></Grid></Grid>;
        }
        const roadsBuilding = s.getBuildingByName(Roads.name);
        if (!roadsBuilding || roadsBuilding.size.currentValue === 0) {
            return <Grid container spacing={1}><Grid item xs={12}><span style={{color:'#888'}}>Build Roads to unlock trading.</span></Grid></Grid>;
        }
        return <Grid container justifyContent="center" alignItems="center" spacing={1}>
            {s.market.marketResources.filter(mr =>
                s.resourceBuildings.find(b => b.outputResource === mr.resource && b.unlocked)
            ).map((mr, i) =>
                <Grid item xs={4} key={mr.resource.name} justifyContent="center" alignItems="center" style={{alignItems:"center", justifyContent:"center"}}>
                    <MarketResourceComponent
                        marketResource={mr}
                        buyFromMarket={(e, direction) => this.buyFromMarket(e, mr, direction)}
                    />
                </Grid>
            )}
        </Grid>;
    }
    /**
     * §5 Diplomacy section — shown in NPC settlement Production tab.
     * Allows player to propose resource trade deals with the NPC settlement.
     * Max 2 active agreements simultaneously.
     */
    renderDiplomacySection() {
        const game = this.props.game;
        const npcSettlement = this.settlement;
        const playerSettlement = game.settlements.find(s => s.leader.isPlayer);
        if (!playerSettlement) return null;

        const activeAgreements = (game.tradeAgreements || []).filter(a => a.active);
        const atCap = activeAgreements.length >= 2;

        // Build list of tradeable resources (player produces them)
        const playerResources = playerSettlement.resourceBuildings
            .filter(b => b.unlocked && b.size.currentValue > 0)
            .map(b => b.outputResource);
        const npcResources = npcSettlement.resourceBuildings
            .filter(b => b.unlocked && b.size.currentValue > 0)
            .map(b => b.outputResource);

        const tradeModalOpen = this.state.tradeModalOpen || false;
        const tradeOffer = this.state.tradeOffer || { offerResource: null, offerAmount: 5, requestResource: null, requestAmount: 5 };

        const willAccept = tradeOffer.offerResource && tradeOffer.requestResource
            ? npcWillAcceptTrade(npcSettlement, tradeOffer.offerResource, tradeOffer.requestResource)
            : null;

        const proposeTrade = () => {
            if (!tradeOffer.offerResource || !tradeOffer.requestResource) return;
            if (!willAccept) return;
            const agreement = new TradeAgreement({
                fromSettlement: playerSettlement,
                toSettlement: npcSettlement,
                fromResource: tradeOffer.offerResource,
                fromAmount: tradeOffer.offerAmount,
                toResource: tradeOffer.requestResource,
                toAmount: tradeOffer.requestAmount,
                gameClock: game.gameClock,
                onCancel: (a) => {
                    game.addGameMessage(`Trade agreement cancelled: could not fulfil ${tradeOffer.offerResource.name} delivery.`);
                    game.tradeAgreements = game.tradeAgreements.filter(x => x !== a);
                }
            });
            game.tradeAgreements.push(agreement);
            this.setState({ tradeModalOpen: false });
        };

        return <Grid item xs={12} style={{ borderTop: '1px solid #ccc', paddingTop: '8px', marginTop: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#555' }}>Diplomacy</span><br />
            {activeAgreements.length === 0
                ? <span style={{ color: '#888', fontSize: '0.8rem' }}>No active trade agreements.</span>
                : activeAgreements.map((a, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', marginBottom: '2px' }}>
                        📦 {a.fromAmount} {a.fromResource.name}/yr → {a.toAmount} {a.toResource.name}/yr
                        <button style={{ marginLeft: '6px', fontSize: '0.7rem' }} onClick={() => { a.cancel(); this.forceUpdate(); }}>Cancel</button>
                    </div>
                ))
            }
            <br />
            <button
                disabled={atCap}
                style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: atCap ? 'not-allowed' : 'pointer', opacity: atCap ? 0.5 : 1 }}
                onClick={() => this.setState({ tradeModalOpen: true })}
            >
                {atCap ? 'Trade cap reached (2/2)' : 'Propose Trade'}
            </button>

            {/* Trade proposal modal */}
            <Modal open={tradeModalOpen} onClose={() => this.setState({ tradeModalOpen: false })}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 480, bgcolor: 'background.paper',
                    border: '2px solid #000', boxShadow: 24, p: 3
                }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Propose Trade with {npcSettlement.name}</Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                        The NPC will accept if they produce your offered resource at least 1.2× more efficiently than what you request.
                    </Typography>

                    <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>You offer:</span><br />
                        <select
                            value={tradeOffer.offerResource ? tradeOffer.offerResource.name : ''}
                            onChange={e => {
                                const res = playerResources.find(r => r.name === e.target.value);
                                this.setState({ tradeOffer: { ...tradeOffer, offerResource: res } });
                            }}
                            style={{ marginRight: '8px' }}
                        >
                            <option value="">-- select resource --</option>
                            {playerResources.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                        </select>
                        <input
                            type="number" min="1" max="100"
                            value={tradeOffer.offerAmount}
                            onChange={e => this.setState({ tradeOffer: { ...tradeOffer, offerAmount: parseInt(e.target.value) || 1 } })}
                            style={{ width: '60px' }}
                        /> /yr
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontWeight: 'bold' }}>You request:</span><br />
                        <select
                            value={tradeOffer.requestResource ? tradeOffer.requestResource.name : ''}
                            onChange={e => {
                                const res = npcResources.find(r => r.name === e.target.value);
                                this.setState({ tradeOffer: { ...tradeOffer, requestResource: res } });
                            }}
                            style={{ marginRight: '8px' }}
                        >
                            <option value="">-- select resource --</option>
                            {npcResources.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                        </select>
                        <input
                            type="number" min="1" max="100"
                            value={tradeOffer.requestAmount}
                            onChange={e => this.setState({ tradeOffer: { ...tradeOffer, requestAmount: parseInt(e.target.value) || 1 } })}
                            style={{ width: '60px' }}
                        /> /yr
                    </div>

                    {willAccept !== null && (
                        <Typography sx={{ mb: 1, color: willAccept ? 'green' : 'red', fontWeight: 'bold' }}>
                            {willAccept ? '✓ The NPC will accept this deal.' : '✗ The NPC will not accept this deal.'}
                        </Typography>
                    )}

                    <button
                        disabled={!willAccept}
                        style={{ marginRight: '8px', padding: '4px 12px', cursor: willAccept ? 'pointer' : 'not-allowed', opacity: willAccept ? 1 : 0.5 }}
                        onClick={proposeTrade}
                    >Confirm</button>
                    <button style={{ padding: '4px 12px' }} onClick={() => this.setState({ tradeModalOpen: false })}>Cancel</button>
                </Box>
            </Modal>
        </Grid>;
    }

    /** Tab 2 — Military: weapon stockpiles, unit conversion, army strength */
    renderMilitaryTab() {
        const s = this.settlement;
        const isPlayer = s.leader.isPlayer;

        // Weapon stockpile resources
        const weaponResources = [
            Resources.stoneWeaponry,
            Resources.ironWeaponry,
            Resources.steelWeaponry,
            Resources.bows,
        ];

        // All unit types grouped by weapon source
        const unitGroups = [
            { label: 'Stone Weapon Soldiers', units: [Resources.stoneSpears, Resources.stoneSwords] },
            { label: 'Iron Weapon Soldiers',  units: [Resources.ironSpears,  Resources.ironSwords]  },
            { label: 'Steel Weapon Soldiers', units: [Resources.steelSpears, Resources.steelShortSwords, Resources.steelLongSwords] },
            { label: 'Bow Soldiers',          units: [Resources.shortbowmen, Resources.warbowmen, Resources.longbowmen] },
        ];

        const getStorage = (resource) => s.resourceStorages.find(rs => rs.resource === resource);

        return <Grid container justifyContent="center" alignItems="flex-start" spacing={1} style={{ padding: '4px' }}>
            {/* Army strength */}
            <Grid item xs={12}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Army</span><br />
                <VariableComponent showOwner={false} variable={s.armyStrength} />
            </Grid>

            {/* Weapon stockpiles */}
            <Grid item xs={12}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Weapon stockpiles</span>
            </Grid>
            {weaponResources.map(wr => {
                const storage = getStorage(wr);
                if (!storage) return null;
                return <Grid item xs={3} key={wr.name} style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#555' }}>{wr.name.replace(/\b\w/g, c => c.toUpperCase())}</span><br />
                    <span style={{ fontWeight: 'bold' }}>{Math.floor(storage.amount.currentValue)}</span>
                </Grid>;
            })}

            {/* Unit conversion */}
            {isPlayer && <Grid item xs={12}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Soldiers</span>
            </Grid>}
            {isPlayer && unitGroups.map(group => {
                const anyUnit = group.units.some(u => {
                    const weaponCost = UNIT_WEAPON_COSTS[u.name];
                    if (!weaponCost) return false;
                    const weaponStorage = getStorage(Resources[weaponCost.resourceName]);
                    return weaponStorage && weaponStorage.amount.currentValue >= weaponCost.amount;
                });
                const anyArmed = group.units.some(u => {
                    const st = getStorage(u);
                    return st && st.amount.currentValue > 0;
                });
                if (!anyUnit && !anyArmed) return null;
                return <Grid item xs={12} key={group.label}>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{group.label}</span>
                    <Grid container spacing={1}>
                        {group.units.map(unitResource => {
                            const unitStorage = getStorage(unitResource);
                            if (!unitStorage) return null;
                            const weaponCost = UNIT_WEAPON_COSTS[unitResource.name];
                            const weaponStorage = weaponCost ? getStorage(Resources[weaponCost.resourceName]) : null;
                            const canArm = weaponStorage && weaponStorage.amount.currentValue >= weaponCost.amount;
                            const armed = Math.floor(unitStorage.amount.currentValue);
                            const attackVal = UNIT_ATTACK_VALUES[unitResource.name];
                            return <Grid item xs={4} key={unitResource.name} style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                                <span style={{ color: '#333' }}>{unitResource.name.replace(/\b\w/g, c => c.toUpperCase())}</span><br />
                                <span style={{ color: '#888' }}>atk {attackVal} · cost {weaponCost ? weaponCost.amount : '?'}</span><br />
                                <span style={{ fontWeight: 'bold' }}>{armed} armed</span><br />
                                <button
                                    disabled={!canArm}
                                    style={{ fontSize: '0.7rem', padding: '1px 6px', marginRight: '2px', cursor: canArm ? 'pointer' : 'not-allowed', opacity: canArm ? 1 : 0.4 }}
                                    onClick={() => { s.armSoldiers(unitResource, 1); this.forceUpdate(); }}
                                >+1</button>
                                <button
                                    disabled={!canArm}
                                    style={{ fontSize: '0.7rem', padding: '1px 6px', marginRight: '2px', cursor: canArm ? 'pointer' : 'not-allowed', opacity: canArm ? 1 : 0.4 }}
                                    onClick={() => { s.armSoldiers(unitResource, 5); this.forceUpdate(); }}
                                >+5</button>
                                <button
                                    disabled={armed <= 0}
                                    style={{ fontSize: '0.7rem', padding: '1px 6px', cursor: armed > 0 ? 'pointer' : 'not-allowed', opacity: armed > 0 ? 1 : 0.4 }}
                                    onClick={() => { s.disarmSoldiers(unitResource, 1); this.forceUpdate(); }}
                                >-1</button>
                            </Grid>;
                        })}
                    </Grid>
                </Grid>;
            })}

            {/* Active bandit threat */}
            {s.settlementEvents.filter(ev => ev.name === 'bandit raid' && ev.isActive()).length > 0 && (
                <Grid item xs={12}>
                    <span style={{ color: 'red', fontWeight: 'bold' }}>⚔ Bandit raid in progress!</span>
                </Grid>
            )}
        </Grid>;
    }

    childRender() {
        this.settlement = this.props.settlement;
        const isPlayer = this.settlement.leader.isPlayer;
        const theme = this.context;
        const c = theme ? theme.colors : null;
        // Clamp tab to valid range (3 tabs: Production, Trading, Military)
        const tab = Math.min(this.state.tab || 0, 2);
        return <Grid container justifyContent="center" alignItems="center" style={{alignItems:"center", justifyContent:"center"}}>
            {/* Sticky settlement header: name/leader/terrain/events + stats bar + tabs.
                Sits below the sticky HUD block (HUD + warning banner + nav buttons).
                stickyHeaderHeight is measured from the actual DOM ref in GameUI and passed
                down via MainUI, so this always clears the sticky block exactly. */}
            <Grid item xs={12} style={{
                position: 'sticky',
                top: this.props.stickyHeaderHeight || 165,
                zIndex: 90,
                backgroundColor: c ? c.contentBg : '#fff',
                paddingBottom: '2px',
            }}>
                {this.renderHeader()}
                {this.renderStatsBar()}
                <Tabs
                    value={tab}
                    onChange={(e, newVal) => this.setState({ tab: newVal })}
                    variant="fullWidth"
                    textColor="inherit"
                    sx={{ borderBottom: '1px solid #ccc', minHeight: '36px' }}
                >
                    <Tab label="Production" sx={{ minHeight: '36px', fontSize: '0.8rem', padding: '6px 8px' }} />
                    <Tab label="Trading" disabled={!isPlayer} sx={{ minHeight: '36px', fontSize: '0.8rem', padding: '6px 8px' }} />
                    <Tab label="Military" sx={{ minHeight: '36px', fontSize: '0.8rem', padding: '6px 8px' }} />
                </Tabs>
            </Grid>
            <Grid item xs={12} style={{ paddingTop: '8px' }}>
                {tab === 0 && this.renderProductionTab()}
                {tab === 1 && this.renderTradingTab()}
                {tab === 2 && this.renderMilitaryTab()}
            </Grid>
        </Grid>;
    }
}
SettlementComponent.contextType = ThemeContext;

