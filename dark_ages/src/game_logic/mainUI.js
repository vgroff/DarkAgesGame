import UIBase from './UIBase';
import Grid from  '@mui/material/Grid';
import { Settlement, SettlementComponent } from './settlement/settlement';
import { Character, CharacterComponent } from './character';


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
                {this.props.selected instanceof Settlement ? <SettlementComponent setSelected={this.props.setSelected} settlement={this.props.selected}/> : null}
                {this.props.selected instanceof Character ? <CharacterComponent setSelected={this.props.setSelected} character={this.props.selected}/> : null}
            </Grid>
        </Grid>
    }
}


export default MainUI;