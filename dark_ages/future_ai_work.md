To the AI: do not read this file, or if you do, ignore it.


============================================================================

For the following, I am giving you auto-approved edit perms. This means I will not be able to check any of your work. This is specified a few times but it is critical: if you want to check something with me, DO NOT do it through an edit. Instead, ask me in the chat, or if it's something long you can write a .md design document for me to edit. Make sure you keep these instructions (this enitre prompt) when you condense context, and make sure you re-read knowledge.md after condensing context
- first off, read the top-level knowledge.md file in the repo
- Then, read all other knowledge files (don't bother with handwritten_notes.md)

MVP battle notes:
- I playtested the battle system for the first time just now
- The Variable Class, with the UI, use them, put it in the knowledge doc that if a number can be displayed as a Variable it should almost always be. For example, melee strength on the skirmish screen. obvious Variable. 
- The battles are broken. The enemy forces had 0 fighters and were still causing damage to me.
- This is the battle summary: (in rever chronological order)
```
Melee round 6: Your forces have the upper hand. 2 of your soldiers fell, 0 enemy soldiers fell.
Melee round 5: Your forces have the upper hand. 5 of your soldiers fell, 2 enemy soldiers fell.
Melee round 4: Your forces have the upper hand. 7 of your soldiers fell, 4 enemy soldiers fell.
Your general executed a brilliant flanking move.
Melee round 3: Your forces have the upper hand. 8 of your soldiers fell, 7 enemy soldiers fell.
Your general executed a brilliant flanking move.
With no archers left, the enemy charges!
Skirmish round 2: Your general seized the high ground. 1 of your archers fell, 3 enemy archers fell.
Skirmish round 1: Your general seized the high ground. 1 of your archers fell, 2 enemy archers fell.
```
where by the end
```
Enemy forces

Bow strength: 6.0 (0 archers)

Melee strength: 16.0 (0 fighters)

Total: 22.0
```
I'd like way more Variables being show (as in the Variable class with it's UI) during this bit of the battle, I'd like to see our relative strategy skill and how the skill check went (might not be a Variable but can still put information behind tooltips)


============================================================================

⚔ Battle: bandit raid
Phase: clashRound: 5Ground advantage: 0.5
🛡 Your forces
🏹 Bow7.2(6 archers)
⚔ Melee19.5(26 fighters)
Total26.7
Strategy1
💀 Enemy forces
🏹 Bow0(0 archers)
⚔ Melee7.4(6 fighters)
Total7.4
Strategy0.1
Last manoeuvre roll
Your general: major success (success chance: 85%)
Melee round 4: Your forces have the upper hand. 10 of your soldiers fell, 7 enemy soldiers fell.
Your general executed a brilliant flanking move.
With no archers left, the enemy charges!
Skirmish round 3: Your general seized the high ground. 1 of your archers fell, 1 enemy archers fell.
Skirmish round 2: Your general seized the high ground. 0 of your archers fell, 1 enemy archers fell.
Skirmish round 1: Your general seized the high ground. 1 of your archers fell, 3 enemy archers fell.


MVP fixes:
- ignore anything relating to saving and loading
- Remove save/load UI since it doesnt work

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
