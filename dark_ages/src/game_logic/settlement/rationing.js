import { Variable, VariableComponent } from "../UIUtils";
import { Resource, Resources } from "./resource";
import UIBase from '../UIBase';
import Button from '@mui/material/Button';



export function getBasePopDemands() { // Needs to be a funciton so that each settlement can have it's own
    const basePopDemands = {
        food: {
            resource: Resources.food,
            idealAmount: new Variable({name: "Ideal Food", startingValue: 1}),
            additiveHappiness: {
                coefficient: new Variable({name: "Additive Food Happiness Coeff", startingValue: 0.3}),
                exponent: new Variable({name: "Additive Food Happiness Exp", startingValue: 1.25})
            },
            additiveHealth: {
                coefficient: new Variable({name: "Additive Food Health Coeff", startingValue: 0.1}),
                exponent: new Variable({name: "Additive Food Health Exp", startingValue: 2})
            },
            multiplicativeHealth: {
                offset: 0,
                exponent: new Variable({name: "Multiplicative Food Health Exp", startingValue: 1})
            },           
        },
        coal: {
            resource: Resources.coal,
            idealAmount: new Variable({name: "Ideal Coal", startingValue: 1}), // This should change with weather
            additiveHappiness: {
                coefficient: new Variable({name: "Additive Coal Happiness Coeff", startingValue: 0.3}),
                exponent: new Variable({name: "Additive Coal Happiness Exp", startingValue: 1.25})
            },
            multiplicativeHappiness: {
                offset: 0.5,
                exponent: new Variable({name: "Multiplicative Coal Happiness Exp", startingValue: 0.5})
            },
            additiveHealth: {
                coefficient: new Variable({name: "Additive Coal Health Coeff", startingValue: 0.1}),
                exponent: new Variable({name: "Additive Coal Health Exp", startingValue: 2})
            },
            multiplicativeHealth: {
                offset: 0.5, // This should change with weather, could make it a variable and manually subscribe?
                exponent: new Variable({name: "Multiplicative Coal Health Exp", startingValue: 0.5})
            },           
        }
    };
    return basePopDemands;
}

export class RationingComponent extends UIBase {
    constructor(props){
        super(props);
        this.demandedRation = props.demandedRation;
        this.recievedRation = props.recievedRation;
        this.idealRation = props.idealRation;
        this.addVariables([props.demandedRation, props.recievedRation])
    }
    childRender() {
        return <span style={{alignItems: "center", justifyContent: "center"}}>
            <div>
            <VariableComponent variable={this.idealRation} /><br/>
            <VariableComponent variable={this.demandedRation} /><br/>
            <VariableComponent variable={this.recievedRation} /><br/>
            </div>
            <Button variant={"outlined"} onClick={(e) => this.props.addRations(e, 1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
            <Button variant={"outlined"} onClick={(e) => this.props.addRations(e, -1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>
        </span>
    }
}