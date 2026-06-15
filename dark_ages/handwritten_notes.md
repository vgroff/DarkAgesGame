To the AI reading this: the following are rough handwritten notes written by a programmer who is slightly out of his depth. 
As such, although the problems that I point to are probably real, the analysis of those problems and to an even further extent, the
solutions I propose could be garbage. You should question these notes, basically. They are however, still a useful to point you in the right direction when it comes both to my intentions and some problems that I at least believe might exist.

Please incorporate the notes into the knowledge files where relevant, but please do not make any actual design decisions regarding the game design without asking me. Always ask for clarification where needed, lean towards asking if unsure whether you should ask, especially as you translate the following file into your own knowledge.md files. If you are just fixing a bug, then you may do that without confirmation, but if you are unsure whether it's a feature or a bug, always ask. I will generally assume that if you are giving me a file edit, you have already checked with me in the chat that this is appropriate, do not assume that I will read every line of your edits and understand the implications. Always lean on the side of caution. Please add a summarised version of these instructions to the top of every knowledge file.

// Stuff for now:
// - Move to the character
//        - Force stop timer until all player traits set on the first day?
// - nomad events for growth
// - Keep a permanent log of game messages somewhere?
// - auto-sell excess goods to the market - important! else they get wasted? 
//        - Should be easy to do this by keeping track of excess within the cumulator variable and then just picking them up at the end of the day
// - UIBase doesn't currently work correctly since e.g. the props.character in the CharacterComponent can change, but the subscriptions won't
//        - Instead, they need to be given a callback that gets the name of the variables and get them correctly from props (use propsDidChange()?) so that it can re-run during component didUpdate(), including clearing the old ones

// - Big-time Optimisation: Force happiness, health to 3 dp? Also building productivity? 
//          - add new VariableModifier({type: roundTo, startingValue: 3, customPriority: 200}) to building productivtity?
// - Optimisation: the game appears to be really slow when the user switches between bankruptcy and being liquid
//          - Examine what is so expensive via logging, maybe deal with it. Might be fine to use round dp
// - Potential simple/important buildings: cemetery(trivial), bathhouse(trivial), suclpture/artists studio(trivial), sportsballfield(trivial)
// - Add a history to some variables - short term, long term and super long term. Plot them? Snapshot their explanations over time?
// - resource buildings should show a productivity breakdown so that user can easily see effect of terrain, crop blight etc...
// - Should be able to buy resources on the market that you need as inputs even if you don't produce them (e.g. no iron mine?) 
// - UI needs serious improvement to be playable
// Thoughts on easy UI improvements to make it playable:
// - Tabluate stuff: production, distribution, trading, research etc...
// - Move research into it's own tab - it should use the sum of the research from all settlements? since research isn't per-settlement
// - Have warnings a la Paradox if you have homeless/unemployement/rebellions etc...
// - Have back and forth arrows for navigating like a web browser
// - Hide research and market behind having the library building and the market building
// - Add descriptions to some variables (e.g. character/settlement ones)
// Extra major improvment thoughts:
// - Potential Balance/exploit issue: if productivities are very different in different buildings, trading will be preferred. Research boosts need to be not to aggressive, and trade needs to penalise
// - option to "buy/sell now" in the market which allows you to buy/sell as much as you can right then from storage - maybe unbalanced?
// - Check content notes
// - auto-sell excess goods to the market - important! else they get wasted? Easy way for the player to get money


// Content notes:
// - Potential simple/important buildings: cemetery(trivial), bathhouse(trivial), suclpture/artists studio(trivial), sportsballfield(trivial)
// - Add a coastal terrain with fishin wharf + higher raid chances
// - Add more cultures + cultural traits (check phone notes)
// - Add more faction edits/laws etc... (check phone notes)
//       - Could add in more features to do with interest groups?
// - Tavern/entertainment should improve trade modifier?
// - Events Notes:
//     - Make the wolf attack depended on how much weaponry you have available
//     - Have a probabilistic outcome with the fire where you can organise the buildings better with high admin 
//          - Add an event effect that increases the checkEvery by a set amount (permanently)
//     - Should have a default _eventShouldFire() with a probability set in the props if appropriate
//          - Have an event effect that changes the probability of the event firing and add it to existing events where appropriate
//     - More basic events:
//          - just do: blizzard, warm spell, game surplus, nomads
//          - blizzard - increased coal demand and massively increase trade costs, 
//                - don't need a special bonus for trade costs, just make a ModifySettlementVariableBonus where you pass the variable name in
//                - add/remove modifier to coal (or any other resource's) ideal demand (see adjustCoalDemand function)
//          - rats in storage - lose food, can perhaps mitigate somehow?
//          - landslide: spend money or face unhappinness,  
//          - warm spell: happiness, less coal
//          - merchant boom: trading factor increase
//          - hunting game surplus: hunter's hut increase
//          - dry hunting lands: hunters hut significant decrease
//          - local miracle: boost to happiness and (and immigration?) - partly done but no immigration
//          - "court intrigue" events - trials, corruption, dealings with nobles etc... change legitimacy and happiness and depend on character abilities
//          - large group of nomads arrives: take them in, trade with them, send them away (force pause this one?) 
//                  - a chance that they can rob you in the night? Would need to trigger another event later? Could have a one-time event
//          - pestilence: lose health, then choose to isolate for a productivity hit or lose even more health -  The health penalty shouldnt be temporary!
//          - bandit raid: choose to fight them off or pay them off or they raid

// Next up:
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Add civilian and military rebellions - add a legitimacy system and low legitmacy+happiness triggers rebellions
// - Have warnings a la Paradox if you have homeless/unemployement etc...

// Requirements for MVP:
// - Should test balance with tests -> set up conditions and measure happiness
// - Basic settlement management
// - Basic character/RPG system
// - Basic combat system - have bandit raids
// - Saving/Loading system? -> 
//     - I can probably do a lot of this with Object.entries(). I need to make sure that any objects that are present in multiple places are reconstructed correctly, so I probably need some global Set() object that get populated/read from
//     - We need a way to figure out what class to rebuild the object as so that it has the right methods/prototypes potentially use tools
//     - Need to find a way to store lambdas, which are basically all subscribes() in/to variables/modifiers. I.e. not that much work
//         - We could have some kind of init() function on all objects that does the necessary subscribing after construction. I.e. give the variables it's modifiers as objects, then call init() for it to subcribe once everything's ready
//         - All subscribes() could be changed so that they refer to a class method, that way they can be referred to by string - unfortunate that this is a bit inefficient
//     - Some tools
//          - If the only real problem is with serialising stored functions in subscribe() fashion, can we find a way of storing a re-viving subscriptions?
//          - https://github.com/denostack/superserial this sounds like it might help maybe? 
//          - https://github.com/iconico/JavaScript-Serializer or this? 
//          - https://www.npmjs.com/package/javascript-serializer 
// - Do some UX improvement work
// - Playtesting! Myself and friends

// Stuff for later builds:
// - Diplomacy system
// - "Fake" AI settlements that are really just characters that do combat/diplomacy but don't actually do the settlement management
// - Could have conditional variables -> they take either a single true/false variable or two variables to compare and then return different results depending on the outcome
// - Add building upkeep
// - Add food decay

// AI reinforcement learning:
// - job setting: iterate through buildings, one NN each, inputs are: demand, stockpile, productivity, unemployed, happiness, health, behaviour/strategy inputs. output is % of unemployed to set to job
// - ration setting: iterate through rations, one NN each, inputs are happiness, health, demand. output is ration %
//    - this one could be trained by running many "simulations" where it has to optimally distributed resources given supply+production
// - building/upgrading: have a nn who's job it is to decide what to build/upgrade (if anything) and to pass that onto job setting NN?