import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses } from '@mui/material/Tooltip';
import React from 'react';
import { Variable, VariableComponent } from "./variable/variable";

export function titleCase(str) {
    return str[0].toUpperCase() + str.substring(1);
}

export function roundNumber(number, dp = 3) {
    if (number === undefined || number === null || isNaN(number)) {
        console.warn('roundNumber called with invalid value:', number);
        return 0;
    }
    return parseFloat(number.toFixed(dp));
}

export function percentagize(amount) {
    return `${roundNumber((amount - 1)*100, 1)}`
}

export function randomRange(low, high) {
    return low + (high - low) * Math.random();
}

// Keep these out of UIUtils.js or it creates circular dependencies
// disablePortal: true prevents nested tooltips from flashing to (0,0) before positioning.
// Without it, inner tooltips inside an outer tooltip's portal content briefly render at the
// document body origin before the Popper measures the anchor, causing a visible flash.
export const HTMLTooltip = styled(({ className, ...props }) => (
    <Tooltip
        {...props}
        classes={{ popper: className }}
        PopperProps={{
            disablePortal: true,
            // Use 'fixed' strategy so the tooltip position is not recalculated
            // when inner content (nested VariableComponent tooltips) changes the
            // height of the tooltip body. Without this, Popper repositions the
            // outer tooltip every time an inner tooltip opens, causing a visible jump.
            modifiers: [
                { name: 'computeStyles', options: { adaptive: false } },
                { name: 'flip', enabled: false },
                { name: 'preventOverflow', enabled: false },
            ],
            ...props.PopperProps,
        }}
        TransitionProps={{ timeout: 0 }}
        enterDelay={0}
        enterNextDelay={0}
        leaveDelay={0}
    />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#ffffff',
        color: '#333333',
        maxWidth: 560,
        // minWidth ensures the tooltip is never squeezed to the width of a small anchor element.
        // Without this, a tooltip on a short number like "0.82" would be only ~30px wide.
        minWidth: '220px',
        // Override MUI typography — use explicit px so it matches the tutorial demo exactly
        fontSize: '13px',
        fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
        fontWeight: 400,
        lineHeight: 1.7,
        border: '1px solid #c8c8d0',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        textAlign: 'right',
        padding: '8px 12px',
    },
    // Override the arrow if present
    [`& .${tooltipClasses.arrow}`]: {
        color: '#ffffff',
        '&::before': {
            border: '1px solid #c8c8d0',
        },
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