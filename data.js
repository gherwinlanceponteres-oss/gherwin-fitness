// Gherwin Fitness — default plan, foods and quotes.
// Everything here is only the STARTING data; the app saves your own edited copy on the phone.

window.DEFAULT_PROGRAM = {
  deloadEvery: 8,
  days: {
    1: { type: "gym", name: "Chest + triceps", items: [
      { ex: "db_bench", sets: 3, min: 6, max: 10 },
      { ex: "incline_db", sets: 3, min: 8, max: 12 },
      { ex: "db_fly", sets: 2, min: 10, max: 15 },
      { ex: "db_pullover", sets: 2, min: 10, max: 15 },
      { ex: "oh_ext", sets: 3, min: 10, max: 15 },
      { ex: "ez_lying", sets: 2, min: 8, max: 12 },
      { ex: "pushdown", sets: 2, min: 12, max: 15 } ] },
    2: { type: "gym", name: "Back + biceps", items: [
      { ex: "pullup", sets: 3, min: 5, max: 10 },
      { ex: "lat_pd", sets: 3, min: 8, max: 12 },
      { ex: "cs_row", sets: 3, min: 8, max: 12 },
      { ex: "db_row", sets: 2, min: 8, max: 12 },
      { ex: "back_ext", sets: 3, min: 10, max: 15 },
      { ex: "incline_curl", sets: 3, min: 10, max: 12 },
      { ex: "hammer", sets: 2, min: 10, max: 12 } ] },
    3: { type: "gym", name: "Shoulders + abs", items: [
      { ex: "db_ohp", sets: 3, min: 8, max: 12 },
      { ex: "angled_lat", sets: 4, min: 12, max: 20 },
      { ex: "seated_lat", sets: 3, min: 12, max: 20 },
      { ex: "rear_fly", sets: 3, min: 12, max: 20 },
      { ex: "cable_crunch", sets: 3, min: 10, max: 15 },
      { ex: "decline_crunch", sets: 3, min: 10, max: 15 } ] },
    4: { type: "gym", name: "Upper (2nd hit) + arms", items: [
      { ex: "incline_db", sets: 3, min: 8, max: 12 },
      { ex: "lat_pd", sets: 3, min: 8, max: 12 },
      { ex: "cs_row", sets: 2, min: 10, max: 12 },
      { ex: "lat_raise", sets: 3, min: 15, max: 20 },
      { ex: "conc_curl", sets: 2, min: 10, max: 12 },
      { ex: "pushdown", sets: 2, min: 12, max: 15 } ] },
    5: { type: "gym", name: "Legs + abs", items: [
      { ex: "smith_squat", sets: 3, min: 6, max: 10 },
      { ex: "smith_rdl", sets: 3, min: 8, max: 10 },
      { ex: "leg_ext", sets: 3, min: 10, max: 15 },
      { ex: "leg_curl", sets: 3, min: 10, max: 15 },
      { ex: "calf", sets: 4, min: 10, max: 15 },
      { ex: "hanging_knee", sets: 3, min: 10, max: 15 } ] },
    6: { type: "run", name: "Cardio — run", items: [] },
    0: { type: "rest", name: "Rest", items: [] }
  }
};

// Values per 1 unit. buy = how the grocery list converts it.
window.DEFAULT_FOODS = {
  chicken:   { name: "Chicken breast", unit: "block (~143 g raw)", gPer: 143, kcal: 172, p: 32, c: 0, f: 3.7, cat: "Meat & fish", buy: { g: 143 }, protein: true },
  tuna:      { name: "Tuna", unit: "can (drained)", gPer: 120, kcal: 130, p: 28, c: 0, f: 1, cat: "Meat & fish", buy: { pcs: 1, label: "cans" }, protein: true },
  salmon:    { name: "Salmon fillet", unit: "fillet (~150 g)", gPer: 150, kcal: 310, p: 30, c: 0, f: 20, cat: "Meat & fish", buy: { g: 150 }, protein: true },
  sardines:  { name: "Sardines", unit: "can (drained)", gPer: 90, kcal: 190, p: 22, c: 0, f: 11, cat: "Meat & fish", buy: { pcs: 1, label: "cans" }, protein: true },
  porkchop:  { name: "Pork chop", unit: "chop (~150 g)", gPer: 150, kcal: 250, p: 30, c: 0, f: 14, cat: "Meat & fish", buy: { pcs: 1, label: "chops" }, protein: true },
  egg:       { name: "Egg", unit: "whole egg", gPer: 50, kcal: 72, p: 6.3, c: 0.4, f: 4.8, cat: "Eggs & dairy", buy: { pcs: 1, label: "eggs" } },
  milk:      { name: "Milk (full cream)", unit: "glass (250 ml)", gPer: 250, kcal: 160, p: 8, c: 12, f: 8, cat: "Eggs & dairy", buy: { ml: 250 } },
  rice:      { name: "Rice (cooked)", unit: "cup", gPer: 158, kcal: 205, p: 4.3, c: 45, f: 0.4, cat: "Pantry", buy: { g: 62, note: "uncooked" } },
  bread:     { name: "Bread", unit: "slice", gPer: 28, kcal: 80, p: 3, c: 14, f: 1, cat: "Pantry", buy: { pcs: 1, label: "slices", per: 20, perLabel: "loaf" } },
  pb:        { name: "Peanut butter", unit: "tbsp (16 g)", gPer: 16, kcal: 95, p: 4, c: 3, f: 8, cat: "Pantry", buy: { g: 16, per: 340, perLabel: "jar" } },
  nuts:      { name: "Mixed nuts", unit: "handful (30 g)", gPer: 30, kcal: 175, p: 6, c: 6, f: 15, cat: "Pantry", buy: { g: 30 } },
  oil:       { name: "Cooking oil (if pan-frying)", unit: "tbsp", gPer: 14, kcal: 120, p: 0, c: 0, f: 14, cat: "Pantry", buy: null },
  banana:    { name: "Banana", unit: "piece", gPer: 118, kcal: 105, p: 1.3, c: 27, f: 0.4, cat: "Fruit", buy: { pcs: 1, label: "pcs" } },
  fruit:     { name: "Apple or orange", unit: "piece", gPer: 150, kcal: 80, p: 0.8, c: 20, f: 0.3, cat: "Fruit", buy: { pcs: 1, label: "pcs" } },
  nitrotech: { name: "Nitro-Tech (whey + 3 g creatine)", unit: "scoop", gPer: 45, kcal: 160, p: 30, c: 4, f: 2.5, cat: "Supplements", buy: null, stock: "nitrotech", creatine: 3 },
  creatine:  { name: "Creatine", unit: "5 g scoop", gPer: 5, kcal: 0, p: 0, c: 0, f: 0, cat: "Supplements", buy: null, stock: "creatine", creatine: 5 }
};

const PROTEIN_ALTS = ["chicken", "tuna", "salmon", "sardines", "porkchop"];
window.DEFAULT_TEMPLATES = {
  weekday: [
    { slot: "Breakfast", items: [{ food: "egg", qty: 3 }, { food: "nitrotech", qty: 1 }] },
    { slot: "Lunch", items: [{ food: "chicken", qty: 1, alts: PROTEIN_ALTS }, { food: "rice", qty: 2.5 }] },
    { slot: "Snack (4–5 pm)", items: [{ food: "bread", qty: 1 }, { food: "pb", qty: 2 }, { food: "banana", qty: 1 }] },
    { slot: "After training", items: [{ food: "nitrotech", qty: 1 }] },
    { slot: "Dinner", items: [{ food: "chicken", qty: 1, alts: PROTEIN_ALTS }, { food: "rice", qty: 2.5 }] }
  ],
  weekend: [
    { slot: "Breakfast", items: [{ food: "egg", qty: 4 }, { food: "bread", qty: 2 }, { food: "milk", qty: 1 }, { food: "creatine", qty: 1 }] },
    { slot: "Lunch", items: [{ food: "chicken", qty: 1, alts: PROTEIN_ALTS }, { food: "rice", qty: 2.5 }] },
    { slot: "Snack", items: [{ food: "milk", qty: 1 }, { food: "bread", qty: 1 }, { food: "pb", qty: 2 }, { food: "fruit", qty: 1 }] },
    { slot: "Dinner", items: [{ food: "chicken", qty: 1, alts: PROTEIN_ALTS }, { food: "rice", qty: 2.5 }] }
  ]
};

// Real quotes from public-domain authors and translations. Add your own (Clear, Hormozi...) in the app: Me > Quotes.
window.QUOTES = [
{
"q": "No longer talk at all about the kind of man that a good man ought to be, but be such.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "In the morning when thou risest unwillingly, let this thought be present — I am rising to the work of a human being.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "Do not act as if thou wert going to live ten thousand years. While thou livest, while it is in thy power, be good.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "If it is not right, do not do it: if it is not true, do not say it.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "That which is an obstacle on the road helps us on this road.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "Think not so much of what thou hast not as of what thou hast.",
"a": "Marcus Aurelius, Meditations"
},
{
"q": "While we are postponing, life speeds by.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "Hold every hour in your grasp. Lay hold of to-day's task, and you will not need to depend so much upon to-morrow's.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "We suffer more often in imagination than in reality.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "There are more things likely to frighten us than there are to crush us.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "Everywhere means nowhere.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "Philosophy teaches us to act, not to speak.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "When a man does not know what harbour he is making for, no wind is the right wind.",
"a": "Seneca, Letters to Lucilius"
},
{
"q": "First say to yourself what you would be; and then do what you have to do.",
"a": "Epictetus, Discourses"
},
{
"q": "Men are disturbed not by the things which happen, but by the opinions about the things.",
"a": "Epictetus, Enchiridion"
},
{
"q": "Nothing great is produced suddenly, since not even the grape or the fig is.",
"a": "Epictetus, Discourses"
},
{
"q": "It is impossible for a man to begin to learn that which he thinks that he knows.",
"a": "Epictetus, Discourses"
},
{
"q": "If you would be a good reader, read; if a writer, write.",
"a": "Epictetus, Discourses"
},
{
"q": "No man is free who is not master of himself.",
"a": "Epictetus"
},
{
"q": "It is a disgrace to grow old through sheer carelessness before seeing what manner of man you may become by developing your bodily strength and beauty to their highest limit.",
"a": "Socrates, in Xenophon's Memorabilia"
},
{
"q": "We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.",
"a": "Aristotle, Nicomachean Ethics"
},
{
"q": "He who has begun has half done. Dare to be wise; begin!",
"a": "Horace, Epistles"
},
{
"q": "The journey of a thousand li commences with a single step.",
"a": "Lao Tzu, Tao Te Ching"
},
{
"q": "Well done is better than well said.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "Diligence is the mother of good luck.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "There are no gains without pains.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "Lost time is never found again.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "Have you somewhat to do to-morrow, do it to-day.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "Early to bed and early to rise, makes a man healthy, wealthy, and wise.",
"a": "Benjamin Franklin, Poor Richard's Almanack"
},
{
"q": "Nothing in the world is worth having or worth doing unless it means effort, pain, difficulty.",
"a": "Theodore Roosevelt"
},
{
"q": "Do what you can, with what you have, where you are.",
"a": "Theodore Roosevelt, Autobiography"
},
{
"q": "It is hard to fail, but it is worse never to have tried to succeed.",
"a": "Theodore Roosevelt, The Strenuous Life"
},
{
"q": "The credit belongs to the man who is actually in the arena, whose face is marred by dust and sweat and blood.",
"a": "Theodore Roosevelt, Citizenship in a Republic"
},
{
"q": "If there is no struggle there is no progress.",
"a": "Frederick Douglass"
},
{
"q": "Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome while trying to succeed.",
"a": "Booker T. Washington, Up from Slavery"
},
{
"q": "Genius is one per cent inspiration and ninety-nine per cent perspiration.",
"a": "Thomas Edison"
},
{
"q": "Do the thing, and you shall have the power.",
"a": "Ralph Waldo Emerson, Compensation"
},
{
"q": "If one advances confidently in the direction of his dreams, and endeavors to live the life which he has imagined, he will meet with a success unexpected in common hours.",
"a": "Henry David Thoreau, Walden"
}
];
