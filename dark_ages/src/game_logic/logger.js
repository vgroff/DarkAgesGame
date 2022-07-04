import UIBase from "./UIBase";
import {Variable,VariableComponent} from './variable/variable';

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
    static addLine(line) {
        Logger.logger.addLine(line);
    }
    static setInspect(inspect) {
        Logger.logger.setInspect(inspect);
    }
    constructor() {
        this.lines = [];
        this.inspect = null;
        this.subscriptions = [];
    }
    addLine(line) {
        this.lines.push(line);
        this.callSubscribers();
    }
    setInspect(inspect) {
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
        this.subscriptions.forEach(subscription => subscription(depth))
    }
}

export class LoggerComponent extends UIBase {
    constructor(props) {
        super(props);
        this.logger = props.logger;
        this.state = {
            inspect: this.logger.inspect,
            lines: this.logger.lines,
            ready: true
        };
    }
    componentDidMount() {
        var self = this;
        this.sub = this.logger.subscribe(() => {
            self.setState({
                inspect: this.logger.inspect,
                lines: this.logger.lines
            })
        });
    }
    componentWillUnmount() {
        this.logger.unsubscribe(this.sub);
    }
    renderObject(obj) {
        let self = this;
        if (!obj) {
            return '';
        }
        return <div>
            {Object.entries(obj).map(([key, v]) => {
                if (v instanceof Variable) {
                    return <VariableComponent variable={this.logger.inspect}/>
                } else if (typeof(obj) === "object") {
                    return self.renderObject(obj);
                } else {
                    return `${key}: ${v}`;
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
        return <div>
            <div>{this.renderInspect()}</div>
            {this.logger.lines.map(line => <span>line<br /></span>)}
        </div>
    }
}