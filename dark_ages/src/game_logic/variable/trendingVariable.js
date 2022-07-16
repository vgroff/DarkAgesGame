import { Variable, VariableComponent} from "./variable";
import { roundNumber } from '../utils'


export class TrendingVariable extends Variable {
    constructor(props) {
        super(props);

        this.timer = props.timer;
        if (!this.timer) {
            throw Error("TrendingVariable needs timer");
        }
        this.trendingSpeed = props.trendingSpeed;
        this.trendingUpSpeed = props.trendingUpSpeed;
        this.trendingDownSpeed = props.trendingDownSpeed;
        if (this.trendingSpeed === undefined && !(this.trendingDownSpeed !== undefined && this.trendingUpSpeed !== undefined)) {
            throw Error("TrendingVariable needs trending speed")
        }
        this.currentlyTrendingTo = this.currentValue;
        this.timer.subscribe(() => {
            this.storeCurrentValue();
        });
        this.timerStartVal = this.timer.currentValue;
    }
    recalculate() {
        super.recalculate(true);
        this.trend();
    }
    trend() {
        this.currentlyTrendingTo = this.currentValue;
        if (this.trendingValueAtTurnStart === undefined || this.timerStartVal === undefined || this.timer.currentValue === this.timerStartVal) {
            this.trendingValueAtTurnStart = this.currentlyTrendingTo; // Reset trending as many times as needed on the first turn its created
        }
        console.log(this.currentlyTrendingTo, this.trendingValueAtTurnStart);
        if (this.timer) {console.log(this.timer.currentValue, this.timerStartVal)};
        let speed;
        if (this.currentlyTrendingTo < this.trendingValueAtTurnStart) {
            speed = this.trendingDownSpeed ? this.trendingDownSpeed : this.trendingSpeed;
        } else if (this.trendingUpSpeed && this.currentlyTrendingTo > this.trendingValueAtTurnStart) {
            speed = this.trendingUpSpeed ? this.trendingUpSpeed : this.trendingSpeed;
        } else {
            speed = 1;
        }
        this.currentValue = speed*this.currentlyTrendingTo + (1 - speed)*this.trendingValueAtTurnStart;
        let textExpl = `Trending at speed:${speed} from ${roundNumber(this.trendingValueAtTurnStart, this.displayRound)} to ${roundNumber(this.currentValue, this.displayRound)}`;
        if (this.explanations[this.explanations.length - 1].text !== textExpl) {
            this.explanations.push({"text": textExpl});
        }
        if (isNaN(this.currentValue)) {
            throw Error("nan");
        }
        this.callSubscribers(this.currentDepth);
    }
    storeCurrentValue() {
        this.trendingValueAtTurnStart = this.currentValue;
        this.trend();
    }
}

export class TrendingVariableComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    render () {
        let trendingValue = 0;
        if (this.variable) {
            trendingValue = parseFloat(this.variable.currentlyTrendingTo.toFixed(3));
        }
        return super.render([
            <span key={1}>{this.props.showMax && this.props.variable.max ? `/${this.props.variable.max.currentValue}` : ''}</span>,
            <span key={2}>{this.props.showTrending ? `(${trendingValue})` : ''}</span>,
        ]);
    }
}

TrendingVariableComponent.defaultProps = {
    showTrending: true,
    showMax: true,
    // Variable props 
    showName: true,
    showOwner: true,
    showBase: false,
    expanded: false
};