import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import React from "react";
import { getProbabilities } from "./rolling";
import { daysInYear } from "./seasons";
import { AdministrationBonus, Bonus, CharacterBonus, HealthBonus, DiplomacyBonus, GeneralProductivityBonus, LegitimacyBonus, SettlementBonus, SpecificBuildingProductivityBonus, SpecificBuildingEfficiencyBonus, StrategyBonus, HappinessBonus, TemporaryLegitimacyBonus } from "./settlement/bonus";
import { Apothecary, Church, HuntingCabin, Library, LumberjacksHut } from "./settlement/building";
import UIBase from "./UIBase";
import { addition, multiplication, Variable, VariableComponent, VariableModifier } from "./UIUtils";
import { CustomTooltip, titleCase } from "./utils";

export class Faction {
    constructor(props) {
        this.name = props.name || "Unnamed Faction";
        this.leader = props.leader;
        if (!this.leader) {
            throw Error("faction should be created by it's leader");
        }
        this.members = [this.leader];
        this.tentativelyChanged = false;
        this.numPrivilegesAllowed = 4;
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
                    new HappinessBonus({amount: 1.05, type:addition}),
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
    }
    changePrivilegeTentatively(privilegeIndex, change) {
        let numExistingPrivileges = this.getNumPrivileges();
        if (numExistingPrivileges + change > this.numPrivilegesAllowed) {
            console.log("too many privileges already");
            return;
        }
        if (!this.tentativelyChanged) {
            this.oldPrivilegeNums = this.privileges.map(privilege => privilege.num);
            this.tentativelyChanged = true;
        }
        this.privileges[privilegeIndex].num += change;
        if (this.tentativelyChanged) {
            // Check if equal to oldPrivilegeNums and if so set tentativelyChanged to false
            this.privileges.filter((privilege, i) => privilege.num !== this.oldPrivilegeNums[i]);
            if (this.privileges.length === 0) {
                this.tentativelyChanged = false;
            }
        }
        this.updatePrivileges();
    }
    confirmPrivilegeChanges() {
        if (!this.tentativelyChanged) { 
            return;
        }
        let legitimacyMalus = new TemporaryLegitimacyBonus({amount: -0.05, duration:daysInYear*5, timer: this.timer, type: addition});
        legitimacyMalus.activate(this.leader);
        this.tentativelyChanged = false;
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
        super({...props, name: "celtic"})
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
        super({name: "strategic", effects: [
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
        this.faction = props.faction || null;
        this.traitGroups = {
            childhoodTrait: {trait: props.childhoodTrait, choices:ChildhoodTraits, name: "childhood trait"},
            abilityTrait: {trait: props.abilityTrait, choices:AbilityTraits, name: "ability trait"},
            personalityTrait: {trait: props.personalityTrait, choices:PersonalityTraits, name: "personality trait"},
            fameTrait: {trait: props.fameTrait, choices:FameTraits, name: "fame trait"},
            trinketTrait: {trait: props.trinketTrait, choices:TrinketTraits, name: "trinket trait"}
        }
        this.legitimacy = new Variable({name:`legitimacy`, startingValue:0.2});
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
        this.setFaction(new Faction({leader: this, name: props.factionName}));
        this.changeCulture(props.culture);
        if (!this.culture) {
            throw Error("everyone needs a culture")
        }
    }
    setFaction(faction) {
        if (this.faction) {
            this.factionTraits.forEach(trait => this.removeTrait(trait));
        }
        this.faction = faction;
        this.faction.joinFaction(this);
        this.factionTraits = this.faction.getTraits(); // intentional that we generate new traits each time
        this.factionTraits.forEach(trait => this.addTrait(trait));
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
        const index = this.traits.indexOf(settlement);
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
        console.log(this.edit);
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

export class CharacterComponent extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([props.character.legitimacy]);
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
            <ChoiceComponent key={`culture`} editable={true} chosen={this.character.culture} choices={Object.values(Cultures).map(choice => new choice())} groupName={"Culture"} handleChange={(newCulture, oldCulture) => this.handleCultureChange(newCulture, oldCulture)}/>
            Cultural Traits:
            <ul>{this.character.culture.lastTraits ? this.character.culture.lastTraits.map((trait, i) => 
                <li key={`cultural_trait_${trait.name}_${i}`}><ChoiceComponent chosen={trait} /></li>)
             : null}</ul>            
            {Object.entries(this.character.traitGroups).map(([key, traitGroup], i) => 
                <ChoiceComponent key={`trait_group_${key}_${i}`} editable={true} chosen={traitGroup.trait} choices={traitGroup.choices.map(choice => new choice())} groupName={traitGroup.name} handleChange={(newTrait, oldTrait) => this.handleTraitChange(newTrait, oldTrait)}/>)
            }
            <br />
            <b>Skills</b> <br />
            <VariableComponent showOwner={false} variable={this.character.diplomacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.strategy} /><br />
            <VariableComponent showOwner={false} variable={this.character.administration} /><br />
            <br />
            <b>Attributes</b> <br />
            <VariableComponent showOwner={false} variable={this.character.legitimacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.administrativeEfficiency} /><br />
            <br />
            <b>Faction</b> <br />
            <FactionComponent faction={this.character.faction} /><br />
        </div>
    }
}

// Notes
// - use linear modifier thing for admin efficency
// - Faction:
//     - Do faction name and privileges
//     - Need to make the faction UI (probably it's own component) for changing privileges
//     - How to handle invalid states? How to handle legitimacy change?
//            - Finish the confirm button which shows the effects of confirming (legitimacy drops temporarily)
//            - Force-stop the timer while tentatively changing
// - Make diplomacy affect support (only a little?)
// - Link events in with character stats. Make events have temporary effects to support, or more rarely, to legitimacy
// - Add in revolutions by trending on negative support?
// - (later?) Religion