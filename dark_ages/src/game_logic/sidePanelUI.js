import React from 'react';
import UIBase from "./UIBase";
import { ThemeContext } from "./theme";


/**
 * A single clickable item in the side panel.
 * Uses local hover state for the hover highlight.
 */
class SidePanelItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hovered: false };
    }
    render() {
        const { label, sublabel, onClick, c } = this.props;
        const { hovered } = this.state;

        const style = {
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '16px',
            color: c ? (hovered ? c.sidePanelSelectedText : c.sidePanelText) : '#444',
            backgroundColor: c
                ? (hovered ? c.sidePanelHover : 'transparent')
                : (hovered ? '#f0f0f0' : 'transparent'),
            borderLeft: `3px solid ${hovered && c ? c.borderStrong : 'transparent'}`,
            transition: 'background-color 0.1s, color 0.1s, border-color 0.1s',
            userSelect: 'none',
        };

        return (
            <div
                style={style}
                onClick={onClick}
                onMouseEnter={() => this.setState({ hovered: true })}
                onMouseLeave={() => this.setState({ hovered: false })}
            >
                <span>{label}</span>
                {sublabel && c && (
                    <span style={{
                        display: 'block',
                        fontSize: '11px',
                        color: c.textMuted,
                        marginTop: '1px',
                    }}>
                        {sublabel}
                    </span>
                )}
            </div>
        );
    }
}


/**
 * Research button in the side panel — a special nav item that toggles the
 * faction research panel. Styled to match the side panel items but visually
 * distinct (uses accent colour when active).
 */
class ResearchNavItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hovered: false };
    }
    render() {
        const { onClick, c, isActive } = this.props;
        const { hovered } = this.state;

        const style = {
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '16px',
            color: c
                ? (isActive ? c.accentText : hovered ? c.sidePanelSelectedText : c.sidePanelText)
                : (isActive ? '#fff' : '#444'),
            backgroundColor: c
                ? (isActive ? c.accent : hovered ? c.sidePanelHover : 'transparent')
                : (isActive ? '#888' : hovered ? '#f0f0f0' : 'transparent'),
            borderLeft: `3px solid ${isActive && c ? c.accent : (hovered && c ? c.borderStrong : 'transparent')}`,
            fontWeight: isActive ? 'bold' : 'normal',
            transition: 'background-color 0.1s, color 0.1s, border-color 0.1s',
            userSelect: 'none',
        };

        return (
            <div
                style={style}
                onClick={onClick}
                onMouseEnter={() => this.setState({ hovered: true })}
                onMouseLeave={() => this.setState({ hovered: false })}
            >
                📜 Research
            </div>
        );
    }
}


/**
 * Tutorial button in the side panel — shown at the bottom, toggles the tutorial page.
 * Styled to match ResearchNavItem.
 */
class TutorialNavItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hovered: false };
    }
    render() {
        const { onClick, c, isActive } = this.props;
        const { hovered } = this.state;
        const style = {
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '16px',
            color: c
                ? (isActive ? c.accentText : hovered ? c.sidePanelSelectedText : c.sidePanelText)
                : (isActive ? '#fff' : '#444'),
            backgroundColor: c
                ? (isActive ? c.accent : hovered ? c.sidePanelHover : 'transparent')
                : (isActive ? '#888' : hovered ? '#f0f0f0' : 'transparent'),
            borderLeft: `3px solid ${isActive && c ? c.accent : (hovered && c ? c.borderStrong : 'transparent')}`,
            fontWeight: isActive ? 'bold' : 'normal',
            transition: 'background-color 0.1s, color 0.1s, border-color 0.1s',
            userSelect: 'none',
        };
        return (
            <div
                style={style}
                onClick={onClick}
                onMouseEnter={() => this.setState({ hovered: true })}
                onMouseLeave={() => this.setState({ hovered: false })}
            >
                📖 How to Play
            </div>
        );
    }
}


export class SidePanel extends UIBase {
    constructor(props) {
        super(props);
        this.setSelected = props.setSelected;
        this.addVariables([props.internalTimer]);
    }
    childRender() {
        const theme = this.context;
        const c = theme ? theme.colors : null;

        this.game = this.props.game;
        this.setSelected = this.props.setSelected;

        const { showResearch, onToggleResearch, showTutorial, onToggleTutorial } = this.props;

        const sectionLabelStyle = {
            padding: '8px 16px 3px',
            fontSize: '11px',
            color: c ? c.textMuted : '#aaa',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 'bold',
        };

        const dividerStyle = {
            borderTop: `1px solid ${c ? c.sidePanelBorder : '#ddd'}`,
            margin: '6px 0',
        };

        return (
            <div style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div>
                    {/* Characters section */}
                    <div style={sectionLabelStyle}>Characters</div>
                    <SidePanelItem
                        label={this.game.playerCharacter.name}
                        onClick={() => {
                            if (onToggleResearch && showResearch) onToggleResearch();
                            if (onToggleTutorial && showTutorial) onToggleTutorial();
                            this.setSelected(this.game.playerCharacter);
                        }}
                        c={c}
                    />

                    <div style={dividerStyle} />

                    {/* Research — faction-level, below character, above settlements */}
                    <ResearchNavItem
                        onClick={() => {
                            if (onToggleTutorial && showTutorial) onToggleTutorial();
                            if (onToggleResearch) onToggleResearch();
                        }}
                        c={c}
                        isActive={showResearch}
                    />

                    <div style={dividerStyle} />

                    {/* Settlements section */}
                    <div style={sectionLabelStyle}>Settlements</div>
                    {this.game.settlements.map((settlement, i) => (
                        <SidePanelItem
                            key={`settlement_${i}`}
                            label={settlement.name}
                            sublabel={settlement.terrain ? settlement.terrain.name : null}
                            onClick={() => {
                                if (onToggleResearch && showResearch) onToggleResearch();
                                if (onToggleTutorial && showTutorial) onToggleTutorial();
                                this.setSelected(settlement);
                            }}
                            c={c}
                        />
                    ))}
                </div>

                {/* Tutorial button — pinned at the bottom of the side panel */}
                <div style={{ marginTop: 'auto' }}>
                    <div style={dividerStyle} />
                    <TutorialNavItem
                        onClick={onToggleTutorial}
                        c={c}
                        isActive={showTutorial}
                    />
                </div>
            </div>
        );
    }
}

SidePanel.contextType = ThemeContext;
