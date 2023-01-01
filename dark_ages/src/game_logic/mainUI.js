import UIBase from './UIBase';
import Grid from  '@mui/material/Grid';
import { Settlement, SettlementComponent } from './settlement/settlement';


class MainUI extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        this.game = this.props.game;
        return <Grid container spacing={2}>
            <Grid item xs={12}>
                {this.props.selected instanceof Settlement ? <SettlementComponent settlement={this.props.selected}/> : <span>Nothing</span>}
            </Grid>
        </Grid>
    }
}


export default MainUI;