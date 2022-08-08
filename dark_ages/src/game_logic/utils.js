import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses } from '@mui/material/Tooltip';
import React from 'react';
import { Variable, VariableComponent } from "./variable/variable";

export function titleCase(str) {
    return str[0].toUpperCase() + str.substring(1);
}

export function roundNumber(number, dp = 3) {
    if (number === undefined) {
        debugger;
    }
    return parseFloat(number.toFixed(dp));
}

export function randomRange(low, high) {
    return low + (high - low) * Math.random();
}

// Keep these out of UIUtils.js or it creates circular dependencies
export const HTMLTooltip = styled(({ className, ...props }) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#f5f5f9',
        color: 'rgba(0, 0, 0, 0.87)',
        maxWidth: 400,
        fontSize: theme.typography.pxToRem(12),
        border: '1px solid #dadde9',
        textAlign: 'right'
    },
}));

export const CustomTooltip = (props) => {
    return <HTMLTooltip {...props} title={
        props.items.map((item, i) => {
            if (item instanceof Variable) {
                return <span  key={i}><VariableComponent variable={item}/><br /></span>
            } else if (typeof(item) === 'string') {
                return <span key={i} style={{fontStyle: 'italics'}}>{item}<br /></span>
            } else if (item.text) {
                return <span key={i} style={item.style}>{item.text}</span>
            } else {
                throw Error('what');
            }
        })
    }>
    </HTMLTooltip>
}