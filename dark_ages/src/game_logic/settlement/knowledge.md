# Settlement System

Settlement management and resource production.

## Key Concepts

### Buildings
- Produce or consume resources
- Have size, efficiency and productivity modifiers
- Can be upgraded or demolished
- Some buildings unlock other features (Library -> research)

### Resources
- Food, materials, special resources
- Supply/demand system with priorities
- Storage limits for most resources
- Some resources don't accumulate (entertainment)

### Settlement Stats
- Population affects labor availability
- Happiness affects growth and stability
- Health impacts population growth
- Local legitimacy from leader and events

## Implementation Guidelines

- Check building prerequisites before construction
- Maintain proper resource demand priorities
- Handle temporary bonuses with appropriate duration
- Update all settlement stats when leader changes