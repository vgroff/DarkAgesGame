import { rollSuccess, successToNumber } from "./rolling";
import { daysInYear } from "./seasons";
import { SpecificBuildingProductivityBonus } from "./settlement/bonus";
import { Farm } from "./settlement/building";
import { roundNumber } from "./utils";



class Event {
    constructor(props) {
        this.timer = props.timer;
        this.checkEvery = props.checkEvery;
        this.timer.subscribe(() => {
            if (this.eventShouldFire()) {
                this.fire();
            }
        });
    }
    eventShouldFire() {
        throw Error("this is an abstract class, extend it")
    }
    fire() {
        throw Error("this is an abstract class, extend it")
    }
    getText() {
        throw Error("this is an abstract class, extend it")
    }
}

class GlobalSettlementEvent extends Event {
    constructor(props) {
        super(props);
        this.eventShouldFireCb = props.eventShouldFireCb;
        this.fireEventCb = props.fireEventCb;
        this.settlements = props.settlements;
    }
    eventShouldFire() {
        return this.eventShouldFireCb(this.timer.currentValue, this.settlements);
    }
    fire() {
        this.fireEventCb(this.timer.currentValue, this.settlements);
    }
    getText() {
        throw Error("this is an abstract class, extend it")
    }
}

export class HarvestEvent extends GlobalSettlementEvent {
    constructor(props) {
        super({
            checkEvery: daysInYear,
            eventShouldFireCb: () => {return true},
            fireEventCb: (day, settlements) => {
                let harvestSuccess  = successToNumber(rollSuccess(0.65), 1);
                this.harvestModifier = 0.9 + 0.1*harvestSuccess; // varies between 0.7 and 1.1
                if (this.harvestBonus) {
                    settlements.forEach( settlement => {
                        settlement.deactivateBonus(this.harvestBonus);
                    });
                }
                let harvestBonus = new SpecificBuildingProductivityBonus({name: "effect of weather on the harvest", building: Farm.name, amount: this.harvestModifier});
                settlements.forEach( settlement => {
                    settlement.activateBonus(harvestBonus);
                });
                this.harvestBonus = harvestBonus;
            },
            ...props
        });
        if (this.eventShouldFire()) {
            this.fire();
        }
    }
    getText() {
        let percentage = `${roundNumber((this.harvestModifier - 1)*100, 1)}`
        return `The weather will affect productivity of ${Farm.name} by ${percentage}%`;
    }
}