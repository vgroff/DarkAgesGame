import {VariableModifier, Variable, addition, multiplication, } from '../UIUtils.js';
import { titleCase, CustomTooltip } from '../utils.js';
import React from 'react';
import UIBase from '../UIBase';
import {Resources} from './resource.js'
import Box from '@mui/material/Box';
import Grid from  '@mui/material/Grid';
import Button from '@mui/material/Button';


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
        this.resource = props.resource;
        this.productionRatio = props.productionRatio;
        if (!this.productionRatio) {
            throw Error('Need a production ratio');
        }
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
        this.filledJobs = new Variable({owner: this, name:"filled jobs", startingValue: 3, max: this.totalJobs,
            modifiers:[]
        });
        this.productionModifiers = [
            new VariableModifier({name:"from workers", startingValue:this.productionRatio, type:addition, modifiers: [
                new VariableModifier({variable: this.filledJobs, type:multiplication}),
                new VariableModifier({variable: this.productivity, type:multiplication})
            ]})
        ];
        this.production = new Variable({owner: this, name:"production",
            modifiers:this.productionModifiers
        });
    }
}

export class ResourceBuildingComponent extends UIBase {
    constructor(props) {
        super(props);
        this.building = props.building;
        this.toolTipVars = [
            this.building.size,
            this.building.production
        ]
        this.addVariables([this.building.filledJobs,this.building.totalJobs,...this.toolTipVars]);
    }
    childRender() {
        return <Grid container justifyContent="center" alignItems="center" spacing={0.5} style={{border:"2px solid black", alignItems: "center", justifyContent: "center"}} >
        <Grid item xs={9}>
            <CustomTooltip items={this.toolTipVars} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                <span>{titleCase(this.building.name)} {this.building.filledJobs.currentValue}/{this.building.totalJobs.currentValue}</span>
            </CustomTooltip>
        </Grid>
        <Grid item xs={3} style={{textAlign:"center", alignItems: "center", justifyContent: "center"}}>
            <Button variant={"outlined"}  sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
            <Button variant={"outlined"} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>
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
            resource: Resources.food, 
            productionRatio: 1.03, 
            sizeJobsMultiplier: 5,
            ...props
        })
    }
}

export class LumberjacksHut extends ResourceBuilding {
    constructor(props) {
        super({name: "lumberjack's hut", 
            resource: Resources.wood, 
            productionRatio: 1.0, 
            sizeJobsMultiplier: 3,
            ...props
        })
    }
}