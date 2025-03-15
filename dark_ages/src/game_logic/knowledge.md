# Game Logic

Core game systems and mechanics.

## Key Systems

### Variable System
- Base class for all numeric game values
- Supports modifiers, subscriptions, and explanations
- Used for resources, stats, and most numeric values
- Careful with recursion depth and subscription chains

### Events
- Regular events check periodically
- Settlement events affect specific settlements
- Events can have choices with probabilistic outcomes
- Events can grant temporary or permanent bonuses

### Characters
- Have cultures, traits, and abilities
- Traits provide bonuses to settlements/character
- Faction leadership affects settlement legitimacy
- Skills: Strategy, Diplomacy, Administration

### Resources
- Supply/demand system with priorities
- Storage limits and cumulative tracking
- Resource buildings produce/consume resources
- Market system for trading between settlements

## Implementation Notes

- Use TemporaryModifierBonus for time-limited effects
- Check event trigger conditions carefully
- Maintain proper subscription cleanup
- Round display values appropriately