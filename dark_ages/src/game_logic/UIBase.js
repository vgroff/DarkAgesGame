import React from 'react';


class UIBase extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ready: false
        };
        this.subs = [];
        this.variablesSet = false;
    }
    addVariables(variables) {
        if (this.variablesSet) {
            throw Error("Setting variables twice, something has gone wrong")
        }
        let self = this;
        variables.forEach((variable, key) => self.addVarToStateObject(key, variable));
        this.variablesSet = true;
    }
    addVarToStateObject(key, variable) {
        this.subs.push({key, variable});
    }
    componentDidMount() {
        this.subs.forEach(sub => {
            let state = {ready:true};
            let self = this;
            if (sub.variable === undefined) {
                debugger;
            }
            sub.callback = sub.variable.subscribe(() => {
                let newState = self.state;
                newState[sub.key] = sub.variable;
                self.setState({...newState});//, () => console.log("settingg mount 1", this.constructor.name, this.state, {...newState}));
            });
            state[sub.key] = sub.variable;
            state.ready = true;
            this.setState({...self.state, ...state});//, () => console.log("settingg mount 2", this.state));
        });
    }
    componentWillUnmount() {
        this.subs.forEach(sub => sub.variable.unsubscribe(sub.callback));
    }
    render() {
        if (this.state.ready) {
            return <div> 
                {this.childRender()}
            </div>
        } else {
            return <div>Not Ready</div>
        }
    }
}

export default UIBase;