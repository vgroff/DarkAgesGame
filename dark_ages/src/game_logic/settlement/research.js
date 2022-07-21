import React from "react";
import UIBase from "../UIBase";
import { VariableModifier, multiplication } from "../UIUtils";
import { Farm, LumberjacksHut } from "./building";
import Button from '@mui/material/Button';
import { titleCase, CustomTooltip, roundNumber } from '../utils.js';


export class ResearchBonus {
    constructor(props) {
        this.name = props.name;
    }
    activate() {
        throw Error("need an activation");
    }
    getEffect() {
        throw Error("you forgot to define this on the subclass");
    }
};

export class SettlementResearchBonus extends ResearchBonus {
    activate(settlement) {
        throw Error("need an activation");
    }
};

export class GeneralProductivityBonus extends SettlementResearchBonus {
    constructor(props) {
        props.name = "productivity bonus";
        super(props);
        this.amount = props.amount;
    }
    activate(settlement) {
        settlement.generalProductivity.addModifier(new VariableModifier({startingValue: this.amount, name: this.name, type: multiplication}));
    }
    getEffectText() {
        let percentage = `${roundNumber((this.amount - 1)*100, 1)}`
        return `Increase general productivity by ${percentage}%`;
    }
};

export class SpecificResourceProductivityBonus extends SettlementResearchBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = `${this.buildingName} productivity bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.productivity.addModifier(new VariableModifier({startingValue: this.amount, name: this.name, type: multiplication}));
            }
        }
    }
    getEffectText() {
        let percentage = `${roundNumber((this.amount - 1)*100, 1)}`
        return `Increase productivity of ${this.buildingName} by ${percentage}%`;
    }
};

export class Research {
    constructor(props) {
        this.name = props.name;
        this.researchBonuses = props.researchBonuses;
        this.researchCost = props.researchCost;
        this.researched = false;
    }
    getEffectList() {
        let effectList = []
        for (const researchBonus of this.researchBonuses) {
            effectList.push(researchBonus.getEffectText());
        }
        return effectList;
    }
};

export class ResearchComponent extends React.Component {
    constructor(props) {
        super(props);
        this.research = props.research;
    }
    render() {
        let costText = this.research.researched ? '' : `\nCosts ${this.research.researchCost} research`;
        return <CustomTooltip items={this.research.getEffectList().concat([costText])}>
            <span>
                {titleCase(this.research.name)}
                <Button variant={this.props.canResearch ? "outlined" : this.research.researched ? "contained disabled" : "disabled"} onClick={() => this.props.activateResearch()} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>
                    {this.research.researched ? 'Researched' : 'Research'}
                </Button>
            </span>
        </CustomTooltip>
    }
};

export function createResearchTree() {
    return {
        agriculture: [
            new Research({
                name: "Larger Ploughs",
                researchCost: 100,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.02})],
            }),
            new Research({
                name: "Heavy Ploughs",
                researchCost: 200,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.03})],
            }),
            new Research({
                name: "Better irrigation",
                researchCost: 450,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.05})],
            }),
            new Research({
                name: "3 field rotation",
                researchCost: 700,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.1})],
            })
        ],
        woodcutting: [
            new Research({
                name: "Larger Axes",
                researchCost: 100,
                researchBonuses: [new SpecificResourceProductivityBonus({building: LumberjacksHut.name, amount: 1.1})],
            }),
            new Research({
                name: "Better Axes",
                researchCost: 200,
                researchBonuses: [new SpecificResourceProductivityBonus({building: LumberjacksHut.name, amount: 1.1})],
            }),
            new Research({
                name: "Saws",
                researchCost: 350,
                researchBonuses: [new SpecificResourceProductivityBonus({building: LumberjacksHut.name, amount: 1.2})],
            }),
            new Research({
                name: "Advanced Saws",
                researchCost: 350,
                researchBonuses: [new SpecificResourceProductivityBonus({building: LumberjacksHut.name, amount: 1.2})],
            })
        ],
        productivity: [
            new Research({
                name: "Basic Administration",
                researchCost: 150,
                researchBonuses: [new GeneralProductivityBonus({bamount: 1.02})],
            }),
            new Research({
                name: "Productivity Incentives",
                researchCost: 400,
                researchBonuses: [new GeneralProductivityBonus({amount: 1.03})],
            }),
            new Research({
                name: "Record Keeping",
                researchCost: 500,
                researchBonuses: [new GeneralProductivityBonus({amount: 1.03})],
            })
        ]
    };
};