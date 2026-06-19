To the AI: do not read this file, or if you do, ignore it.


============================================================================

For the following, I am giving you auto-approved edit perms. This means I will not be able to check any of your work. This is specified a few times but it is critical: if you want to check something with me, DO NOT do it through an edit. Instead, ask me in the chat, or if it's something long you can write a .md design document for me to edit. Make sure you keep these instructions (this enitre prompt) when you condense context, and make sure you re-read knowledge.md after condensing context
- first off, read the top-level knowledge.md file in the repo
- Then, read all other knowledge files (don't bother with handwritten_notes.md)

Current changes:
- Can you add a section to the knowledge.md file to say that the tooltips are very important, and in particular the Variable class and their associated VariableComponent and their associated tooltips are core to how the player is meant to play and understand the game. We need to take care to make them visible and have a philosophy of using them wherever possible
- The resource count on the buildings UI - it's good, although let's replace "/tick" with "/day". I also want them to have the same tooltip as it does in the resource storage, which shows the production and demand, exactly the same, don't make a new Variable, just use the same thing
- Fix the tooltips going off screen and the tooltips in the event section
    - Possible to have it so that tooltips are always at the top, i.e. they overlay everything, except other tooltips?


============================================================================


MVP fixes:
- ignore anything relating to saving and loading

MVP UI fixes:


MVP fixes:
- Too many civilians in my army?
- Legitimacy boost for fighting off bandits

MVP content:
- (Look through these first!!!) - We are going to implement the suggestions in the file cultures_religions_design_doc.md
    - I think we might want the modifiers on support to go on the instantaneous rebellionSupport variable
    - Do one less level of noble privileges for celts?
- Randomly generated settlement and character names by factio

MVP changes:
- Name character and settlement on scenario select
- Make the year longer, maybe 4 days per season instead of 3 - could this cause any problems do you think?
- Treasury should be held on a per-faction basis, not per-settlement (if it isn't already)


============================================================================


AI stuff:
- make claude playtest it by writing different rule/heuristic based AIs and running them and looking at the logs
