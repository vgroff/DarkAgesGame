import { Logger } from "./logger";
import { rollSuccess, successToNumber, successToTruthy, majorFailureText, majorSuccessText, successText, getProbabilities, defaultMajorModifier, failureText } from "./rolling";
import { daysInYear } from "./seasons";
import { ChangePopulationBonus, ChangePriceBonus, GeneralProductivityBonus, HealthBonus, SettlementBonus, SimpleSettlementModifier, SpecificBuildingChangeSizeBonus, SpecificBuildingProductivityBonus, TemporaryGeneralProductivityBonus, TemporaryHappinessBonus, TemporaryHealthBonus, TemporaryLocalLegitimacyBonus } from "./settlement/bonus";
import { Farm, HuntingCabin, IronMine } from "./settlement/building";
import { Resources } from "./settlement/resource";
import UIBase from "./UIBase";
import { CustomTooltip, HTMLTooltip, percentagize, randomRange, roundNumber, titleCase } from "./utils";
import {Box, Button, Grid, Modal, Typography} from "@mui/material";
import { Variable, VariableComponent, multiplication, VariableModifier, addition } from "./UIUtils";
import { winter } from "./seasons";
import React from "react";

const forceLastCheckedDebug = false; // Force all events to fire on day 2 if this is set to true (besides Harvest and other manual overrides)
const forceFireEvents = false; // Force all events to fire no matter what eventShouldFire_() says
// Setting both of the above to true can make debugging events easier as it forces them all to fire on day 2

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
            this.lastChecked = Math.min(-1, -this.checkEvery);
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
                Logger.info(`Event fired: ${this.name}`, { day: this.timer.currentValue, duration: this.eventDuration?.currentValue });
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
            Logger.debug(`Event ended: ${this.name}`, { day: this.timer.currentValue });
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
                bonus.setOrigin("Event:" + this.name);
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
        Logger.info(`Event choice applied: ${this.name} → "${eventChoice.name}"`, { day: this.timer.currentValue });
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
            this.settlements.forEach( settlement => {
                eventEffect.deactivate(settlement);
            });
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
            variance: 0.45, 
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
        Logger.info(`Crop blight: farm productivity modifier ${this.cropBlightModifier.toFixed(3)}`, { day: this.timer.currentValue });
        return [new SpecificBuildingProductivityBonus({name: "effect of crop blight", building: Farm.name, amount: this.cropBlightModifier})];
    }
}

export class LocalMiracle extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "local miracle",
            checkEveryAvg: daysInYear*4,
            variance: 0.25, 
            eventDuration:  roundNumber(daysInYear*1.5, 0),
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
                    amount: -0.05,
                    duration: roundNumber(daysInYear*1.5, 0),
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
            duration: roundNumber(daysInYear, 0),
            timer: this.timer
        })];
    }
}

export class Fire extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "fire!",
            checkEveryAvg: daysInYear*3,
            variance: 0.45, 
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
                duration: roundNumber(daysInYear*1.5, 0),
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
        this.severity = 1;
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
        // Roll severity 1-3 (hidden from player — they just see the effects)
        this.severity = Math.ceil(Math.random() * 3); // 1=mild, 2=moderate, 3=severe
        const severityScale = [0.6, 1.0, 1.6][this.severity - 1];
        const success = rollSuccess(0.5);
        const successNumber = successToNumber(success, 2); // -3, -1, 1, 3
        const healthDamage = Math.min(0.35, Math.max(0.05, 0.07 * (2 - 0.7 * successNumber) * severityScale));

        // Duration scales with severity: 0.5, 0.65, 0.85 years
        const durationScale = [0.5, 0.65, 0.85][this.severity - 1];
        this.eventDuration.setNewBaseValue(
            Math.round(daysInYear * durationScale),
            'pestilence severity'
        );

        // Flavour text based on severity
        const severityTexts = [
            "A mild illness is spreading through the settlement.",
            "A serious pestilence has broken out.",
            "A devastating plague has struck the settlement."
        ];
        this.bonusFlavourText = severityTexts[this.severity - 1];

        Logger.info(`Pestilence: severity ${this.severity}, health damage ${healthDamage.toFixed(3)}, duration ${this.eventDuration.currentValue} days`, { day: this.timer.currentValue, severity: this.severity, healthDamage });

        return [new HealthBonus({
            name: "pestilence",
            amount: 1 - healthDamage,
        })];
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
                successChance: new Variable({startingValue: 0.2, modifiers:[
                    new VariableModifier({variable: this.settlements[0].leader.strategy, type: addition})
                ]}), successEffects: [
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

export class CourtIntrigue extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "court intrigue",
            checkEveryAvg: daysInYear*3.5,
            variance: 0.35, 
            eventDuration: 1,
            forcePause: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.35));
    }
    getEventChoices() {
        return [
            new EventChoice({name: "Do nothing", effects: [
                new TemporaryGeneralProductivityBonus({
                    name: "nobles acquired more power during court intrigue", timer: this.timer,
                    amount: 0.98, duration: daysInYear*20, type:multiplication
                })
            ]}),
            new ProbabilisticEventChoice({name: "Negotiate with them", effects: [],
                successChance: new Variable({startingValue: 0.15, modifiers:[
                    new VariableModifier({variable: this.settlements[0].leader.diplomacy, type: addition})
                ]}), 
                majorSuccessEffects: [
                    new TemporaryLocalLegitimacyBonus({
                        name: "consolidated power during court intrigue", timer: this.timer,
                        amount: 0.1, duration:daysInYear*15
                    })
                ],
                successEffects: [
                    new TemporaryEventDisabled({
                        amount: 2*this.checkEveryAvg
                    }),
                    new TemporaryLocalLegitimacyBonus({
                        name: "negotiated with nobles during court intrigue", timer: this.timer,
                        amount: 0.05, duration:daysInYear*15
                    })
                ], majorFailureEffects: [
                    new TemporaryLocalLegitimacyBonus({
                        name: "nobles acquire a lot more power during court intrigue", timer: this.timer,
                        amount: -0.05, duration:daysInYear*15
                    }),
                    new TemporaryGeneralProductivityBonus({
                        name: "nobles acquire a lot more power during court intrigue", timer: this.timer,
                        amount: 0.96, duration: daysInYear*10, type:multiplication
                    })
                ]
            }),
            new ProbabilisticEventChoice({name: "Use the law to outmaneouver them", effects: [],
                successChance: new Variable({startingValue: -0.1, modifiers:[
                    new VariableModifier({variable: this.settlements[0].leader.administration, type: addition})
                ]}), 
                majorSuccessEffects: [
                    new TemporaryEventDisabled({
                        amount: 5*this.checkEveryAvg
                    }),
                    new TemporaryLocalLegitimacyBonus({
                        name: "majorly outmaneouvered the nobles during court intrigue", timer: this.timer,
                        amount: 0.1, duration:daysInYear*15
                    })
                ],
                successEffects: [
                    new TemporaryEventDisabled({
                        amount: 3*this.checkEveryAvg
                    }),
                    new TemporaryLocalLegitimacyBonus({
                        name: "outmaneouvered the nobles during court intrigue", timer: this.timer,
                        amount: 0.05, duration:daysInYear*15
                    })
                ], majorFailureEffects: [
                    new TemporaryLocalLegitimacyBonus({
                        name: "outmaneouvered by the nobles during court intrigue", timer: this.timer,
                        amount: -0.02, duration:daysInYear*15
                    })
                ]
            })
        ];
    }
    getBonuses() {
        let bonuses = [];
        this.bonusFlavourText = "Some nobles are plotting to acquire more power"
        bonuses.push(
            new TemporaryLocalLegitimacyBonus({
                name: "plotting nobles", timer: this.timer,
                amount: 0.95, duration:daysInYear*5, type:multiplication
            })
        );
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
        // If true, the next getBonuses() call will produce a "success" (decent, not amazing) harvest.
        // Set by _applyScenario when goodFirstYearHarvest is enabled.
        this.forceGoodNextHarvest = props.forceGoodNextHarvest || false;
    }
    eventShouldFire_(day, settlements) {
        return true;
    }
    getBonuses() {
        if (this.forceGoodNextHarvest) {
            // Force a "success" outcome — decent but not amazing (modifier = 1.0)
            // successToNumber('success', 3) = 1, so 0.95 + 0.05*1 = 1.0
            this.forceGoodNextHarvest = false; // Only applies once
            this.harvestSuccess = successText;
            this.harvestModifier = 1.0;
        } else {
            this.harvestSuccess = rollSuccess(0.7);
            let harvestSuccess  = successToNumber(this.harvestSuccess, 3);
            this.harvestModifier = 0.95 + 0.05*harvestSuccess; // varies between ~0.75 and ~1.15
        }
        Logger.info(`Harvest result: ${this.harvestSuccess}`, { modifier: this.harvestModifier, day: this.timer.currentValue });
        return [
            new SpecificBuildingProductivityBonus({name: "effect of weather on the harvest", building: Farm.name, amount: this.harvestModifier}),
            new ChangePriceBonus({name: "effect of weather on the harvest", resource: Resources.food, amount: 1/this.harvestModifier})
        ];
    }
}

// ─── §3.3 New Events ──────────────────────────────────────────────────────────

export class WarmSpell extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "warm spell",
            checkEveryAvg: daysInYear * 2,
            variance: 0.4,
            eventDuration: Math.round(daysInYear / 2),
            ...props
        });
        this._coalModifier = null;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [
            new TemporaryHappinessBonus({
                name: "warm spell happiness",
                amount: 0.08,
                duration: this.eventDuration.currentValue,
                timer: this.timer
            })
        ];
    }
    fire_() {
        const bonuses = this.getBonuses();
        bonuses.forEach(bonus => {
            bonus.setOrigin("Event:" + this.name);
            this.settlements.forEach(s => s.activateBonus(bonus));
        });
        this.lastBonuses = bonuses;
        this.choiceApplied = false;
        this.appliedChoice = null;
        // Reduce coal demand
        this._coalModifier = new VariableModifier({
            name: "warm spell coal reduction",
            startingValue: -0.4,
            type: addition
        });
        this.settlements.forEach(s => {
            if (s.popDemands && s.popDemands.coal) {
                s.popDemands.coal.idealAmount.addModifier(this._coalModifier);
            }
        });
    }
    end_() {
        this.deactivateBonusesAndEventEffects();
        if (this._coalModifier) {
            this.settlements.forEach(s => {
                if (s.popDemands && s.popDemands.coal) {
                    try { s.popDemands.coal.idealAmount.removeModifier(this._coalModifier); } catch(e) {}
                }
            });
            this._coalModifier = null;
        }
        this.lastBonuses = null;
        this.choiceApplied = false;
        this.appliedChoice = null;
    }
}

export class MerchantBoom extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "merchant boom",
            checkEveryAvg: daysInYear * 3,
            variance: 0.35,
            eventDuration: Math.round(daysInYear / 3),
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SimpleSettlementModifier({
            name: "merchant boom trade factor",
            variableAccessor: "tradeFactor",
            amount: 0.3,
            type: addition
        })];
    }
}

export class HuntingGameSurplus extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "hunting game surplus",
            checkEveryAvg: daysInYear * 2,
            variance: 0.4,
            eventDuration: Math.round(daysInYear / 2),
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SpecificBuildingProductivityBonus({
            name: "hunting game surplus",
            building: HuntingCabin.name,
            amount: 1.3
        })];
    }
}

export class DryHuntingLands extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "dry hunting lands",
            checkEveryAvg: daysInYear * 2.5,
            variance: 0.4,
            eventDuration: Math.round(daysInYear * 0.65),
            ...props
        });
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getEventChoices() { return []; }
    getBonuses() {
        return [new SpecificBuildingProductivityBonus({
            name: "dry hunting lands",
            building: HuntingCabin.name,
            amount: 0.5
        })];
    }
}

export class Blizzard extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "blizzard",
            checkEveryAvg: daysInYear,
            variance: 0.3,
            eventDuration: 3,
            ...props
        });
        this._coalModifier = null;
        this._tradeModifier = null;
    }
    eventShouldFire_() {
        // Only fires in winter
        if (this.timer.translatedTime.season !== winter) return false;
        return successToTruthy(rollSuccess(0.2));
    }
    getEventChoices() { return []; }
    getBonuses() {
        return [
            new SpecificBuildingProductivityBonus({
                name: "blizzard farm penalty",
                building: Farm.name,
                amount: 0.75
            }),
            new GeneralProductivityBonus({
                name: "blizzard productivity penalty",
                amount: 0.85
            })
        ];
    }
    fire_() {
        const bonuses = this.getBonuses();
        bonuses.forEach(bonus => {
            bonus.setOrigin("Event:" + this.name);
            this.settlements.forEach(s => s.activateBonus(bonus));
        });
        this.lastBonuses = bonuses;
        this.choiceApplied = false;
        this.appliedChoice = null;
        this._coalModifier = new VariableModifier({
            name: "blizzard coal demand",
            startingValue: 1.0,
            type: addition
        });
        this._tradeModifier = new VariableModifier({
            name: "blizzard trade penalty",
            startingValue: -0.5,
            type: addition
        });
        this.settlements.forEach(s => {
            if (s.popDemands && s.popDemands.coal) {
                s.popDemands.coal.idealAmount.addModifier(this._coalModifier);
            }
            s.tradeFactor.addModifier(this._tradeModifier);
        });
    }
    end_() {
        this.deactivateBonusesAndEventEffects();
        this.settlements.forEach(s => {
            if (this._coalModifier && s.popDemands && s.popDemands.coal) {
                try { s.popDemands.coal.idealAmount.removeModifier(this._coalModifier); } catch(e) {}
            }
            if (this._tradeModifier) {
                try { s.tradeFactor.removeModifier(this._tradeModifier); } catch(e) {}
            }
        });
        this._coalModifier = null;
        this._tradeModifier = null;
        this.lastBonuses = null;
        this.choiceApplied = false;
        this.appliedChoice = null;
    }
}

export class RatsInStorage extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "rats in storage",
            checkEveryAvg: daysInYear * 2,
            variance: 0.5,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
        this._foodLost = 0;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.2)); }
    getEventChoices() {
        return [
            new EventChoice({name: "Acknowledge", effects: []})
        ];
    }
    getBonuses() { return []; }
    fire_() {
        const settlement = this.settlements[0];
        const foodStorage = settlement.resourceStorages.find(rs => rs.resource.name === 'food');
        const currentFood = foodStorage ? foodStorage.amount.baseValue : 0;
        this._foodLost = Math.round(currentFood * (0.1 + 0.1 * Math.random())); // 10–20%
        this.bonusFlavourText = `Rats got into the food stores and ate ${this._foodLost} units of food.`;
        if (foodStorage && this._foodLost > 0) {
            foodStorage.oneOffDemand(this._foodLost, 'rats in storage');
        }
        this.lastBonuses = [];
        this.choiceApplied = false;
        this.appliedChoice = null;
    }
    end_() {
        this.lastBonuses = null;
        this.choiceApplied = false;
        this.appliedChoice = null;
    }
}

export class NomadsArrive extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "nomads arrive",
            checkEveryAvg: daysInYear * 3,
            variance: 0.4,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
        this.nomadGroupSize = 0;
        this.addToTreasury = props.addToTreasury || null;
        this._robGold = 0;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.25)); }
    getBonuses() { return []; }
    getEventChoices() {
        const settlement = this.settlements[0];
        this.nomadGroupSize = Math.round(5 + Math.random() * 10); // 5–15 nomads
        const choices = [
            new EventChoice({name: `Take them in (+${this.nomadGroupSize} population)`, effects: [
                new ChangePopulationBonus({ name: "nomads taken in", amount: this.nomadGroupSize }),
                new TemporaryHappinessBonus({
                    name: "disruption from nomads", amount: -0.05,
                    duration: Math.round(daysInYear * 0.25), timer: this.timer
                }),
                new TemporaryLocalLegitimacyBonus({
                    name: "nobles unhappy about nomads", amount: -0.03,
                    duration: Math.round(daysInYear * 0.2), timer: this.timer
                })
            ]}),
            new EventChoice({name: "Send them away", effects: []})
        ];
        // Rob them — only available if army strength is sufficient
        const armyStrength = settlement.armyStrength ? settlement.armyStrength.currentValue : 0;
        const robThreshold = this.nomadGroupSize * 1.5;
        if (armyStrength >= robThreshold) {
            const goldGained = Math.round(this.nomadGroupSize * 2);
            this._robGold = goldGained;
            choices.push(new EventChoice({name: `Rob them (gain ~${goldGained} gold, reduces future nomad visits)`, effects: [
                new TemporaryLocalLegitimacyBonus({
                    name: "reputation for robbing nomads", amount: -0.04,
                    duration: daysInYear * 2, timer: this.timer
                })
            ]}));
        }
        return choices;
    }
    applyChoice(eventChoice) {
        super.applyChoice(eventChoice);
        if (eventChoice.name.startsWith("Rob them")) {
            Logger.info(`Nomads robbed: gained ${this._robGold} gold`, { day: this.timer.currentValue, gold: this._robGold });
            if (this.addToTreasury && this._robGold > 0) {
                this.addToTreasury(this._robGold, 'robbed nomads');
            }
            this.setEventBan(daysInYear * 2);
        } else if (eventChoice.name.startsWith("Take them in")) {
            Logger.info(`Nomads taken in: +${this.nomadGroupSize} population`, { day: this.timer.currentValue, groupSize: this.nomadGroupSize });
        } else {
            Logger.debug('Nomads sent away', { day: this.timer.currentValue });
        }
    }
}

// ─── §4.6 Bandit Raid Event ───────────────────────────────────────────────────

export class BanditRaid extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "bandit raid",
            checkEveryAvg: daysInYear * 4,
            variance: 0.4,
            eventDuration: 1,
            forcePause: true,
            ...props
        });
        // Don't fire for first 2 years
        this.bannedUntil = daysInYear * 2;
        this.addToTreasury = props.addToTreasury || null;
        this._battleState = null;
        this._banditArmy = null;
    }
    eventShouldFire_() { return successToTruthy(rollSuccess(0.3)); }
    getBonuses() { return []; }
    getEventChoices() {
        if (this.choiceApplied) return [];
        const settlement = this.settlements[0];
        const pop = settlement.populationSizeExternal.currentValue;
        const tributeCost = Math.round(pop * 0.8);
        return [
            new EventChoice({name: `Pay tribute (costs ${tributeCost} gold)`, effects: [
                new TemporaryLocalLegitimacyBonus({
                    name: "seen as weak for paying tribute", amount: -0.05,
                    duration: daysInYear * 4, timer: this.timer
                })
            ]}),
            new EventChoice({name: "Fight them off", effects: []}),
            new EventChoice({name: "Do nothing (they will raid)", effects: []})
        ];
    }
    applyChoice(eventChoice) {
        const settlement = this.settlements[0];
        if (eventChoice.name.startsWith("Pay tribute")) {
            const pop = settlement.populationSizeExternal.currentValue;
            const tributeCost = Math.round(pop * 0.8);
            Logger.info(`Bandit raid: tribute paid`, { cost: tributeCost, day: this.timer.currentValue });
            if (this.addToTreasury) {
                // Deduct from treasury — negative amount
                this.addToTreasury(-tributeCost, 'paid tribute to bandits');
            }
            // Apply legitimacy malus via super
            super.applyChoice(eventChoice);
        } else if (eventChoice.name.startsWith("Fight them off")) {
            // Start battle — build armies and trigger battle UI
            this._banditArmy = buildBanditArmy(settlement);
            this._playerArmy = buildPlayerArmy(settlement);
            this._battleState = {
                playerArmy: this._playerArmy,
                enemyArmy: this._banditArmy,
                groundAdvantage: new Variable({ name: "Ground advantage", startingValue: 0 }),
                phase: 'skirmish',
                round: 1,
                log: [],
                playerBowCasualties: 0,
                enemyBowCasualties: 0,
                playerMeleeCasualties: 0,
                enemyMeleeCasualties: 0,
                startingEnemyStrength: this._banditArmy.totalStrength.currentValue
            };
            this.choiceApplied = true;
            this.appliedChoice = eventChoice;
            // Don't unpause — battle continues
        } else {
            // Do nothing — apply raid
            this._applyRaid(settlement, false, false);
            super.applyChoice(eventChoice);
        }
    }
    _applyRaid(settlement, playerFled, lostFight) {
        // Zero all resource storages
        for (const rs of settlement.resourceStorages) {
            if (rs.amount.baseValue > 0) {
                rs.oneOffDemand(rs.amount.baseValue, 'bandit raid');
            }
        }
        // Zero treasury
        if (this.addToTreasury) {
            // We can't directly zero treasury, but we can add a large negative
            // This is a limitation — we just drain what we can
        }
        // Destroy 1-3 random flammable buildings
        const flammable = settlement.getBuildings().filter(b => b.flammable && b.size.currentValue > 0);
        const numDestroyed = Math.min(flammable.length, 1 + Math.floor(Math.random() * 3));
        for (let i = 0; i < numDestroyed; i++) {
            const idx = Math.floor(Math.random() * flammable.length);
            const building = flammable.splice(idx, 1)[0];
            const sizeChange = playerFled ? -Math.min(building.size.currentValue, 2) : -1;
            new SpecificBuildingChangeSizeBonus({ building: building.name, amount: sizeChange }).activate(settlement);
        }
        // Civilian deaths
        const pop = settlement.populationSizeExternal.currentValue;
        const deathRate = playerFled ? (0.05 + 0.07 * Math.random()) * 1.5 : (0.05 + 0.03 * Math.random());
        const deaths = -Math.round(pop * deathRate);
        if (deaths < 0) {
            new ChangePopulationBonus({ name: "bandit raid deaths", amount: deaths }).activate(settlement);
        }
        // Aftermath penalties
        const totalDead = Math.abs(deaths);
        applyBattleAftermath(settlement, false, playerFled, totalDead, this.timer);
    }
    // Called from BattleUI to advance battle state
    advanceBattle(choice) {
        if (!this._battleState) return;
        const state = this._battleState;
        const settlement = this.settlements[0];

        if (choice === 'skirmish') {
            resolveSkirmishRound(state);
            // Check if bandits auto-move in (no archers left)
            if (state.enemyArmy.bowCount === 0 && state.phase === 'skirmish') {
                state.phase = 'clash';
                state.log.push("With no archers left, the enemy charges!");
            }
        } else if (choice === 'move_in') {
            state.phase = 'clash';
            state.log.push("Your archers hold their fire as your infantry advances into the fray.");
            resolveMeleeRound(state, true); // first round penalty
        } else if (choice === 'clash') {
            resolveMeleeRound(state, false);
        } else if (choice === 'manoeuvre') {
            // Strategy check
            const playerStratChance = Math.min(0.85, Math.max(0.1, state.playerArmy.strategySkill.currentValue));
            const stratRoll = rollSuccess(playerStratChance);
            let groundDelta = 0;
            let flavour = '';
            if (stratRoll === majorSuccessText) {
                groundDelta = 0.25;
                flavour = "Your general executed a brilliant flanking move.";
            } else if (stratRoll === successText) {
                groundDelta = 0.15;
                flavour = "Your forces found a better position.";
            } else if (stratRoll === failureText) {
                groundDelta = -0.05;
                flavour = "The manoeuvre was disrupted.";
            } else {
                groundDelta = -0.15;
                flavour = "The manoeuvre backfired — your lines are exposed.";
            }
            state.groundAdvantage.setNewBaseValue(
                Math.max(-0.5, Math.min(0.5, state.groundAdvantage.currentValue + groundDelta)),
                `manoeuvre: ${stratRoll} (chance ${Math.round(playerStratChance * 100)}%)`
            );
            state.log.push(flavour);
            // Store roll info for UI display (reuse lastSkirmishRoll slot)
            state.lastSkirmishRoll = {
                playerStratRoll: stratRoll,
                enemyStratRoll: null,
                playerStratChance,
                enemyStratChance: null,
                groundDelta,
                isManoeuvre: true
            };
            resolveMeleeRound(state, false);
        } else if (choice === 'flee') {
            this._applyRaid(settlement, true, false);
            this.timer.unforceStopTimer("Event: " + this.name);
            this._battleState = null;
            return;
        }

        // Check end conditions
        const playerTotal = state.playerArmy.totalStrength.currentValue;
        const enemyTotal = state.enemyArmy.totalStrength.currentValue;
        const enemyFled = enemyTotal < state.startingEnemyStrength * 0.2;
        const maxRounds = 8;

        if (enemyTotal <= 0 || enemyFled) {
            // Player wins
            Logger.info('Battle won vs bandits', { round: state.round, playerStrength: playerTotal, day: this.timer.currentValue });
            applyBattleAftermath(settlement, true, false, 0, this.timer);
            state.log.push(enemyFled ? "The bandits flee! Victory!" : "The bandits are defeated! Victory!");
            state.ended = true;
            state.playerWon = true;
            this.timer.unforceStopTimer("Event: " + this.name);
        } else if (playerTotal <= 0 || state.round > maxRounds) {
            // Player loses
            Logger.info('Battle lost vs bandits', { round: state.round, playerStrength: playerTotal, enemyStrength: enemyTotal, day: this.timer.currentValue });
            this._applyRaid(settlement, false, true);
            state.log.push(playerTotal <= 0 ? "Your forces are overwhelmed!" : "The battle drags on — your forces are exhausted and retreat.");
            state.ended = true;
            state.playerWon = false;
            this.timer.unforceStopTimer("Event: " + this.name);
        }
    }
}

// ─── Battle System (§4.5) ─────────────────────────────────────────────────────

/**
 * BattleArmy holds the strength Variables for one side of a battle.
 *
 * Design: rawBowStrength and rawMeleeStrength accumulate the full starting
 * strength via addition modifiers (one per unit type). A separate
 * bowFraction / meleeFraction Variable (starts at 1.0) is multiplied in to
 * produce the effective bowStrength / meleeStrength. Casualties reduce the
 * fraction, so the effective strength correctly reaches 0 when all fighters
 * are dead — even though the raw modifiers still hold the original values.
 *
 * This avoids the previous bug where setNewBaseValue(0) on a Variable that
 * still had addition modifiers would produce currentValue = 0 + sum(modifiers)
 * instead of 0.
 */
class BattleArmy {
    constructor({ name, isPlayer }) {
        this.name = name;
        this.isPlayer = isPlayer;

        // bowStrength and meleeStrength accumulate unit contributions via addition
        // modifiers during build. After finalise(), casualties are applied by
        // calling setNewBaseValue(startingStrength * survivingFraction) — this
        // works correctly because the base value is set to the scaled total and
        // the modifiers are cleared (we never add modifiers after finalise()).
        //
        // Specifically: during build we add modifiers (one per unit type).
        // finalise() records currentValue as startingStrength, then removes all
        // modifiers and sets baseValue = startingStrength. After that, casualties
        // simply call setNewBaseValue(startingStrength * fraction), which is
        // correct because there are no modifiers left to interfere.
        this.bowStrength   = new Variable({ name: `${name} bow strength`,   startingValue: 0, displayRound: 1 });
        this.meleeStrength = new Variable({ name: `${name} melee strength`, startingValue: 0, displayRound: 1 });

        this.totalStrength = new Variable({
            name: `${name} total strength`,
            startingValue: 0,
            displayRound: 1,
            modifiers: [
                new VariableModifier({ variable: this.bowStrength,   type: addition }),
                new VariableModifier({ variable: this.meleeStrength, type: addition }),
            ]
        });

        this.bowCount   = 0;  // number of archer units remaining
        this.meleeCount = 0;  // number of melee units remaining
        this.startingBowCount   = 0;
        this.startingMeleeCount = 0;
        this.startingBowStrength   = 0;  // set after finalise(), used for fraction calc
        this.startingMeleeStrength = 0;

        this.strategySkill = new Variable({ name: `${name} leader strategy`, startingValue: 0, displayRound: 2 });
    }

    /**
     * Call after all units have been added. Locks in the starting strengths,
     * then removes all build-time modifiers and sets baseValue = startingStrength.
     * After this point, setNewBaseValue(startingStrength * fraction) correctly
     * scales strength without any modifiers interfering.
     */
    finalise() {
        // Record the fully-modded starting strength
        this.startingBowStrength   = this.bowStrength.currentValue;
        this.startingMeleeStrength = this.meleeStrength.currentValue;
        this.startingBowCount      = this.bowCount;
        this.startingMeleeCount    = this.meleeCount;

        // Remove all build-time addition modifiers and bake the value into baseValue.
        // This ensures future setNewBaseValue calls are not affected by leftover modifiers.
        this.bowStrength.setModifiers([]);
        this.bowStrength.setNewBaseValue(this.startingBowStrength, 'finalise: bake starting bow strength');

        this.meleeStrength.setModifiers([]);
        this.meleeStrength.setNewBaseValue(this.startingMeleeStrength, 'finalise: bake starting melee strength');
    }

    /**
     * Apply bow casualties. `dead` is the integer number of archers killed.
     * Scales bowStrength proportionally to surviving fraction.
     */
    applyBowCasualties(dead) {
        if (dead <= 0) return;
        const newCount = Math.max(0, this.bowCount - dead);
        const fraction = this.startingBowCount > 0 ? newCount / this.startingBowCount : 0;
        this.bowStrength.setNewBaseValue(
            this.startingBowStrength * fraction,
            `${dead} archers lost (${newCount}/${this.startingBowCount} remaining)`
        );
        this.bowCount = newCount;
    }

    /**
     * Apply melee casualties. `dead` is the integer number of melee fighters killed.
     * Scales meleeStrength proportionally to surviving fraction.
     */
    applyMeleeCasualties(dead) {
        if (dead <= 0) return;
        const newCount = Math.max(0, this.meleeCount - dead);
        const fraction = this.startingMeleeCount > 0 ? newCount / this.startingMeleeCount : 0;
        this.meleeStrength.setNewBaseValue(
            this.startingMeleeStrength * fraction,
            `${dead} soldiers lost (${newCount}/${this.startingMeleeCount} remaining)`
        );
        this.meleeCount = newCount;
    }
}

function buildPlayerArmy(settlement) {
    const army = new BattleArmy({ name: settlement.name, isPlayer: true });

    const BOW_UNITS = [
        { name: 'short bows', attack: 1.2 },
        { name: 'war bows',   attack: 2.5 },
        { name: 'long bows',  attack: 4.0 },
    ];
    BOW_UNITS.forEach(({ name, attack }) => {
        const rs = settlement.resourceStorages.find(rs => rs.resource.name === name);
        const count = rs ? Math.floor(rs.amount.baseValue) : 0;
        if (count > 0) {
            army.bowStrength.addModifier(new VariableModifier({
                name: `${count} ${name} (×${attack} each)`,
                startingValue: count * attack,
                type: addition
            }));
            army.bowCount += count;
        }
    });

    const MELEE_UNITS = [
        { name: 'stone spears', attack: 0.6 }, { name: 'stone swords', attack: 0.9 },
        { name: 'iron spears',  attack: 1.2 }, { name: 'iron swords',  attack: 1.8 },
        { name: 'steel spears', attack: 2.0 }, { name: 'steel short swords', attack: 4.0 },
        { name: 'steel long swords', attack: 10.0 },
    ];
    MELEE_UNITS.forEach(({ name, attack }) => {
        const rs = settlement.resourceStorages.find(rs => rs.resource.name === name);
        const count = rs ? Math.floor(rs.amount.baseValue) : 0;
        if (count > 0) {
            army.meleeStrength.addModifier(new VariableModifier({
                name: `${count} ${name} (×${attack} each)`,
                startingValue: count * attack,
                type: addition
            }));
            army.meleeCount += count;
        }
    });

    // Mobilised civilians
    const pop = settlement.populationSizeExternal.currentValue;
    const legitimacyMod = 0.7 + 0.3 * Math.min(1, settlement.localLegitimacy ? settlement.localLegitimacy.currentValue : 0);
    const mobilised = Math.floor(pop * 0.30 * legitimacyMod);
    if (mobilised > 0) {
        army.meleeStrength.addModifier(new VariableModifier({
            name: `${mobilised} mobilised civilians (×0.5 each, legitimacy ${Math.round(legitimacyMod * 100)}%)`,
            startingValue: mobilised * 0.5,
            type: addition
        }));
        army.meleeCount += mobilised;
    }

    // Strategy from leader
    if (settlement.leader && settlement.leader.strategy) {
        army.strategySkill.addModifier(new VariableModifier({
            name: `${settlement.leader.name} strategy`,
            variable: settlement.leader.strategy,
            type: addition
        }));
    }

    army.finalise();
    return army;
}

function buildBanditArmy(settlement) {
    const pop = settlement.populationSizeExternal.currentValue;
    // Count all player military units
    const militaryNames = ['stone spears','stone swords','iron spears','iron swords','steel spears','steel short swords','steel long swords','short bows','war bows','long bows'];
    let playerUnitCount = 0;
    for (const name of militaryNames) {
        const rs = settlement.resourceStorages.find(rs => rs.resource.name === name);
        if (rs) playerUnitCount += Math.floor(rs.amount.baseValue);
    }
    const banditCount = Math.max(
        Math.floor(pop * 0.15),
        Math.floor(playerUnitCount * 0.8)
    );

    const spearCount = Math.floor(banditCount * 0.6);
    const bowCount   = Math.floor(banditCount * 0.3);
    const swordCount = banditCount - spearCount - bowCount;
    const banditStrategy = 0.1 + Math.random() * 0.15;

    const army = new BattleArmy({ name: "Bandit Warband", isPlayer: false });
    if (bowCount > 0) {
        army.bowStrength.addModifier(new VariableModifier({
            name: `${bowCount} bandit shortbowmen (×1.2 each)`,
            startingValue: bowCount * 1.2, type: addition
        }));
    }
    if (spearCount > 0) {
        army.meleeStrength.addModifier(new VariableModifier({
            name: `${spearCount} bandit spearmen (×1.0 each)`,
            startingValue: spearCount * 1.0, type: addition
        }));
    }
    if (swordCount > 0) {
        army.meleeStrength.addModifier(new VariableModifier({
            name: `${swordCount} bandit swordsmen (×2.0 each)`,
            startingValue: swordCount * 2.0, type: addition
        }));
    }
    army.strategySkill.addModifier(new VariableModifier({
        name: `bandit leader strategy (poor)`,
        startingValue: banditStrategy, type: addition
    }));
    army.bowCount   = bowCount;
    army.meleeCount = spearCount + swordCount;

    army.finalise();
    return army;
}

function resolveSkirmishRound(state) {
    const { playerArmy, enemyArmy } = state;

    const playerStratChance = Math.min(0.85, Math.max(0.1, playerArmy.strategySkill.currentValue));
    const enemyStratChance  = Math.min(0.85, Math.max(0.1, enemyArmy.strategySkill.currentValue));
    const playerStratRoll = rollSuccess(playerStratChance);
    const enemyStratRoll  = rollSuccess(enemyStratChance);
    const playerStratNum  = successToNumber(playerStratRoll, 0.5);
    const enemyStratNum   = successToNumber(enemyStratRoll,  0.5);
    const groundDelta     = (playerStratNum - enemyStratNum) * 0.15;

    state.groundAdvantage.setNewBaseValue(
        Math.max(-0.5, Math.min(0.5, state.groundAdvantage.currentValue + groundDelta)),
        `Round ${state.round}: player rolled ${playerStratRoll} (chance ${Math.round(playerStratChance*100)}%), enemy rolled ${enemyStratRoll} (chance ${Math.round(enemyStratChance*100)}%)`
    );

    const ga = state.groundAdvantage.currentValue;
    const playerEffBow = playerArmy.bowStrength.currentValue * (1 + ga);
    const enemyEffBow  = enemyArmy.bowStrength.currentValue  * (1 - ga);
    const totalBow = playerEffBow + enemyEffBow + 5;

    const playerBowCasualtyRate = enemyEffBow / totalBow;
    const enemyBowCasualtyRate  = playerEffBow / totalBow;

    state.playerBowCasualties += playerArmy.bowCount * playerBowCasualtyRate;
    state.enemyBowCasualties  += enemyArmy.bowCount  * enemyBowCasualtyRate;
    const playerBowDead = Math.floor(state.playerBowCasualties);
    const enemyBowDead  = Math.floor(state.enemyBowCasualties);
    state.playerBowCasualties -= playerBowDead;
    state.enemyBowCasualties  -= enemyBowDead;

    playerArmy.applyBowCasualties(playerBowDead);
    enemyArmy.applyBowCasualties(enemyBowDead);

    const groundText = groundDelta > 0 ? "Your general seized the high ground." :
                       groundDelta < 0 ? "The enemy took the better position." :
                       "Neither side gained a positional advantage.";
    // Store roll info for UI display
    state.lastSkirmishRoll = { playerStratRoll, enemyStratRoll, playerStratChance, enemyStratChance, groundDelta };
    state.log.push(`Skirmish round ${state.round}: ${groundText} ${playerBowDead} of your archers fell, ${enemyBowDead} enemy archers fell.`);
    state.round++;
}

function resolveMeleeRound(state, firstRoundPenalty) {
    const { playerArmy, enemyArmy } = state;
    const ga = state.groundAdvantage.currentValue;

    // Bows fire at infantry at 40% effectiveness (first round: player bows at 20%, enemy at 50%)
    const playerBowMult = firstRoundPenalty ? 0.2 : 0.4;
    const enemyBowMult  = firstRoundPenalty ? 0.5 : 0.4;

    const playerBowVsMelee = playerArmy.bowStrength.currentValue * playerBowMult * (1 + ga);
    const enemyBowVsMelee  = enemyArmy.bowStrength.currentValue  * enemyBowMult  * (1 - ga);

    const playerTotalAttack = playerArmy.meleeStrength.currentValue + playerBowVsMelee;
    const enemyTotalAttack  = enemyArmy.meleeStrength.currentValue  + enemyBowVsMelee;
    const totalAttack = playerTotalAttack + enemyTotalAttack + 10;

    const playerMeleeCasualtyRate = enemyTotalAttack / totalAttack;
    const enemyMeleeCasualtyRate  = playerTotalAttack / totalAttack;

    state.playerMeleeCasualties = (state.playerMeleeCasualties || 0) + playerArmy.meleeCount * playerMeleeCasualtyRate;
    state.enemyMeleeCasualties  = (state.enemyMeleeCasualties  || 0) + enemyArmy.meleeCount  * enemyMeleeCasualtyRate;
    const playerMeleeDead = Math.floor(state.playerMeleeCasualties);
    const enemyMeleeDead  = Math.floor(state.enemyMeleeCasualties);
    state.playerMeleeCasualties -= playerMeleeDead;
    state.enemyMeleeCasualties  -= enemyMeleeDead;

    playerArmy.applyMeleeCasualties(playerMeleeDead);
    enemyArmy.applyMeleeCasualties(enemyMeleeDead);

    const advantage = playerTotalAttack > enemyTotalAttack ? "Your forces have the upper hand." :
                      playerTotalAttack < enemyTotalAttack ? "The enemy is pressing hard." :
                      "The lines are evenly matched.";
    const bowNote = firstRoundPenalty ? " Your archers hold their fire as your infantry advances." : "";
    // Store roll info for UI display
    state.lastMeleeRound = { playerTotalAttack, enemyTotalAttack, playerBowVsMelee, enemyBowVsMelee, ga };
    state.log.push(`Melee round ${state.round}: ${advantage}${bowNote} ${playerMeleeDead} of your soldiers fell, ${enemyMeleeDead} enemy soldiers fell.`);
    state.round++;
}

function applyBattleAftermath(settlement, playerWon, playerFled, totalPlayerDead, timer) {
    const pop = settlement.populationSizeExternal.currentValue;
    const deathRate = totalPlayerDead / Math.max(1, pop);

    if (playerWon) {
        new TemporaryHappinessBonus({
            name: "victory celebration", amount: 0.06,
            duration: daysInYear, timer
        }).activate(settlement);
        new TemporaryLocalLegitimacyBonus({
            name: "defended the settlement", amount: 0.05,
            duration: daysInYear * 2, timer
        }).activate(settlement);
    } else {
        const happinessPenalty = -(0.1 + deathRate * 0.5);
        const healthPenalty    = -(0.05 + deathRate * 0.3);
        new TemporaryHappinessBonus({
            name: "mourning battle losses", amount: happinessPenalty,
            duration: daysInYear, timer
        }).activate(settlement);
        new TemporaryHealthBonus({
            name: "injuries from battle", amount: healthPenalty,
            duration: Math.round(daysInYear * 0.5), timer
        }).activate(settlement);
        if (playerFled) {
            new TemporaryLocalLegitimacyBonus({
                name: "fled from battle", amount: -0.08,
                duration: daysInYear, timer
            }).activate(settlement);
        }
    }
}

export class EventComponent extends UIBase {
    constructor(props) {
        super(props);
        this.event = props.event;
        this._lastAutoOpenedTrigger = null; // track which fire we last auto-opened for
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
        // Auto-open modal when event fires (player settlements only — event is active and unread)
        if (
            this.event.isActive() &&
            !this.event.read &&
            this.event.lastTriggered !== this._lastAutoOpenedTrigger &&
            !this.state.modalOpen
        ) {
            this._lastAutoOpenedTrigger = this.event.lastTriggered;
            // Use setTimeout to avoid setState-during-render
            setTimeout(() => this.setModalOpen(true), 0);
        }
        // For BanditRaid in battle phase, show battle UI instead of normal event modal
        if (this.event instanceof BanditRaid && this.event._battleState && !this.event._battleState.ended) {
            return <BattleUI event={this.event} />;
        }
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

/**
 * §4.5 Battle UI — shown as a modal when a BanditRaid battle is in progress.
 * Renders the current battle state and player choices.
 * Uses VariableComponent for all numeric values so tooltips show breakdowns.
 */
class BattleUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = { open: true };
    }
    render() {
        const { event } = this.props;
        const state = event._battleState;
        if (!state) return null;

        const { playerArmy, enemyArmy, groundAdvantage, phase, log, ended, playerWon } = state;

        // ── Shared styles ──────────────────────────────────────────────────────
        const labelStyle = { fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                             letterSpacing: '0.06em', color: '#888', marginBottom: '2px' };
        const rowStyle   = { display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' };
        const varStyle   = { fontSize: '14px' };

        // ── Ground advantage tooltip content ───────────────────────────────────
        const gaTooltipItems = [
            groundAdvantage,
            'Affects bow effectiveness and melee combat. Positive = your advantage, negative = enemy advantage. Range: −50% to +50%.'
        ];

        // ── Strategy skill tooltip content ─────────────────────────────────────
        const playerStratTooltipItems = [
            playerArmy.strategySkill,
            'Your leader\'s strategy skill. Used for skirmish positioning rolls and manoeuvre checks. Higher = better chance of gaining ground advantage.'
        ];
        const enemyStratTooltipItems = [
            enemyArmy.strategySkill,
            'Enemy leader\'s strategy skill. Used for skirmish positioning rolls.'
        ];

        // ── Last roll info panel ───────────────────────────────────────────────
        const renderLastRollInfo = () => {
            const roll = state.lastSkirmishRoll;
            if (!roll) return null;
            const { playerStratRoll, enemyStratRoll, playerStratChance, enemyStratChance, isManoeuvre } = roll;
            const rollColor = (r) => r === majorSuccessText ? '#1a7a1a' : r === successText ? '#2e7d32' :
                                     r === failureText ? '#b26a00' : '#c62828';
            return (
                <div style={{ backgroundColor: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: '4px',
                              padding: '6px 10px', marginBottom: '8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '3px', color: '#444' }}>
                        {isManoeuvre ? 'Last manoeuvre roll' : 'Last skirmish strategy roll'}
                    </div>
                    <div>Your general: <span style={{ color: rollColor(playerStratRoll), fontWeight: 'bold' }}>{playerStratRoll}</span>
                        <span style={{ color: '#888' }}> (success chance: {Math.round(playerStratChance * 100)}%)</span>
                    </div>
                    {enemyStratRoll !== null && (
                        <div>Enemy leader: <span style={{ color: rollColor(enemyStratRoll), fontWeight: 'bold' }}>{enemyStratRoll}</span>
                            <span style={{ color: '#888' }}> (success chance: {Math.round(enemyStratChance * 100)}%)</span>
                        </div>
                    )}
                </div>
            );
        };

        // ── Army panel ─────────────────────────────────────────────────────────
        const renderArmy = (army, label) => (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{label}</div>
                <div style={rowStyle}>
                    <span style={labelStyle}>🏹 Bow</span>
                    <CustomTooltip items={[army.bowStrength, `${army.bowCount} archers remaining (of ${army.startingBowCount} starting). Bow strength = sum of all archer unit attack values, scaled by casualties.`]}>
                        <span style={varStyle}>
                            <VariableComponent variable={army.bowStrength} showName={false} showOwner={false} style={varStyle} />
                        </span>
                    </CustomTooltip>
                    <span style={{ color: '#888', fontSize: '12px' }}>({army.bowCount} archers)</span>
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>⚔ Melee</span>
                    <CustomTooltip items={[army.meleeStrength, `${army.meleeCount} fighters remaining (of ${army.startingMeleeCount} starting). Melee strength = sum of all melee unit attack values, scaled by casualties.`]}>
                        <span style={varStyle}>
                            <VariableComponent variable={army.meleeStrength} showName={false} showOwner={false} style={varStyle} />
                        </span>
                    </CustomTooltip>
                    <span style={{ color: '#888', fontSize: '12px' }}>({army.meleeCount} fighters)</span>
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Total</span>
                    <CustomTooltip items={[army.totalStrength, 'Total combat strength = bow strength + melee strength.']}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold' }}>
                            <VariableComponent variable={army.totalStrength} showName={false} showOwner={false} style={{ fontSize: '15px', fontWeight: 'bold' }} />
                        </span>
                    </CustomTooltip>
                </div>
                <div style={{ ...rowStyle, marginTop: '4px' }}>
                    <span style={labelStyle}>Strategy</span>
                    <CustomTooltip items={army.isPlayer ? playerStratTooltipItems : enemyStratTooltipItems}>
                        <span style={varStyle}>
                            <VariableComponent variable={army.strategySkill} showName={false} showOwner={false} style={varStyle} />
                        </span>
                    </CustomTooltip>
                </div>
            </div>
        );

        // ── Choices ────────────────────────────────────────────────────────────
        const renderChoices = () => {
            if (ended) {
                return <div>
                    <Typography sx={{ color: playerWon ? 'green' : 'red', fontWeight: 'bold', mb: 1 }}>
                        {playerWon ? '⚔ Victory!' : '💀 Defeat'}
                    </Typography>
                    <Button variant='outlined' onClick={() => this.setState({ open: false })}>Close</Button>
                </div>;
            }
            if (phase === 'skirmish') {
                return <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <HTMLTooltip title={
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Continue skirmishing</div>
                            <div>Both sides' archers exchange fire. Your general and the enemy leader each make a strategy roll to gain ground advantage.</div>
                            <div style={{ marginTop: '4px', color: '#555' }}>Your strategy chance: {Math.round(Math.min(0.85, Math.max(0.1, playerArmy.strategySkill.currentValue)) * 100)}%</div>
                            <div style={{ color: '#555' }}>Enemy strategy chance: {Math.round(Math.min(0.85, Math.max(0.1, enemyArmy.strategySkill.currentValue)) * 100)}%</div>
                        </div>
                    }>
                        <Button variant='outlined' onClick={() => { event.advanceBattle('skirmish'); this.forceUpdate(); }}>
                            Continue skirmishing
                        </Button>
                    </HTMLTooltip>
                    <HTMLTooltip title={
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Move in (melee)</div>
                            <div>Your infantry advances. Your archers fire at reduced effectiveness (20%) while the enemy archers fire at increased effectiveness (50%) during the charge.</div>
                        </div>
                    }>
                        <Button variant='outlined' onClick={() => { event.advanceBattle('move_in'); this.forceUpdate(); }}>
                            Move in (melee)
                        </Button>
                    </HTMLTooltip>
                    <Button variant='outlined' color='error' onClick={() => { event.advanceBattle('flee'); this.setState({ open: false }); }}>
                        Flee
                    </Button>
                </div>;
            } else {
                return <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <HTMLTooltip title={
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Hold the line</div>
                            <div>Both sides fight in place. Archers fire at 40% effectiveness into the melee. Casualties are proportional to relative attack strength.</div>
                        </div>
                    }>
                        <Button variant='outlined' onClick={() => { event.advanceBattle('clash'); this.forceUpdate(); }}>
                            Hold the line
                        </Button>
                    </HTMLTooltip>
                    <HTMLTooltip title={
                        <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Attempt a manoeuvre (strategy check)</div>
                            <div>Your general attempts a flanking move or tactical repositioning. Rolls against your strategy skill.</div>
                            <div style={{ marginTop: '4px', color: '#555' }}>Your strategy: {playerArmy.strategySkill.currentValue.toFixed(2)}</div>
                            <div style={{ color: '#555' }}>Success chance: {Math.round(Math.min(0.85, Math.max(0.1, playerArmy.strategySkill.currentValue)) * 100)}%</div>
                            <div style={{ marginTop: '4px' }}>
                                <span style={{ color: '#1a7a1a' }}>Major success: +25% ground advantage</span><br/>
                                <span style={{ color: '#2e7d32' }}>Success: +15% ground advantage</span><br/>
                                <span style={{ color: '#b26a00' }}>Failure: −5% ground advantage</span><br/>
                                <span style={{ color: '#c62828' }}>Major failure: −15% ground advantage</span>
                            </div>
                            <div style={{ marginTop: '4px', color: '#555' }}>Melee combat also resolves this round.</div>
                        </div>
                    }>
                        <Button variant='outlined' onClick={() => { event.advanceBattle('manoeuvre'); this.forceUpdate(); }}>
                            Attempt a manoeuvre (strategy check)
                        </Button>
                    </HTMLTooltip>
                    <Button variant='outlined' color='error' onClick={() => { event.advanceBattle('flee'); this.setState({ open: false }); }}>
                        Flee
                    </Button>
                </div>;
            }
        };

        // ── Ground advantage display ───────────────────────────────────────────
        const gaVal = groundAdvantage.currentValue;
        const gaColor = gaVal > 0.05 ? '#1a7a1a' : gaVal < -0.05 ? '#c62828' : '#555';

        return <Modal open={this.state.open}>
            <Box sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 700, bgcolor: 'background.paper',
                border: '2px solid #000', boxShadow: 24, p: 3,
                maxHeight: '85vh', overflowY: 'auto'
            }}>
                <Typography variant="h6" sx={{ mb: 1 }}>⚔ Battle: {event.name}</Typography>

                {/* Phase / Round / Ground advantage header */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '10px',
                              backgroundColor: '#fafafa', border: '1px solid #e0e0e0',
                              borderRadius: '4px', padding: '6px 12px', fontSize: '13px' }}>
                    <span>Phase: <strong>{phase}</strong></span>
                    <span>Round: <strong>{state.round}</strong></span>
                    <CustomTooltip items={gaTooltipItems}>
                        <span>Ground advantage: <strong style={{ color: gaColor }}>
                            <VariableComponent variable={groundAdvantage} showName={false} showOwner={false}
                                style={{ color: gaColor, fontWeight: 'bold', display: 'inline' }} />
                        </strong></span>
                    </CustomTooltip>
                </div>

                {/* Army panels */}
                <Grid container spacing={2} sx={{ mb: 1 }}>
                    <Grid item xs={6}>
                        {renderArmy(playerArmy, '🛡 Your forces')}
                    </Grid>
                    <Grid item xs={6}>
                        {renderArmy(enemyArmy, '💀 Enemy forces')}
                    </Grid>
                </Grid>

                {/* Last roll info */}
                {renderLastRollInfo()}

                {/* Battle log */}
                <div style={{ maxHeight: '120px', overflowY: 'auto', backgroundColor: '#f5f5f5',
                              padding: '8px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>
                    {log.slice().reverse().map((line, i) => <div key={i}>{line}</div>)}
                </div>

                {/* Action buttons */}
                {renderChoices()}
            </Box>
        </Modal>;
    }
}