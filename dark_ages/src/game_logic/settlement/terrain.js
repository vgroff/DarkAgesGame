import React from "react";
import { Logger } from "../logger";
import UIBase from "../UIBase";
import { CustomTooltip, titleCase } from "../utils";
import { AddNewBuildingBonus, SpecificBuildingMaxSizeBonus, SpecificBuildingProductivityBonus } from "./bonus";
import { Apothecary, BogIronPit, CoalMine, CoalPit, ConstructionSite, Farm, HuntingCabin, IronMine, LumberjacksHut, PeatBog, ResourceBuilding } from "./building";


class Terrain {
    constructor(props) {
        this.name = props.name;
        this.bonuses = props.bonuses;
    }
    getEffectList() {
        let effectList = []
        for (const bonus of this.bonuses) {
            effectList.push(bonus.getEffectText());
        }
        return effectList;
    }
}

export class TerrainComponent extends React.Component {
    constructor(props) {
        super(props);
        this.terrain = props.terrain;
    }
    render() {
        this.toolTipVars = this.terrain.getEffectList();
        return <CustomTooltip items={this.toolTipVars} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
            <span style={{}} onClick={()=>{Logger.setInspect(this.terrain)}}>{this.props.prefix ? "Terrain: " : null}{titleCase(this.terrain.name)}</span>
        </CustomTooltip>
    }
}

TerrainComponent.defaultProps = {
    prefix: false
}

export class NoTerrain extends Terrain {
    constructor() {
        super({name: "No Terrain", bonuses: []})
    }
}

export class Farmlands extends Terrain {
    constructor() {
        super({name: "Farmlands", bonuses: [
            new AddNewBuildingBonus({buildingType: CoalPit, size: 0}),
            new SpecificBuildingProductivityBonus({building: Farm.name, amount: 1.05}),
            new SpecificBuildingProductivityBonus({building: Apothecary.name, amount: 0.9}),
            new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 0.85})
        ]})
    }
}

export class Woodlands extends Terrain {
    constructor() {
        super({name: "Woodlands", bonuses: [
            new SpecificBuildingProductivityBonus({building: Farm.name, amount: 0.9}),
            new SpecificBuildingProductivityBonus({building: ConstructionSite.name, amount: 0.9}),
            new SpecificBuildingProductivityBonus({building: HuntingCabin.name, amount: 1.25}),
            new SpecificBuildingMaxSizeBonus({building: HuntingCabin.name, amount: 3}),
            new SpecificBuildingProductivityBonus({building: Apothecary.name, amount: 1.35}),
            new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.25})
        ]})
    }
}

export class Marshlands extends Terrain {
    constructor() {
        super({name: "Marshlands", bonuses: [
            new AddNewBuildingBonus({buildingType: BogIronPit}),
            new AddNewBuildingBonus({buildingType: PeatBog, size: 1, unlocked: true}),
            new SpecificBuildingMaxSizeBonus({building: CoalMine.name, amount: 3}),
            new SpecificBuildingProductivityBonus({building: Farm.name, amount: 0.93}),
            new SpecificBuildingProductivityBonus({building: ConstructionSite.name, amount: 0.8}),
            new SpecificBuildingProductivityBonus({building: Apothecary.name, amount: 1.2}),
            new SpecificBuildingProductivityBonus({building: LumberjacksHut.name, amount: 1.25}),
        ]})
    }
}

export class Mountains extends Terrain {
    constructor() {
        super({name: "Mountains", bonuses: [
            new AddNewBuildingBonus({buildingType: CoalMine, size: 1, unlocked: true}),
            new SpecificBuildingMaxSizeBonus({building: CoalMine.name, amount: 5}),
            new SpecificBuildingProductivityBonus({building: Farm.name, amount: 0.9}),
            new SpecificBuildingProductivityBonus({building: ConstructionSite.name, amount: 0.85}),
            new SpecificBuildingProductivityBonus({building: Apothecary.name, amount: 1.2}),
            new SpecificBuildingProductivityBonus({building: IronMine.name, amount: 1.35}),
            new SpecificBuildingProductivityBonus({building: CoalMine.name, amount: 1.35})
        ]})
    }
}