import React from "react";
import UIBase from "../UIBase";
import { VariableModifier, multiplication } from "../UIUtils";
import { Farm } from "./building";
import Button from '@mui/material/Button';


export class ResearchBonus {
    constructor(props) {
        this.name = props.name;
    }
    activate() {
        throw Error("need an activation");
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
};

export class Research {
    constructor(props) {
        this.name = props.name;
        this.researchBonuses = props.researchBonuses;
        this.researchCost = props.researchCost;
        this.researched = false;
    }
};

export class ResearchComponent extends React.Component {
    constructor(props) {
        super(props);
        this.research = props.research;
    }
    render() {
        return <span>
            {this.research.name}
            <Button variant={this.research.researched ? "disabled" : "outlined"} onClick={() => this.props.activateResearch()} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>Research</Button>
        </span>
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
                researchCost: 350,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.05})],
            }),
            new Research({
                name: "3 field rotation",
                researchCost: 700,
                researchBonuses: [new SpecificResourceProductivityBonus({building: Farm.name, amount: 1.1})],
            })
        ]
    };
};