/**
 * TutorialUI.js
 *
 * In-game tutorial / help page. Accessible from the left side panel at the bottom.
 * Pure React component — no Variable subscriptions needed.
 */

import React from 'react';
import { ThemeContext } from './theme';

// ─── Nested tooltip demo ──────────────────────────────────────────────────────

class TooltipDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showOuter: false, showInner: false, showDeep: false };
    }
    render() {
        const c = this.props.c;
        const { showOuter, showInner, showDeep } = this.state;

        const pill = (extra) => ({
            display: 'inline-block', padding: '2px 10px', borderRadius: '4px',
            border: `1px solid ${c.borderMid}`, backgroundColor: c.contentBgAlt,
            color: c.textPrimary, cursor: 'default',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            fontSize: '14px', position: 'relative', ...extra,
        });

        const tip = (z, minW) => ({
            position: 'absolute', top: '110%', left: 0, zIndex: z,
            backgroundColor: '#ffffff', border: '1px solid #c8c8d0',
            borderRadius: '4px', padding: '8px 12px', minWidth: minW,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            fontSize: '13px', fontFamily: '"Segoe UI", system-ui, sans-serif',
            color: '#333', textAlign: 'right', lineHeight: '1.7',
        });

        const innerPill = {
            display: 'inline-block', padding: '0px 5px', borderRadius: '3px',
            border: '1px solid #c8c8d0', backgroundColor: '#f7f7f9',
            fontFamily: 'monospace', fontSize: '12px', color: '#333',
            cursor: 'pointer', position: 'relative',
        };

        const header = {
            fontWeight: 'bold', color: '#444', textAlign: 'left',
            marginBottom: '3px', borderBottom: '1px solid #e0e0e8',
            paddingBottom: '3px', display: 'block',
        };

        return (
            <div style={{ display: 'inline-block', marginBottom: '8px' }}>
                <span style={pill({})}
                    onMouseEnter={() => this.setState({ showOuter: true })}
                    onMouseLeave={() => this.setState({ showOuter: false, showInner: false, showDeep: false })}>
                    generalProductivity: <strong>0.82</strong>
                    {showOuter && (
                        <div style={tip(300, '270px')}>
                            <span style={header}>generalProductivity</span>
                            <div>base value: 1.00</div>
                            <div>× health effect:{' '}
                                <span style={innerPill}
                                    onMouseEnter={(e) => { e.stopPropagation(); this.setState({ showInner: true }); }}
                                    onMouseLeave={(e) => { e.stopPropagation(); this.setState({ showInner: false, showDeep: false }); }}>
                                    0.91
                                    {showInner && (
                                        <div style={tip(400, '230px')}>
                                            <span style={header}>health effect (S-curve)</span>
                                            <div>health:{' '}
                                                <span style={innerPill}
                                                    onMouseEnter={(e) => { e.stopPropagation(); this.setState({ showDeep: true }); }}
                                                    onMouseLeave={(e) => { e.stopPropagation(); this.setState({ showDeep: false }); }}>
                                                    0.58
                                                    {showDeep && (
                                                        <div style={tip(500, '190px')}>
                                                            <span style={header}>health (trending)</span>
                                                            <div>base: 0.50</div>
                                                            <div>+ food rations: +0.12</div>
                                                            <div>+ coal rations: +0.08</div>
                                                            <div>− homelessness: −0.12</div>
                                                            <div style={{ color: '#888', fontSize: '11px', marginTop: '3px' }}>trending ↑ toward 0.62</div>
                                                        </div>
                                                    )}
                                                </span>
                                            </div>
                                            <div>speed: 3.5, bias: 0.35, scale: 0.65</div>
                                        </div>
                                    )}
                                </span>
                            </div>
                            <div>× happiness effect: 0.90</div>
                            <div>× admin efficiency: 1.00</div>
                            <div style={{ borderTop: '1px solid #e0e0e8', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>= 0.82</div>
                        </div>
                    )}
                </span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: c.textMuted, fontStyle: 'italic' }}>
                    ← hover me, then hover the inner values
                </span>
            </div>
        );
    }
}

// ─── Static trending examples ─────────────────────────────────────────────────

function TrendingExamples({ c }) {
    const row = { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', fontFamily: 'monospace', fontSize: '14px' };
    const label = { width: '80px', fontSize: '13px', color: c.textMuted, fontFamily: 'inherit' };
    const val = (col) => ({ fontWeight: 'bold', color: col, minWidth: '48px' });
    const arrow = (col) => ({ color: col, fontSize: '13px' });
    const target = { fontSize: '12px', color: c.textMuted };

    return (
        <div style={{ padding: '10px 14px', border: `1px solid ${c.borderLight}`, borderRadius: '6px', backgroundColor: c.contentBgAlt, display: 'inline-block' }}>
            <div style={{ fontSize: '11px', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Example trending values
            </div>
            <div style={row}>
                <span style={label}>happiness</span>
                <span style={val('#2a8a2a')}>0.523</span>
                <span style={arrow('#2a8a2a')}>↑</span>
                <span style={target}>(↑0.68)</span>
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif' }}>— slowly improving</span>
            </div>
            <div style={row}>
                <span style={label}>happiness</span>
                <span style={val('#cc3333')}>0.441</span>
                <span style={arrow('#cc3333')}>↓</span>
                <span style={target}>(↓0.31)</span>
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif' }}>— falling faster</span>
            </div>
            <div style={row}>
                <span style={label}>health</span>
                <span style={val('#2a8a2a')}>0.612</span>
                <span style={arrow('#2a8a2a')}>↑</span>
                <span style={target}>(↑0.65)</span>
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif' }}>— very slowly improving</span>
            </div>
            <div style={row}>
                <span style={label}>health</span>
                <span style={val('#cc3333')}>0.489</span>
                <span style={arrow('#cc3333')}>↓</span>
                <span style={target}>(↓0.38)</span>
                <span style={{ fontSize: '12px', color: c.textMuted, fontFamily: 'sans-serif' }}>— falling quickly</span>
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

                <SubHeader title="Variables are deeply connected — and intentionally circular" c={c} />
                <Para c={c}>
                    Some variable loops are intentional. Cutting food rations saves food short-term,
                    but reduces health → happiness → productivity → food output, potentially making
                    the shortage worse:
                </Para>
                <div style={{ marginBottom: '16px' }}><ConnectionDiagram c={c} /></div>

                <SubHeader title="Trending variables" c={c} />
                <Para c={c}>
                    Health and happiness don't jump instantly — they drift toward their target.
                    Worsening is always faster than improving. The arrow shows direction; the
                    number in parentheses is the target:
                </Para>
                <div style={{ marginBottom: '16px' }}><TrendingExamples c={c} /></div>

                {/* ── Gameplay ── */}
                <SectionHeader title="Gameplay" c={c} />

                <BulletList c={c} items={[
                    'Make your character first — fill all five trait groups before the clock starts.',
                    'Assign workers to buildings in the Production tab. Build a Construction Site first.',
                    'Research is faction-level — click 📜 Research in the left panel.',
                    'Build Roads to unlock the Trading tab.',
                    'Use the Distribution tab to set food and coal rations. Keep them around 0.6 — harvests vary and coal demand spikes in winter.',
                    'There is no end game yet — grow your settlements and avoid rebellion.',
                ]} />

                {/* ── Starter Tips ── */}
                <SectionHeader title="Struggling on the intended start?" c={c} />

                <Callout c={c} type="tip">
                    <strong>Begin with extensive noble privileges</strong> — they give legitimacy bonuses that reduce rebellion risk early on.
                </Callout>
                <Callout c={c} type="tip">
                    <strong>Keep food and coal rations at around 0.6</strong> — full rations drain stockpiles fast. A bad harvest at full rations can be catastrophic.
                </Callout>
                <Callout c={c} type="tip">
                    <strong>Build Wooden Huts early</strong> — research "Wooden Huts" and upgrade Housing. Homelessness is one of the fastest ways to spiral into rebellion.
                </Callout>

                <div style={{ height: '40px' }} />
            </div>
        );
    }
}

TutorialUI.contextType = ThemeContext;

export default TutorialUI;
