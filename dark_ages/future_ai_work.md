To the AI: do not read this file, or if you do, ignore it.


============================================================================

For the following, I am giving you auto-approved edit perms. This means I will not be able to check any of your work. This is specified a few times but it is critical: if you want to check something with me, DO NOT do it through an edit. Instead, ask me in the chat, or if it's something long you can write a .md design document for me to edit. Make sure you keep these instructions (this enitre prompt) when you condense context, and make sure you re-read knowledge.md after condensing context
- first off, read the top-level knowledge.md file in the repo
- Then, read all other knowledge files (don't bother with handwritten_notes.md)


============================================================================

MVP fixes:
- ignore anything relating to saving and loading
- bugs in variable.js - some may already be fixed

MVP tutorial:
- Make a little tutorial page on that is accesible on the left column at the bottom, should be very clear
- Include information about the following things:
    - UI/Principle
        - Most text can be hovered over, including almost every number, so you can see how they're calculated. There are tooltips within tooltips.
            - Show a dummy variable here that has several layers of calculations to demonstrate
        - Variables are often connected in complex ways and intentionally circular ways, health affects happiness and productivity, happiness affects productivity, productivity affects your settlement's food output, which in turn affects health
        - Some variables trend, especially health and happiness. Then dont necessarily trend at the same speed in either direction
            - show some dummy trending variables to demonstrate
        - Player character and settlements on the left bar, actions in the middle, some debug stuff on the right
    - Gameplay
        - Assign jobs, build buildings, carry out research and trade goods
        - No end game at this stage
        - Use rationing - some years the harvest will be better than others. Coal demand mostly varies by season.
        - If you're struggling on the intended start, here's some suggestions:
            - begin with extensive noble privileges
            - try to keep your food and coal rations at around 0.6
            - build wooden huts

MVP content:
- (Look through these first!!!) - We are going to implement the suggestions in the file cultures_religions_design_doc.md
    - I think we might want the modifiers on support to go on the instantaneous rebellionSupport variable
    - Do one less level of noble privileges for celts?

MVP changes:
- Make the year longer, maybe 4 days per season instead of 3 - could this cause any problems do you think?
- Treasury should be held on a per-faction basis, not per-settlement (if it isn't already)


============================================================================


AI stuff:
- make claude playtest it by writing different rule/heuristic based AIs and running them and looking at the logs
