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
        Object.entries(variables).forEach(([key, variable]) => self.addVarToStateObject(key, variable));
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
                self.setState({ready: true, key: sub.key, variable: sub.variable});
            });
            state[sub.key] = sub.variable;
            this.setState(state)
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