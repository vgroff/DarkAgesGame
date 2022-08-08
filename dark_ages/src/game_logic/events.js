import { rollSuccess, successToNumber, successToTruthy } from "./rolling";
import { daysInYear } from "./seasons";
import { SpecificBuildingProductivityBonus } from "./settlement/bonus";
import { Farm } from "./settlement/building";
import { randomRange, roundNumber } from "./utils";



class Event {
    constructor(props) {
        this.name = props.name;
        this.timer = props.timer;
        this.checkEvery = props.checkEvery;
        if (this.checkEvery === undefined || !this.timer) {
            throw Error()
        }
        this.lastChecked = this.timer.currentValue;
        this.eventDuration = props.eventDuration || null;
        this.lastTriggered = null;
        this.lastEnded = null;
        this.timer.subscribe(() => {
            if ((this.timer.currentValue - this.lastChecked) % Math.round(this.checkEvery) === 0) {
                this.lastChecked = this.timer.currentValue;
                if (this.eventShouldFire()) {
                    this.lastTriggered = this.timer.currentValue;
                    this.fire();
                }
            }
            if (this.eventDuration && (!this.lastEnded || this.lastEnded <= this.lastTriggered) && this.lastTriggered && this.timer.currentValue - this.lastTriggered >= this.eventDuration) {
                this.lastEnded = this.timer.currentValue;
                this.end();
            }
        });
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
}

class GlobalSettlementEvent extends Event {
    constructor(props) {
        super(props);
        this.settlements = props.settlements;
    }
    eventShouldFire() {
        return this.eventShouldFire_(this.timer.currentValue, this.settlements);
    }
    fire() {
        this.fire_(this.timer.currentValue, this.settlements);
    }
    end() {
        this.end_(this.timer.currentValue, this.settlements);
    }
    getText() {
        throw Error("this is an abstract class, extend it")
    }
}

class SingleSettlementEvent extends Event {
    constructor(props) {
        super(props);
        this.settlement = props.settlement;
    }
    eventShouldFire() {
        return this.eventShouldFire_(this.timer.currentValue, this.settlement);
    }
    fire() {
        this.fire_(this.timer.currentValue, this.settlement);
    }
    end() {
        this.end_(this.timer.currentValue, this.settlement);
    }
    getText() {
        throw Error("this is an abstract class, extend it")
    }
}


class RegularSingleSettlementEvent extends SingleSettlementEvent {
    constructor(props) {
        let variance = props.variance || 0;
        super({checkEvery: props.checkEveryAvg * randomRange(1-variance, 1+variance), ...props});
        this.variance = props.variance || 0;
    }
    eventShouldFire() {
        let eventShouldFire = this.eventShouldFire_();
        this.checkEvery = daysInYear * randomRange(1-this.variance, 1+this.variance);
        return eventShouldFire;
    }
}

export class CropBlight extends RegularSingleSettlementEvent {
    constructor(props) {
        super({
            name: "crop blight",
            checkEveryAvg: daysInYear,
            variance: 0.5, 
            eventDuration:  daysInYear / 2,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(0.15));
    }
    fire_(day, settlement) {
        this.cropBlightModifier = 0.9 - 0.2*Math.random();
        if (this.cropBlightBonus) {
            settlement.deactivateBonus(this.cropBlightBonus);
        }
        let cropBlightBonus = new SpecificBuildingProductivityBonus({name: "effect of crop blight", building: Farm.name, amount: this.cropBlightModifier});
        settlement.activateBonus(cropBlightBonus);
        this.cropBlightBonus = cropBlightBonus;
    }
    end_(day, settlement) {
        if (this.cropBlightBonus) {
            settlement.deactivateBonus(this.cropBlightBonus);
            this.cropBlightBonus = null;
        }
    }
}

export class HarvestEvent extends GlobalSettlementEvent {
    constructor(props) {
        super({
            name: "harvest event",
            checkEvery: daysInYear,
            ...props
        });
        if (this.eventShouldFire()) {
            this.fire();
        }
    }
    eventShouldFire_(day, settlements) {
        return true;
    }
    fire_(day, settlements) {
        console.log('harvest fired');
        this.harvestSuccess = rollSuccess(0.65);
        let harvestSuccess  = successToNumber(this.harvestSuccess, 0.5);
        this.harvestModifier = 0.95 + 0.1*(harvestSuccess/Math.abs(harvestSuccess))*harvestSuccess**2; // varies between ~0.7 and ~1.1
        if (this.harvestBonus) {
            settlements.forEach( settlement => {
                settlement.deactivateBonus(this.harvestBonus);
            });
        }
        let harvestBonus = new SpecificBuildingProductivityBonus({name: "effect of weather on the harvest", building: Farm.name, amount: this.harvestModifier});
        settlements.forEach( settlement => {
            settlement.activateBonus(harvestBonus);
        });
        this.harvestBonus = harvestBonus;;
    }
    end_(day, settlements) {
        if (this.harvestBonus) {
            settlements.forEach( settlement => {
                settlement.deactivateBonus(this.harvestBonus);
            });
        }
    }
    getText() {
        let percentage = `${roundNumber((this.harvestModifier - 1)*100, 1)}`
        return `The weather will affect productivity of ${Farm.name} by ${percentage}%`;
    }
}

