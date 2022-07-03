export { addition, multiplication, VariableModifier } from "./variable/modifier";
export { Variable, VariableComponent } from "./variable/variable";
export { AggregatorModifier } from './variable/aggregator';
export { Cumulator, CumulatorComponent } from './variable/cumulator';
export { ListAggModifier } from './variable/listAggModifier';

export function titleCase(str) {
    return str[0].toUpperCase() + str.substring(1);
}