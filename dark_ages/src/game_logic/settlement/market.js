import { Variable, VariableModifier, addition, subtraction, scaledMultiplication, scaledAddition, multiplication, VariableComponent } from "../UIUtils";
import { Button } from "@mui/material";
import UIBase from "../UIBase";
import { roundNumber } from "../utils";


export class Market {
    constructor(props) {
        this.resourceStorages = props.resourceStorages;
        this.idealPrices = props.idealPrices;
        this.population = props.population;
        if (!props.population || !this.idealPrices || !this.resourceStorages || !props.tradeFactor) {
            throw Error("need this stuff");
        }
        let defaultPenalty = 0.35;
        let one = new Variable({startingValue: 1});
        let zero = new Variable({startingValue: 0});
        this.marketSellPriceFactor = new Variable({
            name: "market sell price factor", startingValue: (1 - defaultPenalty), max: one,
            modifiers: [
                new VariableModifier({variable: props.tradeFactor, type: scaledAddition, scale: defaultPenalty*0.8, exp: 0.75})
            ]
        });
        this.marketBuyPriceFactor = new Variable({
            name: "market buy price factor", startingValue: 1 + defaultPenalty, min: one, type: multiplication, 
            modifiers: [
                new VariableModifier({variable: props.tradeFactor, type: scaledAddition, scale: -defaultPenalty*0.8, exp:0.75})
            ]
        });
        this.marketAmountFactor = new Variable({
            name: "market amount factor", startingValue: 0, type: multiplication,
            modifiers: [
                new VariableModifier({variable: props.tradeFactor, type: scaledAddition, scale: 1, exp:0.75, bias: 0.25})
            ]
        });
        this.marketResources = this.resourceStorages.map(resourceStorage => {
            let resource = resourceStorage.resource;
            if (!resource.storageMultiplier) {
                return null;
            }
            if (!(resource.name in this.idealPrices)) {
                throw Error("need all resources")
            }
            let desiredSellProp = new Variable({name: `desired selling % of ${resource.name}`, startingValue: 0, min: zero, max: this.marketAmountFactor});
            let buyProp = new Variable({name: `buying % of ${resource.name}`, startingValue: 0, min: zero,  max: this.marketAmountFactor,
                modifiers: [new VariableModifier({variable: props.bankrupt, type:scaledMultiplication, bias:1,scale:-1})]
            });
            let desiredSellAmount = new Variable({name: `total selling of ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: this.population, type: addition}),
                new VariableModifier({variable: desiredSellProp, type: multiplication}),
            ]});
            let buyAmount = new Variable({name: `buying amount of ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: this.population, type: addition}),
                new VariableModifier({variable: buyProp, type: multiplication}),
            ]});
            let idealProportion = new Variable({name: `ideal ${resource.name} proportion`, startingValue: 1});
            let actualProportion = new Variable({name: `${resource.name} proportion`, startingValue: 1});
            let actualSellPropProp = resourceStorage.addDemand(`market demand`, desiredSellAmount, idealProportion, actualProportion, 3).actualDesiredPropFulfilled; // 3 because market goes last
            resourceStorage.addSupply(buyAmount);
            let actualSellProp = new Variable({name: `actual selling % amount of ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: desiredSellProp, type: addition}),
                new VariableModifier({variable: actualSellPropProp, type: multiplication}),
            ]});
            let actualSellAmount = new Variable({name: `selling amount of ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: this.population, type: addition}),
                new VariableModifier({variable: actualSellProp, type: multiplication}),
            ]});
            let marketSellPrice = new Variable({name: `${resource.name} market sell price`, startingValue: this.idealPrices[resource.name],
                modifiers: [new VariableModifier({variable: this.marketSellPriceFactor, type: multiplication})]
            });
            let marketBuyPrice = new Variable({name: `${resource.name} market buy price`, startingValue: this.idealPrices[resource.name],
                modifiers: [new VariableModifier({variable: this.marketBuyPriceFactor, type: multiplication})]
            });
            let marketSellIncome = new Variable({name: `income from ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: actualSellAmount, type: addition}),
                new VariableModifier({variable: marketSellPrice, type: multiplication}),
            ]}); 
            let marketBuyCosts = new Variable({name: `costs from ${resource.name}`, startingValue: 0, modifiers: [
                new VariableModifier({variable: buyAmount, type: addition}),
                new VariableModifier({variable: marketBuyPrice, type: multiplication}),
            ]}); 
            return {
                resource,
                idealPrice: this.idealPrices[resource.name],
                marketSellPrice,
                marketBuyPrice,
                buyProp,
                desiredSellProp,
                actualSellProp,
                netIncome: new Variable({name: `net income from ${resource.name}`, startingValue: 0, modifiers: [
                    new VariableModifier({variable: marketSellIncome, type: addition}),
                    new VariableModifier({variable: marketBuyCosts, type: subtraction}),
                ]})
            }
        }).filter(v => v);
        this.netMarketIncome = new Variable({name: `net daily cost of current market trading`, startingValue: 0, modifiers:[]})
        this.netMarketIncome.setModifiers(this.marketResources.map(marketResource => {
            return new VariableModifier({variable: marketResource.netIncome, type:addition});
        }));
    }
    setNewIdealPrices(idealPrices) {
        this.idealPrices = idealPrices;
        this.marketResources.forEach(marketResource => {
            marketResource.idealPrice = this.idealPrices[marketResource.resource.name];
            marketResource.marketSellPrice.setNewBaseValue(this.idealPrices[marketResource.resource.name], `ideal price: ${roundNumber(this.idealPrices[marketResource.resource.name], 2)}`);
            marketResource.marketBuyPrice.setNewBaseValue(this.idealPrices[marketResource.resource.name], `ideal price: ${roundNumber(this.idealPrices[marketResource.resource.name], 2)}`);
        });
    }
}



export class MarketResourceComponent extends UIBase {
    constructor(props){
        super(props);
        this.marketResource = props.marketResource;
        this.addVariables([this.marketResource.buyProp, this.marketResource.desiredSellProp, this.marketResource.marketSellPrice])
    }
    childRender() {
        return <span style={{alignItems: "center", justifyContent: "center", fontSize: 14}}>
            <div>
            <VariableComponent variable={this.marketResource.marketSellPrice} /><br/>
            <VariableComponent variable={this.marketResource.marketBuyPrice} /><br/>
            {this.marketResource.desiredSellProp.currentValue > 0 ? <span><VariableComponent variable={this.marketResource.desiredSellProp}/><br/></span> : null}
            {this.marketResource.desiredSellProp.currentValue > 0 ? <span><VariableComponent variable={this.marketResource.actualSellProp} /><br/></span> : null}
            {this.marketResource.buyProp.currentValue > 0 ? <span><VariableComponent variable={this.marketResource.buyProp} showMax={true} /><br/></span> : null}
            {this.marketResource.buyProp.currentValue > 0 || this.marketResource.desiredSellProp.currentValue > 0 ? <span><VariableComponent variable={this.marketResource.netIncome} /></span> : null}
            </div>
            <Button variant={"outlined"} onClick={(e) => this.props.buyFromMarket(e, 1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "120px", maxWidth: "120px"}}>Buy</Button>
            <Button variant={"outlined"} onClick={(e) => this.props.buyFromMarket(e, -1)} sx={{minHeight: "100%", maxHeight: "100%", minWidth: "120px", maxWidth: "120x"}}>Sell</Button>
        </span>
    }
}
