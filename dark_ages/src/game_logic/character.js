import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import TextField from "@mui/material/TextField";
import React from "react";
import { AdministrationBonus, Bonus, CharacterBonus, DiplomacyBonus, LegitimacyBonus, SettlementBonus, StrategyBonus } from "./settlement/bonus";
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
}

export class Celtic extends Culture {
    constructor(props) {
        super({...props, name: "celtic"})
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
        text = text.concat(this.effects ? this.effects.map(bonus => bonus.getEffectText()) : [''])
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


export const ChildhoodTraits = [NobleUpbringing, MilitaryUpbringing, MerchantUpbringing];

export class Character {
    constructor(props) {
        this.name = props.name || "Unnamed Character";
        this.faction = props.faction || null;
        this.culture = props.culture;
        if (!this.culture) {
            throw Error("everyone needs a culture")
        }
        this.legitimacy = new Variable({name:`legitimacy`, startingValue:0.2});
        this.diplomacy = new Variable({name:`diplomacy`, startingValue:props.diplomacy});
        this.strategy = new Variable({name:`strategy`, startingValue:props.strategy});
        this.administration = new Variable({name:`administration`, startingValue:props.administration});
        this.childhoodTrait = props.childhoodTrait;
        this.personalityTrait = props.personalityTrait;
        this.knownForTrait = props.knownForTrait;
        this.traits = [];
    }
    addTrait(trait) {
        trait.activate(this);
        this.traits.push(trait);
        if (ChildhoodTraits.some(chTrait => trait instanceof chTrait)) {
            if (this.childhoodTrait) {
                throw Error("setting childhood traits twice");
            }
            this.childhoodTrait = trait;
        }
    }
    removeTrait(trait) {
        trait.deactivate(this);
        const index = this.traits.indexOf(trait);
        if (index > -1) { // only splice array when item is found
            this.traits.splice(index, 1); // 2nd parameter means remove one item only
        }
        if (ChildhoodTraits.some(chTrait => trait instanceof chTrait)) {
            this.childhoodTrait = null;
        }
    }
    activateBonus(bonus) {
        if (bonus instanceof CharacterBonus) {
            bonus.activate(this);
        } else if (bonus instanceof SettlementBonus) {
            // handle these
            throw Error("didn't recognise bonus")
        } else {
            throw Error("didn't recognise bonus")
        }
    }
    deactivateBonus(bonus) {
        if (bonus instanceof CharacterBonus) {
            bonus.deactivate(this);
        } else if (bonus instanceof SettlementBonus) {
            // handle these
            throw Error("didn't recognise bonus")
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
            {!this.edit ? 
            <div onClick = {() => !this.edit && this.choices ? this.setState({edit: !this.state.edit}) : null}>
                <CustomTooltip items={this.trait.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                    <span>{this.traitGroupName ? `${this.traitGroupName}: ` : null}{this.trait.name}</span>
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
        let childhoodTraits = ChildhoodTraits.map(trait => new trait());
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
            {<TraitComponent key={`childhood trait`} trait={this.character.childhoodTrait} choices={childhoodTraits} traitGroupName={"Childhood trait"} handleTraitChange={(newTrait, oldTrait) => this.handleTraitChange(newTrait, oldTrait)}/>}
            <VariableComponent showOwner={false} variable={this.character.legitimacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.diplomacy} /><br />
            <VariableComponent showOwner={false} variable={this.character.strategy} /><br />
            <VariableComponent showOwner={false} variable={this.character.administration} /><br />
            All traits: <br />
            {this.character.traits.map((trait, i) => <TraitComponent key={`trait_${trait.name}_${i}`} trait={trait}></TraitComponent>)}
        </div>
    }
}

// Character traits should be:
// - Make a TraitComponent for displaying traits and their effects
// - Faction
// - Culture
// - Skills: Diplomacy, Strategy, Administration
// - (later?) Religion