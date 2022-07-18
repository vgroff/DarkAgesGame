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
    recalculate(reason='', indent) {
        this.currentDepth += 1;
        super.recalculate(`trending - ${reason}`, indent, true);
        this.trend(indent);
        this.currentDepth = 0;
    }
    trend(indent) {
        this.currentlyTrendingTo = this.currentValue;
        if (this.trendingValueAtTurnStart === undefined || this.timerStartVal === undefined) {// || this.timer.currentValue === this.timerStartVal) {
            this.trendingValueAtTurnStart = this.currentlyTrendingTo; // Reset trending as many times as needed on the first turn its created
        }
        let speed;
        if (this.currentlyTrendingTo < this.trendingValueAtTurnStart) {
            speed = this.trendingDownSpeed ? this.trendingDownSpeed : this.trendingSpeed;
        } else if (this.trendingUpSpeed && this.currentlyTrendingTo > this.trendingValueAtTurnStart) {
            speed = this.trendingUpSpeed ? this.trendingUpSpeed : this.trendingSpeed;
        } else {
            speed = 1;
        }
        this.currentValue = speed*this.currentlyTrendingTo + (1 - speed)*this.trendingValueAtTurnStart;
        this.trendingChange = this.currentValue - this.trendingValueAtTurnStart;
        let textExpl = `Trending at speed:${speed} from ${roundNumber(this.trendingValueAtTurnStart, this.displayRound)} to ${roundNumber(this.currentValue, this.displayRound)} towards ${roundNumber(this.currentlyTrendingTo, this.displayRound)}`;
        if (this.explanations[this.explanations.length - 1].text !== textExpl) {
            this.explanations.push({"text": textExpl});
        }
        if (isNaN(this.currentValue)) {
            throw Error("nan");
        }
        this.callSubscribers(indent+1);
    }
    storeCurrentValue() {
        this.trendingValueAtTurnStart = this.currentValue;
        this.recalculate('new turn', 0);
    }
    forceResetTrend() {
        super.recalculate('force reset', 0, true);
        this.trendingValueAtTurnStart = this.currentValue;
        this.recalculate('force reset', 0);       
    }
}

export class TrendingVariableComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    render () {
        let trendingValue = 0;
        let extraStyle = {};
        if (this.variable) {
            trendingValue = parseFloat(this.variable.currentlyTrendingTo.toFixed(3));
            if (this.variable.trendingChange) {
                let eps = this.variable.currentValue * 0.00001;
                extraStyle.color = this.variable.trendingChange < - eps  ? 'red' : this.variable.trendingChange > eps ? 'green' : 'black';
            }
        }
        return super.render([
            <span key={1}>{this.props.showMax && this.props.variable.max ? `/${this.props.variable.max.currentValue}` : ''}</span>,
            <span key={2}>{this.props.showTrending ? ` (${trendingValue})` : ''}</span>,
        ], extraStyle);
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