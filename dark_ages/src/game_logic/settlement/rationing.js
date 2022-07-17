import { Variable, VariableComponent, VariableModifier, addition, division, invLogit, multiplication, exponentiation } from "../UIUtils";
import { Resource, Resources } from "./resource";
import UIBase from '../UIBase';
import Button from '@mui/material/Button';
import { priority } from "../variable/modifier";



export function getBasePopDemands() { // Needs to be a funciton so that each settlement can have it's own
    const basePopDemands = {
        food: {
            resource: Resources.food,
            idealAmount: new Variable({name: "Ideal Food", startingValue: 1}),
            additiveHappiness: {
                coefficient: new Variable({name: "Additive Food Happiness Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Food Happiness Exp", startingValue: 1.25})
            },
            additiveHealth: {
                offsetProportion: -0.35,
                coefficient: new Variable({name: "Additive Food Health Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Food Health Exp", startingValue: 2})
            },
            multiplicativeHealth: {
                offset: 0.05,
                midpoint: new Variable({name: "Multiplicative Food Health S Curve Midpoint", startingValue: 0.3}),
                speed: 3
            },           
        },
        coal: {
            resource: Resources.coal,
            idealAmount: new Variable({name: "Ideal Coal", startingValue: 1.0}), // This should change with weather
            additiveHappiness: {
                coefficient: new Variable({name: "Additive Coal Happiness Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Additive Coal Happiness Exp", startingValue: 1.25})
            },
            multiplicativeHappiness: {
                offset: 0.5,
                exponent: new Variable({name: "Multiplicative Coal Happiness Exp", startingValue: 0.5})
            },
            additiveHealth: {
                offsetProportion: -0.35,
                coefficient: new Variable({name: "Additive Coal Health Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Coal Health Exp", startingValue: 2})
            },
            multiplicativeHealth: {
                offset: 0.3,
                midpoint: new Variable({name: "Multiplicative Coal Health S Curve Midpoint", startingValue: 0.25}),
                speed: 2.5
            },           
        },
        beer: {
            resource: Resources.beer,
            idealAmount: new Variable({name: "Ideal Beer", startingValue: 1}), // This should change with weather
            additiveHappiness: {
                coefficient: new Variable({name: "Additive Beer Happiness Coeff", startingValue: 0.3}),
                exponent: new Variable({name: "Additive Beer Happiness Exp", startingValue: 0.5})
            },
            additiveHealth: {
                coefficient: new Variable({name: "Additive Beer Health Coeff", startingValue: -0.12}),
                exponent: new Variable({name: "Additive Beer Health Exp", startingValue: 1.5})
            }        
        },
        medicinalHerbs: {
            resource: Resources.medicinalHerbs,
            idealAmount: new Variable({name: "Ideal Medicinal Herbs", startingValue: 1}), // This should change with weather
            additiveHealth: {
                coefficient: new Variable({name: "Additive Medicinal Herbs Health Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Additive Medicinal Herbs Health Exp", startingValue: 1.35})
            }        
        }
    };
    return basePopDemands;
}

function getModifierVariables(rationAchieved, idealAmount, modifierData) {
    let modifiers = [];
    if (modifierData.coefficient !== undefined && modifierData.exponent !== undefined ) {
        let offsetProportion = modifierData.offsetProportion || 0; // offsetProportion because it will be multiplied by coefficient
        modifiers.push(new VariableModifier({ type: addition, startingValue: offsetProportion}));
        modifiers.push(new VariableModifier({ type: addition,
            variable: new Variable({name: "Exponentiated demand prop", startingValue: 0, modifiers: [
                new VariableModifier({variable: rationAchieved, type:addition}),
                new VariableModifier({variable: idealAmount, type:division}),
                new VariableModifier({variable: modifierData.exponent, type:exponentiation})
            ]})
        }));
        modifiers.push(new VariableModifier({name: "Coefficient", type: multiplication, variable: modifierData.coefficient}));
    } else if (modifierData.offset !== undefined && modifierData.exponent !== undefined) {
        let expCoeff = 1 - modifierData.offset;
        modifiers.push(new VariableModifier({type: addition, variable: new Variable({name: `mult offset`,startingValue: modifierData.offset})}));
        modifiers.push(new VariableModifier({ type: addition,
            variable: new Variable({name: "Exponentiated demand prop", startingValue: 0, modifiers: [
                new VariableModifier({variable: rationAchieved, type:addition}),
                new VariableModifier({variable: idealAmount, type:division}),
                new VariableModifier({variable: modifierData.exponent, type:exponentiation}),
                new VariableModifier({variable: new Variable({name: "normalising for offset", startingValue: expCoeff}), type:multiplication, customPriority:99})
            ]})
        }));
    } else if (modifierData.offset !== undefined && modifierData.midpoint !== undefined && modifierData.speed !== undefined) {
        let expCoeff = 1 - modifierData.offset;
        modifiers.push(new VariableModifier({type: addition, variable: new Variable({name: `mult offset`,startingValue: modifierData.offset})}));
        modifiers.push(new VariableModifier({ type: addition,
            variable: new Variable({name: "S curve demand prop", startingValue: 0, modifiers: [
                new VariableModifier({variable: rationAchieved, type:addition}),
                new VariableModifier({variable: idealAmount, type:division}),
                new VariableModifier({variable: modifierData.midpoint, invLogitSpeed: modifierData.speed, type:invLogit, customPriority:priority.exponentiation + 5}),
                new VariableModifier({variable: new Variable({name: "normalising for offset", startingValue: expCoeff}), type:multiplication, customPriority:priority.exponentiation + 10})
            ]})
        }));
    } else {
        throw Error("dont recognise this formaat");
    }
    return modifiers;
}

export function applyRationingModifiers(rationAchieved, demand, health, happiness) {
    if (demand.additiveHappiness) {
        happiness.addModifier(new VariableModifier({type: addition, variable: new Variable({ name: `Happiness from ${demand.resource.name}`, startingValue: 0, 
            modifiers: getModifierVariables(rationAchieved, demand.idealAmount, demand.additiveHappiness)
        })}));
    }
    if (demand.multiplicativeHappiness) {
        happiness.addModifier(new VariableModifier({type: multiplication, variable: new Variable({ name: `Happiness. from ${demand.resource.name}`, startingValue: 0, 
            modifiers: getModifierVariables(rationAchieved, demand.idealAmount, demand.multiplicativeHappiness)
        })}));
    }
    if (demand.additiveHealth) {
        health.addModifier(new VariableModifier({type: addition, variable: new Variable({ name: `Health from ${demand.resource.name}`, startingValue: 0, 
            modifiers: getModifierVariables(rationAchieved, demand.idealAmount, demand.additiveHealth)
        })}));
    }
    if (demand.multiplicativeHealth) {
        health.addModifier(new VariableModifier({type: multiplication, variable: new Variable({ name: `Health from ${demand.resource.name}`, startingValue: 0, 
            modifiers: getModifierVariables(rationAchieved, demand.idealAmount, demand.multiplicativeHealth)
        })}));
    }
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