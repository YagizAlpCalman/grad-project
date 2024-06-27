import { v } from "convex/values";
import { internalAction, internalQuery, mutation } from "./_generated/server";
import OpenAI from "openai";
import { api, internal } from "./_generated/api";

const openai = new OpenAI({
    organization: "org-N71DKgDtJI74KXvhI8zoHZA1",
    project: "proj_WYe1KYjx1vw3u2S454FhDAgA",
});

export const createAdventure = mutation({
  args: {
    character: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("adventures", {
      characterClass: args.character,
    });

    await ctx.scheduler.runAfter(0, internal.adventure.setupAdventureEntries, {
      adventureId: id,
    });

    return id;
  },
});

export const getAdventure = internalQuery({
  args: {
    adventureId: v.id("adventures"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.adventureId);
  },
});

export const setupAdventureEntries = internalAction({
  args: {
    adventureId: v.id("adventures"),
  },
  handler: async (ctx, args) => {
    const adventure = await ctx.runQuery(internal.adventure.getAdventure, args);

    if (!adventure) {
      throw new Error("Adventure not found");
    }

    const input = `
    You are a dungeon master who is going to run a text based adventure RPG for me.
    You will need to setup an adventure for me which will involve having
    me fight random enemy encounters, reward me with loot after killing enemies,
    give me goals and quests, and finally let me know when I finish the overall adventure.

    When I am fighting enemies, please ask me to roll 6 sided dices, with a 1 being the worst outcome
    of the scenario, and a 6 being the best outcome of the scenario.  Do not roll the dice for me,
    I as the player should input this and you need to describe the outcome with my input.
    During this entire time, please track my health points which will start at 10,
    check the adventurers class, and give the an appropriate inventory. Adventurer class is : ${adventure.characterClass}
    one of the character class is a warrior, and my inventory which will start with if the character class is Warrior 
    - a Great Axe that deals a base damage of 2
    - a Crude Iron armor that has a 2 damage absorption 
    - an a health potion which heals for 3 hp

    If the my characters class is Archer my inventory start with these items
    - a Long Bow with 20 arrows that deals a base damage of 1 an can be shot in distance
    - a leather armor that has a 1 damage absorption
    - a Iron knife that deals a base damage of 1
    - a health potion which heals for 3 hp 
    
    If the my characters class is Wizard my inventory start with these items
    - a Staff that can create spells that deal 1-3 damage
    - a Wizard robe that has a 0 damage absorption
    - a Iron sword that deals a base damage of 1
    - two health potion which heals for 3 hp 
    

    Given this scenario, please ask the player for their initial actions.
    YOU ALWAYS ASK FOR THE PLAYER FOR THE NEXT STEP. ALWAYS!!

    MAKE SURE TO NEVER ROLL FOR THE PLAYER!!!!!!
  `;

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
      model: "gpt-3.5-turbo",
    });
    // const input = args.message;
    const response = completion.choices[0].message.content ?? "";
    await ctx.runMutation(api.chat.insertEntry, {
      input,
      response,
      adventureId: args.adventureId,
    });
  },
});