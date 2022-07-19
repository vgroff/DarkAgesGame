import {VariableModifier, Variable, addition, subtraction, min, multiplication,division } from '../UIUtils.js';
import { titleCase, CustomTooltip, roundNumber } from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';
import {Resources} from './resource.js'
import Box from '@mui/material/Box';
import Grid from  '@mui/material/Grid';
import Button from '@mui/material/Button';
import {Logger} from '../logger.js';


export class Building {
    constructor(props) {
        this.name = props.name;
        this.startingSize = props.startingSize || 0;
        this.size = new Variable({owner: this, name:"building size", startingValue: this.startingSize, modifiers:[]});
        this.buildInputs = props.buildInputs;
    }
    canBuild(resourceStorages) {
        for (const inputResource of this.buildInputs) {
            let resourceStorage = resourceStorages.find(r => r.resource === inputResource[0]);
            if (resourceStorage.amount.currentValue < inputResource[1]) {
                return false;
            }
        }
        return true;
    }
    getBuildText(resourceStorages) {
        let buildText = ['Will increase size by 1'];
        for (const inputResource of this.buildInputs) {
            let resourceStorage = resourceStorages.find(r => r.resource === inputResource[0]);
            if (resourceStorage.amount.currentValue < inputResource[1]) {
                buildText.push(`\nneed another ${roundNumber(inputResource[1] - resourceStorage.amount.currentValue, 3)} ${inputResource[0].name}`);
            }
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
}

export class ResourceBuilding extends Building {
    constructor(props) {
        super(props);
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
        let zero = new Variable({startingValue: 0});
        this.filledJobs = new Variable({owner: this, name:"filled jobs", startingValue: props.startingFilledJobs || 0, max: this.totalJobs, min: zero,
            modifiers:[]
        });
        this.emptyJobs = new Variable({owner: this, name:"empty jobs", startingValue: 0, max: this.totalJobs, min: zero,
            modifiers:[
                new VariableModifier({variable: this.totalJobs, type:addition}),
                new VariableModifier({variable: this.filledJobs, type:subtraction})
            ]
        });
        this.productionModifiers = [
            new VariableModifier({name:"production from workers", owner: this, startingValue:this.outputResource.productionRatio, type:addition, modifiers: [
                new VariableModifier({variable: this.filledJobs, type:multiplication}),
                new VariableModifier({variable: this.productivity, type:multiplication})
            ]})
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
        this.inputResources = props.inputResources || [];
        var self = this;
        this.propDemandsDesired = [];
        this.propDemandsSatisfied = []
        this.inputResources.forEach((input, i) => {
            if (!input.resource || !input.multiplier) {
                throw Error("need this stuff");
            }
            let propDemandDesired = new Variable({name: "satisfied input resource demand", startingValue: 1,
                modifiers: []
            });
            self.propDemandsDesired.push(propDemandDesired);
            let resourceStorage = self.resourceStorages.find(resourceStorage => input.resource === resourceStorage.resource);
            self.propDemandsSatisfied.push(resourceStorage.addDemand(
                self.name,
                new Variable({ owner: self, name: `${resourceStorage.resource.name} demand from ${self.name}`,
                    startingValue: input.multiplier, modifiers: [
                        new VariableModifier({variable: self.theoreticalProduction, type: multiplication}),
                        new VariableModifier({variable: self.efficiency, type: division})
                    ]
                }), 
                propDemandDesired,
                1)
            );
        });
        this.propDemandsDesired.forEach((demand, i) => {
            demand.setModifiers(self.propDemandsSatisfied.filter((_, j) => {return i !== j}).map(variable => {
                return new VariableModifier({variable: variable, type: min, customPriority: 5})
            }
        ))}); // Limit the demand on all inputs by the min of the others to avoid waste
        this.minPropDemandSatisfied = new Variable({owner: this, name: "proportion of demand satisfied",startingValue: 1, 
            modifiers: self.propDemandsSatisfied.map(demandSatisfied => {
                return new VariableModifier({variable: demandSatisfied, type: min, customPriority: 5});
            })
        }); // Limit the production by the min of the inputs
        let productionModifiers = [
            new VariableModifier({variable: this.theoreticalProduction,type: addition})
        ];
        productionModifiers.push(new VariableModifier({variable: this.minPropDemandSatisfied,type: multiplication}))
        this.totalProduction.setModifiers(productionModifiers);
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
}

export class ResourceBuildingComponent extends UIBase {
    constructor(props) {
        super(props);
        this.building = props.building;
        this.toolTipVars = [
            this.building.size,
            this.building.totalProduction
        ]
        this.addVariables([this.building.filledJobs,this.building.totalJobs,...this.toolTipVars]);
    }
    childRender() {
        let extraStyle = {};
        let extraVars = [];
        if (this.building.alerts.length > 0) {
            extraStyle = {"color": "red"}
            this.building.alerts.forEach(alert => {
                extraVars.push({text: alert, style: extraStyle})
            })
        }
        return <Grid container spacing={0.5} style={{border:"2px solid #2196f3", borderRadius:"7px", alignItems: "center", justifyContent: "center"}} >
        <Grid item xs={9}>
            <CustomTooltip items={this.toolTipVars.concat(extraVars)} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                <span style={extraStyle} onClick={()=>{Logger.setInspect(this.building)}}>{titleCase(this.building.name)} {this.building.sizeJobsMultiplier ? <span>{this.building.filledJobs.currentValue}/{this.building.totalJobs.currentValue}</span> : ''} </span>
            </CustomTooltip>
        </Grid>
        <Grid item xs={3} style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"} onClick={(e) => this.props.addWorkers(e, 1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
            <Button variant={"outlined"} onClick={(e) => this.props.addWorkers(e, -1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>
        </Grid>
        <CustomTooltip items={this.props.buildText} style={{textAlign: "left"}}>
        <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
                <Button variant={this.props.canBuild ? "outlined" : "disabled"} onClick={(e) => this.props.addToBuildingSize(e, 1)} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Build</Button>
        </Grid>
        </CustomTooltip>
        <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"} onClick={(e) => this.props.addToBuildingSize(e, -1)} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Demolish</Button>
        </Grid>
        <Grid item xs={12} style={{textAlign:"center",  padding: "2px", minWidth:"100%", maxWidth: "100%", alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"} sx={{fontSize: 12, minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Upgrade</Button>
        </Grid>
        </Grid>
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
            ...props
        })
    }
}

export class Housing extends ResourceBuilding {
    static name = "housing";
    constructor(props) {
        super({name: Housing.name, 
            outputResource: Resources.housing, 
            buildInputs: [[Resources.labourTime, 50], [Resources.wood, 100]],
            sizeJobsMultiplier: 0,
            passiveProductionPerSize: 10,
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
            inputResources: [{resource:Resources.wood, multiplier: 0.25}],
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
            inputResources: [{resource:Resources.stone, multiplier: 2}],
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}