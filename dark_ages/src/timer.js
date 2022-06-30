import React from 'react'

class Timer extends React.Component {
    constructor(props) {
        super(props);
        this.days = 0
        this.state = {days:this.days};
    }
    componentDidMount() {
        let self = this;
        this.intervalID = setInterval(() => {
            self.days += 1;
            self.setState({days: this.days});
        }, 1000);
    };
    componentWillUnmount() {
        clearInterval(this.intervalID);
    };
    render () {
        return <div>
            {this.state.days} days
        </div>
    }
}

export default Timer;