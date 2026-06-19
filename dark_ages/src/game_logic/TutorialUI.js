/**
 * TutorialUI.js
 *
 * In-game tutorial / help page. Accessible from the left side panel at the bottom.
 */

import React from 'react';
import { ThemeContext } from './theme';
import { Variable, VariableComponent } from './variable/variable';
import { VariableModifier, multiplication } from './variable/modifier';
import { TrendingVariable, TrendingVariableComponent } from './variable/trendingVariable';

// ─── Nested tooltip demo ──────────────────────────────────────────────────────
// Uses real Variable/VariableModifier objects so the tooltip behaviour is
// identical to the rest of the game (nested hoverable pills, auto-calculated
// breakdown, etc.).

function buildTooltipDemoVariables() {
    // Leaf: health (0.58) — a plain variable with a fixed value
    const health = new Variable({ name: 'health', startingValue: 0.58, displayRound: 2 });

    // health effect (0.91) — a variable whose value is derived from health
    const healthEffect = new Variable({
        name: 'health effect',
        startingValue: 1,
        displayRound: 2,
        modifiers: [
            new VariableModifier({ name: 'health', type: multiplication, variable: health }),
        ],
    });

    // happiness effect (0.90) — plain variable
    const happinessEffect = new Variable({ name: 'happiness effect', startingValue: 0.90, displayRound: 2 });

    // admin efficiency (1.00) — plain variable
    const adminEffect = new Variable({ name: 'admin efficiency', startingValue: 1.00, displayRound: 2 });

    // generalProductivity — multiplied by the three effect variables above
    const generalProductivity = new Variable({
        name: 'generalProductivity',
        startingValue: 1,
        displayRound: 2,
        modifiers: [
            new VariableModifier({ name: 'health effect', type: multiplication, variable: healthEffect }),
            new VariableModifier({ name: 'happiness effect', type: multiplication, variable: happinessEffect }),
            new VariableModifier({ name: 'admin efficiency', type: multiplication, variable: adminEffect }),
        ],
    });

    return generalProductivity;
}

// Built once at module load — static demo values, no timer needed.
const tooltipDemoVariable = buildTooltipDemoVariables();

function TooltipDemo({ c }) {
    return (
        <div style={{ display: 'inline-block', marginBottom: '8px' }}>
            <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: '4px',
                border: `1px solid ${c.borderMid}`, backgroundColor: c.contentBgAlt,
                color: c.textPrimary, fontFamily: '"Segoe UI", system-ui, sans-serif',
                fontSize: '14px',
            }}>
                <VariableComponent variable={tooltipDemoVariable} showName={true} showOwner={false} />
            </span>
            <span style={{ marginLeft: '10px', fontSize: '12px', color: c.textMuted, fontStyle: 'italic' }}>
                ← hover me, then hover the inner values
            </span>
        </div>
    );
}

// ─── Trending variable demo ───────────────────────────────────────────────────
// Uses real TrendingVariable objects so the display is identical to in-game.
// A plain Variable acts as a timer stub — TrendingVariable only needs
// timer.subscribe() and timer.currentValue, both of which Variable provides.

function buildTrendingDemoVariables() {
    const fakeTimer = new Variable({ name: 'demo timer', startingValue: 0 });

    // happiness: currently 0.52, trending up toward 0.68
    const happiness = new TrendingVariable({
        name: 'happiness',
        startingValue: 0.68,
        displayRound: 2,
        timer: fakeTimer,
        trendingSpeed: 0.05,
        trendingRoundTo: 3,
        smallestTrend: 0.001,
    });
    // Manually set the displayed (trending) value to 0.52 so it shows as improving
    happiness.trendingValueAtTurnStart = 0.52;
    happiness.currentValue = 0.52;
    happiness.trendingChange = 0.01; // positive → green ↑

    // health: currently 0.49, trending down toward 0.38
    const health = new TrendingVariable({
        name: 'health',
        startingValue: 0.38,
        displayRound: 2,
        timer: fakeTimer,
        trendingSpeed: 0.05,
        trendingRoundTo: 3,
        smallestTrend: 0.001,
    });
    // Manually set the displayed value to 0.49 so it shows as falling
    health.trendingValueAtTurnStart = 0.49;
    health.currentValue = 0.49;
    health.trendingChange = -0.01; // negative → red ↓

    return { happiness, health };
}

const trendingDemoVars = buildTrendingDemoVariables();

function TrendingExamples({ c }) {
    const row = { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' };
    return (
        <div style={{ padding: '10px 14px', border: `1px solid ${c.borderLight}`, borderRadius: '6px', backgroundColor: c.contentBgAlt, display: 'inline-block' }}>
            <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Example trending values
            </div>
            <div style={row}>
                <TrendingVariableComponent variable={trendingDemoVars.happiness} showName={true} showOwner={false} showTrending={true} showMax={false} />
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif', marginLeft: '6px' }}>— slowly improving</span>
            </div>
            <div style={row}>
                <TrendingVariableComponent variable={trendingDemoVars.health} showName={true} showOwner={false} showTrending={true} showMax={false} />
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif', marginLeft: '6px' }}>— falling quickly</span>
            </div>
        </div>
    );
}

// ─── Connection diagram ───────────────────────────────────────────────────────

function ConnectionDiagram({ c }) {
    const node = (label, hi) => (
        <span style={{
            display: 'inline-block', padding: '4px 10px', borderRadius: '16px',
            border: `1.5px solid ${hi ? c.accent : c.borderMid}`,
            backgroundColor: hi ? c.accent : c.contentBgAlt,
            color: hi ? c.accentText : c.textPrimary,
            fontSize: '12px', fontWeight: hi ? 'bold' : 'normal',
            margin: '3px 2px', whiteSpace: 'nowrap',
        }}>{label}</span>
    );
    const arr = <span style={{ fontSize: '13px', color: c.textMuted, margin: '0 1px' }}>→</span>;
    return (
        <div style={{ padding: '12px 16px', border: `1px solid ${c.borderLight}`, borderRadius: '6px', backgroundColor: c.contentBgAlt, marginBottom: '12px', display: 'inline-block' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                {node('food rations', true)}{arr}{node('health')}{arr}{node('productivity')}{arr}{node('food output')}{arr}{node('food rations', true)}
                <span style={{ fontSize: '12px', color: c.textMuted, marginLeft: '6px' }}>(circular!)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                {node('food rations', true)}{arr}{node('happiness')}{arr}{node('productivity')}{arr}{node('food output')}{arr}{node('food rations', true)}
                <span style={{ fontSize: '12px', color: c.textMuted, marginLeft: '6px' }}>(circular!)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                {node('food rations', true)}{arr}{node('health')}{arr}{node('happiness')}{arr}{node('productivity')}{arr}{node('food output')}{arr}{node('food rations', true)}
                <span style={{ fontSize: '12px', color: c.textMuted, marginLeft: '6px' }}>(circular!)</span>
            </div>
        </div>
    );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function SectionHeader({ title, c }) {
    return (
        <h2 style={{ fontFamily: 'serif', fontSize: '20px', color: c.textPrimary, borderBottom: `2px solid ${c.borderMid}`, paddingBottom: '6px', marginTop: '32px', marginBottom: '14px' }}>
            {title}
        </h2>
    );
}

function SubHeader({ title, c }) {
    return (
        <h3 style={{ fontFamily: 'serif', fontSize: '16px', color: c.textSecondary, marginTop: '20px', marginBottom: '8px' }}>
            {title}
        </h3>
    );
}

function Para({ children, c }) {
    return (
        <p style={{ fontSize: '14px', lineHeight: '1.65', color: c.textPrimary, marginBottom: '10px' }}>
            {children}
        </p>
    );
}

function Callout({ children, c, type }) {
    const cols = {
        tip:     { bg: 'rgba(60,160,80,0.10)',   border: 'rgba(60,160,80,0.35)'   },
        info:    { bg: 'rgba(100,140,200,0.10)', border: 'rgba(100,140,200,0.35)' },
    };
    const col = cols[type || 'info'];
    return (
        <div style={{ backgroundColor: col.bg, border: `1px solid ${col.border}`, borderRadius: '5px', padding: '10px 14px', marginBottom: '12px', fontSize: '13.5px', lineHeight: '1.6', color: c.textPrimary }}>
            {children}
        </div>
    );
}

function BulletList({ items, c }) {
    return (
        <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
            {items.map((item, i) => (
                <li key={i} style={{ fontSize: '14px', lineHeight: '1.6', color: c.textPrimary, marginBottom: '4px' }}>{item}</li>
            ))}
        </ul>
    );
}

// ─── Main Tutorial Component ──────────────────────────────────────────────────

export class TutorialUI extends React.Component {
    render() {
        const theme = this.context;
        const c = theme ? theme.colors : {
            textPrimary: '#333', textSecondary: '#666', textMuted: '#999',
            contentBg: '#fff', contentBgAlt: '#f5f5f5',
            borderLight: '#ddd', borderMid: '#bbb',
            accent: '#888', accentText: '#fff',
        };

        return (
            <div style={{ padding: '24px 32px', maxWidth: '820px', color: c.textPrimary }}>

                <h1 style={{ fontFamily: 'serif', fontSize: '28px', color: c.textPrimary, marginBottom: '4px' }}>
                    📖 How to Play
                </h1>
                <div style={{ fontSize: '14px', color: c.textMuted, marginBottom: '28px', fontStyle: 'italic' }}>
                    A guide to the Dark Ages game.
                </div>

                {/* ── UI & Principles ── */}
                <SectionHeader title="UI & Principles" c={c} />

                <SubHeader title="Tooltips on almost everything" c={c} />
                <Para c={c}>
                    Nearly every number in the game can be hovered to see how it was calculated.
                    Tooltips show the base value, each modifier applied, and the final result.
                    Crucially, <strong>tooltips nest</strong> — the numbers inside a tooltip are
                    themselves hoverable, revealing their own calculation chains.
                </Para>
                <Para c={c}>Try hovering the value below, then hover the inner numbers:</Para>
                <div style={{ marginBottom: '16px' }}><TooltipDemo c={c} /></div>
                <Para c={c}>
                    (Almost) everything is transparent to you via the tooltips
                </Para>

                <SubHeader title="Connections and Loops" c={c} />
                <Para c={c}>
                    Variables are connected to each other, often in loops and often in more than one way. 
                    For example, cutting food rations saves food in the short-term,
                    but it will also reduce productivity, and therefore food output:
                </Para>
                <div style={{ marginBottom: '16px' }}><ConnectionDiagram c={c} /></div>

                <SubHeader title="Trending variables" c={c} />
                <Para c={c}>
                    Some variables they drift toward a target rather than changing instantanousely.
                    Health and happiness for example.
                    Worsening is often faster than improving. The arrow shows direction; the
                    number in parentheses is the target:
                </Para>
                <div style={{ marginBottom: '16px' }}><TrendingExamples c={c} /></div>

                <Para c={c}>
                    Many numbers, such as happiness and health, will start between 0 and 1. However,
                    most of them can grow larger than 1. You should think of 1 as{' '}
                    <strong>"good, fulfilled"</strong> rather than <strong>"maxed out"</strong>.
                </Para>

                {/* ── Gameplay ── */}
                <SectionHeader title="Gameplay" c={c} />

                <BulletList c={c} items={[
                    'Make your character first — fill all five trait groups before the clock starts',
                    'Assign workers to buildings in the Production tab',
                    'Set food and coal rations, try to have stockpiles — harvests vary and coal demand spikes in winter',
                    'Keep popular support positive or a rebellion will eventually occur',
                    'Keep happiness+legitimacy > 1 to keep popular support positive',
                    'Research is faction-level — click 📜 Research in the left panel',
                    'Build Roads to unlock trading',
                    'There is no end game yet — just grow your settlements and avoid rebellion',
                ]} />

                {/* ── Starter Tips ── */}
                <SectionHeader title="Struggling on the intended start?" c={c} />

                <Callout c={c} type="tip">
                    <strong>Begin with extensive noble privileges</strong> — they give legitimacy bonuses that reduce rebellion risk early on. Reduce them when happiness is high enough
                </Callout>
                <Callout c={c} type="tip">
                    <strong>Keep food and coal rations at around 0.6 at the start</strong> — full rations drain stockpiles fast. A bad harvest or cold winter at full rations can be catastrophic.
                </Callout>
                <Callout c={c} type="tip">
                    <strong>Build Wooden Huts early</strong> — research "Wooden Huts" and upgrade Housing, the happiness boost will allow you to cut food and coal rations a little
                </Callout>

                <div style={{ height: '40px' }} />
            </div>
        );
    }
}

TutorialUI.contextType = ThemeContext;

export default TutorialUI;
