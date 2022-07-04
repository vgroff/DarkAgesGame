import UIBase from "./UIBase";
import {Variable,VariableComponent} from './variable/variable';
import Button from '@mui/material/Button'

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
        this.inspects = [];
        this.subscriptions = [];
    }
    addLine(line) {
        this.lines.push(line);
        this.callSubscribers();
    }
    setInspect(inspect) {
        this.inspects.push(inspect);
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
        this.subscriptions.forEach(subscription => subscription(depth))
    }
    backOne() {
        if (this.inspects.length >= 2) {
            this.inspects.pop();
            this.setInspect(this.inspects.pop());
        }
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
            {Object.entries(obj).map(([key, v], i) => {
                if (v instanceof Variable) {
                    return <span  key={i}><VariableComponent variable={v} style={{fontSize: 10}}/>< br/></span>
                } else if (typeof(v) === "function") {
                    return ''
                }  else if (typeof(v) === "string") {
                    return <span  style={{fontSize: 10}} key={i}>{key}: {v}<br /></span>
                } else if (typeof(v) === "object") {
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
        return <div>
            <div style={{textAlign:'right', paddingRight: '5px'}}>{this.renderInspect()}</div>
            <br />
            <div style={{textAlign:'center'}}>
                <Button onClick={() => {this.logger.backOne()}} variant='outlined' style={{fontSize:12}}>Go Back</Button>
            </div>
            {this.logger.lines.map((line, i) => <span key={i}>line<br /></span>)}
        </div>
    }
}