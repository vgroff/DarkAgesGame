import React from 'react';


/**
 * UIBase - base class for all class-based UI components that subscribe to Variables.
 *
 * Two subscription modes:
 *
 * 1. Static (original): call `this.addVariables([variable1, variable2, ...])` in the
 *    constructor. Subscriptions are set up once on mount and never change.
 *    Use this when the variables you care about never change identity across re-renders.
 *
 * 2. Dynamic (new): call `this.addVariableGetters([getter1, getter2, ...])` in the
 *    constructor, where each getter is `{ key: string, get: (props) => Variable }`.
 *    On mount AND on every `componentDidUpdate`, the getters are re-evaluated against
 *    the current props. If any variable identity has changed, old subscriptions are
 *    torn down and new ones are set up. Use this when props (e.g. `props.character`)
 *    can change after mount.
 *
 * The two modes can be combined: static variables are subscribed once; dynamic getters
 * are re-evaluated on every prop change.
 *
 * Known Issues (fixed):
 * - Previously, `addVariables()` was the only mechanism and threw if called twice,
 *   meaning components whose props changed (e.g. CharacterComponent receiving a new
 *   `props.character`) would never re-wire their subscriptions. Fixed by the dynamic
 *   getter mechanism above.
 */
class UIBase extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ready: false
        };
        // Static subs: set up once in constructor via addVariables(), never change.
        this.subs = [];
        this.variablesSet = false;
        // Dynamic subs: re-evaluated on every componentDidUpdate via addVariableGetters().
        this._variableGetters = [];   // Array of { key, get(props) => Variable }
        this._dynamicSubs = [];       // Array of { key, variable, callback }
    }

    // ── Static subscription API (original) ──────────────────────────────────

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

    // ── Dynamic subscription API (new) ──────────────────────────────────────

    /**
     * Register dynamic variable getters. Call this in the constructor.
     * @param {Array<{key: string, get: (props: object) => Variable}>} getters
     */
    addVariableGetters(getters) {
        this._variableGetters = getters;
    }

    /** Tear down all dynamic subscriptions. */
    _clearDynamicSubs() {
        this._dynamicSubs.forEach(sub => {
            if (sub.variable && sub.callback) {
                sub.variable.unsubscribe(sub.callback);
            }
        });
        this._dynamicSubs = [];
    }

    /** (Re-)establish dynamic subscriptions from current props. */
    _setupDynamicSubs() {
        this._clearDynamicSubs();
        if (!this._variableGetters || this._variableGetters.length === 0) return;

        let self = this;
        let state = {};
        this._variableGetters.forEach(getter => {
            const variable = getter.get(self.props);
            if (!variable) return;
            const key = getter.key;
            const callback = variable.subscribe(() => {
                let newState = {};
                newState[key] = variable;
                self.setState(newState);
            });
            self._dynamicSubs.push({ key, variable, callback });
            state[key] = variable;
        });
        if (Object.keys(state).length > 0) {
            this.setState({ ...state, ready: true });
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    componentDidMount() {
        // Set up static subscriptions
        this.subs.forEach(sub => {
            let state = {ready:true};
            let self = this;
            if (sub.variable === undefined) {
                debugger;
            }
            sub.callback = sub.variable.subscribe(() => {
                let newState = self.state;
                newState[sub.key] = sub.variable;
                self.setState({...newState});
            });
            state[sub.key] = sub.variable;
            state.ready = true;
            this.setState({...self.state, ...state});
        });

        // Set up dynamic subscriptions
        this._setupDynamicSubs();

        // Mark ready even if there are no subscriptions at all
        if (this.subs.length === 0 && this._variableGetters.length === 0) {
            this.setState({ ready: true });
        }
    }

    componentDidUpdate(prevProps) {
        if (!this._variableGetters || this._variableGetters.length === 0) return;

        // Check whether any dynamic variable identity has changed
        let needsRewire = false;
        for (const getter of this._variableGetters) {
            const newVar = getter.get(this.props);
            const oldSub = this._dynamicSubs.find(s => s.key === getter.key);
            if (!oldSub || oldSub.variable !== newVar) {
                needsRewire = true;
                break;
            }
        }
        if (needsRewire) {
            this._setupDynamicSubs();
        }
    }

    componentWillUnmount() {
        // Tear down static subscriptions
        this.subs.forEach(sub => sub.variable.unsubscribe(sub.callback));
        // Tear down dynamic subscriptions
        this._clearDynamicSubs();
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
