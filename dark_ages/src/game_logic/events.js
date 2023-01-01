import { getButtonUnstyledUtilityClass } from "@mui/base";
import { Logger } from "./logger";
import { rollSuccess, successToNumber, successToTruthy, majorFailureText, majorSuccessText, successText, getProbabilities, defaultMajorModifier, failureText } from "./rolling";
import { daysInYear } from "./seasons";
import { ChangePopulationBonus, ChangePriceBonus, GeneralProductivityBonus, HealthBonus, SettlementBonus, SpecificBuildingChangeSizeBonus, SpecificBuildingEfficiencyBonus, SpecificBuildingProductivityBonus, TemporaryHappinessBonus, TemporaryHealthBonus } from "./settlement/bonus";
import { Church, Farm, IronMine, LumberjacksHut } from "./settlement/building";
import { Resources } from "./settlement/resource";
import UIBase from "./UIBase";
import { CustomTooltip, percentagize, randomRange, roundNumber, titleCase } from "./utils";
import {Box, Button, Modal, Typography} from "@mui/material";
import { Variable, multiplication, VariableModifier } from "./UIUtils";
import { toHaveDisplayValue } from "@testing-library/jest-dom/dist/matchers";

const forceLastCheckedDebug = true; // Force all events to fire on day 2 if this is set to true (besides Harvest and other manual overrides)
const forceFireEvents = true; // Force all events to fire no matter what eventShouldFire_() says
// Setting both of the above the true can make debugging events easier as it forces them all to fire on day 2 

class Event {
    constructor(props) {
        this.name = props.name;
        this.timer = props.timer;
        this.checkEvery = Math.round(props.checkEvery);
        this.read = false;
        this.bannedUntil = -1e9;
        if (this.checkEvery === undefined || !this.timer) {
            throw Error()
        }
        if (forceLastCheckedDebug) {
            this.lastChecked = Math.min(-1, -this.checkEvery + 1);
        } else {
            this.lastChecked = Math.min(-1, Math.round((-this.checkEvery + 1)*(0.5+0.5*Math.random())));
        }
        this.eventDuration = props.eventDuration ? new Variable({startingValue: props.eventDuration}) : new Variable({startingValue: this.checkEvery});
        this.lastTriggered = null;
        this.lastEnded = null;
        this.forcePause = props.forcePause || false;
        this.pause = props.pause || false;
        this.timer.subscribe(() => {
            this.triggerChecks();
        });
        if (this.eventDuration) {
            this.eventDuration.subscribe(() => {
                this.triggerChecks();
            });
        }
        if (props.triggerChecks) {
            this.triggerChecks(); // Used if subclass (e.g. SettlementEvent) needs to triggerChecks separately
        }
    }
    setEventBan(banLength) { // Disables event for some amount of days
        if (this.timer.currentValue + banLength > this.bannedUntil) {
            this.bannedUntil = this.timer.currentValue + banLength;
        }
    }
    triggerChecks() {
        this.endIfShouldEnd();
        if (!this.isActive() && (this.lastChecked === null || (this.timer.currentValue - this.lastChecked) % Math.round(this.checkEvery) === 0)) {
            this.lastChecked = this.timer.currentValue;
            let notBanned = this.timer.currentValue > this.bannedUntil;
            if ((forceFireEvents || this.eventShouldFire()) && notBanned) {
                this.lastTriggered = this.timer.currentValue;
                this.fire();
                if (this.forcePause) {
                    this.timer.forceStopTimer("Event: " + this.name); // it's up to the subclasses to unpause
                } else if (this.pause) {
                    this.timer.stopTimer();
                }
                this.read = false;
            }
        }
    }
    endIfShouldEnd() {
        if (this.eventDuration && this.isActive() && this.daysLeft() <= 0) {
            console.log("event ended");
            this.lastEnded = this.timer.currentValue;
            this.end();
        }
    }
    isActive() {
        return this.lastTriggered !== null && (this.lastEnded === null || this.lastTriggered >= this.lastEnded);
    }
    daysLeft() {
        return this.eventDuration.currentValue - (this.timer.currentValue - this.lastTriggered);
    }        
    eventShouldFire() {
        throw Error("this is an abstract class, extend it")
    }
    fire() {
        throw Error("this is an abstract class, extend it")
    }
    end() {
        throw Error("this is an abstract class, extend it")
    }
    getText() {
        throw Error("this is an abstract class, extend it")
    }
    activatEventChoice(eventChoice) {
        throw Error("this is an abstract class, extend it")
    }
    deactivatEventChoice(eventChoice) {
        throw Error("this is an abstract class, extend it")
    }
}

class EventEffect {
    constructor(props) {
        this.name = props.name;
    }
    activate(event) {
        
    }
    deactivate(event) {
    }
    getEffectText() {
        throw Error("this is an abstract class, extend it")
    }
}

class ChangeEventDuration extends EventEffect {
    constructor(props) {
        super({props, name: "Change Event duration"});
        this.amount = props.amount;
        this.modifier = new VariableModifier({startingValue: this.amount, type: multiplication});
    }
    activate(event) {
        event.eventDuration.addModifier(this.modifier);
    }
    deactivate(event) {
        console.log("deactive event effect");
        event.eventDuration.removeModifier(this.modifier);
    }
    getEffectText() {
        return `Change event duration by ${percentagize(this.amount)}%`
    }
}

class TemporaryEventDisabled extends EventEffect {
    constructor(props) {
        super({props, name: "Disable event temporarily"});
        this.amount = props.amount;
    }
    activate(event) {
        event.setEventBan(this.amount);
    }
    deactivate(event) {
    }
    getEffectText() {
        return `This event cannot fire for another ${this.amount} days`
    }
}

class EventChoice {
    constructor(props) {
        this.name = props.name;
        this.effects = props.effects;
    }
    getEffects() {
        return this.effects;
    }
    getText() {
        let text = [this.name];
        text = text.concat(this.effects.map(effect => effect.getEffectText()));
        return text;
    }
}

class ProbabilisticEventChoice extends EventChoice {
    constructor(props) {
        super(props);
        this.successChance = props.successChance;
        this.majorModifier = props.majorModifier || defaultMajorModifier;
        this.majorSuccessEffects = props.majorSuccessEffects || null;
        this.successEffects = props.successEffects;
        this.failureEffects = props.failureEffects || null;
        this.majorFailureEffects = props.majorFailureEffects || null;
        this.didSucceed = null;
        this.lastRoll = null;
        if (this.successChance === undefined || this.successEffects === undefined) {    
            throw Error("undefined variables for event choice");
        }
    }
    getEffects() {
        this.lastRoll = rollSuccess(this.successChance.currentValue, this.majorModifier);
        return this.effects.concat(this.getEffectsWithRoll(this.lastRoll));
    }
    getEffectsWithRoll(roll) {
        if (roll === majorSuccessText || roll === successText) {
            if (this.majorSuccessEffects && roll === majorSuccessText) {
                return this.majorSuccessEffects;
            } else {
                return this.successEffects || [];
            }
        } else if (roll === majorFailureText || roll === failureText) {
            if (this.majorFailureEffects && roll === majorFailureText) {
                return this.majorFailureEffects;
            } else {
                return this.failureEffects || [];
            }
        } else { throw Error(); }
    }
    getText() {
        let text = [this.name];
        if (this.effects.length) {
            text.push("Has the following effects:")
            text = text.concat(this.effects.map(effect => effect.getEffectText()));
        }
        let probs = getProbabilities(this.successChance.currentValue);
        if (this.lastRoll === null) {
            let majorSuccess = this.majorSuccessEffects !== null;
            let introText = `There is a ${percentagize(majorSuccess ? 1+probs.successText : 1+this.successChance.currentValue)}% of success`;
            if (this.successEffects.length > 0) {
                introText += ' which gives the following effects:'
            }
            text.push(introText)
            text = text.concat(this.successEffects.map(effect => effect.getEffectText()));
            if (majorSuccess) {
                text.push(``)
                text.push(`There is also a ${percentagize(1+probs.majorSuccessText)}% chance of major success, which gives the following effects:`)
                if (this.majorSuccessEffects.length === 0) {
                    text.push('No effect');
                }
                text = text.concat(this.majorSuccessEffects.map(effect => effect.getEffectText()));               
            }
            let majorFail = this.majorFailureEffects !== null;
            if (this.failureEffects !== null) {
                text.push(``)
                text.push(`On failure, the following effects will trigger:`)
                text = text.concat(this.failureEffects.map(effect => effect.getEffectText()));
            }
            if (majorFail) {
                text.push(``)
                text.push(`There is also a ${percentagize(1+probs.majorFailureText)}% chance of major failure, which gives the following effects:`)
                if (this.majorFailureEffects.length === 0) {
                    text.push('No effect');
                }
                text = text.concat(this.majorFailureEffects.map(effect => effect.getEffectText()));               
            }
        } else {
            text.push(`Rolled ${this.lastRoll}`);
            text = text.concat(this.getEffectsWithRoll(this.lastRoll).map(effect => effect.getEffectText()));
        }
        return text;
    }
}

class SettlementEvent extends Event {
    constructor(props) {
        super(props);
        this.settlements = props.settlements;
        this.lastBonuses = null;
        this.choiceApplied = false;
        this.appliedChoice = null;
        this.singleSettlement = props.singleSettlement;
        if (this.singleSettlement === undefined) {  
            this.singleSettlement = true;
        }
        if (this.singleSettlement && this.settlements.length !== 1) {
            throw Error("this is a single-settlement event")
        }
    }
    eventShouldFire() {
        return this.eventShouldFire_(this.timer.currentValue, this.settlements);
    }
    fire() {
        if (this.fire_) {
            return this.fire_(this.timer.currentValue, this.settlements);
        } else {
            let bonuses = this.getBonuses(this.timer.currentValue, this.settlements);
            this.deactivateBonusesAndEventEffects();
            this.choiceApplied = false;
            this.appliedChoice = null;
            bonuses.forEach( bonus => {
                this.settlements.forEach( settlement => {
                    settlement.activateBonus(bonus);
                });
            });
            this.lastBonuses = bonuses;
        }
    }
    deactivateBonusesAndEventEffects() {
        if (this.lastBonuses) {
            this.lastBonuses.forEach( bonus => {
                this.settlements.forEach( settlement => {
                    settlement.deactivateBonus(bonus);
                });
            });
        }     
        if (this.appliedChoice) {
            this.appliedChoice.getEffects().forEach(effect => {
                this.deactivateEventEffect(effect);
            });
        }
    }
    getBonuses() {
        throw Error("this is an abstract class, extend it"); 
    }
    getEventChoices() {
        throw Error("this is an abstract class, extend it"); 
    }
    applyChoice(eventChoice) {
        if (this.choiceApplied) {
            throw Error("shouldn't apply choice twice");
        }
        this.choiceApplied = true;
        eventChoice.getEffects().forEach(effect => {
            this.activateEventEffect(effect);
        });
        this.appliedChoice = eventChoice;
        if (this.forcePause) {
            this.timer.unforceStopTimer("Event: " + this.name);
        }
    }
    activateEventEffect(eventEffect) {
        if (eventEffect instanceof EventEffect) {
            eventEffect.activate(this);
        } else if (eventEffect instanceof SettlementBonus) {
            this.settlements.forEach(settlement => eventEffect.activate(settlement));
        } else {
            throw Error("what")
        }
    }
    deactivateEventEffect(eventEffect) {
        if (eventEffect instanceof EventEffect) {
            eventEffect.deactivate(this);
        } else if (eventEffect instanceof SettlementBonus) {
            eventEffect.deactivate(eventEffect);
        } else {
            throw Error("what")
        }
    }
    end() {
        if (this.end_) {
            return this.end_(this.timer.currentValue, this.settlements);
        } else {
            this.deactivateBonusesAndEventEffects();
            this.lastBonuses = null;
            this.choiceApplied = false;
            this.appliedChoice = null;
        }
    }
    getText() {
        let text = [`Event ${this.name} will last for ${this.eventDuration ? this.eventDuration.currentValue : 0} days and has following effects:`];
        text = text.concat(this.lastBonuses ? this.lastBonuses.map(bonus => bonus.getEffectText()) : [''])
        if (this.bonusFlavourText) {
            text = [this.bonusFlavourText].concat(text);
        }
        return text;
    }
}

class RegularSettlementEvent extends SettlementEvent {
    constructor(props) {
        let variance = props.variance || 0;
        super({checkEvery: props.checkEveryAvg * randomRange(1-variance, 1+variance), ...props});
        this.checkEveryAvg = props.checkEveryAvg;
        this.variance = props.variance || 0;
    }
    eventShouldFire() {
        let eventShouldFire = this.eventShouldFire_();
        this.checkEvery = this.checkEveryAvg * randomRange(1-this.variance, 1+this.variance);
        return eventShouldFire;
    }
}

export class CropBlight extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "crop blight",
            checkEveryAvg: daysInYear,
            variance: 0.5, 
            eventDuration:  daysInYear / 2,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.2));
    }
    getEventChoices() {
        if (this.settlements.length !== 1) {
            throw Error("this is a single-settlement event")
        }
        if (this.choiceApplied) {
            return [];
        }
        let amount = -1 * Math.min(1, Math.round(0.5 + this.settlements[0].getBuildingByName(Farm.name).size.currentValue * 0.2));
        return [
            new EventChoice({name: "Wait it out", effects: []}),
            new EventChoice({name: "Destroy some fields to limit the damage", effects: [
                new SpecificBuildingChangeSizeBonus({building: Farm.name, amount}),
                new ChangeEventDuration({amount: 0.5})
            ]})
        ]
    }
    getBonuses() {
        this.cropBlightModifier = 0.9 - 0.2*Math.random();
        return [new SpecificBuildingProductivityBonus({name: "effect of crop blight", building: Farm.name, amount: this.cropBlightModifier})];
    }
}

export class LocalMiracle extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "local miracle",
            checkEveryAvg: daysInYear*4,
            variance: 0.25, 
            eventDuration:  roundNumber(daysInYear*0.75, 0),
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.25));
    }
    getEventChoices() {
        return [];
    }
    getBonuses() {
        let happinessModifier = 0.2;
        return [new TemporaryHappinessBonus({
            name: "effect of local miracle", 
            amount: happinessModifier,
            duration: this.eventDuration.currentValue,
            timer: this.timer
        })];
    }
}

export class MineShaftCollapse extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "iron mine shaft collapse",
            checkEveryAvg: daysInYear*2,
            variance: 0.5, 
            eventDuration: 1,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() {
        if (this.settlements.length !== 1) {
            throw Error("this is a single-settlement event")
        }
        let mine = this.settlements[0].getBuildingByName(IronMine.name);
        if (!mine || mine.size.currentValue === 0) {
            return false;
        }
        this.numWorkers = mine.filledJobs.currentValue;
        return successToTruthy(rollSuccess(0.2));
    }
    getEventChoices() {
        if (this.settlements.length !== 1) {
            throw Error("this is a single-settlement event")
        }
        if (this.choiceApplied) {
            return [];
        }
        let amount = -1 * Math.max(1, Math.round(0.5 + this.settlements[0].getBuildingByName(Farm.name).size.currentValue * 0.3));
        return [
            new EventChoice({name: "Destroy the dangerous shafts", effects: [
                new SpecificBuildingChangeSizeBonus({building: IronMine.name, amount}),
            ]}),
            new EventChoice({name: "Do nothing", effects: [
                new TemporaryHappinessBonus({
                    name: "dissapointed at response to mine collapse", 
                    amount: -0.07,
                    duration: roundNumber(daysInYear, 0),
                    timer: this.timer
                })
            ]})
        ];
    }
    getBonuses() {
        let numDied = Math.round(Math.min(5, Math.max(1, this.numWorkers*0.15)));
        return [new ChangePopulationBonus({
            name: "death from mine collapse", 
            amount: -numDied
        }), new TemporaryHappinessBonus({
            name: "grieving death from mine collapse", 
            amount: -0.03,
            duration: roundNumber(daysInYear*0.75, 0),
            timer: this.timer
        })];
    }
}

export class Fire extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "fire!",
            checkEveryAvg: daysInYear*3,
            variance: 0.35, 
            eventDuration: 1,
            pause: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.25));
    }
    getEventChoices() {
        return [];
    }
    getBonuses() {
        let bonuses = [];
        let success = rollSuccess(0.15);
        let buildings = this.settlements[0].getBuildings().filter(building => building.size.currentValue > 0 && building.flammable);
        if (buildings.length === 0) {
            console.log("WARN: couldn't find a building to burn, this is weird");
            return [];
        }
        let building = buildings[Math.floor(Math.random()*buildings.length)];
        let successNumber = successToNumber(success, 1);
        let buildingSizeChange = -1*Math.round(Math.max(1, Math.min(building.size.currentValue, (0.3-0.2*successNumber)*building.size.currentValue)));
        bonuses.push(new SpecificBuildingChangeSizeBonus({building: building.name, amount: buildingSizeChange}));
        if (!successToTruthy(success)) {
            let numDead = Math.round(Math.max(1, Math.min(10, building.size.currentValue*(0.5-successNumber)))); // successNumber negative here
            bonuses.push(new ChangePopulationBonus({
                name: "death from fire", 
                amount: -numDead
            }), new TemporaryHappinessBonus({
                name: "grieving death from fire", 
                amount: 0.04*successNumber, // successNumber negative here
                duration: roundNumber(daysInYear*0.75, 0),
                timer: this.timer
            }));
        }
        return bonuses;
    }
}

export class Pestilence extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "pestilence",
            checkEveryAvg: daysInYear*4,
            variance: 0.35, 
            eventDuration: daysInYear*0.65,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.25));
    }
    getEventChoices() {
        return [
            new EventChoice({name: "Do nothing", effects: [
                new HealthBonus({
                    name: "pestilence spreading", 
                    amount: 0.7,
                })
            ]}),
            new EventChoice({name: "Quarantine the sick", effects: [
                new GeneralProductivityBonus({
                    name: "the sick are quarantined",
                    amount: 0.9
                }),
                new HealthBonus({
                    name: "pestilence slightly spreading", 
                    amount: 0.85,
                }),
                new ChangeEventDuration({
                   amount: 0.85
                })
            ]}),
            new EventChoice({name: "Quarantine the sick and their families", effects: [
                new GeneralProductivityBonus({
                    name: "the sick & their family quarantined",
                    amount: 0.7
                }),
                new ChangeEventDuration({
                    amount: 0.5
                })
            ]})
        ];
    }
    getBonuses() {
        let bonuses = [];
        let success = rollSuccess(0.5);
        let successNumber = successToNumber(success, 2); // can be -3,-1,1,3
        let healthDamage = Math.min(0.35, Math.max(0.05, 0.07*(2-0.7*successNumber)));
        bonuses.push(new HealthBonus({
            name: "pestilence", 
            amount: 1 - healthDamage,
        }));
        return bonuses;
    }
}

export class WolfAttack extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "wolf attack",
            checkEveryAvg: daysInYear*3,
            variance: 0.35, 
            eventDuration: 1,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.25));
    }
    getEventChoices() {
        return [
            new EventChoice({name: "Do nothing", effects: [
                new TemporaryHappinessBonus({
                    name: "did nothing about wolf attack", 
                    amount: -0.05,// this number is negative
                    duration: roundNumber(daysInYear, 0),
                    timer: this.timer
                })
            ]}),
            new ProbabilisticEventChoice({name: "Hunt the wolves down", effects: [],
                successChance: new Variable({startingValue: 0.65}), successEffects: [
                    // Need to fill this out
                    new TemporaryEventDisabled({
                        amount: 4*this.checkEveryAvg
                    })
                ], majorFailureEffects: [
                    new ChangePopulationBonus({
                        name: "death from wolf hunting down wolves", 
                        amount: -1
                    })
                ]
            })
        ];
    }
    getBonuses() {
        let bonuses = [];
        let success = rollSuccess(0.4);
        let successNumber = successToNumber(success, 2); // can be -3,-1,1,3
        this.bonusFlavourText = "Some wolves attacked and "
        if (success !== majorSuccessText) {
            let population = this.settlements[0].populationSizeExternal.currentValue;
            let numDead = -Math.round(Math.min(7, Math.max(1, (2 - successNumber)*population/50.0)))
            bonuses.push(new ChangePopulationBonus({
                name: "death from wolf attack", 
                amount: numDead
            }));
            bonuses.push(new TemporaryHappinessBonus({
                name: "grieving death from wolf attack", 
                amount: 1 + 0.05*(-2 + successNumber),// between 0.95 and 0.75, mulitplicative
                duration: roundNumber(daysInYear, 0),
                type: multiplication,
                timer: this.timer
            }));
            this.bonusFlavourText += "they killed some villagers";
        } else {
            this.bonusFlavourText += "we got lucky, no one was hurt";
        }

        return bonuses;
    }
}

export class HarvestEvent extends SettlementEvent {
    constructor(props) {
        super({
            name: "harvest event",
            checkEvery: daysInYear,
            singleSettlement: false,
            ...props
        });
        // this.triggerChecks(); // Harvest fires immediately
        this.lastChecked = -this.checkEvery; // Harvest fires on day one of the year
    }
    eventShouldFire_(day, settlements) {
        return true;
    }
    getBonuses() {
        this.harvestSuccess = rollSuccess(0.7);
        let harvestSuccess  = successToNumber(this.harvestSuccess, 3);
        this.harvestModifier = 0.95 + 0.05*harvestSuccess; // varies between ~0.75 and ~1.15
        return [
            new SpecificBuildingProductivityBonus({name: "effect of weather on the harvest", building: Farm.name, amount: this.harvestModifier}),
            new ChangePriceBonus({name: "effect of weather on the harvest", resource: Resources.food, amount: 1/this.harvestModifier})
        ];
    }
}

export class EventComponent extends UIBase {
    constructor(props) {
        super(props);
        this.event = props.event;
        this.addVariables([this.event.timer]);
    }
    setModalOpen(modalOpen) {
        this.setState({modalOpen: modalOpen});
        if (modalOpen === true) {
            this.event.read = true;
        }
    }
    childRender() {
        this.event = this.props.event;
        console.log(this.event.appliedChoice);
        return <div><CustomTooltip items={this.event.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center", color: this.event.read ? "black" : "red"}}>
            <span onClick={()=>{Logger.setInspect(this.event); this.setModalOpen(true);}}>{titleCase(this.event.name)}</span>
        </CustomTooltip>
            <Modal
            open={this.state.modalOpen || false}
            onClose={() => this.setModalOpen(false)}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
            >
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600,
                bgcolor: 'background.paper',
                border: '2px solid #000',
                boxShadow: 24,
                p: 4,
                }}>
                <Typography id="modal-modal-title" variant="h6" component="h2">
                Event: {this.event.name}
                </Typography>
                <div>
                    {this.event.getText().map((text, i) => {return <span key={i}>{text}<br /></span>})}
                </div>
                <br />
                {!this.event.appliedChoice && this.event.getEventChoices ? this.event.getEventChoices().map((choice, i) => {
                    return <div key={i}><CustomTooltip key={i} items={choice.getText()} style={{textAlign:'center', alignItems: "center", justifyContent: "center"}}>
                        <Button variant='outlined' onClick={() => {this.event.applyChoice(choice);}}>{choice.name}</Button>
                    </CustomTooltip></div>
                }) : ''}
                <br />
                {this.event.appliedChoice ? 
                    <div>
                        You chose to: {this.event.appliedChoice.getText().map((text, i) => {return <span key={i}>{text}<br /></span>})}
                    </div>
                : ''}
                <Button variant='outlined' onClick={() => this.setModalOpen(false)}>Close</Button>
            </Box>
        </Modal></div>
    }
}