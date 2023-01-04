import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import TextField from "@mui/material/TextField";
import React from "react";
import { AdministrationBonus, Bonus, CharacterBonus, HealthBonus, DiplomacyBonus, GeneralProductivityBonus, LegitimacyBonus, SettlementBonus, SpecificBuildingProductivityBonus, SpecificBuildingEfficiencyBonus, StrategyBonus } from "./settlement/bonus";
import { Apothecary, HuntingCabin, LumberjacksHut } from "./settlement/building";
import UIBase from "./UIBase";
import { addition, multiplication, Variable, VariableComponent, VariableModifier } from "./UIUtils";
import { CustomTooltip, percentagize, roundNumber, titleCase } from "./utils";
import { unnamedVariableName } from "./variable/variable";

export class Faction {
    constructor(props) {
        this.name = props.name || "Unnamed Faction";
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
    getText(extensive=false) {
        let text = [`Culture ${this.name} has following traits:`];
        text = text.concat(this.lastTraits ? this.lastTraits.map(trait => extensive ? trait.getText() : trait.name).flatten() : [''])
        return text;
    }
}

export const Cultures = {
    Celtic: new Celtic(),
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
        text = text.concat(this.pastEffects ? this.pastEffects.map(bonus => bonus.getEffectText()) : [''])
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
            new DiplomacyBonus({amount: TraitScaler, type: addition}),
        ]})
    }
}

export class Careful extends Trait {
    constructor() {
        super({name: "careful", effects: [
            new AdministrationBonus({amount: TraitScaler, type: addition}),
        ]})
    }
}

export class Brave extends Trait {
    constructor() {
        super({name: "strategic", effects: [
            new StrategyBonus({amount: TraitScaler, type: addition})
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
        this.culture = props.culture;
        if (!this.culture) {
            throw Error("everyone needs a culture")
        }
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
            this.settlements.forEach(settlement => settlement.deactivate(bonus));
        } else {
            throw Error("didn't recognise bonus")
        }  
    }
}

export class TraitComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {edit: false};
    }
    render() {
        this.trait = this.props.trait;
        this.traitGroupName = this.props.traitGroupName;
        this.choices = this.props.choices;
        this.edit = this.state.edit;
        if (!this.trait && this.choices) {
            this.edit = true;
        }
        return <div>
            {!this.edit && this.trait ? 
            <div onClick = {() => !this.edit && this.choices ? this.setState({edit: !this.state.edit}) : null}>
                <CustomTooltip items={this.trait.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                    <span>{this.traitGroupName ? `${titleCase(this.traitGroupName)}: ` : null}{titleCase(this.trait.name)}</span>
                </CustomTooltip>
            </div> :
            <FormControl fullWidth size={"small"}>
                <InputLabel id="demo-simple-select-label">{this.traitGroupName}</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={this.trait || ''}
                    label={this.traitGroupName}
                    onChange={(e) => {this.props.handleTraitChange(e.target.value, this.trait); this.setState({edit: false});}}
                >
                    {this.choices.map((choice,i) => {
                        return <MenuItem key={choice.name+i} value={choice}><TraitComponent trait={choice} edit={false}/></MenuItem>
                    })}
                </Select>
            </FormControl>}
        </div>
    }
}

export class CharacterComponent extends UIBase {
    constructor(props) {
        super(props);
        this.addVariables([props.character.legitimacy]);
    }
    handleTraitChange(newTrait, oldTrait) {
        console.log(oldTrait);
        if (oldTrait) {
            this.character.removeTrait(oldTrait);
        }
        this.character.addTrait(newTrait);
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
            <p>
            Faction: {this.character.faction ? titleCase(this.character.faction.name) : "None"}<br />
            Culture: {this.character.culture ? titleCase(this.character.culture.name) : "None"}<br />
            </p>
            <br />
            {Object.entries(this.character.traitGroups).map(([key, traitGroup]) => 
                <TraitComponent key={`${key}`} trait={traitGroup.trait} choices={traitGroup.choices.map(choice => new choice())} traitGroupName={traitGroup.name} handleTraitChange={(newTrait, oldTrait) => this.handleTraitChange(newTrait, oldTrait)}/>)
            }
            <br />
            Skills <br />
            <VariableComponent showOwner={false} variable={this.character.diplomacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.strategy} /><br />
            <VariableComponent showOwner={false} variable={this.character.administration} /><br />
            Attributes <br />
            <VariableComponent showOwner={false} variable={this.character.legitimacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.administrativeEfficiency} /><br />
        </div>
    }
}

// Notes
// - Do culture part 
//     - Celtic: druids (health+apothecary), elected kings (legitimacy), foresters (lumberjack prod. + hunting size/prod)
//     - 
// - Faction
// - (later?) Religion