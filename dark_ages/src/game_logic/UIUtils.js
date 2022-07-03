
import { styled } from '@mui/material/styles';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import {Variable, VariableComponent} from './variable/variable.js'

export const HTMLTooltip = styled(({ className, ...props }) => (
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

export const CustomTooltip = (props) => {
    return <HTMLTooltip {...props} title={
        Object.entries(props.items).map(([i,item]) => {
            if (item instanceof Variable) {
                return <span  key={i}><VariableComponent variable={item}/><br /></span>
            } else if (typeof(item) === 'string') {
                return <span key={i} style={{fontStyle: 'italics'}}>{item}<br /></span>;
            } else {
                throw Error('what');
            }
        })
    }>
    </HTMLTooltip>
}