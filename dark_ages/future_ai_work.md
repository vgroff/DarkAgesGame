To the AI: do not read this file, or if you do, ignore it.


============================================================================

For the following, I am giving you auto-approved edit perms. This means I will not be able to check any of your work. This is specified a few times but it is critical: if you want to check something with me, DO NOT do it through an edit. Instead, ask me in the chat, or if it's something long you can write a .md design document for me to edit. Make sure you keep these instructions (this enitre prompt) when you condense context, and make sure you re-read knowledge.md after condensing context
- first off, read the top-level knowledge.md file in the repo
- Then, read all other knowledge files (don't bother with handwritten_notes.md)

Current changes:
- We are going to implement the suggestions in the file cultures_religions_design_doc.md. So read that
- We wrote this file together, but I've made some changes (you can see it in git diff if you want), both to some numbers and to some behaviours. I think everything is consistent, but do ask if anything is unclear/inconsistent/doesn't make sense or you're unsure. 
- We also want to add some default character names and settlement names, for each culture type, and AI characters/settlements should be auto-assigned an appropriate name on creation


Current changes:


============================================================================


MVP fixes:
- ignore anything relating to saving and loading

MVP tutorial:
- More than one way. Show the 3 paths of food -> food 

MVP fixes:
- Too many civilians in my army?
- Legitimacy boost for fighting off bandits - but have it fall over time - does this behaviour exist yet?

MVP content:
- Religion/culture changes:
    - Valhalla - increase size of army
    - Do one less level of noble privileges for celts? Or make it weaker?

MVP changes:
- What exactly does the Faction traits do? is this culture or different? Waht happens to these when leader of settlement changes?
    - I think it just holds privileges and research?
- Name character and settlement on scenario select
- Make the year longer, maybe 4 days per season instead of 3 - could this cause any problems do you think?
- Treasury should be held on a per-faction basis, not per-settlement (if it isn't already)

MVP code stuff:
- Tests, unit tests
- scenario loading tests (no unemployed, variables snapped etc...)
- Refactor/rewrites/cleanups

============================================================================


AI stuff:
- make claude playtest it by writing different rule/heuristic based AIs and running them and looking at the logs
