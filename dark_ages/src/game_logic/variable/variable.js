import React from 'react'
import { styled } from '@mui/material/styles';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';

const HtmlTooltip = styled(({ className, ...props }) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#f5f5f9',
        color: 'rgba(0, 0, 0, 0.87)',
        maxWidth: 220,
        fontSize: theme.typography.pxToRem(12),
        border: '1px solid #dadde9',
    },
}));
  

export class Variable {
    constructor(props) {
        // console.log('new var created ' + this.name);
        const unnamed = 'unnamed variable'
        this.name = props.name || unnamed;
        if (this.name === unnamed) {
            console.log('Unnamed variable;')
        }
        this.owner = props.owner || '';
        this.baseValue = props.startingValue || 0;
        this.currentValue = this.baseValue;
        this.subscriptions = [];
        this.currentDepth = 0;
        this.explanations = [];
        this.baseValueExplanations = [];

        this.modifiers = [];
        this.modifierCallbacks = [];
        this.setModifiers(props.modifiers || []);
        this.recalculate();
    }
    componentDidCatch(err) {
        console.log("ERR" + err.stack);
    }
    clearSubscriptions() {
        this.subscriptions = [];
    }
    setNewBaseValue(baseValue, explanations) {
        this.baseValue = baseValue;
        this.baseValueExplanations = explanations;
        if (explanations === undefined) {
            throw Error("Need explanation")
        }
        if (explanations === null) {
            this.baseValueExplanations = [];
        } else if (!Array.isArray(explanations)) {
            this.baseValueExplanations = [explanations];
        }
        this.recalculate();
    }
    setModifiers(modifiers) {
        for (const [i, modifier] of this.modifiers.entries()) {
            modifier.unsubscribe(this.modifierCallbacks[i]);
        }
        this.modifierCallbacks = [];
        this.modifiers = modifiers;
        this.subscribeToModifiers();
        this.recalculate();
    }
    subscribeToModifiers() {
        let self = this;
        for (let modifier of this.modifiers) {
            if (modifier === undefined) {
                throw Error('undefined modifier');
            }
            this.modifierCallbacks.push(modifier.subscribe((depth) => {
                self.recalculate();
            }));
        }
    }
    subscribe(callback, reason = '') {
        this.subscriptions.push(callback);
        // console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length + ' ' + reason)
        return callback;
        // console.log("sub to "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    unsubscribe(callback) {
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
        // console.log("unsubs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
    }
    callSubscribers(callback, depth) {
        // console.log("Calling subs "  + this.name + ' ' + this.currentValue + ' ' + this.subscriptions.length);
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    recalculate(force=false) {
        if (this.name.includes('otal')) {
            console.log('calc ' + this.name);
        }
        this.modifiers.sort((a, b) => {
            return a.priority() > b.priority();
        });
        let value = this.baseValue;
        let explanations = this.baseValueExplanations.map(val => val); // Need to copy the array
        for (let modifier of this.modifiers) {
            let result = modifier.modify(value);
            value = result.result;
            explanations.push({text: result.explanation, variable: result.variable});
        }
        if (this.currentValue !== value) {
            this.currentValue = value;
            this.explanations = explanations;
            this.currentDepth += 1;
            if (this.currentDepth < 3) {
                this.callSubscribers(this.currentDepth);
            }
            this.currentDepth = 0;
            if (isNaN(this.currentValue)) {
                throw Error("nan number");
            }
        }
    }
}

export class VariableComponent extends React.Component {
    constructor(props) {
        if (props.variable === undefined) {
            throw Error('need a variable to show')
        }
        super(props);
        this.subscribed = false;
        this.ingestProps(props, false);
        if (this.variable) {
            this.state = {variable: this.variable};
        } else {
            this.state = {variable: 'nan'};
        }
        // console.log('new var created ' + this.variable.name + ' subbed: ' + this.variable.subscriptions);
    }
    ingestProps(props, forceSubscribe=false) {
        let wasSubscribed = this.subscribed;
        if (wasSubscribed) {
            this.variable.unsubscribe(this.callback);
            this.subscribed = false
        }
        this.variable = props.variable;
        if (wasSubscribed || forceSubscribe) {
            this.trySubscribe();
        }
        // console.log('new props on var ' + this.variable.name);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.variable !== this.props.variable) {
            if (!this.props.variable) {
                throw Error('no variable');
            }
            this.ingestProps(this.props);
        }
    }
    componentDidMount() {
        this.trySubscribe();
    }
    componentWillUnmount() {
        if (this.subscribed) {
            this.variable.unsubscribe(this.callback);
            this.subscribed = false            
        }
    }
    trySubscribe() {
        if (!this.subscribed) {
            let self = this;
            if (this.variable) {
                this.callback = this.variable.subscribe(() => {
                    self.setState({variable:self.variable})
                }, 'display');
                this.subscribed = true;
            }
        }
    }
    render () {
        let displayValue = Math.round(this.state.variable.currentValue, 3);
        if (this.props.showName) {
            return <HtmlTooltip title={
                    Object.entries(this.variable.explanations).map(([i,explanation]) => {
                        if (explanation.variable) {
                            return <p  key={i}><VariableComponent variable={explanation.variable}/></p>
                        } else {
                            return <p key={i} >{explanation.text}</p>
                        }
                    })
                }>
                <span style={{"text-align": "center"}} >{this.variable.owner ? `${this.variable.owner.name}'s ` : ''}{this.variable.name}: {displayValue} {this.props.children}</span>
                </HtmlTooltip>
        } else {
            return <span>
                Current value: {displayValue} 
            </span>
        }
    }
}

Variable.defaultProps = {
    modifiers: []
};

VariableComponent.defaultProps = {
    showName: true
};

