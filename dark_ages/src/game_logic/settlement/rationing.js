import { Variable, VariableComponent, VariableModifier, addition, division, invLogit, roundTo, multiplication, exponentiation } from "../UIUtils";
import { Resource, Resources } from "./resource";
import UIBase from '../UIBase';
import Button from '@mui/material/Button';
import { priority } from "../variable/modifier";



export function getBasePopDemands() { // Needs to be a funciton so that each settlement can have it's own
    const basePopDemands = {
        food: {
            resource: Resources.food,
            idealAmount: new Variable({name: "Ideal Food", startingValue: 1}),
            effects: [{
                type:addition,
                on: "happiness",
                coefficient: new Variable({name: "Additive Food Happiness Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Food Happiness Exp", startingValue: 1.25})
            },
            {
                type:addition,
                on: "health",
                offsetProportion: -0.35,
                coefficient: new Variable({name: "Additive Food Health Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Food Health Exp", startingValue: 2})
            },
            {
                type:multiplication,
                on: "health",
                offset: 0.05,
                midpoint: new Variable({name: "Multiplicative Food Health S Curve Midpoint", startingValue: 0.3}),
                speed: 3
            }]           
        },
        mudHuts: {
            resource: Resources.mudHuts,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Housing", startingValue: 1.0}), 
            effects: [],
        },
        woodenHuts: {
            resource: Resources.woodenHuts,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Housing", startingValue: 1.0}), 
            effects: [{
                on: "happiness",
                type: addition,
                coefficient: new Variable({name: "Wooden Huts Happiness Coeff", startingValue: 0.15}),
                exponent: new Variable({name: "Wooden Huts Coal Happiness Exp", startingValue: 1.5})
            }],
        },
        brickHouses: {
            resource: Resources.brickHouses,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Housing", startingValue: 1.0}), 
            effects: [{
                on: "happiness",
                type: addition,
                coefficient: new Variable({name: "Brick Houses Happiness Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Brick Houses Coal Happiness Exp", startingValue: 1.5})
            } ],
        },
        coal: {
            resource: Resources.coal,
            idealAmount: new Variable({name: "Ideal Coal", startingValue: 1.0}), // This should change with weather
            effects: [{
                type:addition,
                on: "happiness",
                coefficient: new Variable({name: "Additive Coal Happiness Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Additive Coal Happiness Exp", startingValue: 1.25})
            },
            {
                type:multiplication,
                on: "happiness",
                offset: 0.5,
                exponent: new Variable({name: "Multiplicative Coal Happiness Exp", startingValue: 0.5})
            },
            {
                type:addition,
                on: "health",
                offsetProportion: -0.35,
                coefficient: new Variable({name: "Additive Coal Health Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Coal Health Exp", startingValue: 2})
            },
            {
                type:multiplication,
                on: "health",
                offset: 0.3,
                midpoint: new Variable({name: "Multiplicative Coal Health S Curve Midpoint", startingValue: 0.25}),
                speed: 2.5
            }],           
        },
        beer: {
            resource: Resources.beer,
            idealAmount: new Variable({name: "Ideal Beer", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "happiness",
                coefficient: new Variable({name: "Additive Beer Happiness Coeff", startingValue: 0.3}),
                exponent: new Variable({name: "Additive Beer Happiness Exp", startingValue: 0.5})
            },
            {
                type:addition,
                on: "health",
                coefficient: new Variable({name: "Additive Beer Health Coeff", startingValue: -0.12}),
                exponent: new Variable({name: "Additive Beer Health Exp", startingValue: 1.5})
            }]      
        },
        medicinalHerbs: {
            resource: Resources.medicinalHerbs,
            idealAmount: new Variable({name: "Ideal Medicinal Herbs", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "health",
                coefficient: new Variable({name: "Additive Medicinal Herbs Health Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Additive Medicinal Herbs Health Exp", startingValue: 1.35})
            }]      
        },
        dirtPathAccess: {
            resource: Resources.dirtPathAccess,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Dirt Path Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Road Productivity Coeff", startingValue: 0.05}),
                exponent: new Variable({name: "Additive Road Productivity  Exp", startingValue: 0.75})
            },{
                type:addition,
                on: "tradeFactor",
                coefficient: new Variable({name: "Additive Road Trade Factor Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Road Trade Factor  Exp", startingValue: 0.4})
            }]
        },
        gravelPathAccess: {
            resource: Resources.gravelPathAccess,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Gravel Path Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Road Productivity Coeff", startingValue: 0.125}),
                exponent: new Variable({name: "Additive Road Productivity  Exp", startingValue: 0.75})
            },{
                type:addition,
                on: "tradeFactor",
                coefficient: new Variable({name: "Additive Road Trade Factor Coeff", startingValue: 0.35}),
                exponent: new Variable({name: "Additive Road Trade Factor  Exp", startingValue: 0.4})
            }]
        },
        brickRoadAccess: {
            resource: Resources.brickRoadAccess,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Brick Road Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Road Productivity Coeff", startingValue: 0.2}),
                exponent: new Variable({name: "Additive Road Productivity  Exp", startingValue: 0.75})
            },{
                type:addition,
                on: "tradeFactor",
                coefficient: new Variable({name: "Additive Road Trade Factor Coeff", startingValue: 0.5}),
                exponent: new Variable({name: "Additive Road Trade Factor  Exp", startingValue: 0.4})
            }] 
        },
        stoneTools: {
            resource: Resources.stoneTools,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Tools Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Tools Productivity Coeff", startingValue: 0.15}),
                exponent: new Variable({name: "Additive Tools Productivity  Exp", startingValue: 0.8})
            }] 
        },
        ironTools: {
            resource: Resources.ironTools,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Tools Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Tools Productivity Coeff", startingValue: 0.25}),
                exponent: new Variable({name: "Additive Tools Productivity  Exp", startingValue: 0.8})
            }] 
        },
        steelTools: {
            resource: Resources.steelTools,
            alwaysFullRations: true,
            idealAmount: new Variable({name: "Ideal Tools Access", startingValue: 1}), // This should change with weather
            effects: [{
                type:addition,
                on: "productivity",
                coefficient: new Variable({name: "Additive Tools Productivity Coeff", startingValue: 0.35}),
                exponent: new Variable({name: "Additive Tools Productivity  Exp", startingValue: 0.8})
            }] 
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
    modifiers.push(new VariableModifier({type: roundTo, startingValue: 3, customPriority: 200}));
    return modifiers;
}

export function applyRationingModifiers(rationAchieved, demand, health, happiness, productivity, tradeFactor) {
    demand.effects.forEach(effect => {
        if (effect.on === "happiness") {
            happiness.addModifier(new VariableModifier({type: effect.type, variable: new Variable({ name: `Happiness from ${demand.resource.name}`, startingValue: 0, 
                modifiers: getModifierVariables(rationAchieved, demand.idealAmount, effect)
            })}));
        } else if (effect.on === "health") {
            health.addModifier(new VariableModifier({type: effect.type, variable: new Variable({ name: `Health from ${demand.resource.name}`, startingValue: 0, 
                modifiers: getModifierVariables(rationAchieved, demand.idealAmount, effect)
            })}));
        } else if (effect.on === "productivity") {
            productivity.addModifier(new VariableModifier({type: effect.type, variable: new Variable({ name: `Productivity from ${demand.resource.name}`, startingValue: 0, 
                modifiers: getModifierVariables(rationAchieved, demand.idealAmount, effect)
            })}));
        } else if (effect.on === "tradeFactor") {
            tradeFactor.addModifier(new VariableModifier({type: effect.type, variable: new Variable({ name: `Trade Factor from ${demand.resource.name}`, startingValue: 0, 
                modifiers: getModifierVariables(rationAchieved, demand.idealAmount,effect)
            })}));
        } else {
            throw Error("effect on not recognised");
        }
    });
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