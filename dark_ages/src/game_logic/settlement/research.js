import React from "react";
import UIBase from "../UIBase";
import { VariableModifier, multiplication } from "../UIUtils";
import { Apothecary, Brewery, Farm, LumberjacksHut, Quarry, Stonecutters, Roads, CharcoalKiln, IronMine, BogIronPit, Toolmaker, Housing, Church, Tavern, CoalMine, CoalPit, WeaponMaker } from "./building";
import {Grid, Button} from '@mui/material';
import { titleCase, CustomTooltip, roundNumber } from '../utils.js';
import { GeneralProductivityBonus, SpecificBuildingProductivityBonus, SpecificBuildingEfficiencyBonus, UnlockBuildingBonus, UnlockBuildingUpgradeBonus, SpecificBuildingMaxSizeBonus } from "./bonus";



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
        housing: [
            new Research({
                name: "Wooden Huts",
                researchCost: 75,
                researchBonuses: [new UnlockBuildingUpgradeBonus({building: Housing.name, upgrade:  Housing.woodenHuts,})],
            }), new Research({
                name: "Brick Houses",
                researchCost: 250,
                researchBonuses: [new UnlockBuildingUpgradeBonus({building: Housing.name,  upgrade: Housing.brickHouses,})],
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
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Brewery.name, amount: 1.3})],
            }),
            new Research({
                name: "Improved Barrels",
                researchCost: 300,
                researchBonuses: [new SpecificBuildingProductivityBonus({building: Brewery.name, amount: 1.2})],
            })
        ],
        services: [
            new Research({
                name: "Tavern",
                researchCost: 100,
                researchBonuses: [new UnlockBuildingBonus({building: Tavern.name})],
            }),
            new Research({
                name: "Church Architecture",
                researchCost: 200,
                researchBonuses: [new UnlockBuildingBonus({building: Church.name})],
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
        mining: [
            new Research({
                name: "Quarrying",
                researchCost: 50,
                researchBonuses: [new UnlockBuildingBonus({building: Quarry.name})],
            }),
            new Research({
                name: "Stonecutting",
                researchCost: 100,
                researchBonuses: [new UnlockBuildingBonus({building: Stonecutters.name})],
            }),
            new Research({
                name: "Surface Mining",
                researchCost: 150,
                researchBonuses: [new UnlockBuildingBonus({building: BogIronPit.name}), new UnlockBuildingBonus({building: CoalPit.name})],
            }),
            new Research({
                name: "Deep Mining",
                researchCost: 200,
                researchBonuses: [new UnlockBuildingBonus({building: IronMine.name}), new UnlockBuildingBonus({building: CoalMine.name})],
            }),
            new Research({
                name: "Deeper Mining",
                researchCost: 400,
                researchBonuses: [new SpecificBuildingMaxSizeBonus({building: CoalMine.name, amount: 4})],
            }),
            new Research({
                name: "Deepest Mining",
                researchCost: 600,
                researchBonuses: [new SpecificBuildingMaxSizeBonus({building: CoalMine.name, amount: 4})],
            }),
        ],
        tools: [
            new Research({
                name: "Stone Tools",
                researchCost: 100,
                researchBonuses: [new UnlockBuildingBonus({building: Toolmaker.name})],
            }),
            new Research({
                name: "Iron Tools",
                researchCost: 350,
                researchBonuses: [new UnlockBuildingUpgradeBonus({upgrade: Toolmaker.ironBlacksmith, building: Toolmaker.name})],
            }),
            new Research({
                name: "Steel Tools",
                researchCost: 500,
                researchBonuses: [new UnlockBuildingUpgradeBonus({upgrade: Toolmaker.steelBlacksmith, building: Toolmaker.name})],
            })         
        ],
        military: [
            new Research({
                name: "Stone Weaponry",
                researchCost: 30,
                researchBonuses: [new UnlockBuildingBonus({building: WeaponMaker.name})],
            }),
            new Research({
                name: "Bowyery and Fletching",
                researchCost: 100,
                researchBonuses: [new UnlockBuildingBonus({building: WeaponMaker.name})],
            }),
            new Research({
                name: "Iron Weaponry",
                researchCost: 300,
                researchBonuses: [new UnlockBuildingUpgradeBonus({upgrade: WeaponMaker.ironBlacksmith, building: WeaponMaker.name})],
            }),
            new Research({
                name: "Steel Weaponry",
                researchCost: 500,
                researchBonuses: [new UnlockBuildingUpgradeBonus({upgrade: WeaponMaker.steelBlacksmith, building: WeaponMaker.name})],
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