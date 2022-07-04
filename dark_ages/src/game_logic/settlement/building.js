import {VariableModifier, Variable, addition, min, multiplication,division } from '../UIUtils.js';
import { titleCase, CustomTooltip } from '../utils.js';
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
        this.productivity = new Variable({owner: this, name:"productivity", startingValue: 1, modifiers:this.productivityModifiers});
        this.startingJobs = props.startingJobs || 0;
        this.sizeJobsMultiplier = props.sizeJobsMultiplier;
        if (!this.sizeJobsMultiplier) {
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
        this.filledJobs = new Variable({owner: this, name:"filled jobs", startingValue: 1, max: this.totalJobs, min: zero,
            modifiers:[]
        });
        this.productionModifiers = [
            new VariableModifier({name:"production from workers", startingValue:this.outputResource.productionRatio, type:addition, modifiers: [
                new VariableModifier({variable: this.filledJobs, type:multiplication}),
                new VariableModifier({variable: this.productivity, type:multiplication})
            ]})
        ];
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
        this.minPropDemandSatisfied = []
        this.inputResources.forEach((input, i) => {
            if (!input.resource || !input.multiplier) {
                throw Error("need this stuff");
            }
            let propDemandDesired = new Variable({name: "satisfied input resource demand", startingValue: 1,
                modifiers: []
            });
            self.propDemandsDesired.push(propDemandDesired);
            let resourceStorage = self.resourceStorages.find(resourceStorage => input.resource === resourceStorage.resource);
            self.propDemandsDesired.push(resourceStorage.addDemand(
                self.name,
                new Variable({ owner: self, name: `${resourceStorage.resource.name} demand from ${self.name}`,
                    startingValue: input.multiplier, modifiers: [
                        new VariableModifier({variable: self.totalProduction, type: multiplication}),
                        new VariableModifier({variable: self.efficiency, type: division})
                    ]
                }), 
                propDemandDesired,
                1)
            );
        });
        this.propDemandsDesired.forEach((demand, i) => {
            demand.setModifiers(self.propDemandsDesired.filter((_, j) => {return i !== j}).map(variable => {
                return new VariableModifier({variable: variable, type: min, customPriority: 5})
            }
        ))});
        this.minPropDemandSatisfied = new Variable({owner: this, name: "proportion of demand satisfied",startingValue: 1, 
            modifiers: self.propDemandsDesired.map(demandSatisfied => {
                return new VariableModifier({variable: demandSatisfied, type: min, customPriority: 5});
            })
        })
        // add these to actual Production
        let productionModifiers = [
            new VariableModifier({variable: this.theoreticalProduction,type: addition})
        ];
        productionModifiers.push(new VariableModifier({variable: this.minPropDemandSatisfied,type: multiplication}))
        this.totalProduction.setModifiers(productionModifiers);
    
    }
    setNewFilledJobs(villagers) {
        this.filledJobs.setNewBaseValue(villagers, "Set by leader");
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
        return <Grid container spacing={0.5} style={{border:"2px solid #2196f3", borderRadius:"7px", alignItems: "center", justifyContent: "center"}} >
        <Grid item xs={9}>
            <CustomTooltip items={this.toolTipVars} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                <span onClick={()=>{Logger.setInspect(this.building)}}>{titleCase(this.building.name)} {this.building.filledJobs.currentValue}/{this.building.totalJobs.currentValue}</span>
            </CustomTooltip>
        </Grid>
        <Grid item xs={3} style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"} onClick={() => this.props.addWorkers(1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
            <Button variant={"outlined"} onClick={() => this.props.addWorkers(-1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>
        </Grid>
        <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"}  sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Build</Button>
        </Grid>
        <Grid item xs={6} style={{textAlign:"center", padding: "2px",alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"}  sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Demolish</Button>
        </Grid>
        <Grid item xs={12} style={{textAlign:"center",  padding: "2px", minWidth:"100%", maxWidth: "100%", alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"} sx={{fontSize: 12, minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Upgrade</Button>
        </Grid>
        </Grid>
    }
}

export class Farm extends ResourceBuilding {
    constructor(props) {
        super({name: "farm", 
            outputResource: Resources.food, 
            productionRatio: 1.05, 
            sizeJobsMultiplier: 5,
            ...props
        })
    }
}

export class HuntingCabin extends ResourceBuilding {
    constructor(props) {
        super({name: "hunter's cabin", 
            outputResource: Resources.food, 
            productionRatio: 1.35, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class LumberjacksHut extends ResourceBuilding {
    constructor(props) {
        super({name: "lumberjack's hut", 
            outputResource: Resources.wood, 
            productionRatio: 1.0, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class CharcoalKiln extends ResourceBuilding {
    constructor(props) {
        super({name: "charcoal kiln", 
            outputResource: Resources.coal, 
            productionRatio: 1.0, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class Quarry extends ResourceBuilding {
    constructor(props) {
        super({name: "quarry", 
            outputResource: Resources.stone, 
            productionRatio: 1.0, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}

export class Stonecutters extends ResourceBuilding {
    constructor(props) {
        super({name: "Stonecutter's workshop", 
            outputResource: Resources.stoneBricks, 
            inputResources: [{resource:Resources.stone, multiplier: 2}],
            productionRatio: 1.0, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}