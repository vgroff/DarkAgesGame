import {AggregatorModifier, VariableModifier, Variable, Cumulator, addition, VariableComponent} from '../utils.js';
import Grid from  '@mui/material/Grid';
import React from 'react';
import UIBase from '../UIBase';
import {Farm, ResourceBuildingComponent} from './building.js'


export class Settlement {
    constructor(props) {
        this.name = props.name;
        this.tax = new Variable({owner: this, name:`tax`, startingValue: 0});
        this.gameClock = props.gameClock;
    }
}

export class SettlementComponent extends UIBase {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
        this.addVariables([this.settlement.tax]);
        this.buildings = [
            new Farm({startingSize: 3, productivityModifiers: []})
        ]
    }
    render() {
        return <Grid container spacing={2}>
        <Grid item xs={12}>
            <VariableComponent variable={this.settlement.tax} />
            <ResourceBuildingComponent building={this.buildings[0]}/>
        </Grid>
    </Grid>
    }
}

