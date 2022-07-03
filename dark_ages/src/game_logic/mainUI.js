import UIBase from './UIBase';
import Settlement from './settlement/settlement';
import {AggregatorModifier, VariableModifier, Variable, Cumulator, addition, VariableComponent, CumulatorComponent} from './utils.js';
import { Timer } from './timer';
import Grid from  '@mui/material/Grid';
import { SettlementComponent } from './settlement/settlement';


class MainUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        return <Grid container spacing={2}>
            <Grid item xs={12}>
                <SettlementComponent settlement={this.game.settlements[this.props.currentSettlement]}/>
            </Grid>
        </Grid>
    }
}


export default MainUI;