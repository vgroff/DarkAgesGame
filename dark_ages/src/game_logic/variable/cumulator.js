import {Variable, VariableComponent} from './variable.js';
import { roundNumber } from '../utils';


export class Cumulator extends Variable {
    constructor(props) {
        super(props);
        this.timer = props.timer;
        if (!this.timer) {
            throw Error("Cumulator needs timer");
        }
        let self = this;
        this.previousAgg = -1;
        this.expectedChange = 0;
        this.valueAtTurnStart = this.baseValue;
        this.timer.subscribe(() => {
            // console.log("aggregated on timer");
            self.aggregate(0);
        });
        this.subscribe(() => {
            this.recalculateLastChange();
        }, 1);
    }
    recalculateLastChange() {
        this.expectedChange = this.currentValue - this.baseValue;
    } // lastChange, previousAgg
    aggregate() {
        this.valueAtTurnStart = this.currentValue;
        this.recalculateLastChange();
        if (this.baseValue !== this.currentValue) {
            this.setNewBaseValue(this.currentValue, `Turn start: ${roundNumber(this.valueAtTurnStart, this.displayRound)}`, 0);
        } else {
            return;
        }
    }
}

export class CumulatorComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    render () {
        let expectedChange = 0;
        if (this.variable.expectedChange) {
            expectedChange = parseFloat(this.variable.expectedChange.toFixed(3));
        }
        return super.render([
            <span key={1}>{this.props.showMax && this.props.variable.max ? `/${this.props.variable.max.currentValue}` : ''}</span>,
            <span key={2}>{this.props.showChange ? (expectedChange > 0 ? `(+${expectedChange})`: `(${expectedChange})`) : ''}</span>
        ]);
    }
}

CumulatorComponent.defaultProps = {
    showChange: true,
    showMax: true,
    // Variable props 
    showName: true,
    showOwner: true,
    showBase: false,
    expanded: false
};