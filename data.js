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

// Ready-made programs the app can suggest when you outgrow your split. [exercise, sets, min reps, max reps]
(() => {
  const D = (name, list) => ({ type: 'gym', name, items: list.map(([ex, sets, min, max]) => ({ ex, sets, min, max })) });
  const RUN = { type: 'run', name: 'Cardio — run', items: [] }, REST = { type: 'rest', name: 'Rest', items: [] };
  const LEGS = D('Legs + abs', [['smith_squat', 3, 6, 10], ['smith_rdl', 3, 8, 10], ['leg_ext', 3, 10, 15], ['leg_curl', 3, 10, 15], ['calf', 4, 10, 15], ['hanging_knee', 3, 10, 15]]);
  const SS = (ex, sets, min, max) => ({ ex, sets, min, max, ss: true }), I = (ex, sets, min, max) => ({ ex, sets, min, max });
  window.PROGRAMS = [
    { id: 'ulv4', name: 'Upper / Lower — V-taper', when: '4 gym days (Mon–Thu) + Fri catch-up + run', kcalTip: -300,
      blurb: 'Built from your own exercises and your calendar: all training Mon–Thu (your most consistent days), legs early in the week, every muscle twice a week, extra side- and rear-delt work for the V-taper, abs twice a week. Friday is a free catch-up day — the app offers any workout you missed. Each session fits in about an hour (arms and fly are supersets).',
      program: { deloadEvery: 8, days: {
        1: { type: 'gym', name: 'Upper A (heavy)', items: [I('db_bench', 3, 6, 10), I('cs_row', 3, 8, 12), I('db_ohp', 3, 8, 12), I('lat_pd', 3, 8, 12), I('seated_lat', 4, 12, 20), SS('oh_ext', 3, 10, 15), I('hammer', 3, 10, 12)] },
        2: { type: 'gym', name: 'Lower A + abs', items: [I('smith_squat', 4, 6, 10), I('smith_rdl', 3, 8, 10), I('leg_curl', 3, 10, 15), I('calf', 3, 10, 15), I('hanging_leg', 3, 10, 15)] },
        3: { type: 'gym', name: 'Upper B (V-taper)', items: [I('incline_db', 3, 8, 12), I('pullup', 3, 5, 10), I('db_row', 3, 8, 12), I('lat_raise', 4, 12, 20), SS('db_fly', 2, 10, 15), I('rear_fly', 3, 12, 20), SS('pushdown', 2, 12, 15), I('incline_curl', 3, 10, 12)] },
        4: { type: 'gym', name: 'Lower B + abs', items: [I('smith_squat', 3, 10, 15), I('leg_ext', 3, 10, 15), I('leg_curl', 3, 10, 15), I('back_ext', 3, 10, 15), I('x_Cable_Seated_Crunch', 3, 10, 15), I('plank', 2, 30, 60)] },
        5: { type: 'rest', name: 'Free day / catch-up', items: [], catchup: true },
        6: RUN, 0: REST } } },
    { id: 'ppl5', name: 'Push / Pull / Legs + Upper', when: '5 gym days + run', blurb: 'Every muscle twice a week, extra shoulder and back work for the V-taper. Best next step when a once-a-week split stops working.',
      program: { days: {
        1: D('Push', [['db_bench', 3, 6, 10], ['db_ohp', 3, 8, 12], ['incline_db', 3, 8, 12], ['lat_raise', 5, 12, 20], ['oh_ext', 3, 10, 15], ['pushdown', 2, 12, 15]]),
        2: D('Pull', [['pullup', 3, 5, 10], ['cs_row', 3, 8, 12], ['lat_pd', 3, 8, 12], ['rear_fly', 3, 12, 20], ['incline_curl', 3, 10, 12], ['hammer', 2, 10, 12]]),
        3: LEGS,
        4: D('Upper (V-taper)', [['incline_db', 3, 8, 12], ['close_pd', 3, 8, 12], ['db_row', 3, 8, 12], ['angled_lat', 4, 12, 20], ['rear_fly', 2, 12, 20], ['ez_lying', 2, 8, 12]]),
        5: D('Shoulders + arms', [['arnold', 3, 8, 12], ['seated_lat', 4, 12, 20], ['rear_fly', 3, 12, 20], ['preacher', 3, 10, 12], ['seated_oh_ext', 3, 10, 15], ['conc_curl', 2, 10, 12], ['cable_crunch', 3, 10, 15]]),
        6: RUN, 0: REST } } },
    { id: 'ul4', name: 'Upper / Lower', when: '4 gym days + run', blurb: 'Fewer gym days, heavier main lifts, every muscle twice a week. Good when time is short or recovery is struggling.',
      program: { days: {
        1: D('Upper A (strength)', [['db_bench', 3, 6, 8], ['cs_row', 3, 6, 10], ['db_ohp', 3, 8, 10], ['lat_pd', 3, 8, 12], ['lat_raise', 3, 12, 20], ['hammer', 2, 10, 12]]),
        2: D('Lower A', [['smith_squat', 4, 6, 8], ['smith_rdl', 3, 8, 10], ['leg_curl', 3, 10, 15], ['calf', 4, 10, 15], ['hanging_knee', 3, 10, 15]]),
        3: REST,
        4: D('Upper B (V-taper)', [['incline_db', 3, 8, 12], ['pullup', 3, 5, 10], ['angled_lat', 4, 12, 20], ['db_row', 3, 8, 12], ['rear_fly', 3, 12, 20], ['oh_ext', 2, 10, 15], ['incline_curl', 2, 10, 12]]),
        5: D('Lower B + abs', [['bulgarian', 3, 8, 12], ['leg_press', 3, 10, 15], ['leg_ext', 3, 10, 15], ['back_ext', 3, 10, 15], ['calf', 3, 12, 15], ['decline_crunch', 3, 10, 15]]),
        6: RUN, 0: REST } } },
    { id: 'arnold5', name: 'Arnold split', when: '5 gym days + run', blurb: 'Chest+back, shoulders+arms, legs — upper body twice a week. Long pump-style sessions for size.',
      program: { days: {
        1: D('Chest + back', [['db_bench', 3, 6, 10], ['pullup', 3, 5, 10], ['incline_db', 3, 8, 12], ['cs_row', 3, 8, 12], ['db_pullover', 2, 10, 15]]),
        2: D('Shoulders + arms', [['arnold', 3, 8, 12], ['lat_raise', 4, 12, 20], ['rear_fly', 3, 12, 20], ['incline_curl', 3, 10, 12], ['ez_lying', 3, 8, 12], ['hammer', 2, 10, 12]]),
        3: LEGS,
        4: D('Chest + back B', [['incline_db', 3, 8, 12], ['lat_pd', 3, 8, 12], ['db_fly', 2, 10, 15], ['db_row', 3, 8, 12], ['back_ext', 2, 10, 15]]),
        5: D('Shoulders + arms B', [['db_ohp', 3, 8, 12], ['angled_lat', 4, 12, 20], ['rear_fly', 2, 12, 20], ['preacher', 3, 10, 12], ['pushdown', 3, 12, 15], ['conc_curl', 2, 10, 12]]),
        6: RUN, 0: REST } } },
    { id: 'fb3', name: 'Full body ×3', when: '3 gym days + run', blurb: 'Whole body three times a week. Great for busy weeks or a lighter training phase.',
      program: { days: {
        1: D('Full body A', [['smith_squat', 3, 6, 10], ['db_bench', 3, 6, 10], ['cs_row', 3, 8, 12], ['lat_raise', 3, 12, 20], ['incline_curl', 2, 10, 12], ['hanging_knee', 2, 10, 15]]),
        2: REST,
        3: D('Full body B', [['smith_rdl', 3, 8, 10], ['incline_db', 3, 8, 12], ['pullup', 3, 5, 10], ['db_ohp', 2, 8, 12], ['oh_ext', 2, 10, 15], ['calf', 3, 10, 15]]),
        4: REST,
        5: D('Full body C', [['leg_press', 3, 10, 15], ['close_pd', 3, 8, 12], ['db_row', 3, 8, 12], ['angled_lat', 3, 12, 20], ['rear_fly', 2, 12, 20], ['cable_crunch', 3, 10, 15]]),
        6: RUN, 0: REST } } },
    { id: 'original', name: 'Your original split', when: '5 gym days + run', blurb: 'The split you started with (chest+tri, back+bi, shoulders+abs, upper, legs).', program: window.DEFAULT_PROGRAM }
  ];
})();
