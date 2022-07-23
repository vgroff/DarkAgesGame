import React from "react";
import UIBase from "../UIBase";
import { VariableModifier, multiplication } from "../UIUtils";
import { Apothecary, Brewery, Farm, LumberjacksHut, Quarry, Stonecutters, Roads, CharcoalKiln } from "./building";
import {Grid, Button} from '@mui/material';
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

export class SpecificBuildingProductivityBonus extends SettlementResearchBonus {
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

export class SpecificBuildingEfficiencyBonus extends SettlementResearchBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = `${this.buildingName} efficiency bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.efficiency.addModifier(new VariableModifier({startingValue: this.amount, name: this.name, type: multiplication}));
            }
        }
    }
    getEffectText() {
        let percentage = `${roundNumber((this.amount - 1)*100, 1)}`
        return `Increase efficiency of ${this.buildingName} by ${percentage}%`;
    }
};

export class UnlockBuildingBonus extends SettlementResearchBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = `unlock ${this.buildingName}`;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.unlocked = true;
            }
        }
    }
    getEffectText() {
        return `Unlock ${this.buildingName}`;
    }
};

export class UnlockBuildingUpgradeBonus extends SettlementResearchBonus {
    constructor(props) {
        super(props);
        this.upgradeName = props.upgrade;
        this.buildingName = props.building;
        this.name = `${props.upgrade}`;
    }
    activate(settlement) {
        let building = settlement.resourceBuildings.find(building => building.name === this.buildingName)
        let upgrade = building.upgrades.find(upgrade => upgrade.name === this.upgradeName)
        upgrade.unlocked = true;
    }
    getEffectText() {
        return `Unlock building upgrade ${this.upgradeName}`;
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
            <Grid container justifyContent="center" alignItems="center"  style={{alignItems: "center", justifyContent: "center"}} >
                <Grid item xs={8}>
                    {titleCase(this.research.name)}
                </Grid>
                <Grid item xs={4}>
                    <Button variant={this.props.canResearch ? "outlined" : this.research.researched ? "contained disabled" : "disabled"} onClick={() => this.props.activateResearch()} sx={{fontSize: 12,  minWidth:"100%", maxWidth: "100%", minHeight: "100%", maxHeight: "100%"}}>
                        {this.research.researched ? 'Researched' : 'Research'}
                    </Button>
                </Grid>
            </Grid>
        </CustomTooltip>
    }
};

export function createResearchTree() {
    return {
        agriculture: [
            new Research({
                name: "Larger Plough",
                researchCost: 100,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.03})],
            }),
            new Research({
                name: "Selective Breeding",
                researchCost: 200,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.03})],
            }),
            new Research({
                name: "Heavy Plough",
                researchCost: 200,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.03})],
            }),
            new Research({
                name: "Better irrigation",
                researchCost: 450,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.05})],
            }),
            new Research({
                name: "3 field rotation",
                researchCost: 700,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.1})],
            })
        ],
        woodcutting: [
            new Research({
                name: "Larger Axes",
                researchCost: 100,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.1})],
            }),
            new Research({
                name: "Better Axes",
                researchCost: 200,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.1})],
            }),
            new Research({
                name: "Saws",
                researchCost: 350,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.2})],
            }),
            new Research({
                name: "Advanced Saws",
                researchCost: 350,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.2})],
            })
        ],
        charcoal: [
            new Research({
                name: "Larger Kilns",
                researchCost: 100,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: CharcoalKiln.name, amount: 1.1})],
            }),
            new Research({
                name: "Using the shavings",
                researchCost: 200,
                researchBonuses: [new SpecificBuildingEfficiencyBonus({building: CharcoalKiln.name, amount: 1.1})],
            })
        ],
        brewing: [
            new Research({
                name: "Brewing",
                researchCost: 35,
                researchBonuses: [new UnlockBuildingBonus({building: Brewery.name})],
            }),
            new Research({
                name: "Ageing",
                researchCost: 150,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Brewery.name, amount: 1.35})],
            }),
            new Research({
                name: "Improved Barrels",
                researchCost: 300,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Brewery.name, amount: 1.1})],
            })
        ],
        health: [
            new Research({
                name: "Apothecary",
                researchCost: 35,
                researchBonuses: [new UnlockBuildingBonus({building: Apothecary.name})],
            })
        ],
        roads: [
            new Research({
                name: "Gravel Paths",
                researchCost: 150,
                researchBonuses: [new UnlockBuildingUpgradeBonus({building: Roads.name, upgrade:  Roads.gravelPath,})],
            }), new Research({
                name: "Brick Roads",
                researchCost: 350,
                researchBonuses: [new UnlockBuildingUpgradeBonus({building: Roads.name,  upgrade: Roads.brickRoads,})],
            }) // Should I change the output resource? Maybe don't show resources that have no buildings on the GUI
        ],
        stonework: [
            new Research({
                name: "Quarrying",
                researchCost: 50,
                researchBonuses: [new UnlockBuildingBonus({building: Quarry.name})],
            }),
            new Research({
                name: "Stonecutting",
                researchCost: 250,
                researchBonuses: [new UnlockBuildingBonus({building: Stonecutters.name})],
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
        ],
    };
};