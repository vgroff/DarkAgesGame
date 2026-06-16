import { Variable, VariableModifier, addition, subtraction, scaledMultiplication, scaledAddition, multiplication, VariableComponent } from "../UIUtils";
import { Button } from "@mui/material";
import UIBase from "../UIBase";
import { roundNumber } from "../utils";
import { ThemeContext } from "../theme";
import { RESOURCE_ICONS } from "./resource";


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
                buyAmount,
                desiredSellProp,
                actualSellProp,
                actualSellAmount,
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
        this.marketResource = this.props.marketResource;
        const mr = this.marketResource;
        const selling = mr.desiredSellProp.currentValue > 0;
        const buying = mr.buyProp.currentValue > 0;
        const theme = this.context;
        const c = theme ? theme.colors : null;

        const btnSx = c ? {
            minHeight: '100%', maxHeight: '100%', minWidth: '120px', maxWidth: '120px',
            borderColor: c.btnBorder,
            color: c.btnText,
            '&:hover': { borderColor: c.accentHover, backgroundColor: c.contentBgHover },
        } : { minHeight: '100%', maxHeight: '100%', minWidth: '120px', maxWidth: '120px' };

        const icon = RESOURCE_ICONS[mr.resource.name] || '';

        return <span style={{alignItems: "center", justifyContent: "center", fontSize: 14}}>
            <div>
            {icon && <span style={{ fontSize: '16px', marginRight: '4px' }}>{icon}</span>}
            <VariableComponent variable={mr.marketSellPrice} /><br/>
            <VariableComponent variable={mr.marketBuyPrice} /><br/>
            {selling && <span>
                <VariableComponent variable={mr.desiredSellProp} description="Proportion of population output you want to sell each day." /><br/>
                <VariableComponent variable={mr.actualSellProp} description="Actual proportion sold (may be less if storage is low)." /><br/>
                <VariableComponent variable={mr.actualSellAmount} description="Actual units sold per day." /><br/>
            </span>}
            {buying && <span>
                <VariableComponent variable={mr.buyProp} showMax={true} description="Proportion of population output you want to buy each day." /><br/>
                <VariableComponent variable={mr.buyAmount} description="Units bought per day." /><br/>
            </span>}
            {(buying || selling) && <span><VariableComponent variable={mr.netIncome} description="Net gold income from this resource per day (sell income minus buy costs)." /></span>}
            </div>
            <Button variant={"outlined"} onClick={(e) => this.props.buyFromMarket(e, 1)} sx={btnSx}>Buy</Button>
            <Button variant={"outlined"} onClick={(e) => this.props.buyFromMarket(e, -1)} sx={btnSx}>Sell</Button>
        </span>
    }
}
MarketResourceComponent.contextType = ThemeContext;
