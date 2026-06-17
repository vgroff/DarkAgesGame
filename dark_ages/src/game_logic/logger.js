import UIBase from "./UIBase";
import {Variable,VariableComponent} from './variable/variable';
import Button from '@mui/material/Button'
import React from 'react';

// ─── Log level constants ───────────────────────────────────────────────────────
export const LOG_LEVELS = {
    DEBUG:    0,
    INFO:     1,
    WARN:     2,
    ERROR:    3,
    GAME_MSG: 4,  // Player-facing game messages only (highest filter level)
};

export const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'GAME'];

// Colours used in the LoggerComponent for each level
const LOG_LEVEL_COLORS = {
    0: '#888',    // DEBUG    — muted grey
    1: 'inherit', // INFO     — default text
    2: '#b8860b', // WARN     — dark yellow
    3: '#cc0000', // ERROR    — red
    4: 'inherit', // GAME_MSG — same as INFO (player-facing)
};

/**
 * Singleton Logger.
 *
 * Two separate logs:
 *   fileLog  — every entry ever logged, regardless of level. Used for debugging
 *              and can be downloaded as a text file. Each entry: { ts, level, message, context }.
 *   lines    — legacy debug inspector lines (unchanged behaviour).
 *
 * In-game log level:
 *   inGameLogLevel (default INFO) — only entries at or above this level are
 *   surfaced to the player via the MessageLogPanel. The level can be changed
 *   at runtime (e.g. from the LoggerComponent UI).
 *
 * Usage:
 *   Logger.debug('tick fired', { day: 3 });
 *   Logger.info('Rebellion in Village 1');
 *   Logger.warn('Treasury near zero', { treasury: 2 });
 *   Logger.error('Unexpected NaN in productivity');
 */
export class Logger {
    static logger = null;

    static constructLogger() {
        if (!Logger.logger) {
            Logger.logger = new Logger();
        }
    }
    static getLogger() {
        Logger.constructLogger();
        return Logger.logger;
    }

    // ── Static convenience methods ──────────────────────────────────────────
    static addLine(line) { Logger.logger.addLine(line); }
    static setInspect(inspect) { Logger.logger.setInspect(inspect); }
    static debug(message, context) { Logger.getLogger().log(LOG_LEVELS.DEBUG, message, context); }
    static info(message, context)  { Logger.getLogger().log(LOG_LEVELS.INFO,  message, context); }
    static warn(message, context)  { Logger.getLogger().log(LOG_LEVELS.WARN,  message, context); }
    static error(message, context) { Logger.getLogger().log(LOG_LEVELS.ERROR, message, context); }

    constructor() {
        this.lines = [];
        this.inspect = null;
        this.inspects = [];
        this.subscriptions = [];

        // All log entries ever written — never trimmed.
        // Shape: { ts: Date, level: number, message: string, context?: object }
        this.fileLog = [];

        // In-game log: only entries at or above inGameLogLevel.
        // This is what the MessageLogPanel reads.
        this.inGameLog = [];

        // Default: show INFO and above to the player.
        this.inGameLogLevel = LOG_LEVELS.INFO;
    }

    // ── Core log method ─────────────────────────────────────────────────────
    /**
     * @param {number} level  — one of LOG_LEVELS.*
     * @param {string} message
     * @param {object} [context] — optional extra data (not shown to player, only in fileLog)
     */
    log(level, message, context) {
        const entry = {
            ts: new Date(),
            level,
            levelName: LOG_LEVEL_NAMES[level] || 'UNKNOWN',
            message,
            context: context || null,
        };
        this.fileLog.push(entry);

        if (level >= this.inGameLogLevel) {
            this.inGameLog.push(entry);
            this.callSubscribers();
        }
    }

    // ── Legacy API (unchanged) ───────────────────────────────────────────────
    addLine(line) {
        this.lines.push(line);
        this.callSubscribers();
    }
    setInspect(inspect) {
        this.inspects.push(this.inspect);
        if (this.inspects.length > 35) {
            this.inspects.shift();
        }
        this.inspect = inspect;
        this.callSubscribers();
    }
    subscribe(callback, reason = '') {
        this.subscriptions.push(callback);
        return callback;
    }
    unsubscribe(callback) {
        this.subscriptions = this.subscriptions.filter(c => c !== callback);
    }
    callSubscribers(depth) {
        this.subscriptions.forEach(subscription => subscription(depth));
    }
    backOne() {
        if (this.inspects.length >= 2) {
            this.inspects.pop();
            this.setInspect(this.inspects.pop());
        }
    }

    // ── Log level control ────────────────────────────────────────────────────
    setInGameLogLevel(level) {
        this.inGameLogLevel = level;
        // Rebuild inGameLog from fileLog with new threshold
        this.inGameLog = this.fileLog.filter(e => e.level >= level);
        this.callSubscribers();
    }

    // ── File log download ────────────────────────────────────────────────────
    /**
     * Returns a Blob URL for downloading the full file log as a text file.
     * Each line: [ISO timestamp] [LEVEL] message  {context json if any}
     */
    getFileLogBlobUrl() {
        const lines = this.fileLog.map(e => {
            const ts = e.ts.toISOString();
            const ctx = e.context ? '  ' + JSON.stringify(e.context) : '';
            return `[${ts}] [${e.levelName.padEnd(5)}] ${e.message}${ctx}`;
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        if (this._fileLogBlobUrl) {
            URL.revokeObjectURL(this._fileLogBlobUrl);
        }
        this._fileLogBlobUrl = URL.createObjectURL(blob);
        return this._fileLogBlobUrl;
    }
}


// ─── LoggerComponent ──────────────────────────────────────────────────────────
/**
 * Debug inspector panel (right column).
 * Shows the inspected object + legacy lines.
 * Also shows a log level selector and a download link for the full file log.
 */
export class LoggerComponent extends UIBase {
    constructor(props) {
        super(props);
        this.logger = props.logger;
        this.state = {
            inspect: this.logger.inspect,
            lines: this.logger.lines,
            ready: true,
            inGameLogLevel: this.logger.inGameLogLevel,
        };
    }
    componentDidMount() {
        var self = this;
        this.sub = this.logger.subscribe(() => {
            self.setState({
                inspect: this.logger.inspect,
                lines: this.logger.lines,
                inGameLogLevel: this.logger.inGameLogLevel,
            });
        });
    }
    componentWillUnmount() {
        this.logger.unsubscribe(this.sub);
    }
    renderObject(obj) {
        if (!obj) {
            return '';
        }
        if (obj.logVar) {
            obj = obj.logVar;
        }
        return <div>
            {Object.entries(obj).map(([key, v], i) => {
                if (v instanceof Variable) {
                    return <span  key={i}><VariableComponent variable={v} style={{fontSize: 10}}/>< br/></span>
                } else if (typeof(v) === "function") {
                    return <span  style={{fontSize: 10}} key={i}>{`${v}`}<br /><br /></span>;
                }  else if (typeof(v) === "string") {
                    return <span  style={{fontSize: 10}} key={i}>{key}: {v}<br /></span>
                }  else if (typeof(v) === "boolean") {
                    return <span  style={{fontSize: 10}} key={i}>{key}: {v}<br /></span>
                }  else if (typeof(v) === "object") {
                    return <span style={{fontSize: 10}} key={i} onClick={()=>{this.logger.setInspect(v)}}>{key}: {'{object}'}<br /></span>
                } else{
                    return <span style={{fontSize: 10}} key={i}>{key}: {v}<br /></span>
                }
            })}
        </div>
    }
    renderInspect() {
        if (this.logger.inspect instanceof Variable) {
            return <VariableComponent variable={this.logger.inspect} expanded={true} style={{fontSize: 10}}/>
        } else {
            return this.renderObject(this.logger.inspect);
        }
    }
    childRender() {
        const logger = this.logger;
        const currentLevel = this.state.inGameLogLevel;

        return <div>
            <div style={{ paddingRight: '5px'}}>{this.renderInspect()}</div>
            <br />
            <div style={{textAlign:'center'}}>
                <Button onClick={() => {this.logger.backOne()}} variant='outlined' style={{fontSize:12}}>Go Back</Button>
            </div>

            {/* Log level selector */}
            <div style={{ marginTop: '8px', padding: '4px', borderTop: '1px solid #ccc' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: '4px' }}>
                    In-Game Log Level
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {LOG_LEVEL_NAMES.map((name, level) => (
                        <button
                            key={level}
                            onClick={() => {
                                logger.setInGameLogLevel(level);
                                this.setState({ inGameLogLevel: level });
                            }}
                            style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                fontWeight: currentLevel === level ? 'bold' : 'normal',
                                border: currentLevel === level ? '2px solid #333' : '1px solid #aaa',
                                borderRadius: '3px',
                                backgroundColor: currentLevel === level ? '#e0e0e0' : 'transparent',
                                color: LOG_LEVEL_COLORS[level],
                            }}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            {/* File log download */}
            <div style={{ marginTop: '6px', fontSize: '10px' }}>
                <button
                    onClick={async () => {
                        const lines = logger.fileLog.map(e => {
                            const ts = e.ts.toISOString();
                            const ctx = e.context ? '  ' + JSON.stringify(e.context) : '';
                            return `[${ts}] [${e.levelName.padEnd(5)}] ${e.message}${ctx}`;
                        });
                        const text = lines.join('\n');

                        // Try File System Access API first (Chrome/Edge) — lets user pick location
                        if (window.showSaveFilePicker) {
                            try {
                                const handle = await window.showSaveFilePicker({
                                    suggestedName: 'dark_ages_log.txt',
                                    types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
                                });
                                const writable = await handle.createWritable();
                                await writable.write(text);
                                await writable.close();
                                return;
                            } catch (e) {
                                // User cancelled or API unavailable — fall through to blob download
                                if (e.name === 'AbortError') return;
                            }
                        }

                        // Fallback: blob download
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'dark_ages_log.txt';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                    }}
                    style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        cursor: 'pointer',
                        border: '1px solid #aaa',
                        borderRadius: '3px',
                        backgroundColor: 'transparent',
                        color: '#555',
                    }}
                >
                    ⬇ Save log ({logger.fileLog.length} entries)
                </button>
            </div>

            {this.logger.lines.map((line, i) => <span key={i}>{line}<br /></span>)}
        </div>
    }
}
