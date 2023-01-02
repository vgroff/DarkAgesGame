import { Grid } from "@mui/material";
import UIBase from "./UIBase";


export class SidePanel extends UIBase {
    constructor(props) {
        super(props);
        this.setSelected = props.setSelected;
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        this.game = this.props.game;
        this.setSelected = this.props.setSelected;
        return <Grid container spacing={2}>
            <Grid item xs={10}>
                <div onClick={() => this.setSelected(this.game.playerCharacter)} key={'playerCharacter'}>{this.game.playerCharacter.name}</div>
                {this.game.settlements.map((settlement,i) => {
                    return <div onClick={() => this.setSelected(settlement)} key={`settlement_${i}`}>{settlement.name}</div>
                })}
            </Grid>
        </Grid>
    }
}