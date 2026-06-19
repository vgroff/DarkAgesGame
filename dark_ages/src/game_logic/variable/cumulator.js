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
        this.excessAmount = 0; // Amount produced this tick that couldn't be stored (storage full)
        this.valueAtTurnStart = this.baseValue;
        this.timer.subscribe(() => {
            // console.log("aggregated on timer");
            self.aggregate();
        });
        this.subscribe(() => {
            this.recalculateLastChange();
        }, 1);
    }
    recalculateLastChange() {
        this.expectedChange = this.currentValue - this.baseValue;
    }
    aggregate() {
        this.valueAtTurnStart = this.currentValue;
        // Detect excess: if storage is full (max exists and currentValue == max),
        // the uncapped value would have been baseValue + expectedChange.
        // Excess = uncapped - max, clamped to >= 0.
        if (this.max) {
            let uncapped = this.baseValue + this.expectedChange;
            let maxVal = this.max.currentValue;
            this.excessAmount = Math.max(0, uncapped - maxVal);
        } else {
            this.excessAmount = 0;
        }
        if (this.baseValue !== this.currentValue) {
            this.setNewBaseValue(this.currentValue, `Turn start: ${roundNumber(this.valueAtTurnStart, this.displayRound)}`, 0);
            this.recalculateLastChange();
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
            expectedChange = roundNumber(parseFloat(this.variable.expectedChange.toFixed(3)), this.displayRound);
        }
        const changeColor = expectedChange > 0 ? '#2e7d32' : expectedChange < 0 ? '#c62828' : undefined;
        const changeSpan = this.props.showChange
            ? <span key={2} style={changeColor ? { color: changeColor } : undefined}>
                {expectedChange > 0 ? `(+${expectedChange})` : `(${expectedChange})`}
              </span>
            : null;

        if (this.props.deltaOnly) {
            // Render only the colored delta using super.render() so the tooltip is built correctly
            // from abridgedExplanations (already mapped to React elements by VariableComponent).
            // We hide the numeric currentValue by passing it as empty via a zero-width span trick:
            // pass the delta as extraChildren and suppress the base value display with showBase=false
            // (already default). The displayValue in super.render() will still show, so we wrap
            // the whole output in a span and use the deltaSpan as the primary visual via CSS override.
            const deltaSpan = (
                <span key="delta" style={{ color: changeColor, fontSize: '11px', fontStyle: 'italic', marginLeft: '2px' }}>
                    {expectedChange > 0 ? `+${expectedChange}/day` : `${expectedChange}/day`}
                </span>
            );
            // Use super.render() with the delta as extraChildren. Hide the numeric value by
            // overriding the outer span style to have fontSize 0, then the delta span restores it.
            return super.render([deltaSpan], { fontSize: 0, lineHeight: 0 });
        }

        return super.render([changeSpan]);
    }
}

CumulatorComponent.defaultProps = {
    showChange: true,
    showMax: true,
    deltaOnly: false,
    // Variable props
    showName: true,
    showOwner: true,
    showBase: false,
    expanded: false
};