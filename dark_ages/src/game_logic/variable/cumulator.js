import {Variable, VariableComponent} from './variable.js'

export class Cumulator extends Variable {
    constructor(props) {
        super(props);
        this.timer = props.timer;
        if (!this.timer) {
            throw Error("Cumulator needs timer");
        }
        let self = this;
        this.previousAgg = -1;
        this.lastChange = 0;
        this.timer.subscribe(() => {
            self.aggregate();
        });
    }
    aggregate() {
        if (this.baseValue !== this.currentValue) {
            this.setNewBaseValue(this.currentValue, `Last turn: ${this.previousAgg}`);
        }
        this.lastChange = this.currentValue - this.previousAgg;
        this.previousAgg = JSON.parse(JSON.stringify(this.currentValue)); // Make a copy you never know
        if (this.previousAgg === undefined || this.previousAgg === null) {
            throw Error("Probably shouldnt JSON whatever type this is"); // Shouldnt happen I don't think
        }
    }
}

export class CumulatorComponent extends VariableComponent {
    constructor(props) {
        super(props)
        this.variable = props.variable;
    }
    render () {
        let lastChange = 0;
        if (this.variable) {
            lastChange = parseFloat(this.state.variable.lastChange.toFixed(3));
        }
        return <span>
            <VariableComponent variable={this.props.variable} children={[
                <span key={1}>{this.props.showMax && this.props.variable.max ? `/${this.props.variable.max.currentValue}` : ''}</span>,
                <span key={2}>{this.props.showChange ? (lastChange > 0 ? `(+${lastChange})`: `(${lastChange})`) : ''}</span>
            ]}/> 
        </span>
    }
}

CumulatorComponent.defaultProps = {
    showChange: true,
    showMax: true
};