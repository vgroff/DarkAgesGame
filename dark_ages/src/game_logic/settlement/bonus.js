import { VariableModifier, multiplication, addition } from "../UIUtils";
import { roundNumber } from "../utils";

export class Bonus {
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

export class SettlementBonus extends Bonus {
    activate(settlement) {
        throw Error("need an activation");
    }
};

export class GeneralProductivityBonus extends SettlementBonus {
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

export class SpecificBuildingProductivityBonus extends SettlementBonus {
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

export class SpecificBuildingEfficiencyBonus extends SettlementBonus {
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

export class SpecificBuildingMaxSizeBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = `${this.buildingName} efficiency bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.size.max.addModifier(new VariableModifier({startingValue: this.amount, name: this.name, type: addition}));
            }
        }
    }
    getEffectText() {
        let percentage = `${roundNumber((this.amount - 1)*100, 1)}`
        return `Increase maximum size of ${this.buildingName} by ${percentage}%`;
    }
};

export class UnlockBuildingBonus extends SettlementBonus {
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

export class UnlockBuildingUpgradeBonus extends SettlementBonus {
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

export class AddNewBuildingBonus extends Bonus {
    constructor(props) {
        super(props);
        this.buildingType = props.buildingType;
        this.name = `Add ${this.buildingType.name} to the settlement`;
        this.size = props.size || 0;
        this.unlocked = props.unlocked || false;
    }
    getEffectText() {
        return `Add ${this.buildingType.name} size ${this.size} to the settlement`;
    }
};