/**
 * theme.js
 *
 * Dark medieval theme system for the main game UI.
 * Four themes available, switchable live during playtesting.
 *
 * Usage:
 *   import { getTheme, THEME_LIST, ThemeContext } from './theme';
 *
 *   // Wrap the game in <ThemeContext.Provider value={theme}>
 *   // Then in any class component: static contextType = ThemeContext; → this.context
 *
 * Each theme object has:
 *   id          — string key
 *   label       — display name
 *   description — short flavour description
 *   colors      — all colour tokens used across the game UI
 */

import React from 'react';

// ─── Theme definitions ────────────────────────────────────────────────────────

const THEMES = {

    /**
     * Parchment — warm candlelight, aged vellum, amber gold.
     * Softer version: muted off-whites, lighter browns, less contrast.
     */
    parchment: {
        id: 'parchment',
        label: 'Parchment',
        description: 'Warm candlelight on aged vellum. Soft, muted off-whites.',

        colors: {
            // Page / root background
            pageBg:             '#1a1208',

            // Main content area background
            contentBg:          '#ede8dc',
            contentBgAlt:       '#e5e0d4',
            contentBgHover:     '#f2ede2',

            // Borders
            borderStrong:       '#9a7a28',
            borderMid:          '#c8b880',
            borderLight:        '#d8cfa8',

            // Text
            textPrimary:        '#4a3818',
            textSecondary:      '#7a6030',
            textMuted:          '#a08858',
            textOnDark:         '#ede8dc',

            // Accent / interactive
            accent:             '#9a7a28',
            accentHover:        '#b09030',
            accentText:         '#fdf8ec',

            // Side panel
            sidePanelBg:        '#2a1e0a',
            sidePanelBorder:    '#5a3e10',
            sidePanelText:      '#c8a860',
            sidePanelHover:     '#3a2e14',
            sidePanelSelected:  '#4a3818',
            sidePanelSelectedText: '#e8c870',

            // HUD bar
            hudBg:              '#2e2008',
            hudBorder:          '#6b4e14',
            hudText:            '#c8a860',
            hudTextMuted:       '#8a7040',

            // Buttons (outlined style)
            btnBorder:          '#9a7a28',
            btnText:            '#7a6030',
            btnHoverBg:         '#f2ede2',
            btnActiveBg:        '#9a7a28',
            btnActiveText:      '#fdf8ec',

            // Warning banner
            warningBannerBg:    '#2e2008',
            warningBannerBorder:'#6b4e14',

            // Message log
            msgLogBg:           '#ede8dc',
            msgLogBorder:       '#c8b880',
            msgLogEntryBorder:  '#d8cfa8',
            msgLogDayColor:     '#a08858',

            // Modals
            modalBg:            '#ede8dc',
            modalBorder:        '#9a7a28',
            modalTitleColor:    '#4a3818',

            // Tabs (MUI)
            tabIndicator:       '#9a7a28',
            tabText:            '#7a6030',
            tabSelectedText:    '#4a3818',

            // Misc
            divider:            '#c8b880',
            scrollbarThumb:     '#9a7a28',
            scrollbarTrack:     '#e5e0d4',
        },
    },

    /**
     * Parchment Dark — same warmth as Parchment but darker overall.
     * More candlelit, like reading by a single flame.
     */
    parchmentDark: {
        id: 'parchmentDark',
        label: 'Parchment Dark',
        description: 'Candlelit parchment. Darker, more atmospheric.',

        colors: {
            pageBg:             '#120d04',

            contentBg:          '#2a2010',
            contentBgAlt:       '#221a0c',
            contentBgHover:     '#342818',

            borderStrong:       '#8a6a20',
            borderMid:          '#5a4418',
            borderLight:        '#3e3010',

            textPrimary:        '#d4b870',
            textSecondary:      '#a08848',
            textMuted:          '#6a5830',
            textOnDark:         '#d4b870',

            accent:             '#8a6a20',
            accentHover:        '#a07828',
            accentText:         '#fdf0c8',

            sidePanelBg:        '#180e04',
            sidePanelBorder:    '#3a2a0c',
            sidePanelText:      '#b09040',
            sidePanelHover:     '#221808',
            sidePanelSelected:  '#2e2010',
            sidePanelSelectedText: '#d4b060',

            hudBg:              '#160c04',
            hudBorder:          '#3a2a0c',
            hudText:            '#b09040',
            hudTextMuted:       '#6a5030',

            btnBorder:          '#8a6a20',
            btnText:            '#a08848',
            btnHoverBg:         '#342818',
            btnActiveBg:        '#8a6a20',
            btnActiveText:      '#fdf0c8',

            warningBannerBg:    '#160c04',
            warningBannerBorder:'#3a2a0c',

            msgLogBg:           '#2a2010',
            msgLogBorder:       '#5a4418',
            msgLogEntryBorder:  '#3e3010',
            msgLogDayColor:     '#6a5830',

            modalBg:            '#2a2010',
            modalBorder:        '#8a6a20',
            modalTitleColor:    '#d4b870',

            tabIndicator:       '#8a6a20',
            tabText:            '#a08848',
            tabSelectedText:    '#d4b870',

            divider:            '#5a4418',
            scrollbarThumb:     '#8a6a20',
            scrollbarTrack:     '#221a0c',
        },
    },

    /**
     * Iron — cold stone, dark iron, grey-green mould.
     * Grimier and more oppressive. The dungeon aesthetic.
     */
    iron: {
        id: 'iron',
        label: 'Iron',
        description: 'Cold stone and dark iron. Grimy, oppressive, dungeon-like.',

        colors: {
            pageBg:             '#0d0f0e',

            contentBg:          '#1c2020',
            contentBgAlt:       '#161a19',
            contentBgHover:     '#242a28',

            borderStrong:       '#4a5e52',
            borderMid:          '#2e3d35',
            borderLight:        '#253028',

            textPrimary:        '#c8d4cc',
            textSecondary:      '#8aaa96',
            textMuted:          '#5a7060',
            textOnDark:         '#c8d4cc',

            accent:             '#5a8a6a',
            accentHover:        '#6aaa7a',
            accentText:         '#0d1410',

            sidePanelBg:        '#0f1412',
            sidePanelBorder:    '#2a3830',
            sidePanelText:      '#7aaa8a',
            sidePanelHover:     '#1a2420',
            sidePanelSelected:  '#1e2e28',
            sidePanelSelectedText: '#a0d4b0',

            hudBg:              '#111614',
            hudBorder:          '#2e4038',
            hudText:            '#8aaa96',
            hudTextMuted:       '#4a6050',

            btnBorder:          '#4a5e52',
            btnText:            '#8aaa96',
            btnHoverBg:         '#242a28',
            btnActiveBg:        '#3a5a48',
            btnActiveText:      '#c8d4cc',

            warningBannerBg:    '#111614',
            warningBannerBorder:'#2e4038',

            msgLogBg:           '#1c2020',
            msgLogBorder:       '#2e3d35',
            msgLogEntryBorder:  '#253028',
            msgLogDayColor:     '#5a7060',

            modalBg:            '#1c2020',
            modalBorder:        '#4a5e52',
            modalTitleColor:    '#c8d4cc',

            tabIndicator:       '#5a8a6a',
            tabText:            '#8aaa96',
            tabSelectedText:    '#c8d4cc',

            divider:            '#2e3d35',
            scrollbarThumb:     '#4a5e52',
            scrollbarTrack:     '#161a19',
        },
    },

    /**
     * Iron Slate — iron with a cold blue-grey tinge.
     * Deep dungeon, wet stone, moonlight through a crack.
     */
    ironSlate: {
        id: 'ironSlate',
        label: 'Iron Slate',
        description: 'Cold blue-grey stone. Deep dungeon, wet rock, moonlight.',

        colors: {
            pageBg:             '#090c10',

            contentBg:          '#141820',
            contentBgAlt:       '#101418',
            contentBgHover:     '#1c2028',

            borderStrong:       '#3a4a60',
            borderMid:          '#263040',
            borderLight:        '#1c2430',

            textPrimary:        '#b8c8d8',
            textSecondary:      '#7890a8',
            textMuted:          '#4a6070',
            textOnDark:         '#b8c8d8',

            accent:             '#3a6080',
            accentHover:        '#4a7898',
            accentText:         '#e0f0f8',

            sidePanelBg:        '#0c1018',
            sidePanelBorder:    '#1e2c3c',
            sidePanelText:      '#6888a8',
            sidePanelHover:     '#141c28',
            sidePanelSelected:  '#182030',
            sidePanelSelectedText: '#90b8d0',

            hudBg:              '#0e1218',
            hudBorder:          '#1e2c3c',
            hudText:            '#6888a8',
            hudTextMuted:       '#3a5060',

            btnBorder:          '#3a4a60',
            btnText:            '#7890a8',
            btnHoverBg:         '#1c2028',
            btnActiveBg:        '#2a4060',
            btnActiveText:      '#e0f0f8',

            warningBannerBg:    '#0e1218',
            warningBannerBorder:'#1e2c3c',

            msgLogBg:           '#141820',
            msgLogBorder:       '#263040',
            msgLogEntryBorder:  '#1c2430',
            msgLogDayColor:     '#4a6070',

            modalBg:            '#141820',
            modalBorder:        '#3a4a60',
            modalTitleColor:    '#b8c8d8',

            tabIndicator:       '#3a6080',
            tabText:            '#7890a8',
            tabSelectedText:    '#b8c8d8',

            divider:            '#263040',
            scrollbarThumb:     '#3a4a60',
            scrollbarTrack:     '#101418',
        },
    },
};

export const THEME_LIST = Object.values(THEMES);

export function getTheme(id) {
    return THEMES[id] || THEMES.parchment;
}

// React context — provides the current theme object to all consumers
export const ThemeContext = React.createContext(THEMES.parchment);

/**
 * Hook for functional components.
 * Returns the full theme object (including colors).
 */
export function useTheme() {
    return React.useContext(ThemeContext);
}

export default THEMES;
