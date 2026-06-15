import { FormControl, Grid, InputLabel, MenuItem, Select } from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import React from "react";
import { chooseRandomly, getProbabilities } from "./rolling";
import { daysInYear } from "./seasons";
import { AdministrationBonus, Bonus, CharacterBonus, HealthBonus, DiplomacyBonus, GeneralProductivityBonus, LegitimacyBonus, SettlementBonus, SpecificBuildingProductivityBonus, SpecificBuildingEfficiencyBonus, StrategyBonus, HappinessBonus, TemporaryLegitimacyBonus } from "./settlement/bonus";
import { Apothecary, Church, HuntingCabin, Library, LumberjacksHut } from "./settlement/building";
import UIBase from "./UIBase";
import { addition, multiplication, Variable, VariableComponent, VariableModifier } from "./UIUtils";
import { CustomTooltip, titleCase } from "./utils";
import { createResearchTree, ResearchComponent } from "./settlement/research";
import { Resources } from "./settlement/resource";

export class Faction {
    constructor(props) {
        this.name = props.name || "Unnamed Faction";
        this.leader = props.leader;
        this.gameClock = props.gameClock;
        if (!this.leader) {
            throw Error("faction should be created by it's leader");
        }
        this.members = [this.leader];
        this.tentativelyChanged = false;
        this.numPrivilegesAllowed = 4;
        // Faction-level research tree. One shared tree for all member settlements.
        // Player interacts with this; bonuses propagate to all member settlements.
        this.researchTree = createResearchTree();
        this.privileges = [
            {
                num: 4,
                name: "noble privileges",
                traits: [
                    new Trait({name: "small nobility", effects: [
                        new LegitimacyBonus({amount: 0.15, type:addition}),
                        new GeneralProductivityBonus({amount: 0.975, type:multiplication}),
                    ]}),
                    new Trait({name: "extensive nobility", effects: [
                        new LegitimacyBonus({amount: 0.3, type:addition}),
                        new GeneralProductivityBonus({amount: 0.95, type:multiplication}),
                    ]}),
                    new Trait({name: "noble privileges", effects: [
                        new LegitimacyBonus({amount: 0.45, type:addition}),
                        new GeneralProductivityBonus({amount: 0.925, type:multiplication}),               
                    ]}),
                    new Trait({name: "extensive noble privileges", effects: [
                        new LegitimacyBonus({amount: 0.6, type:addition}),
                        new GeneralProductivityBonus({amount: 0.90, type:multiplication}),               
                    ]})
                ]
            },
            {
                name: "citizen privileges",
                num: 0,
                traits: [new Trait({name: "sunday afternoons off", effects: [
                    new HappinessBonus({amount: 1.075, type:multiplication}),
                    new GeneralProductivityBonus({amount: 0.98, type:multiplication}),
                ]})]
            },
            {
                name: "clergy privileges",
                num: 0,
                traits: [new Trait({name: "longer services", effects: [
                    new HappinessBonus({amount: 1.05, type:addition}),
                    new SpecificBuildingProductivityBonus({amount: 1.35, building: Church.name}),
                    new GeneralProductivityBonus({amount: 0.98, type:multiplication}),
                ]})]
            }
        ];
        this.timerMessage = "Need to confirm changes to faction privileges";
    }
    changePrivilegeTentatively(privilegeIndex, change) {
        let numExistingPrivileges = this.getNumPrivileges();
        if (numExistingPrivileges + change > this.numPrivilegesAllowed) {
            return;
        }
        if (!this.tentativelyChanged) {
            this.oldPrivilegeNums = this.privileges.map(privilege => privilege.num);
            this.tentativelyChanged = true;
            this.gameClock.forceStopTimer(this.timerMessage)
        }
        this.privileges[privilegeIndex].num += change;
        if (this.tentativelyChanged) {
            // Check if equal to oldPrivilegeNums and if so set tentativelyChanged to false
            const changedPrivileges = this.privileges.filter((privilege, i) => privilege.num !== this.oldPrivilegeNums[i]);
            if (changedPrivileges.length === 0) {
                this.tentativelyChanged = false;
                this.gameClock.unforceStopTimer(this.timerMessage)
            }
        }
        this.updatePrivileges();
    }
    confirmPrivilegeChanges() {
        if (!this.tentativelyChanged) { 
            return;
        }
        let legitimacyMalus = new TemporaryLegitimacyBonus({name: "Changed privileges recently", amount: -0.05, duration:daysInYear*5, timer: this.gameClock, type: addition});
        legitimacyMalus.activate(this.leader);
        this.tentativelyChanged = false;
        this.gameClock.unforceStopTimer(this.timerMessage)
    }
    getNumPrivileges() {
        return this.privileges.reduce((prev, curr) => prev + curr.num, 0);
    }
    joinFaction(member) {
        if (member in this.members) {
            return;
        }
        this.members.push(member);
    }
    updatePrivileges() {
        // need to update every member
        this.members.forEach(member => member.updateFactionTraits());
    }
    getTraits() {
        this.lastTraits = this.privileges.reduce((prev, curr) => {
            if (curr.num > 0) {
                prev.push(curr.traits[curr.num - 1]);
            }
            return prev;
        }, []);
        return this.lastTraits;
    }
    getText(extensive=false) {
        let text = [`Faction ${this.name} has the following traits:`];
        let traits = this.lastTraits ? this.lastTraits : this.getTraits();
        text = text.concat(traits ? traits.map(trait => extensive ? trait.getText() : trait.name).flat() : ['']);
        return text;
    }

    /**
     * Returns all member settlements that belong to the player (isPlayer leader).
     * Used to determine which settlements receive research bonuses.
     */
    getPlayerSettlements() {
        const settlements = [];
        this.members.forEach(member => {
            member.settlements.forEach(s => {
                if (!settlements.includes(s)) settlements.push(s);
            });
        });
        return settlements;
    }

    /**
     * Get the total pooled research points across all member settlements.
     * Returns the sum of each settlement's research resource storage baseValue.
     */
    getTotalResearch() {
        const settlements = this.getPlayerSettlements();
        return settlements.reduce((total, settlement) => {
            const rs = settlement.resourceStorages.find(r => r.resource === Resources.research);
            return total + (rs ? rs.amount.baseValue : 0);
        }, 0);
    }

    /**
     * Returns true if the faction can afford the research cost from the pooled pool.
     */
    canResearch(research) {
        if (research.researched) return false;
        // Check sequential unlock: find the category and ensure previous item is researched
        for (const [, researchList] of Object.entries(this.researchTree)) {
            const idx = researchList.indexOf(research);
            if (idx > 0 && !researchList[idx - 1].researched) return false;
            if (idx !== -1) break;
        }
        return this.getTotalResearch() >= research.researchCost;
    }

    /**
     * Activate a research item:
     * 1. Deduct cost proportionally from all member settlements' research storage.
     * 2. Mark the faction research item as researched.
     * 3. Apply bonuses to all member settlements by activating the matching item
     *    in each settlement's internal research tree (by name lookup).
     */
    activateResearch(research) {
        if (!this.canResearch(research)) return;
        const settlements = this.getPlayerSettlements();
        const totalResearch = this.getTotalResearch();
        const cost = research.researchCost;

        // Deduct proportionally from each settlement's research storage
        settlements.forEach(settlement => {
            const rs = settlement.resourceStorages.find(r => r.resource === Resources.research);
            if (!rs) return;
            const proportion = totalResearch > 0 ? rs.amount.baseValue / totalResearch : 0;
            const deduction = cost * proportion;
            if (deduction > 0) {
                rs.oneOffDemand(deduction);
            }
        });

        // Mark faction research as done
        research.researched = true;

        // Apply bonuses to all member settlements
        settlements.forEach(settlement => {
            // Find matching research item in settlement's internal tree by name
            for (const [, researchList] of Object.entries(settlement.research)) {
                const match = researchList.find(r => r.name === research.name);
                if (match && !match.researched) {
                    // Apply bonuses directly without deducting cost again
                    for (const bonus of match.researchBonuses) {
                        settlement.activateBonus(bonus);
                    }
                    match.researched = true;
                    break;
                }
            }
        });
    }
}

export class Culture {
    constructor(props) {
        this.name = props.name;
        if (!this.name) {
            throw Error("Culture needs name");
        }
    }
    getTraits() {
        throw Error("abstract class")
    }
    getText(extensive=false) {
        let text = [`Culture ${this.name} has following traits:`];
        let traits = this.lastTraits ? this.lastTraits : this.getTraits()
        text = text.concat(traits ? traits.map(trait => extensive ? trait.getText() : trait.name).flat() : [''])
        return text;
    }
}

export class Celtic extends Culture {
    constructor(props) {
        super({...props, name: "celtic"})
    }  
    getTraits() {
        this.lastTraits = [
            new Trait({name: "elected kings", effects: [new LegitimacyBonus({amount:0.95, type:multiplication})]}),
            new Trait({name: "druidic traditions", effects: [
                new SpecificBuildingProductivityBonus({amount:1.25, building:Apothecary.name, type:multiplication}),
                new HealthBonus({amount:1.03, type:multiplication})
            ]}),
            new Trait({name: "foresters", effects: [
                new SpecificBuildingProductivityBonus({amount:1.15, building:LumberjacksHut.name, type:multiplication}),
                new SpecificBuildingProductivityBonus({amount:1.1, building:HuntingCabin.name, type:multiplication})
            ]}),
        ]
        return this.lastTraits;
    }
}

export class Roman extends Culture {
    constructor(props) {
        super({...props, name: "roman"})
    }  
    getTraits() {
        this.lastTraits = [
            new Trait({name: "obsolete military tactics", effects: [new StrategyBonus({amount:0.85, type:multiplication})]}),
            new Trait({name: "academic traditions", effects: [
                new SpecificBuildingProductivityBonus({amount:1.2, building:Library.name, type:multiplication}),
            ]}),
            new Trait({name: "roman plumbing", effects: [
                new HealthBonus({amount:1.05, type:multiplication}),
            ]}),
            new Trait({name: "rhetorical training", effects: [
                new DiplomacyBonus({amount:1.1, type:multiplication}),
            ]}),
        ]
        return this.lastTraits;
    }
}

export const Cultures = {
    Celtic: Celtic,
    Roman: Roman
};

export function copyCulture(character) {
    let culture = Object.values(Cultures).filter(culture => character.culture instanceof culture)[0];
    return new culture();
}

export class Trait {
    constructor(props) {
        this.name = props.name;
        this.effects = props.effects;
        this.effects.map(effect => effect.setOrigin(this.name));
        if (!this.name) {
            throw Error("name your trait");
        }
    }
    getEffects() {
        if (this.effects) {
            return this.effects;
        } else {
            throw Error("Abtract class extend this funciton or set effects param")
        }
    }
    activate(character) {
        this.pastEffects = this.getEffects();
        this.pastEffects.forEach( bonus => {
            character.activateBonus(bonus);
        });
    }
    deactivate(character) {
        this.pastEffects.forEach( bonus => {
            character.deactivateBonus(bonus);
        });
    }
    getText() {
        let text = [`Trait ${this.name} has following effects:`];
        let effects = this.pastEffects ? this.pastEffects : this.getEffects();
        text = text.concat(effects ? effects.map(bonus => bonus.getEffectText()) : [''])
        return text;
    }
}

const TraitScaler = 0.1;

export class NobleUpbringing extends Trait {
    constructor() {
        super({name: "noble upbringing", effects: [
            new LegitimacyBonus({amount: 1.05, type: multiplication}),
            new DiplomacyBonus({amount: 2*TraitScaler, type: addition}),
            new StrategyBonus({amount: TraitScaler, type: addition}),
            new AdministrationBonus({amount: TraitScaler, type: addition})
        ]})
    }
}

export class MilitaryUpbringing extends Trait {
    constructor() {
        super({name: "military upbringing", effects: [
            new StrategyBonus({amount: 3*TraitScaler, type: addition}),
        ]})
    }
}

export class MerchantUpbringing extends Trait {
    constructor() {
        super({name: "merchant upbringing", effects: [
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
            new AdministrationBonus({amount: 2*TraitScaler, type: addition})
        ]})
    }
}

export class PeasantUpbringing extends Trait {
    constructor() {
        super({name: "pesant upbringing", effects: [
            new LegitimacyBonus({amount: 0.92, type: multiplication}),
            new GeneralProductivityBonus({amount: 1.02, type: multiplication}),
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
            new StrategyBonus({amount: TraitScaler, type: addition}),
            new AdministrationBonus({amount: TraitScaler, type: addition})
        ]})
    }
}

export const ChildhoodTraits = [NobleUpbringing, MilitaryUpbringing, MerchantUpbringing, PeasantUpbringing];

export class SmoothTalker extends Trait {
    constructor() {
        super({name: "smooth talker", effects: [
            new DiplomacyBonus({amount: 2*TraitScaler, type: addition}),
        ]})
    }
}

export class Intelligent extends Trait {
    constructor() {
        super({name: "intelligent", effects: [
            new AdministrationBonus({amount: 2*TraitScaler, type: addition}),
        ]})
    }
}

export class Strategic extends Trait {
    constructor() {
        super({name: "strategic", effects: [
            new StrategyBonus({amount: 2*TraitScaler, type: addition})
        ]})
    }
}

export const AbilityTraits = [SmoothTalker, Intelligent, Strategic];

export class Witty extends Trait {
    constructor() {
        super({name: "witty", effects: [
            new DiplomacyBonus({amount: 2*TraitScaler, type: addition}),
        ]})
    }
}

export class Careful extends Trait {
    constructor() {
        super({name: "careful", effects: [
            new AdministrationBonus({amount: 2*TraitScaler, type: addition}),
        ]})
    }
}

export class Brave extends Trait {
    constructor() {
        super({name: "brave", effects: [
            new StrategyBonus({amount: 2*TraitScaler, type: addition})
        ]})
    }
}

export const PersonalityTraits = [Witty, Careful, Brave];

export class Regalia extends Trait {
    constructor() {
        super({name: "regalia", effects: [
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
        ]})
    }
}

export class Ledger extends Trait {
    constructor() {
        super({name: "ledger", effects: [
            new AdministrationBonus({amount: TraitScaler, type: addition}),
        ]})
    }
}

export class Sword extends Trait {
    constructor() {
        super({name: "sword", effects: [
            new StrategyBonus({amount: TraitScaler, type: addition})
        ]})
    }
}

export const TrinketTraits = [Regalia, Ledger, Sword];

export class JoustingChampion extends Trait {
    constructor() {
        super({name: "jousting champion", effects: [
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
            new StrategyBonus({amount: 2*TraitScaler, type: addition})
        ]})
    }
}

export class Orator extends Trait {
    constructor() {
        super({name: "orator", effects: [
            new DiplomacyBonus({amount: 3*TraitScaler, type: addition}),
        ]})
    }
}

export class Officer extends Trait {
    constructor() {
        super({name: "officer", effects: [
            new StrategyBonus({amount: 2*TraitScaler, type: addition}),
            new AdministrationBonus({amount: TraitScaler, type: addition})
        ]})
    }
}

export class PoliticalVeteran extends Trait {
    constructor() {
        super({name: "political veteran", effects: [
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
            new StrategyBonus({amount: TraitScaler, type: addition}),
            new AdministrationBonus({amount: TraitScaler, type: addition})
        ]})
    }
}

export class SuccesfulMerchant extends Trait {
    constructor() {
        super({name: "succesful merchant", effects: [
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
            new AdministrationBonus({amount: 2*TraitScaler, type: addition})
        ]})
    }
}

export const FameTraits = [JoustingChampion, Orator, Officer, PoliticalVeteran, SuccesfulMerchant];

export class Character {
    constructor(props) {
        this.name = props.name || "Unnamed Character";
        this.isPlayer = props.isPlayer || false;
        this.gameClock = props.gameClock;
        this.traitGroups = {
            childhoodTrait: {trait: props.childhoodTrait, choices:ChildhoodTraits, name: "childhood trait"},
            abilityTrait: {trait: props.abilityTrait, choices:AbilityTraits, name: "ability trait"},
            personalityTrait: {trait: props.personalityTrait, choices:PersonalityTraits, name: "personality trait"},
            fameTrait: {trait: props.fameTrait, choices:FameTraits, name: "fame trait"},
            trinketTrait: {trait: props.trinketTrait, choices:TrinketTraits, name: "trinket trait"}
        }
        // Force-stop the timer on day 1 for the player until all traits are chosen.
        // This is released in checkTraitsComplete() once all 5 trait groups are filled.
        this._traitsForceStopReason = "Player must choose all character traits before the game begins";
        if (this.isPlayer && this.gameClock) {
            this.gameClock.forceStopTimer(this._traitsForceStopReason);
        }
        this.legitimacy = new Variable({name:`legitimacy`, startingValue:0.1});
        this.diplomacy = new Variable({name:`diplomacy`, startingValue:props.diplomacy});
        this.strategy = new Variable({name:`strategy`, startingValue:props.strategy});
        this.administration = new Variable({name:`administration`, startingValue:props.administration});
        this.administrativeEfficiency = new Variable({name:`administration efficiency`, startingValue:0.9, modifiers:[
            new VariableModifier({type:addition, variable: new Variable({name:"effect of administration", startingValue:0, modifiers: [
                new VariableModifier({variable: this.administration, type: addition}),
                new VariableModifier({startingValue:0.3, type: multiplication})
            ]})})
        ]});
        this.traits = [];
        this.settlements = [];
        this.characterEffects = [
            new GeneralProductivityBonus({name: "Leader administration", amount: this.administrativeEfficiency, type:multiplication})
        ];
        this.faction = props.faction || null;
        this.changeCulture(props.culture);
        if (props.faction) {
            this.setFaction(props.faction)
        } else {
            this.setFaction(new Faction({leader: this, name: props.factionName, gameClock: this.gameClock}));
        }
        if (!this.culture) {
            throw Error("everyone needs a culture")
        }
        console.log("check")
        if (props.randomizeTraits) {
            console.log("check2")
            this.randomizeTraits();
        }
    }
    /**
     * Check whether all 5 trait groups are filled. If so, and the player timer
     * force-stop is still active, release it. Called after every addTrait/removeTrait.
     */
    checkTraitsComplete() {
        if (!this.isPlayer || !this.gameClock || !this._traitsForceStopReason) return;
        const allFilled = Object.values(this.traitGroups).every(tg => tg.trait !== null && tg.trait !== undefined);
        if (allFilled) {
            // Only unforce-stop if we are currently holding the stop
            if (this.gameClock.forceStops.includes(this._traitsForceStopReason)) {
                this.gameClock.unforceStopTimer(this._traitsForceStopReason);
            }
        } else {
            // Re-apply the stop if a trait was removed and not all groups are filled
            if (!this.gameClock.forceStops.includes(this._traitsForceStopReason)) {
                this.gameClock.forceStopTimer(this._traitsForceStopReason);
            }
        }
    }
    randomizeTraits() {
        Object.keys(this.traitGroups).forEach(traitGroup => {
            const trait = chooseRandomly(this.traitGroups[traitGroup].choices);
            this.addTrait(new trait());
        });
    }
    setFaction(faction) {
        if (this.faction) {
            this.factionTraits.forEach(trait => this.removeTrait(trait));
        }
        this.faction = faction;
        this.faction.joinFaction(this);
        this.updateFactionTraits();
    }
    updateFactionTraits() {
        if (this.factionTraits) {
            this.factionTraits.forEach(trait => this.removeTrait(trait));
        }
        this.factionTraits = this.faction.getTraits(); // intentional that we generate new traits each time
        this.factionTraits.forEach(trait => this.addTrait(trait));
    }
    addSettlement(settlement) {
        this.settlements.push(settlement);
        this.traits.forEach(trait => {
            let effects = trait.pastEffects ? trait.pastEffects : trait.getEffects()
            effects.forEach(effect => {
                if (effect instanceof SettlementBonus) {
                    settlement.activateBonus(effect);
                }
            });
        });
        this.characterEffects.forEach(effect => {
            if (effect instanceof SettlementBonus) {
                settlement.activateBonus(effect);
            }
        });
    }
    removeSettlement(settlement) {
        const index = this.settlements.indexOf(settlement);
        if (index > -1) { // only splice array when item is found
            this.settlements.splice(index, 1); // 2nd parameter means remove one item only
        }
        this.traits.forEach(trait => {
            let effects = trait.pastEffects ? trait.pastEffects : trait.getEffects()
            effects.forEach(effect => {
                if (effect instanceof SettlementBonus) {
                    settlement.deactivateBonus(effect);
                }
            });
        });
        this.characterEffects.forEach(effect => {
            if (effect instanceof SettlementBonus) {
                settlement.deactivateBonus(effect);
            }
        });
    }
    changeCulture(culture) {
        if (this.culture) {
            this.culture.lastTraits.forEach(lastTrait => this.removeTrait(lastTrait));
        }
        this.culture = culture;
        this.culture.getTraits().forEach(lastTrait => this.addTrait(lastTrait));
    }
    addTrait(trait) {
        trait.activate(this);
        this.traits.push(trait);
        Object.entries(this.traitGroups).forEach(([key, traitGroup]) => {
            if (traitGroup.choices.some(chTrait => trait instanceof chTrait)) {
                if (traitGroup.trait) {
                    throw Error("setting trait twice");
                }
                traitGroup.trait = trait;
            }
        });
        this.checkTraitsComplete();
    }
    removeTrait(trait) {
        trait.deactivate(this);
        const index = this.traits.indexOf(trait);
        if (index > -1) { // only splice array when item is found
            this.traits.splice(index, 1); // 2nd parameter means remove one item only
        }
        Object.entries(this.traitGroups).forEach(([key, traitGroup]) => {
            if (traitGroup.choices.some(chTrait => trait instanceof chTrait)) {
                traitGroup.trait = null;
            }
        });
        this.checkTraitsComplete();
    }
    activateBonus(bonus) {
        if (bonus instanceof CharacterBonus) {
            bonus.activate(this);
        } else if (bonus instanceof SettlementBonus) {
            this.settlements.forEach(settlement => settlement.activateBonus(bonus));
        } else {
            throw Error("didn't recognise bonus")
        }
    }
    deactivateBonus(bonus) {
        if (bonus instanceof CharacterBonus) {
            bonus.deactivate(this);
        } else if (bonus instanceof SettlementBonus) {
            this.settlements.forEach(settlement => settlement.deactivateBonus(bonus));
        } else {
            throw Error("didn't recognise bonus")
        }  
    }
}

export class ChoiceComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {edit: false};
    }
    render() {
        this.chosen = this.props.chosen;
        this.groupName = this.props.groupName;
        this.choices = this.props.choices;
        this.editable = this.props.editable !== undefined ? this.props.editable : false;
        this.edit = this.state.edit && this.editable;
        if (!this.chosen && this.choices) {
            this.edit = true;
        }
        return <div>
            {!this.edit && this.chosen ? 
            <div onClick = {() => !this.edit && this.choices ? this.setState({edit: !this.edit}) : null}>
                <CustomTooltip items={this.chosen.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                    <span>{this.groupName ? `${titleCase(this.groupName)}: ` : null}{titleCase(this.chosen.name)}</span>
                </CustomTooltip>
            </div> :
            <FormControl fullWidth size={"small"}>
                <InputLabel id="demo-simple-select-label">{this.groupName}</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={this.chosen || ''}
                    label={this.groupName}
                    onChange={(e) => {this.props.handleChange(e.target.value, this.chosen); this.setState({edit: false});}}
                >
                    {this.choices.map((choice,i) => {
                        return <MenuItem key={choice.name+i} value={choice}><ChoiceComponent chosen={choice} edit={false}/></MenuItem>
                    })}
                </Select>
            </FormControl>}
        </div>
    }
}

export class FactionComponent extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([props.faction.leader.legitimacy]);
    }
    childRender() {
        this.faction = this.props.faction;
        let privileges = this.faction.privileges;
        let hasMaxPrivileges = this.faction.getNumPrivileges() >= this.faction.numPrivilegesAllowed;
        let hasMinPrivileges = this.faction.getNumPrivileges() <= 0;
        return <div>
            <div onClick = {() => !this.state.editName ? this.setState({editName: !this.state.editName}) : null}>
                {this.state.editName ? 
                    <TextField id="outlined-basic" label="Name" variant="outlined" defaultValue={this.faction.name} 
                        onChange={(e) => {this.faction.name = e.target.value}} onKeyUp={(event) => event.key==="Enter" ? this.setState({editName: false}) : null}/>
                    : <CustomTooltip items={this.faction.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <span>Faction: {titleCase(this.faction.name)}<br /><br /></span>
                    </CustomTooltip>}
            </div>
            {privileges.map((privilege, i) => {
                return <span key={`privilege_${privilege.name}`}>{titleCase(privilege.name)}: {privilege.num ? 
                    <CustomTooltip items={privilege.traits[privilege.num - 1].getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <span>{titleCase(privilege.traits[privilege.num - 1].name)} ({privilege.num}/{privilege.traits.length})</span>
                    </CustomTooltip>
                    : <span>None ({privilege.num}/{privilege.traits.length})</span>} 
                <Button variant={!hasMaxPrivileges ? "outlined" : "disabled"} onClick={(e) => this.faction.changePrivilegeTentatively(i, 1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>+</Button>
                <Button variant={!hasMinPrivileges && this.faction.privileges[i].num ? "outlined" : "disabled"} onClick={(e) => this.faction.changePrivilegeTentatively(i, -1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "6px", maxWidth: "6px"}}>-</Button>    
                <br /> </span>
            })}
            <Button variant={this.faction.tentativelyChanged ? "outlined" : "disabled"} onClick={(e) => this.faction.confirmPrivilegeChanges()}>
                Confirm Privilege Changes
            </Button>
        </div>
    }
}

/**
 * Renders the faction's shared research tree.
 * Shows pooled research total, and all research categories with sequential unlock.
 * Subscribes to internalTimer so it re-renders each tick (research points update).
 * Intended to be rendered in a top-level Research panel (not inside SettlementComponent).
 */
export class FactionResearchComponent extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        const faction = this.props.faction;
        const totalResearch = faction.getTotalResearch();
        return <div>
            <div style={{ marginBottom: '8px', color: '#555', fontSize: '13px' }}>
                Pooled research: <b>{Math.floor(totalResearch)}</b>
            </div>
            <Grid container spacing={2} justifyContent="center" alignItems="flex-start">
                {Object.entries(faction.researchTree).map(([category, researchList], i) =>
                    <Grid item xs={6} key={category}>
                        <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>{titleCase(category)}</div>
                        {researchList.map((research, j) => {
                            const visible = research.researched || j === 0 || researchList[j - 1].researched;
                            return visible ? <ResearchComponent
                                key={j}
                                research={research}
                                canResearch={faction.canResearch(research)}
                                visible={visible}
                                activateResearch={() => faction.activateResearch(research)}
                            /> : null;
                        })}
                    </Grid>
                )}
            </Grid>
        </div>;
    }
}

export class CharacterComponent extends UIBase {
    constructor(props) {
        super(props);
        // Use dynamic getters so subscriptions re-wire when props.character changes
        this.addVariableGetters([
            { key: 'legitimacy', get: (p) => p.character.legitimacy }
        ]);
    }
    handleTraitChange(newTrait, oldTrait) {
        if (oldTrait) {
            this.character.removeTrait(oldTrait);
        }
        this.character.addTrait(newTrait);
    }
    handleCultureChange(newCulture, oldCulture) {
        this.character.changeCulture(newCulture);
    }
    childRender() {
        this.character = this.props.character;
        return <div>
            
            <div onClick = {() => !this.state.editName ? this.setState({editName: !this.state.editName}) : null}>
                {this.state.editName ?
                    <TextField id="outlined-basic" label="Name" variant="outlined" defaultValue={this.character.name}
                        onChange={(e) => {this.character.name = e.target.value}} onKeyUp={(event) => event.key==="Enter" ? this.setState({editName: false}) : null}/>
                    : this.character.name}<br />
            </div>
            <ChoiceComponent key={`culture`} editable={this.character.isPlayer} chosen={this.character.culture} choices={Object.values(Cultures).map(choice => new choice())} groupName={"Culture"} handleChange={(newCulture, oldCulture) => this.handleCultureChange(newCulture, oldCulture)}/>
            Cultural Traits:
            <ul>{this.character.culture.lastTraits ? this.character.culture.lastTraits.map((trait, i) =>
                <li key={`cultural_trait_${trait.name}_${i}`}><ChoiceComponent chosen={trait} /></li>)
             : null}</ul>
            {Object.entries(this.character.traitGroups).map(([key, traitGroup], i) =>
                (this.character.isPlayer || traitGroup.trait) ?
                <ChoiceComponent key={`trait_group_${key}_${i}`} editable={this.character.isPlayer} chosen={traitGroup.trait}
                    choices={traitGroup.choices.map(choice => new choice())} groupName={traitGroup.name}
                    handleChange={(newTrait, oldTrait) => this.handleTraitChange(newTrait, oldTrait)}/> : null)
            }
            <br />
            <b>Skills</b> <br />
            <CustomTooltip items={["Affects popular support in settlements and trade negotiations. Higher diplomacy reduces rebellion risk."]}><span><VariableComponent showOwner={false} variable={this.character.diplomacy} /></span></CustomTooltip><br />
            <CustomTooltip items={["Military skill. Affects combat outcomes and raid defence (not yet fully implemented)."]}><span><VariableComponent showOwner={false} variable={this.character.strategy} /></span></CustomTooltip><br />
            <CustomTooltip items={["Organisational skill. Directly multiplies settlement general productivity via administrative efficiency."]}><span><VariableComponent showOwner={false} variable={this.character.administration} /></span></CustomTooltip><br />
            <br />
            <b>Attributes</b> <br />
            <CustomTooltip items={["How much the population accepts this character as their ruler. Contributes to local legitimacy in all settlements."]}><span><VariableComponent showOwner={false} variable={this.character.legitimacy} /></span></CustomTooltip><br />
            <CustomTooltip items={["Productivity multiplier applied to all settlements. Equals 0.9 + 0.3 × administration."]}><span><VariableComponent showOwner={false} variable={this.character.administrativeEfficiency} /></span></CustomTooltip><br />
            <br />
            <b>Faction</b> <br />
            <FactionComponent faction={this.character.faction} /><br />
        </div>
    }
}

// Notes
// - Link events in with character stats. Make events have temporary effects to support, or more rarely, to legitimacy
