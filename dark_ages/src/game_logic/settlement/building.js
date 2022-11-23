import {VariableModifier, Variable, addition, subtraction, min, max, minBase, multiplication,division } from '../UIUtils.js';
import { titleCase, CustomTooltip, roundNumber } from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';
import {Resources} from './resource.js'
import Box from '@mui/material/Box';
import Grid from  '@mui/material/Grid';
import Button from '@mui/material/Button';
import {Logger} from '../logger.js';

const outputResourceChange = "new output resource";
const inputResourceChange = "new input resource";
const newBuildInputs = "new build inputs";
export class Building {
    constructor(props) {
        this.name = props.name;
        this.displayName = props.displayName || props.name;
        this.currentUpgradeIndex = 0;
        let zero = new Variable({startingValue: 0});
        this.startingSize = props.startingSize || 0;
        let maxSize = props.maxSize ? new Variable({startingValue: props.maxSize}) : undefined;
        this.size = new Variable({owner: this, name:"building size", startingValue: this.startingSize, min: zero, max: maxSize, modifiers:[]});
        this.buildInputs = props.buildInputs;
        this.unlocked = (props.unlocked || this.size.currentValue > 0) ? true : false;
        this.upgrades = props.upgrades || [];
        this.upgrades = this.upgrades.map(upgrade => {
            return new BuildingUpgrade({name: upgrade.name, newBuildCost: upgrade.newBuildCost, newDisplayName: upgrade.newDisplayName, 
                changes: upgrade.changes.map(changes => {
                    if (changes[0] === outputResourceChange) {
                        return new NewOutputResource({newResource: changes[1]});
                    } else if (changes[0] === inputResourceChange) {
                        return new NewInputResources({newResources: changes[1]});
                    } else {
                        throw Error("not implemented");
                    }
            })});
        });
    }
    canBuild(resourceStorages) {
        if (this.size.max && this.size.currentValue === this.size.max.currentValue) {
            return false;
        }
        for (const inputResource of this.buildInputs) {
            let resourceStorage = resourceStorages.find(r => r.resource === inputResource[0]);
            if (resourceStorage.amount.baseValue < inputResource[1]) {
                return false;
            }
        }
        return true;
    }
    getBuildText(resourceStorages) {
        if (this.size.max && this.size.currentValue === this.size.max.currentValue) {
            return ["This building can't get any larger"]
        }
        let buildText = ['Will increase size by 1'];
        for (const inputResource of this.buildInputs) {
            let resourceStorage = resourceStorages.find(r => r.resource === inputResource[0]);
            let text = `\nCosts ${roundNumber(inputResource[1], 3)} ${inputResource[0].name}` ;
            if (resourceStorage.amount.baseValue < inputResource[1]) {
                text += `, need another ${roundNumber(inputResource[1] - resourceStorage.amount.baseValue, 3)}`;
            }
            buildText.push(text);
        }
        return buildText;
    }
    build(resourceStorages) {
        if (this.canBuild(resourceStorages)) {
            for (const inputResource of this.buildInputs) {
                let resourceStorage = resourceStorages.find(r => r.resource === inputResource[0]);
                resourceStorage.oneOffDemand(inputResource[1]);
            }
            this.size.setNewBaseValue(this.size.baseValue + 1, "build", 0);
        }
    }
    demolish() {
        this.size.setNewBaseValue(this.size.baseValue - 1, "demolish", 0);
    }
    forceNewSize(newSize) {
        this.size.setNewBaseValue(newSize, "force change (by event)", 0);
    }
    canUpgrade(resourceStorages) {
        if (!this.upgrades || !this.upgrades[this.currentUpgradeIndex]) {
            return false;
        }
        return this.upgrades[this.currentUpgradeIndex].canUpgrade(resourceStorages, this);
        
    }
    canDowngrade(resourceStorages) {
        if (!this.upgrades || !this.upgrades[this.currentUpgradeIndex - 1]) {
            return false;
        }
        return this.upgrades[this.currentUpgradeIndex - 1].canDowngrade(resourceStorages, this);
    }
    getUpgradeText(resourceStorages) {
        if (!this.upgrades || !this.upgrades[this.currentUpgradeIndex]) {
            return [];
        }
        return this.upgrades[this.currentUpgradeIndex].upgradeText(resourceStorages, this);
    }
    upgrade(resourceStorages, force=false) {
        this.upgrades[this.currentUpgradeIndex].upgrade(resourceStorages, this, force);
        this.oldDisplayName = this.displayName;
        this.displayName = this.upgrades[this.currentUpgradeIndex] ? this.upgrades[this.currentUpgradeIndex].newDisplayName || this.displayName : this.displayName;
        this.currentUpgradeIndex += 1;
    }
    downgrade(resourceStorages) {
        this.currentUpgradeIndex -= 1;
        this.upgrades[this.currentUpgradeIndex].downgrade(resourceStorages, this);
        this.displayName = this.oldDisplayName;
    }
}

export class BuildingUpgradeChange {
    activate(building) {
        throw Error("Not implemented");
    }
    deactivate(building) {
        throw Error("Not implemented");
    }
    getText(building) {
        throw Error("Not implemented");
    }
}

export class NewOutputResource extends BuildingUpgradeChange {
    constructor(props) {
        super(props);
        this.newResource = props.newResource;
    }
    activate(building, resourceStorages) {
        this.oldResource = building.outputResource;
        building.changeOutputResource(this.newResource, resourceStorages, true); // Destroy the old resource in case the effect conflict (e.g. tools)
    }
    deactivate(building, resourceStorages) {
        building.changeOutputResource(this.oldResource, resourceStorages, true); // Destroy the old resource in case the effect conflict (e.g. tools)
    }
    getText(building, resourceStorages) {
        this.oldResource = building.outputResource;
        return `${building.name} will now produce ${this.newResource.name} instead of ${this.oldResource.name}`;
    }
}

export class NewInputResources extends BuildingUpgradeChange {
    constructor(props) {
        super(props);
        this.newResources = props.newResources;
    }
    activate(building, resourceStorages) {
        this.outputResources = building.inputResources;
        building.changeInputResources(this.newResources, resourceStorages);
    }
    deactivate(building, resourceStorages) {
        building.changeInputResources(this.oldResources, resourceStorages);
    }
    getText(building, resourceStorages) {
        this.oldResources = building.inputResources;
        return `${building.name} will now need ${this.newResources.map(resource => resource.resource.name).join(", ")} instead of ${this.oldResources.map(resource => resource.resource.name).join(", ")}`;
    }
}

export class BuildingUpgrade {
    constructor(props) {
        this.name = props.name;
        this.changes = props.changes;
        this.newBuildCost = props.newBuildCost;
        this.unlocked = props.unlocked || false;
        this.upgraded = false;
        this.newDisplayName = props.newDisplayName;
    }
    canUpgrade(resourceStorages, building) {
        if (!this.unlocked || this.upgraded) {
            return false;
        } // add pop demand resource for the new resources, add upgrade text and can upgrade/downgrade
        for (const buildCost of this.newBuildCost) {
            let amountNeeded = buildCost[1]*building.size.currentValue;
            let resourceStorage = resourceStorages.find(resourceStorage => resourceStorage.resource === buildCost[0])
            if (amountNeeded > resourceStorage.amount.baseValue) {
                return false;
            }
        }
        return true;
    }
    canDowngrade(resourceStorages, building) {
        return this.upgraded;
    }
    upgradeText(resourceStorages, building) {
        let upgradeText = this.changes.map(upgrade => upgrade.getText(building));
        for (const buildCost of this.newBuildCost) {
            let amountNeeded = buildCost[1]*building.size.currentValue;
            let resourceStorage = resourceStorages.find(resourceStorage => resourceStorage.resource === buildCost[0])
            let resourceText = `Need ${amountNeeded} ${buildCost[0].name}`
            if (amountNeeded > resourceStorage.amount.baseValue) {
                let missing = amountNeeded - resourceStorage.amount.baseValue;
                resourceText += `, need ${missing} more`
            }
            upgradeText.push(resourceText);
        }
        if (!this.unlocked) {
            upgradeText.push('Not yet unlocked, you may need to research this');
        }
        return upgradeText;
    }
    upgrade(resourceStorages, building, force=false) {
        if (!force && !this.canUpgrade(resourceStorages, building)) {
            return;
        }
        for (const buildCost of this.newBuildCost) {
            let amountNeeded = buildCost[1]*building.size.currentValue;
            let resourceStorage = resourceStorages.find(resourceStorage => resourceStorage.resource === buildCost[0])
            if (amountNeeded <= resourceStorage.amount.baseValue) {
                resourceStorage.oneOffDemand(amountNeeded, `upgrade: ${this.name}`);
            }
        }
        this.changes.forEach(change => change.activate(building, resourceStorages));
        this.oldBuildCost = building.buildInputs;
        building.buildInputs = this.newBuildCost || building.buildInputs;
        this.upgraded = true;
    }
    downgrade(resourceStorages, building) {
        if (!this.canDowngrade(resourceStorages, building)) { 
            return;
        }
        this.changes.forEach(change => change.deactivate(building, resourceStorages));
        building.buildInputs = this.oldBuildCost;
        this.upgraded = false;
    }
}

export class ResourceBuilding extends Building {
    constructor(props) {
        super(props);
        let zero = new Variable({startingValue: 0});
        this.resourceStorages = props.resourceStorages;
        if (!this.resourceStorages) {
            throw Error("need storage");
        }
        this.outputResource = props.outputResource;
        this.productivityModifiers = props.productivityModifiers;        
        if (!this.productivityModifiers) {
            throw Error('Need a productivity modifier');
        };
        this.productivity = new Variable({owner: this, name:"productivity", startingValue: props.startingProductivity || 1, modifiers:this.productivityModifiers});
        this.startingJobs = props.startingJobs || 0;
        this.sizeJobsMultiplier = props.sizeJobsMultiplier;
        if (this.sizeJobsMultiplier === undefined) {
            throw Error('Need a sizeJobsMultiplier');
        };    
        this.totalJobsModifiers = [
            new VariableModifier({name:"size effect", startingValue:this.sizeJobsMultiplier, type:addition, modifiers: [
                new VariableModifier({variable: this.size, type:multiplication})
            ]})
        ];
        this.totalJobs = new Variable({owner: this, name:"total jobs", startingValue: this.startingJobs, 
            modifiers:this.totalJobsModifiers
        });
        this.filledJobs = new Variable({owner: this, name:"filled jobs", startingValue: props.startingFilledJobs || 0, max: this.totalJobs, min: zero,
            modifiers:[]
        });
        this.filledJobs.subscribe(() => {
            // This helps some other systems behave a bit more sensibly 
            if (this.filledJobs.baseValue > this.filledJobs.max.currentValue) {
                this.filledJobs.setNewBaseValue(this.filledJobs.max.currentValue, 'size changed');
            }
        });
        this.emptyJobs = new Variable({owner: this, name:"empty jobs", startingValue: 0, max: this.totalJobs, min: zero,
            modifiers:[
                new VariableModifier({variable: this.totalJobs, type:addition}),
                new VariableModifier({variable: this.filledJobs, type:subtraction})
            ]
        });
        this.workerProduction = new Variable({name:"production from workers", owner: this, startingValue: this.outputResource.productionRatio, modifiers: [
            new VariableModifier({variable: this.filledJobs, type:multiplication}),
            new VariableModifier({variable: this.productivity, type:multiplication})
        ]})
        this.productionModifiers = [
            new VariableModifier({variable: this.workerProduction, type: addition})
        ];
        if (props.passiveProductionPerSize) {
            this.passiveProduction = new Variable({name:"passive production", startingValue:props.passiveProductionPerSize, modifiers: [
                new VariableModifier({variable: this.size, type:multiplication}),
            ]})
            this.productionModifiers.push(new VariableModifier({type: addition, variable: this.passiveProduction}));
        }
        this.theoreticalProduction = new Variable({owner: this, name:"theoretical total production",
            modifiers: this.productionModifiers
        });
        this.totalProduction = new Variable({owner: this, name:"total production",
            modifiers: []
        });
        let resourceStorage = this.resourceStorages.find(resourceStorage => this.outputResource === resourceStorage.resource);
        resourceStorage.addSupply(this.totalProduction);
        this.efficiency = new Variable({owner: this, name:"efficiency", startingValue: 1,
            modifiers: []
        });
        var self = this;
        this.changeInputResources(props.inputResources || [], this.resourceStorages);
        this.alerts = [];
        self.setDemandAlert();
        this.minPropDemandSatisfied.subscribe(() => {
            self.setDemandAlert();
        });
        this.filledJobs.subscribe(() => {
            self.setDemandAlert();
        });
    }
    setNewFilledJobs(villagers) {
        this.filledJobs.setNewBaseValue(villagers, "Set by leader", 0);
    }
    setDemandAlert() {
        let alert = "Insufficient input resources to work at full capacity!";
        if (this.minPropDemandSatisfied.currentValue < 0.999 && this.filledJobs.currentValue > 0) {
            if (!this.alerts.includes(alert)) {
                this.alerts.push(alert)
            }
        } else {
            this.alerts = this.alerts.filter(a => {return a !== alert;})
        }
        if (this.name.includes("rew")) {
        }
    }
    getIdealisedPrice(localPriceModifiers) {
        let localPriceModifier = localPriceModifiers[this.outputResource.name] ? localPriceModifiers[this.outputResource.name].currentValue : 1;
        let outputProductionRatio = localPriceModifier / (this.outputResource.productionRatio);
        let inputCost = this.inputResources.reduce((prev, resource) => {
            return prev + resource.multiplier*resource.resource.defaultBuilding.getIdealisedPrice(localPriceModifiers);
        }, 0)
        if (isNaN(outputProductionRatio) || isNaN(inputCost)) {
            throw Error("what")
        }
        return outputProductionRatio + inputCost;
    }
    changeOutputResource(newResource, resourceStorages, destroyOld) {
        let resourceStorage = resourceStorages.find(resourceStorage => resourceStorage.resource === this.outputResource);       
        resourceStorage.removeSupply(this.totalProduction);
        if (destroyOld && resourceStorage.cumulates) {
            resourceStorage.oneOffDemand(resourceStorage.amount.currentValue, "resource destroyed by upgrade");
        }
        resourceStorage = resourceStorages.find(resourceStorage => resourceStorage.resource === newResource);       
        resourceStorage.addSupply(this.totalProduction);
        this.outputResource = newResource;
    }
    changeInputResources(newInputResources, resourceStorages) {
        if (this.inputResources) {
            this.inputResources.forEach((input, i) => {
                let resourceStorage = this.resourceStorages.find(resourceStorage => input.resource === resourceStorage.resource);
                resourceStorage.removeDemand(this.idealPropDemandsDesired[i]);
            });
        }
        this.inputResources = newInputResources;
        this.idealPropDemandsDesired = [];
        this.actualPropDemandsDesired = [];
        this.propDemandsSatisfied = []
        this.inputResources.forEach((input, i) => {
            if (!input.resource || !input.multiplier) {
                throw Error("need this stuff");
            }
            let idealPropDemandDesired = new Variable({name: "ideal input resource demand", startingValue: 1,
                modifiers: []
            });
            let actualPropDemandDesired = new Variable({name: "actual input resource demand", startingValue: 1,
                modifiers: []
            });
            this.idealPropDemandsDesired.push(idealPropDemandDesired);
            this.actualPropDemandsDesired.push(actualPropDemandDesired);
            let resourceStorage = this.resourceStorages.find(resourceStorage => input.resource === resourceStorage.resource);
            this.propDemandsSatisfied.push(resourceStorage.addDemand(
                this.name,
                new Variable({ owner: this, name: `${resourceStorage.resource.name} demand from ${this.name}`,
                    startingValue: input.multiplier, modifiers: [
                        new VariableModifier({variable: this.theoreticalProduction, type: multiplication}),
                        new VariableModifier({variable: this.efficiency, type: division})
                    ]
                }), 
                idealPropDemandDesired,
                actualPropDemandDesired,
                1)
            );
        });
        this.minPropDemandSatisfied = new Variable({owner: this, name: "proportion of demand satisfied",startingValue: 1, 
            modifiers: this.propDemandsSatisfied.map(demandSatisfied => {
                return new VariableModifier({variable: demandSatisfied.actualDesiredPropFulfilled, type: min, customPriority: 5});
            })
        }); // Limit the production by the min of the inputs
        this.actualPropDemandsDesired.forEach((demand, i) => {
            demand.setModifiers(this.propDemandsSatisfied.filter((_, j) => {return i !== j}).map(demandSatisfied => {
                return new VariableModifier({variable: demandSatisfied.idealDesiredPropFulfilled, type: min, customPriority: 5})
            }
        ))});  // Limit the demand on all inputs by the min of the inputs
        let productionModifiers = [
            new VariableModifier({variable: this.theoreticalProduction,type: addition})
        ];
        productionModifiers.push(new VariableModifier({variable: this.minPropDemandSatisfied,type: multiplication}))
        this.totalProduction.setModifiers(productionModifiers);
    }
}

export class BuildingComponent extends UIBase {
    constructor(props) {
        super(props);
        this.building = props.building;
        this.toolTipVars = [
            this.building.size,
        ]
        if (this.building instanceof ResourceBuilding) {
            this.toolTipVars = [...this.toolTipVars, this.building.filledJobs,this.building.totalJobs,this.building.totalProduction]
        }
        this.addVariables(this.toolTipVars);
    }
    childRender() {
        let extraStyle = {};
        let extraVars = [];
        if (this.building instanceof ResourceBuilding) {
            extraVars = [``, `Output resource: ${this.building.outputResource.name}`];
            if (this.building.workerProduction.currentValue > 0) {
                let outputPerWorker = this.building.workerProduction.currentValue / this.building.filledJobs.currentValue;
                extraVars.push(`Producing ${roundNumber(outputPerWorker, 3)} per worker`);
                if (this.building.inputResources && this.building.inputResources.length > 0) {
                    this.building.inputResources.forEach(inputResource => {
                        extraVars.push(`Need ${roundNumber(inputResource.multiplier*outputPerWorker, 3)} of ${inputResource.resource.name} per worker`)
                    });
                }
            }
            if (this.building.alerts.length > 0) {
                extraStyle = {"color": "red"}
                this.building.alerts.forEach(alert => {
                    extraVars.push({text: alert, style: extraStyle})
                })
            }
        }
        return <Grid container spacing={0.5} style={{border:"2px solid #2196f3", borderRadius:"7px", alignItems: "center", justifyContent: "center"}} >
            <Grid item xs={9}>
                <CustomTooltip items={this.toolTipVars.concat(extraVars)} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                    <span style={extraStyle} onClick={()=>{Logger.setInspect(this.building)}}>{titleCase(this.building.displayName)} {this.building.sizeJobsMultiplier ? <span>{this.building.filledJobs.currentValue}/{this.building.totalJobs.currentValue}</span> : this.building.passiveProduction ? this.building.passiveProduction.currentValue : this.building.size.currentValue} </span>
                </CustomTooltip>
            </Grid>
            {this.props.addWorkers ? 
            <Grid item xs={3} style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
                <Button variant={this.props.canAddWorkers ? "outlined" : "disabled"} onClick={(e) => this.props.addWorkers(e, 1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
                <Button variant={this.props.canRemoveWorkers ? "outlined" : "disabled"} onClick={(e) => this.props.addWorkers(e, -1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>
            </Grid> : null}
            <CustomTooltip items={this.props.buildText} style={{textAlign: "left"}}>
            <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
                    <Button variant={this.props.canBuild ? "outlined" : "disabled"} onClick={(e) => this.props.addToBuildingSize(e, 1)} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Build</Button>
            </Grid>
            </CustomTooltip>
            <CustomTooltip items={["reduce size by 1"]} style={{textAlign: "left"}}>
            <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
                <Button variant={this.props.canDemolish ? "outlined" : "disabled"} onClick={(e) => this.props.addToBuildingSize(e, -1)} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Demolish</Button>
            </Grid>
            </CustomTooltip>
            <CustomTooltip items={this.props.upgradeText} style={{textAlign: "left"}}>
            <Grid item xs={6} style={{textAlign:"center",  padding: "2px",alignItems: "center", justifyContent: "center"}}>
                <Button variant={this.props.canUpgrade ? "outlined" : "disabled"} onClick={(e) => this.props.upgradeBuilding(e, 1)} sx={{fontSize: 12, minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Upgrade</Button>
            </Grid>
            </CustomTooltip>
            <Grid item xs={6} style={{textAlign:"center",  padding: "2px",alignItems: "center", justifyContent: "center"}}>
                <Button variant={this.props.canDowngrade ? "outlined" : "disabled"} onClick={(e) => this.props.upgradeBuilding(e, -1)}  sx={{fontSize: 12, minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Downgrade</Button>
            </Grid>
        </Grid>
    }
}


export class Storage extends Building {
    static name = "storage";
    constructor(props) {
        super({name: Storage.name, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 50]],
            ...props
        })
    }
}

export class Farm extends ResourceBuilding {
    static name = "farm";
    constructor(props) {
        super({name: Farm.name, 
            outputResource: Resources.food, 
            buildInputs: [[Resources.labourTime, 5], [Resources.wood, 5]],
            sizeJobsMultiplier: 5,
            ...props
        })
    }
}

export class HuntingCabin extends ResourceBuilding {
    static name = "hunting cabin";
    constructor(props) {
        super({name: HuntingCabin.name, 
            outputResource: Resources.food, 
            buildInputs: [[Resources.labourTime, 20], [Resources.wood, 25]],
            sizeJobsMultiplier: 3,
            startingProductivity: 1.45,
            maxSize: 3,
            ...props
        })
    }
}

export class Housing extends ResourceBuilding {
    static name = "Mud Huts";
    static woodenHuts = "Wooden Huts";
    static brickHouses = "Brick Houses";
    static upgrades = [   
        {
            name: Housing.woodenHuts,
            newDisplayName: Housing.woodenHuts,
            newBuildCost: [[Resources.labourTime, 50], [Resources.wood, 25]],
            changes: [[outputResourceChange, Resources.woodenHuts]],
        },
        {
            name: Housing.brickHouses,
            newDisplayName: Housing.brickHouses,
            newBuildCost: [[Resources.labourTime, 100], [Resources.stoneBricks, 40]],
            changes: [[outputResourceChange, Resources.steelTools]]
        }
    ];
    constructor(props) {
        super({name: Housing.name, 
            outputResource: Resources.mudHuts, 
            buildInputs: [[Resources.labourTime, 30]],
            sizeJobsMultiplier: 0,
            passiveProductionPerSize: 10,
            upgrades: Housing.upgrades,
            ...props
        })
    }
}

export class LumberjacksHut extends ResourceBuilding {
    static name = "lumberjack's hut";
    constructor(props) {
        super({name: LumberjacksHut.name, 
            outputResource: Resources.wood, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 40]],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class CharcoalKiln extends ResourceBuilding {
    static name = "charcoal kiln";
    constructor(props) {
        super({name: CharcoalKiln.name, 
            outputResource: Resources.coal, 
            buildInputs: [[Resources.labourTime, 20], [Resources.wood, 30]],
            inputResources: [{resource:Resources.wood, multiplier: 0.3}],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class Brewery extends ResourceBuilding {
    static name = "brewery";
    constructor(props) {
        super({name: Brewery.name, 
            outputResource: Resources.beer, 
            buildInputs: [[Resources.labourTime, 35], [Resources.wood, 50]],
            inputResources: [{resource:Resources.food, multiplier: 0.2}],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class Apothecary extends ResourceBuilding {
    static name = "apothecary";
    constructor(props) {
        super({name: Apothecary.name, 
            outputResource: Resources.medicinalHerbs, 
            buildInputs: [[Resources.labourTime, 15], [Resources.wood, 25]],
            inputResources: [],
            sizeJobsMultiplier: 2,
            ...props
        })
    }
}

export class Library extends ResourceBuilding {
    static name = "library";
    constructor(props) {
        super({name: Library.name, 
            outputResource: Resources.research, 
            buildInputs: [[Resources.labourTime, 50], [Resources.wood, 35]],
            sizeJobsMultiplier: 2,
            ...props
        })
    }
}

export class ConstructionSite extends ResourceBuilding {
    static name = "construction site";
    constructor(props) {
        super({name: ConstructionSite.name, 
            outputResource: Resources.labourTime, 
            buildInputs: [[Resources.labourTime, 5], [Resources.wood, 5]],
            sizeJobsMultiplier: 5,
            ...props
        })
    }
}

export class Church extends ResourceBuilding {
    static name = "church";
    constructor(props) {
        super({name: Church.name, 
            outputResource: Resources.religion, 
            buildInputs: [[Resources.labourTime, 100], [Resources.stone, 75]],
            sizeJobsMultiplier: 1,
            ...props
        })
    }
}

export class Tavern extends ResourceBuilding {
    static name = "tavern";
    constructor(props) {
        super({name: Tavern.name, 
            outputResource: Resources.entertainment, 
            buildInputs: [[Resources.labourTime, 50], [Resources.wood, 50]],
            inputResources: [{resource:Resources.food, multiplier: 0.1}, {resource:Resources.beer, multiplier: 0.1}],
            sizeJobsMultiplier: 2,
            ...props
        })
    }
}

export class Roads extends ResourceBuilding {
    static name = "Roads";
    static gravelPath = "Gravel Paths";
    static brickRoads = "Brick Roads";
    static upgrades = [   
        {
            name: Roads.gravelPath,
            newDisplayName: Roads.gravelPath,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stone, 25]],
            changes: [[outputResourceChange, Resources.gravelPathAccess]],
        },
        {
            name: Roads.brickRoads,
            newDisplayName: Roads.brickRoads,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stoneBricks, 25]],
            changes: [[outputResourceChange, Resources.brickRoadAccess]]
        }
    ];
    constructor(props) {
        super({name: Roads.name, 
            displayName: "Dirt Paths",
            outputResource: Resources.dirtPathAccess, 
            buildInputs: [[Resources.labourTime, 20]],
            sizeJobsMultiplier: 0,
            passiveProductionPerSize: 20,
            upgrades: Roads.upgrades,
            ...props
        })
    }
}

export class Quarry extends ResourceBuilding {
    static name = "quarry";
    constructor(props) {
        super({name: Quarry.name, 
            outputResource: Resources.stone, 
            buildInputs: [[Resources.labourTime, 100], [Resources.wood, 50]],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class Stonecutters extends ResourceBuilding {
    static name = "stonecutter's workshop";
    constructor(props) {
        super({name: Stonecutters.name, 
            outputResource: Resources.stoneBricks, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 25]],
            inputResources: [{resource:Resources.stone, multiplier: 2}, {resource:Resources.wood, multiplier: 2}],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class IronMine extends ResourceBuilding {
    static name = "iron mine";
    constructor(props) {
        super({name: IronMine.name, 
            outputResource: Resources.iron, 
            buildInputs: [[Resources.labourTime, 130], [Resources.wood, 50]],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class BogIronPit extends ResourceBuilding {
    static name = "bog iron pit";
    constructor(props) {
        super({name: BogIronPit.name, 
            outputResource: Resources.iron, 
            buildInputs: [[Resources.labourTime, 40], [Resources.wood, 20]],
            sizeJobsMultiplier: 4,
            maxSize: 2,
            startingProductivity: 1.35, 
            ...props
        })
    }
}

export class CoalMine extends ResourceBuilding {
    static name = "coal mine";
    constructor(props) {
        super({name: CoalMine.name, 
            outputResource: Resources.coal, 
            buildInputs: [[Resources.labourTime, 100], [Resources.wood, 50]],
            sizeJobsMultiplier: 3,
            maxSize: 4,
            startingProductivity: 1.35,
            ...props
        })
    }
}

export class CoalPit extends ResourceBuilding {
    static name = "coal pit";
    constructor(props) {
        super({name: CoalPit.name, 
            outputResource: Resources.coal, 
            buildInputs: [[Resources.labourTime, 30], [Resources.wood, 20]],
            sizeJobsMultiplier: 4,
            maxSize: 2,
            startingProductivity: 1.65, 
            ...props
        })
    }
}

export class PeatBog extends ResourceBuilding {
    static name = "peat bog";
    constructor(props) {
        super({name: PeatBog.name, 
            outputResource: Resources.coal, 
            buildInputs: [[Resources.labourTime, 30]],
            sizeJobsMultiplier: 3,
            maxSize: 2,
            ...props
        })
    }
}

export class Toolmaker extends ResourceBuilding {
    static name = "toolmaker";
    static ironBlacksmith = "Blacksmith (Iron)";
    static steelBlacksmith = "Blacksmith (Steel)";
    static upgrades = [   
        {
            name: Toolmaker.ironBlacksmith,
            newDisplayName: Toolmaker.ironBlacksmith,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stoneBricks, 25], [Resources.iron, 25]],
            changes: [[outputResourceChange, Resources.ironTools], [inputResourceChange, [{resource:Resources.iron, multiplier: 0.05}, {resource:Resources.coal, multiplier: 0.1}, {resource:Resources.wood, multiplier: 0.05}]]],
        },
        {
            name: Toolmaker.steelBlacksmith,
            newDisplayName: Toolmaker.steelBlacksmith,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stoneBricks, 25], [Resources.iron, 25]],
            changes: [[outputResourceChange, Resources.steelTools], [inputResourceChange, [{resource:Resources.iron, multiplier: 0.05}, {resource:Resources.coal, multiplier: 0.2}, {resource:Resources.wood, multiplier: 0.05}]]]
        }
    ];
    constructor(props) {
        super({name: Toolmaker.name, 
            outputResource: Resources.stoneTools, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 25], [Resources.stone, 20]],
            inputResources: [{resource:Resources.stone, multiplier: 0.05}, {resource:Resources.wood, multiplier: 0.05}],
            sizeJobsMultiplier: 2,
            upgrades: Toolmaker.upgrades,
            ...props
        })
    }
}

export class Bowyer extends ResourceBuilding {
    static name = "bowyer";
    constructor(props) {
        super({name: Bowyer.name, 
            outputResource: Resources.bows, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 25], [Resources.stone, 5]],
            inputResources: [{resource:Resources.wood, multiplier: 0.2}],
            sizeJobsMultiplier: 2,
            ...props
        })
    }
}

export class WeaponMaker extends ResourceBuilding {
    static name = "Stone Weapon Maker";
    static ironBlacksmith = "Military Blacksmith (Iron)";
    static steelBlacksmith = "Military Blacksmith (Steel)";
    static upgrades = [   
        {
            name: WeaponMaker.ironBlacksmith,
            newDisplayName: WeaponMaker.ironBlacksmith,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stoneBricks, 25], [Resources.iron, 25]],
            changes: [[outputResourceChange, Resources.ironWeaponry], [inputResourceChange, [{resource:Resources.iron, multiplier: 0.5}, {resource:Resources.coal, multiplier: 0.5}]]],
        },
        {
            name: WeaponMaker.steelBlacksmith,
            newDisplayName: WeaponMaker.steelBlacksmith,
            newBuildCost: [[Resources.labourTime, 50], [Resources.stoneBricks, 25], [Resources.iron, 25]],
            changes: [[outputResourceChange, Resources.steelWeaponry], [inputResourceChange, [{resource:Resources.iron, multiplier: 0.5}, {resource:Resources.coal, multiplier: 0.5}]]]
        }
    ];
    constructor(props) {
        super({name: WeaponMaker.name, 
            outputResource: Resources.stoneWeaponry, 
            buildInputs: [[Resources.labourTime, 25], [Resources.wood, 25], [Resources.stone, 20]],
            inputResources: [{resource:Resources.stone, multiplier: 0.2}, {resource:Resources.wood, multiplier: 0.15}],
            sizeJobsMultiplier: 2,
            upgrades: WeaponMaker.upgrades,
            ...props
        })
    }
}