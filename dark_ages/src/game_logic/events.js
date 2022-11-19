import { getButtonUnstyledUtilityClass } from "@mui/base";
import { Logger } from "./logger";
import { rollSuccess, successToNumber, successToTruthy } from "./rolling";
import { daysInYear } from "./seasons";
import { ChangePriceBonus, SpecificBuildingProductivityBonus } from "./settlement/bonus";
import { Farm } from "./settlement/building";
import { Resources } from "./settlement/resource";
import UIBase from "./UIBase";
import { CustomTooltip, randomRange, roundNumber, titleCase } from "./utils";
import {Box, Button, Modal, Typography} from "@mui/material";



class Event {
    constructor(props) {
        this.name = props.name;
        this.timer = props.timer;
        this.checkEvery = props.checkEvery;
        this.read = false;
        if (this.checkEvery === undefined || !this.timer) {
            throw Error()
        }
        this.lastChecked = null;
        this.eventDuration = props.eventDuration || null;
        this.lastTriggered = null;
        this.lastEnded = null;
        this.timer.subscribe(() => {
            this.triggerChecks();
        });
    }
    triggerChecks() {
        if (!this.lastChecked || (this.timer.currentValue - this.lastChecked) % Math.round(this.checkEvery) === 0) {
            this.lastChecked = this.timer.currentValue;
            if (this.eventShouldFire()) {
                this.lastTriggered = this.timer.currentValue;
                this.fire();
                this.read = false;
            }
        }
        if (this.eventDuration && (!this.lastEnded || this.lastEnded <= this.lastTriggered) && this.lastTriggered && this.timer.currentValue - this.lastTriggered >= this.eventDuration) {
            this.lastEnded = this.timer.currentValue;
            this.end();
        }
    }
    isActive() {
        return this.lastTriggered !== null && this.lastTriggered >= this.lastEnded;
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

class SettlementEvent extends Event {
    constructor(props) {
        super(props);
        this.settlements = props.settlements;
        this.lastBonuses = null;
    }
    eventShouldFire() {
        return this.eventShouldFire_(this.timer.currentValue, this.settlements);
    }
    fire() {
        if (this.fire_) {
            return this.fire_(this.timer.currentValue, this.settlements);
        } else {
            let bonuses = this.getBonuses(this.timer.currentValue, this.settlements);
            if (this.lastBonuses) {
                this.lastBonuses.forEach( bonus => {
                    this.settlements.forEach( settlement => {
                        settlement.deactivateBonus(bonus);
                    });
                });
            }
            bonuses.forEach( bonus => {
                this.settlements.forEach( settlement => {
                    settlement.activateBonus(bonus);
                });
            });
            this.lastBonuses = bonuses;
        }
    }
    getBonuses() {
        throw Error("this is an abstract class, extend it"); 
    }
    end() {
        if (this.end_) {
            return this.end_(this.timer.currentValue, this.settlements);
        } else {
            if (this.lastBonuses) {
                this.lastBonuses.forEach( bonus => {
                    this.settlements.forEach( settlement => {
                        settlement.deactivateBonus(bonus);
                    });
                });
            }
            this.lastBonuses = null;
        }
    }
    getText() {
        let text = [`Event ${this.name} has following effects:`];
        text = text.concat(this.lastBonuses ? this.lastBonuses.map(bonus => bonus.getEffectText()) : [''])
        return text;
    }
}

class RegularSettlementEvent extends SettlementEvent {
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

export class CropBlight extends RegularSettlementEvent {
    constructor(props) {
        super({
            name: "crop blight",
            checkEveryAvg: daysInYear,
            variance: 0.5, 
            eventDuration:  daysInYear / 2,
            checkImmediately: true,
            ...props
        });
    }
    eventShouldFire_() {
        return successToTruthy(rollSuccess(1.0));
    }
    getBonuses() {
        this.cropBlightModifier = 0.9 - 0.2*Math.random();
        return [new SpecificBuildingProductivityBonus({name: "effect of crop blight", building: Farm.name, amount: this.cropBlightModifier})];
    }
}

export class HarvestEvent extends SettlementEvent {
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
    getBonuses() {
        this.harvestSuccess = rollSuccess(0.65);
        let harvestSuccess  = successToNumber(this.harvestSuccess, 0.5);
        this.harvestModifier = 0.95 + 0.1*(harvestSuccess/Math.abs(harvestSuccess))*harvestSuccess**2; // varies between ~0.7 and ~1.1
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
                width: 400,
                bgcolor: 'background.paper',
                border: '2px solid #000',
                boxShadow: 24,
                p: 4,
                }}>
                <Typography id="modal-modal-title" variant="h6" component="h2">
                Event
                </Typography>
                <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                {this.event.getText().join("\n")}
                </Typography>
                <Button onClick={() => this.setModalOpen(false)}>Close</Button>
            </Box>
        </Modal></div>
    }
}