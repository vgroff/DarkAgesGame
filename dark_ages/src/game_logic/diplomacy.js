/**
 * §5 Diplomacy — Resource Trade Deal
 * TradeAgreement and NPC acceptance logic.
 * Kept in a separate file to avoid circular imports between game.js and settlement.js.
 */
import { daysInYear } from './seasons';

/**
 * A yearly resource exchange between two settlements.
 * Max 2 active agreements simultaneously (enforced in UI).
 */
export class TradeAgreement {
    constructor({ fromSettlement, toSettlement, fromResource, fromAmount, toResource, toAmount, gameClock, onCancel }) {
        this.fromSettlement = fromSettlement;
        this.toSettlement   = toSettlement;
        this.fromResource   = fromResource;
        this.fromAmount     = fromAmount; // units per year
        this.toResource     = toResource;
        this.toAmount       = toAmount;   // units per year
        this.active         = true;
        this.onCancel       = onCancel || null;
        this._sub = gameClock.subscribe(() => {
            if (gameClock.currentValue % daysInYear !== 0) return;
            if (!this.active) return;
            const fromStorage = fromSettlement.resourceStorages.find(rs => rs.resource === fromResource);
            const toStorage   = toSettlement.resourceStorages.find(rs => rs.resource === toResource);
            if (!fromStorage || !toStorage) { this.cancel(); return; }
            if (fromStorage.amount.baseValue >= fromAmount) {
                fromStorage.oneOffDemand(fromAmount, 'trade agreement');
                toStorage.amount.setNewBaseValue(toStorage.amount.baseValue + toAmount, 'trade agreement');
            } else {
                // Can't fulfil — cancel agreement
                this.cancel();
            }
        });
    }
    cancel() {
        this.active = false;
        if (this.onCancel) this.onCancel(this);
    }
}

/**
 * Check if NPC will accept a trade deal.
 * NPC accepts if they produce the offered resource at least 1.2× more efficiently than the requested one.
 * "Productivity" = building totalProduction / population.
 */
export function npcWillAcceptTrade(npcSettlement, offeredResource, requestedResource) {
    const offeredBuilding   = npcSettlement.resourceBuildings.find(b => b.outputResource === offeredResource);
    const requestedBuilding = npcSettlement.resourceBuildings.find(b => b.outputResource === requestedResource);
    if (!offeredBuilding || !requestedBuilding) return false;
    const pop = Math.max(1, npcSettlement.populationSizeExternal.currentValue);
    const offeredProd   = offeredBuilding.totalProduction.currentValue   / pop;
    const requestedProd = requestedBuilding.totalProduction.currentValue / pop;
    return offeredProd >= requestedProd * 1.2;
}
