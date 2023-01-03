import { VariableModifier, Variable, multiplication, addition, division, subtraction } from "../UIUtils";
import { percentagize, roundNumber, titleCase } from "../utils";
import { unnamedVariableName } from "../variable/variable";

export class Bonus {
    constructor(props) {
        this.name = props.name;
        this.origin = props.origin;
        this.timeLimit = props.timeLimit;
        this.timer = props.timer;
    }
    setOrigin(origin, rename=true) {
        this.origin = origin;
        this.name = `${this.name}${this.origin ? ` from ${this.origin}` : ''}`
    }
    activate() {
        throw Error("need an activation");
    }
    deactivate() {
        throw Error("need an deactivation");
    }
    getEffect() {
        throw Error("you forgot to define this on the subclass");
    }
};

export class SettlementBonus extends Bonus {
    activate(settlement) {
        throw Error("need an activation");
    }
    deactivate(settlement) {
        throw Error("need an deactivation");
    }
};

export class SimpleSettlementModifier extends SettlementBonus {
    constructor(props) {
        props.name = props.name || `${props.variableAccessor} bonus`
        super(props);
        this.amount = props.amount;
        this.variableAccessor = props.variableAccessor;
        this.variableHumanReadable = props.variableHumanReadable || null;
        this.type = props.type || multiplication;
        if (!this.variableAccessor || !this.amount) {
            throw Error("missing props")
        }
    }
    activate(settlement) {
        if (this.amount instanceof Variable) {
            this.modifier = new VariableModifier({variable: this.amount, name: this.name, type: this.type});
        } else {
            this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: this.type});
        }
        settlement[this.variableAccessor].addModifier(this.modifier);
    }
    deactivate(settlement) {
        settlement[this.variableAccessor].removeModifier(this.modifier);
    }
    getEffectText() {
        let amount = this.amount instanceof Variable ? this.amount.currentValue : this.amount;
        let name = this.variableHumanReadable || this.variableAccessor;
        if (!this.variableHumanReadable && this.variableName && this.variableName !== unnamedVariableName) {
            name = this.variableName;
        }
        let numberText;
        if (this.type === multiplication) {
            numberText = percentagize(amount) + "%";
        } else if (this.type === addition) {
            numberText = roundNumber(amount, 2);
        }
        return `${titleCase(name)} changed by ${numberText} `;
    }
};


export class GeneralProductivityBonus extends SimpleSettlementModifier {
    constructor(props) {
        super({...props, variableAccessor: "generalProductivity", variableHumanReadable: "productivity"});
    }
};

export class HealthBonus extends SimpleSettlementModifier {
    constructor(props) {
        super({...props, variableAccessor: "health", variableHumanReadable: "health"});
    }
};

export class SpecificBuildingProductivityBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = props.name || `${this.buildingName} productivity bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: multiplication});
                building.productivity.addModifier(this.modifier);
            }
        }
    }
    deactivate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.productivity.removeModifier(this.modifier);
            }
        }
    }
    getEffectText() {
        let percentage = percentagize(this.amount)
        return `Increase productivity of ${this.buildingName} by ${percentage}%`;
    }
};

export class SpecificBuildingEfficiencyBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = props.name || `${this.buildingName} efficiency bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: multiplication});
                building.productivity.addModifier(this.modifier);
            }
        }
    }
    deactivate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.productivity.removeModifier(this.modifier);
            }
        }
    }
    getEffectText() {
        let percentage = percentagize(this.amount)
        return `Increase efficiency of ${this.buildingName} by ${percentage}%`;
    }
};

export class SpecificBuildingMaxSizeBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = props.name || `${this.buildingName} max size bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: addition});
                building.productivity.addModifier(this.modifier);
            }
        }
    }
    deactivate(settlement) {
        for (const building of settlement.resourceBuildings) {
            if (building.name === this.buildingName) {
                building.productivity.removeModifier(this.modifier);
            }
        }
    }
    getEffectText() {
        let percentage = percentagize(this.amount)
        return `Increase maximum size of ${this.buildingName} by ${percentage}%`;
    }
};

export class SpecificBuildingChangeSizeBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = props.name || `${this.buildingName} change size bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        let building = settlement.getBuildingByName(this.buildingName);
        building.forceNewSize(Math.max(0, building.size.currentValue + this.amount));
    }
    deactivate(settlement) {
        // This is a one-way change?
    }
    getEffectText() {
        return `Change size of ${this.buildingName} by ${this.amount}`;
    }
};

export class UnlockBuildingBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.buildingName = props.building;
        this.name = props.name || `unlock ${this.buildingName}`;
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
        this.name = props.name || `${props.upgrade}`;
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

export class ChangePriceBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.resource = props.resource;
        this.amount = props.amount;
        this.modifier = new VariableModifier({name: this.name, startingValue: props.amount, type:multiplication})
        this.name = props.name || `Change price of ${this.resource.name}`;
    }
    activate(settlement) {
        settlement.addLocalPriceModifier(this.resource, this.modifier);
    }
    deactivate(settlement) {
        settlement.removeLocalPriceModifier(this.resource, this.modifier);
    }
    getEffectText() {
        let percentage = percentagize(this.amount)
        return `Change price of ${this.resource.name} by ${percentage}%`;
    }
};

export class AddNewBuildingBonus extends Bonus {
    constructor(props) {
        super(props);
        this.buildingType = props.buildingType;
        this.name = props.name || `Add ${this.buildingType.name} to the settlement`;
        this.size = props.size || 0;
        this.unlocked = props.unlocked || false;
    }
    // The activate logic is done within the settlement for this one (cant rememeber why)
    getEffectText() {
        return `Add ${this.buildingType.name} size ${this.size} to the settlement`;
    }
};


export class TemporaryModifierBonus extends SettlementBonus {
    constructor(props) {
        props.name = props.name || `temporary ${props.variable} bonus`;
        super(props);
        this.amount = props.amount;
        this.variableAccessor = props.variableAccessor;
        this.type = props.type || addition; // Not sure this works properly besides addition
        this.duration = props.duration;
        this.timer = props.timer;
        if (!this.variableAccessor || !this.timer || !this.duration || !this.amount) {
            throw Error("missing props")
        }
    }
    activate(settlement) {
        // current change is startingValue amount*(1 - diff/duration) - this is if we interpolate between 0 and amount for the sake of addition,
        // but what if we interpolate between amount and 1 for the sake of multiplication?
        // durationFactor is diff/duration i.e. goes from 0 to 1
        this.durationFactor = new Variable({name: "duration factor", startingValue: -1*this.timer.currentValue, max: new Variable({startingValue: 1}), 
            modifiers: [
                new VariableModifier({variable: this.timer, type: addition}),
                new VariableModifier({startingValue: this.duration, type: division})
            ]
        });
        if (this.type === addition || this.type === subtraction) {
            this.modifier = new VariableModifier({startingValue: 1, name: this.name, type: this.type, modifiers: [
                new VariableModifier({variable: this.durationFactor, type: subtraction}),
                new VariableModifier({startingValue: this.amount, type: multiplication})
            ]});
        } else if (this.type === multiplication) {
            // It should go from amount to 1 so it should be amount + durationFactor*(1-amount) = amount + durationFactor - durationFactor * amount
            this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: this.type, modifiers: [
                new VariableModifier({variable: this.durationFactor, type: addition}),
                new VariableModifier({type: subtraction, variable: new Variable({startingValue: 1, modifiers: [
                    new VariableModifier({variable: this.durationFactor, type: multiplication}),
                    new VariableModifier({startingValue: this.amount, type: multiplication}),
                ]})})
            ]});
        } else {
            throw Error("need to implement the behaviour in question")
        }
        settlement[this.variableAccessor].addModifier(this.modifier);
        this.variableName = settlement[this.variableAccessor].name;
        this.timer.subscribe(() => {
            if (this.durationFactor.currentValue >= 1) {
                settlement[this.variableAccessor].removeModifier(this.modifier);
                return false; // return false to unsub
            }
        })
    }
    deactivate(settlement) {
        // This effect is deactivated separately
    }
    getEffectText() {
        let name = this.variableAccessor;
        if (this.variableName && this.variableName !== unnamedVariableName) {
            name = this.variableName;
        }
        let numberText;
        if (this.type === multiplication) {
            numberText = percentagize(this.amount) + '%';
        } else if (this.type === addition) {
            numberText = roundNumber(this.amount, 2);
        }
        return `${titleCase(name)} changed by ${numberText} for up to ${this.duration} days`;
    }
};

export class TemporaryHappinessBonus extends TemporaryModifierBonus {
    constructor(props) {
        super({...props, variableAccessor: 'happiness'})
    }
}

export class TemporaryHealthBonus extends TemporaryModifierBonus {
    constructor(props) {
        super({...props, variableAccessor: 'health'})
    }
}

export class ChangePopulationBonus extends SettlementBonus {
    constructor(props) {
        super(props);
        this.name = props.name || `Change population bonus`;
        this.amount = props.amount;
    }
    activate(settlement) {
        settlement.populationSizeInternal.setNewBaseValue(settlement.populationSizeInternal.currentValue + this.amount, this.name);
    }
    deactivate(settlement) {
        // This is a one-way change?
    }
    getEffectText() {
        return `Change population of settlement by ${this.amount}`;
    }
};

/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
// Character Bonuses ////////////////////////////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////

export class CharacterBonus extends Bonus {
    activate(character) {
        throw Error("need an activation");
    }
    deactivate(character) {
        throw Error("need an deactivation");
    }
}

export class SimpleCharacterModifier extends CharacterBonus {
    constructor(props) {
        props.name = props.name || `${props.variableAccessor} bonus`
        super(props);
        this.amount = props.amount;
        this.variableAccessor = props.variableAccessor;
        this.variableHumanReadable = props.variableHumanReadable || null;
        this.type = props.type || multiplication;
        if (!this.variableAccessor || !this.amount) {
            throw Error("missing props")
        }
    }
    activate(character) {
        this.modifier = new VariableModifier({startingValue: this.amount, name: this.name, type: this.type});
        character[this.variableAccessor].addModifier(this.modifier);
    }
    deactivate(character) {
        character[this.variableAccessor].removeModifier(this.modifier);
    }
    getEffectText() {
        let name = this.variableHumanReadable || this.variableAccessor;
        if (!this.variableHumanReadable && this.variableName && this.variableName !== unnamedVariableName) {
            name = this.variableName;
        }
        let numberText;
        if (this.type === multiplication) {
            numberText = percentagize(this.amount) + "%";
        } else if (this.type === addition) {
            numberText = roundNumber(this.amount, 2);
        }
        return `${titleCase(name)} changed by ${numberText} `;
    }
};

export class LegitimacyBonus extends SimpleCharacterModifier {
    constructor(props) {
        super({...props, variableAccessor: "legitimacy", variableHumanReadable: "legitimacy"});
    }
};
export class StrategyBonus extends SimpleCharacterModifier {
    constructor(props) {
        super({...props, variableAccessor: "strategy", variableHumanReadable: "strategy"});
    }
};

export class DiplomacyBonus extends SimpleCharacterModifier {
    constructor(props) {
        super({...props, variableAccessor: "diplomacy", variableHumanReadable: "diplomacy"});
    }
};

export class AdministrationBonus extends SimpleCharacterModifier {
    constructor(props) {
        super({...props, variableAccessor: "administration", variableHumanReadable: "administration"});
    }
};

