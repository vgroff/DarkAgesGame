# Dark Ages Game

Medieval strategy/management game built with React.

## Project Overview

- Single player medieval strategy game
- Manage settlements, characters, resources and events
- React-based UI with Material-UI components
- Uses variable/modifier system for game state management

## Key Concepts

### Game Systems
- Characters have cultures, traits, and abilities (strategy, diplomacy, administration)
- Settlements produce resources and can build various buildings
- Events system for random occurrences like fires, wolf attacks, etc.
- Faction system with privileges and legitimacy mechanics

### Technical Architecture
- Uses React components for UI
- Complex state management through Variable/Modifier pattern
- Event system for timed occurrences
- Resource management with supply/demand mechanics

## Development Guidelines

### UI Style
- Use grey color for supporting text on white backgrounds
- Use alpha channel for supporting text on colored backgrounds
- Use grey for unselected items, black/bold for selected
- Minimize labels and headings where possible
- Group related UI elements into tabs (production, distribution, trading, research)

### Code Style
- Keep Variable/Modifier pattern for game state
- Document complex game mechanics in comments
- Use HTMLTooltip for explanatory hover text
- Maintain separation between game logic and UI components

## Current Development Focus
- Improving UI/UX to make game more playable
- Balancing resource production and trading
- Expanding events and faction systems
- Adding more cultural traits and faction mechanics

## Known Issues
- Potential exploit with building productivity differences affecting trade
- Performance issues during bankruptcy state changes
- Need to improve variable rounding for performance