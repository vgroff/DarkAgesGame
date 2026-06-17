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

// ── Tooltip depth context ──────────────────────────────────────────────────────
// Tracks how many tooltip layers deep we are. Depth 0 = top-level tooltip
// (opens downward, same behaviour as before). Depth ≥ 1 = nested tooltip
// (opens rightward, no repositioning so it never stutters).
export const TooltipDepthContext = React.createContext(0);

// ── Shared tooltip styles (applied at all depths) ─────────────────────────────
const StyledTooltipBase = styled(({ className, ...props }) => (
    <Tooltip {...props} classes={{ popper: className }} />
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
    [`& .${tooltipClasses.arrow}`]: {
        color: '#ffffff',
        '&::before': {
            border: '1px solid #c8c8d0',
        },
    },
}));

/**
 * HTMLTooltip — depth-aware tooltip component.
 *
 * Depth 0 (top-level): identical behaviour to the original HTMLTooltip —
 * no explicit placement (MUI defaults to bottom), flip and preventOverflow
 * disabled so the outer tooltip doesn't jump when inner tooltips open/close.
 *
 * Depth ≥ 1 (nested): placement="right-start". All repositioning disabled
 * (flip off, preventOverflow off, adaptive off) — the tooltip simply opens
 * to the right and clips if it goes off-screen. This is the only way to
 * guarantee no stutter: any enabled repositioning modifier can cause a
 * recalculate loop when the tooltip is near the viewport edge.
 *
 * The tooltip's `title` content is automatically wrapped in a
 * TooltipDepthContext.Provider that increments the depth, so any HTMLTooltip
 * rendered inside the title will know it is nested.
 */
export const HTMLTooltip = (props) => {
    const depth = React.useContext(TooltipDepthContext);
    const isNested = depth > 0;

    // Wrap the title content in a depth-incrementing provider so nested
    // tooltips know they are inside another tooltip.
    const wrappedTitle = props.title
        ? <TooltipDepthContext.Provider value={depth + 1}>{props.title}</TooltipDepthContext.Provider>
        : props.title;

    if (isNested) {
        // Nested tooltip: opens rightward, all repositioning disabled.
        // No flip, no preventOverflow — clips at viewport edge rather than
        // stuttering. disablePortal keeps it inline (no flash-to-origin).
        return (
            <StyledTooltipBase
                placement="right-start"
                {...props}
                title={wrappedTitle}
                PopperProps={{
                    disablePortal: true,
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
        );
    } else {
        // Top-level tooltip: identical to the original HTMLTooltip behaviour.
        // No explicit placement (MUI defaults to bottom). Flip and
        // preventOverflow disabled so the outer tooltip doesn't jump when
        // inner content changes height.
        return (
            <StyledTooltipBase
                {...props}
                title={wrappedTitle}
                PopperProps={{
                    disablePortal: true,
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
        );
    }
};

export const CustomTooltip = (props) => {
    return <HTMLTooltip {...props} title={
        props.items.map((item, i) => {
            if (item instanceof Variable) {
                return <span key={i}><VariableComponent variable={item}/><br /></span>
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