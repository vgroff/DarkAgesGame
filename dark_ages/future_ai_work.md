To the AI: do not read this file, or if you do, ignore it.


============================================================================

For the following, I am giving you auto-approved edit perms. This means I will not be able to check any of your work. This is specified a few times but it is critical: if you want to check something with me, DO NOT do it through an edit. Instead, ask me in the chat, or if it's something long you can write a .md design document for me to edit. Make sure you keep these instructions (this enitre prompt) when you condense context, and make sure you re-read knowledge.md after condensing context
- first off, read the top-level knowledge.md file in the repo
- Then, read all other knowledge files (don't bother with handwritten_notes.md)

(current running) Immediate fixes:
- Increase the size of the text for the harvest, it's an important feature, the player should be able to see it easily
- on all the tabs, I want the top-level div with the date and play/pause button to always be at the top of the screen, even if you scroll past it
- also, on all the settlement tabs, I want everything below that up to and including the div that has the popular support/health/hapiness etc... information to also be always at the top even if you scroll past
- You previously had the task: "If we don't have a good icon for a building, you can use the one that is relevant to the resource it produces". However, most of the buildings still don't have an icon even if their resource does (e.g. wooden huts doesn't have the house, peat bog doesn't have the coal etc...)
- Can we have rebellion support with a floored at 0 as the last operation without changing any of the existing game behaviour? It would be a bit cleaner I think
- Give the bandit raid scenario some more iron weaponry, maybe 25 or so to start with
- Military tab - make stuff capitalised - e.g. "Iron Spears" rather than "iron spears"
- What colour do happiness and health take when they increase/decrease? They used to be green and red for increase/decrease, which was quite clear regardless of style, but I'm not sure what they do now, but that was useful behaviour, if it can be implemented, if possible in a style-compatible way that is still visually/semantically clear to the user. I also don't think they need to be bolded now that they are emphasised at the top of the UI. I'm also thinking maybe we should have an arrow, maybe something like 43 (→62)
- Similarly, have the message log and bottom bar with the styles and saving options always stick to the bottom, even if we've scrolled higher than it. I also want the message log showing by default for now
- Events should always trigger a pop-up (in player settlements only ofc) and the text in the list of current events in the settlement UI should be larger/bolded so that it's easier to see
- The warnings and back/forward buttons should also be kept at the top when you scroll down, like the village info and the tabs. There's also an ugly little gap between the village name and what's above it as you scroll down, which you can see through. Don't have that. 
- what's the max size of the log window before it starts scrolling? I don't think we want more than like 4 rows in there before it gets to max size and scrolls instead
- When I hover over a variable, a pop-up shows - perfect. However, when I then scroll over a variable inside said pop-up, although a second pop-up does appear, it flashes in and out of position, moving to the top left of the screen when it flashes out. That also means I can't go one deeper. What is the issue here? I could imagine that I've implemented the UI in some insanely stupid way, so tell me if this fix is going to be complicated or easy before implementing.	

============================================================================

MVP fixes:
- ignore anything relating to saving and loading
- bugs in variable.js - some may already be fixed

MVP content:
- (Look through these first!!!) - We are going to implement the suggestions in the file cultures_religions_design_doc.md
    - I think we might want the modifiers on support to go on the instantaneous rebellionSupport variable

MVP changes:
- Make the year longer, maybe 4 days per season instead of 3 - could this cause any problems do you think?
- Treasury should be held on a per-faction basis, not per-settlement (if it isn't already)

MVP logging:
- Add more logging, with appropriate log levels, which will help for debugging. All logs regardless of level should always be written to the logging file, with (timestamps and log level) but the in-game log should be default only surface things relevant to the player, but it should also have the option to change the log level for debugging reasons. Don't go too crazy yet with the amount of log lines, we will fill them in as we go, but think about what kinds of things might be useful, either for debugging or for analysing playtests

============================================================================


AI stuff:
- make claude playtest it by writing different rule/heuristic based AIs and running them and looking at the logs
