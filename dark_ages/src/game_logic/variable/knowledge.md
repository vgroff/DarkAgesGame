# Variable System

Core state management system.

## Key Concepts

### Variable
- Tracks numeric values with modifiers
- Supports min/max bounds
- Maintains explanation chain
- Handles subscriptions for updates

### Modifiers
- Change variable values
- Types: addition, multiplication, etc.
- Can be temporary or permanent
- Support chaining and priorities

## Implementation Guidelines

- Keep recursion depth under control
- Clean up subscriptions properly
- Use appropriate modifier types
- Round display values consistently

## Performance Tips

- Limit subscription chain length
- Use appropriate rounding precision
- Cache calculated values where possible
- Clean up temporary modifiers