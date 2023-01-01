import { Grid } from "@mui/material";
import UIBase from "./UIBase";


export class SidePanel extends UIBase {
    constructor(props) {
        super(props);
        this.game = props.game;
        this.setSelected = props.setSelected;
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        this.game = this.props.game;
        this.setSelected = this.props.setSelected;
        return <Grid container spacing={2}>
            <Grid item xs={10}>
                {this.game.settlements.map((settlement,i) => {
                    return <div onClick={() => this.setSelected(settlement)} key={i}>{settlement.name}</div>
                })}
            </Grid>
        </Grid>
    }
}