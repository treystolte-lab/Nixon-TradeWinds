import React, { useState, useEffect, useRef } from "react";

/* =========================================================
   TRADEWINDS — a Caribbean merchant saga
   Trade. Sail. Fight. Grow a fleet. Never stop.
   ========================================================= */

const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rf = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gold$ = (n) => `${Math.round(n).toLocaleString()}g`;

/* ---------------- GOODS & PORTS ---------------- */
const GOODS = [
  { k: "sugar", n: "Sugar", base: 18 },
  { k: "cotton", n: "Cotton", base: 14 },
  { k: "rum", n: "Rum", base: 34 },
  { k: "coffee", n: "Coffee", base: 40 },
  { k: "tobacco", n: "Tobacco", base: 48 },
  { k: "spices", n: "Spices", base: 78 },
  { k: "silk", n: "Silk", base: 115 },
];
const GOOD = Object.fromEntries(GOODS.map((g) => [g.k, g]));

const PORTS = [
  { k: "havana", n: "Havana", x: 16, y: 22, mods: { tobacco: 0.55, sugar: 0.7, cotton: 1.35, silk: 1.3 } },
  { k: "nassau", n: "Nassau", x: 36, y: 10, mods: { rum: 0.75, spices: 1.3, coffee: 1.25 } },
  { k: "tortuga", n: "Tortuga", x: 42, y: 34, mods: { cotton: 0.8, rum: 1.5, tobacco: 1.45 } },
  { k: "portroyal", n: "Port Royal", x: 25, y: 50, mods: { rum: 0.6, sugar: 0.65, silk: 1.5, spices: 1.4 } },
  { k: "sanjuan", n: "San Juan", x: 60, y: 38, mods: { coffee: 0.6, silk: 1.4, rum: 1.2 } },
  { k: "bridgetown", n: "Bridgetown", x: 86, y: 56, mods: { cotton: 0.55, sugar: 0.7, coffee: 1.5, spices: 1.25 } },
  { k: "willemstad", n: "Willemstad", x: 62, y: 76, mods: { silk: 0.65, sugar: 1.45, tobacco: 1.25 } },
  { k: "cartagena", n: "Cartagena", x: 30, y: 88, mods: { spices: 0.6, coffee: 0.75, rum: 1.4, silk: 1.35 } },
];
const PORT = Object.fromEntries(PORTS.map((p) => [p.k, p]));

const dist = (a, b) => Math.hypot(PORT[a].x - PORT[b].x, PORT[a].y - PORT[b].y);
const routeDays = (a, b, risky) =>
  risky ? Math.max(2, Math.ceil(dist(a, b) / 20) + 1)
        : Math.max(2, Math.ceil(dist(a, b) / 12) + 2 - (hasRelic("sextant") ? 1 : 0));

function genPrices(portKey) {
  const p = PORT[portKey];
  const out = {};
  GOODS.forEach((g) => {
    const mod = p.mods[g.k] || 1;
    out[g.k] = Math.max(4, Math.round(g.base * mod * rf(0.85, 1.15)));
  });
  return out;
}

/* ---------------- SHIPS ---------------- */
const SHIPS = {
  sloop: { n: "Sloop", hp: 60, cargo: 6, crew: 8, atk: 10, spd: 8, cost: 0, type: "ram", tier: 1 },
  brigantine: { n: "Brigantine", hp: 100, cargo: 10, crew: 16, atk: 14, spd: 7, cost: 2500, type: "cannon", tier: 2 },
  frigate: { n: "Frigate", hp: 160, cargo: 15, crew: 26, atk: 20, spd: 6, cost: 8000, type: "cannon", tier: 3 },
  galleon: { n: "Galleon", hp: 240, cargo: 22, crew: 40, atk: 26, spd: 4, cost: 20000, type: "boarding", tier: 4 },
};
const SHIP_NAMES = ["Meridian", "Sea Lark", "Fortuna", "Wavecutter", "Golden Ibis", "Tempest", "Pelican", "Windrose", "Vesper", "Corona Australis"];

/* ---------------- TYPE TRIANGLE ---------------- */
const TYPES = {
  cannon: { n: "Cannon", beats: "boarding", seal: "#8E2F26", sym: "✹" },
  boarding: { n: "Boarding", beats: "ram", seal: "#47694F", sym: "⚔" },
  ram: { n: "Ram", beats: "cannon", seal: "#274F5B", sym: "⛨" },
};
const effOf = (moveType, defType) =>
  TYPES[moveType].beats === defType ? 1.5 : TYPES[defType].beats === moveType ? 0.67 : 1;

/* ---------------- STATUS EFFECTS ---------------- */
const STATUS = {
  ablaze: { n: "Ablaze", sym: "🔥", turns: 3, tickPct: 0.05, desc: "burning each turn" },
  leak: { n: "Leak", sym: "💧", turns: 4, tickPct: 0.04, desc: "taking on water" },
  tangled: { n: "Tangled", sym: "🪢", turns: 2, tickPct: 0, skip: 0.5, desc: "rigging fouled — may lose a turn, cannot flee" },
};

/* ---------------- MOVES ---------------- */
const MOVES = {
  broadside: { n: "Broadside", t: "cannon", pow: 1.0, desc: "A full volley from the gun deck.", starter: true },
  chainshot: { n: "Chain Shot", t: "cannon", pow: 0.55, status: { k: "tangled", ch: 0.55 }, desc: "Shreds rigging. May Tangle.", starter: true },
  ram: { n: "Ram", t: "ram", pow: 0.95, status: { k: "leak", ch: 0.35 }, desc: "Drive the prow home. May cause a Leak.", starter: true },
  boardem: { n: "Boarding Party", t: "boarding", crewPow: { base: 0.5, per: 0.025, cap: 1.6 }, desc: "Power grows with your crew.", starter: true },
  grapeshot: { n: "Grapeshot", t: "cannon", pow: 0.75, status: { k: "ablaze", ch: 0.35 }, cost: 350, desc: "Scatters burning iron across their deck." },
  hotshot: { n: "Hot Shot", t: "cannon", pow: 0.5, status: { k: "ablaze", ch: 0.7 }, cost: 700, desc: "Furnace-glowing shot. Almost always sets fires." },
  doublebroadside: { n: "Double Broadside", t: "cannon", pow: 1.35, selfStatus: { k: "leak", ch: 0.2 }, cost: 900, desc: "Both decks at once. The recoil can spring your own seams." },
  fulltilt: { n: "Full Tilt", t: "ram", pow: 1.3, selfStatus: { k: "tangled", ch: 0.25 }, cost: 800, desc: "Everything into the prow. Your own rigging may foul." },
  cutthroat: { n: "Cutthroat Rush", t: "boarding", crewPow: { base: 0.6, per: 0.03, cap: 1.9 }, cost: 1000, desc: "A savage boarding — scales hardest with a full company." },
  brace: { n: "Brace", defense: "brace", cost: 500, desc: "Halve the next blow against you and patch 8% hull." },
  smokescreen: { n: "Smoke Screen", defense: "smoke", cost: 600, desc: "The enemy likely fires blind on their next turn." },
  marlinspike: { n: "Marlinspike Volley", t: "boarding", pow: 0.6, status: { k: "tangled", ch: 0.5 }, cost: 550, desc: "Spikes and grapnels through their rigging." },
  mortar: { n: "Mortar Barrage", t: "cannon", pow: 1.15, cost: 600, desc: "Plunging fire from the deck mortar. No tricks — just weight of iron." },
  depthgouge: { n: "Depth Gouge", t: "ram", pow: 0.85, status: { k: "leak", ch: 0.5 }, cost: 650, desc: "Rake them below the waterline. Usually springs a Leak." },
  rally: { n: "Rally the Crew", defense: "rally", cost: 750, desc: "Patch 15% hull. Unlike the Carpenter, this never runs out." },
  witchfire: { n: "Witchfire Shot", t: "cannon", pow: 0.9, status: { k: "ablaze", ch: 0.45 }, cost: 1400, desc: "Green-burning shot from the Sea Witch's own recipe. Heavy and hungry." },
  hellburner: { n: "Hellburner Broadside", t: "cannon", pow: 1.8, status: { k: "ablaze", ch: 0.3 }, cost: 4500, desc: "The whole magazine in one thunderclap. Legendary." },
  colossus: { n: "Colossus Ram", t: "ram", pow: 2.0, selfStatus: { k: "tangled", ch: 0.35 }, cost: 5000, desc: "The single heaviest blow on any sea. Your own rigging may not survive the shock." },
  krakensembrace: { n: "Kraken's Embrace", t: "boarding", crewPow: { base: 0.9, per: 0.035, cap: 2.6 }, cost: 6000, desc: "Every hand over the rail at once. With a full Galleon company, nothing hits harder." },
  stormcall: { n: "Stormcall", t: "cannon", pow: 0.5, status: { k: "tangled", ch: 0.6 }, status2: { k: "ablaze", ch: 0.6 }, cost: 9000, desc: "Call St. Elmo's own tempest down upon them — likely Tangles AND Burns." },
};
const STARTER_MOVES = ["broadside", "chainshot", "ram", "boardem"];
const powOf = (move, crew) => move.crewPow
  ? Math.min(move.crewPow.cap, move.crewPow.base + crew * move.crewPow.per)
  : move.pow;

const ENEMY_MOVES = {
  cannon: [
    { n: "Volley", t: "cannon", pow: 1.0 },
    { n: "Fire Shot", t: "cannon", pow: 0.6, status: { k: "ablaze", ch: 0.45 } },
    { n: "Chain Shot", t: "cannon", pow: 0.5, status: { k: "tangled", ch: 0.5 } },
  ],
  boarding: [
    { n: "Grapple & Board", t: "boarding", pow: 0.95 },
    { n: "Powder Toss", t: "boarding", pow: 0.55, status: { k: "ablaze", ch: 0.35 } },
    { n: "Cutlass Storm", t: "boarding", pow: 0.75 },
  ],
  ram: [
    { n: "Crushing Rend", t: "ram", pow: 1.0 },
    { n: "Tail Sweep", t: "ram", pow: 0.55, status: { k: "tangled", ch: 0.45 } },
    { n: "Gnash the Hull", t: "ram", pow: 0.7, status: { k: "leak", ch: 0.4 } },
  ],
};

/* ---------------- ENEMIES ---------------- */
const NATIONS = { spain: "Spain", britain: "Britain", france: "France" };
/* Easy Mode: gentler pirate stock */
const PIRATES_EASY = [
  { n: "Pirate Cutter", hp: 40, atk: 7, spd: 8, type: "boarding" },
  { n: "Corsair Brig", hp: 78, atk: 11, spd: 7, type: "boarding" },
  { n: "Dread Galleon", hp: 160, atk: 18, spd: 5, type: "boarding" },
];
const ENEMIES = {
  pirate: [
    { n: "Pirate Cutter", hp: 50, atk: 9, spd: 8, type: "boarding" },
    { n: "Corsair Brig", hp: 95, atk: 14, spd: 7, type: "boarding" },
    { n: "Dread Galleon", hp: 190, atk: 22, spd: 5, type: "boarding" },
  ],
  navy: [
    { n: "Patrol Sloop", hp: 70, atk: 12, spd: 8, type: "cannon" },
    { n: "Naval Corvette", hp: 115, atk: 16, spd: 7, type: "cannon" },
    { n: "Man-o'-War", hp: 210, atk: 24, spd: 5, type: "cannon" },
  ],
  monster: [
    { n: "Sea Serpent", hp: 60, atk: 11, spd: 9, type: "ram" },
    { n: "Kraken Spawn", hp: 125, atk: 18, spd: 6, type: "ram" },
    { n: "Storm Leviathan", hp: 230, atk: 27, spd: 6, type: "ram" },
  ],
};
/* Each monster tier has variants; sharks are faster and bite harder but carry less bulk. */
const MONSTER_VARIANTS = [
  [
    { n: "Sea Serpent", hp: 60, atk: 11, spd: 9, type: "ram", art: "serpent" },
    { n: "Reef Shark Frenzy", hp: 50, atk: 13, spd: 10, type: "ram", art: "shark" },
  ],
  [
    { n: "Kraken Spawn", hp: 125, atk: 18, spd: 6, type: "ram", art: "kraken" },
    { n: "Great Maw Shark", hp: 105, atk: 21, spd: 10, type: "ram", art: "shark" },
  ],
  [
    { n: "Storm Leviathan", hp: 230, atk: 27, spd: 6, type: "ram", art: "leviathan" },
    { n: "The Kraken", hp: 260, atk: 25, spd: 5, type: "ram", art: "kraken" },
  ],
];


/* ---------------- SHIP & MONSTER ART ---------------- */
const NATION_FLAGS = {
  spain: ["#C8A24A", "#8E2F26"],
  britain: ["#22406B", "#8E2F26"],
  france: ["#22406B", "#EADDBC"],
};

function ShipArt({ kind = "ship", tier = 1, faction = "player", nation, armor = 0, cannons = 0, sails = 0, flip = false, size = 130 }) {
  const W = 150, H = 100;
  const T = flip ? `translate(${W},0) scale(-1,1)` : undefined;
  const ink = "#2B2113";

  /* ---- monsters ---- */
  if (kind === "serpent") return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} className="shipArt"><g transform={T} stroke={ink} strokeWidth="1.6" fill="#3E5F52">
      <path d="M18,72 Q30,50 44,68 Q50,76 58,68 Q70,52 84,68 Q90,76 98,68 Q108,54 118,66 L124,58 Q134,50 138,58 Q140,64 132,66 L126,70 Q120,78 110,74" fill="none" />
      <circle cx="133" cy="57" r="4.5" fill="#3E5F52" /><circle cx="134.5" cy="56" r="1" fill="#EADDBC" stroke="none" />
      <path d="M128,52 L131,44 L134,52" fill="#3E5F52" />
      <path d="M40,60 L44,50 L48,61 M80,60 L84,50 L88,61" fill="#3E5F52" />
      <path d="M6,78 q5,-3 10,0 q5,3 10,0 M60,80 q5,-3 10,0 q5,3 10,0 M112,82 q5,-3 10,0" fill="none" strokeWidth="1" opacity="0.5" />
    </g></svg>
  );
  if (kind === "kraken") return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} className="shipArt"><g transform={T} stroke={ink} strokeWidth="1.6" fill="#5C4358">
      <path d="M50,66 Q48,30 75,26 Q102,30 100,66 Z" />
      <circle cx="66" cy="46" r="4" fill="#EADDBC" /><circle cx="84" cy="46" r="4" fill="#EADDBC" />
      <circle cx="67" cy="47" r="1.6" fill={ink} stroke="none" /><circle cx="85" cy="47" r="1.6" fill={ink} stroke="none" />
      <path d="M50,64 Q36,60 32,44 Q31,38 36,40 Q38,52 50,56 M100,64 Q114,60 118,44 Q119,38 114,40 Q112,52 100,56" />
      <path d="M56,66 Q50,80 38,80 Q32,80 36,74 Q44,76 48,66 M94,66 Q100,80 112,80 Q118,80 114,74 Q106,76 102,66 M70,66 Q68,84 60,86 M80,66 Q82,84 90,86" fill="none" />
      <path d="M20,84 q5,-3 10,0 q5,3 10,0 M104,86 q5,-3 10,0 q5,3 10,0" fill="none" strokeWidth="1" opacity="0.5" />
    </g></svg>
  );
  if (kind === "shark") return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} className="shipArt"><g transform={T} stroke={ink} strokeWidth="1.6" fill="#5B6E78">
      <path d="M18,62 Q40,44 78,46 Q108,48 124,58 L138,50 Q142,48 141,54 L136,62 Q120,72 90,72 Q46,74 18,62 Z" />
      <path d="M70,46 L80,26 Q83,22 84,28 L82,46" fill="#5B6E78" />
      <path d="M118,58 L126,66 L112,66 Z" fill="#5B6E78" />
      <circle cx="34" cy="56" r="2" fill="#EADDBC" stroke="none" /><circle cx="33.5" cy="56" r="0.9" fill={ink} stroke="none" />
      <path d="M22,64 L26,68 L30,64 L34,68 L38,64" fill="none" strokeWidth="1.1" stroke="#EADDBC" />
      <path d="M56,52 q3,2 6,0 M72,54 q3,2 6,0" fill="none" strokeWidth="0.9" opacity="0.6" />
      <path d="M8,80 q6,-3 12,0 q6,3 12,0 M96,82 q6,-3 12,0 q6,3 12,0" fill="none" strokeWidth="1" opacity="0.5" />
    </g></svg>
  );
  if (kind === "leviathan") return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} className="shipArt"><g transform={T} stroke={ink} strokeWidth="1.8" fill="#33505C">
      <path d="M10,74 Q30,38 78,40 Q116,42 128,60 L138,48 Q144,44 144,52 Q144,62 132,68 Q110,80 60,80 Q26,80 10,74 Z" />
      <circle cx="106" cy="54" r="2.2" fill="#EADDBC" stroke="none" />
      <path d="M60,40 L64,24 L72,38" fill="#33505C" />
      <path d="M96,46 q2,-10 0,-16 M100,46 q4,-9 8,-13" fill="none" strokeWidth="1.2" opacity="0.7" />
      <path d="M4,84 q6,-3 12,0 q6,3 12,0 q6,-3 12,0 M96,86 q6,-3 12,0 q6,3 12,0" fill="none" strokeWidth="1" opacity="0.5" />
    </g></svg>
  );

  /* ---- sailing ships ---- */
  const masts = tier >= 3 ? 3 : tier === 2 ? 2 : 1;
  const hullC = faction === "pirate" ? "#3A2E22" : faction === "navy" ? "#5A452C" : "#6B4A2A";
  const sailC = faction === "pirate" ? "#4A4238" : "#EFE5CC";
  const mastXs = masts === 1 ? [72] : masts === 2 ? [56, 92] : [46, 72, 98];
  const guns = Math.min(7, tier + 1 + cannons);
  const gunXs = Array.from({ length: guns }, (_, i) => 34 + i * (78 / Math.max(1, guns - 1)));
  const flag = faction === "pirate" ? null : faction === "navy" ? NATION_FLAGS[nation] || NATION_FLAGS.spain : null;
  const topDeck = 58;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} className="shipArt">
      <g transform={T}>
        {/* sails */}
        {mastXs.map((x, i) => (
          <g key={i} stroke="#2B2113" strokeWidth="1.1">
            <line x1={x} y1={topDeck} x2={x} y2={sails > 0 ? 8 : 14} />
            <path d={`M${x - 13},${34} Q${x},${40} ${x + 13},${34} L${x + 11},${topDeck - 4} Q${x},${topDeck + 1} ${x - 11},${topDeck - 4} Z`} fill={sailC} />
            {(tier >= 2 || sails > 1) && (
              <path d={`M${x - 10},${18} Q${x},${23} ${x + 10},${18} L${x + 9},${31} Q${x},${35} ${x - 9},${31} Z`} fill={sailC} />
            )}
            {sails > 2 && i === Math.floor(mastXs.length / 2) && (
              <path d={`M${x - 7},${9} Q${x},${13} ${x + 7},${9} L${x + 6},${16} Q${x},${19} ${x - 6},${16} Z`} fill={sailC} />
            )}
          </g>
        ))}
        {/* jib + bowsprit (bow faces right) */}
        <line x1="120" y1={topDeck} x2="142" y2="46" stroke="#2B2113" strokeWidth="1.2" />
        <path d={`M120,${topDeck - 2} L138,48 L120,36 Z`} fill={sailC} stroke="#2B2113" strokeWidth="1" />
        {/* pennant / flag on mainmast */}
        {(() => {
          const mx = mastXs[Math.floor(mastXs.length / 2)];
          const topY = sails > 0 ? 8 : 14;
          if (faction === "pirate") return (<g>
            <rect x={mx} y={topY - 6} width="14" height="8" fill="#1C1712" stroke="#2B2113" strokeWidth="0.8" />
            <circle cx={mx + 7} cy={topY - 2} r="1.6" fill="#EADDBC" />
          </g>);
          if (flag) return (<g>
            <rect x={mx} y={topY - 6} width="14" height="4" fill={flag[0]} stroke="#2B2113" strokeWidth="0.6" />
            <rect x={mx} y={topY - 2} width="14" height="4" fill={flag[1]} stroke="#2B2113" strokeWidth="0.6" />
          </g>);
          const len = 12 + sails * 4;
          return <path d={`M${mx},${topY - 5} L${mx + len},${topY - 2} L${mx},${topY + 1} Z`} fill="#C8A24A" stroke="#2B2113" strokeWidth="0.8" />;
        })()}
        {/* hull */}
        <path d={`M16,${topDeck} L124,${topDeck} L112,78 Q72,84 30,78 Z`} fill={hullC} stroke="#2B2113" strokeWidth="1.6" />
        {tier >= 3 && <rect x="100" y={topDeck - 8} width="22" height="8" fill={hullC} stroke="#2B2113" strokeWidth="1.2" />}
        {/* armor plating band grows with rank */}
        {armor > 0 && (
          <g>
            <rect x="22" y={topDeck + 3} width={20 * Math.min(armor, 5)} height="6" fill="#7C7A72" stroke="#2B2113" strokeWidth="0.8" rx="1" />
            {Array.from({ length: Math.min(armor, 5) * 2 }, (_, i) => (
              <circle key={i} cx={26 + i * 10} cy={topDeck + 6} r="0.9" fill="#2B2113" />
            ))}
          </g>
        )}
        {/* gun ports */}
        {gunXs.map((x, i) => <rect key={i} x={x} y={topDeck + 11} width="4.5" height="4.5" fill="#14100A" stroke="#2B2113" strokeWidth="0.6" />)}
        {/* waterline */}
        <path d="M6,84 q6,-3 12,0 q6,3 12,0 q6,-3 12,0 q6,3 12,0 q6,-3 12,0 q6,3 12,0 q6,-3 12,0 q6,3 12,0 q6,-3 12,0" fill="none" stroke="#274F5B" strokeWidth="1.4" opacity="0.6" />
      </g>
    </svg>
  );
}

const MONSTER_KIND = ["serpent", "kraken", "leviathan"];
const enemyArt = (e) => e.cat === "monster"
  ? { kind: e.art || MONSTER_KIND[e.tier] }
  : { kind: "ship", tier: e.tier + 1, faction: e.cat, nation: e.nation };

/* ---------------- CREW ABILITIES ---------------- */
const ABILITIES = [
  { k: "carpenter", n: "Carpenter", need: 6, desc: "Repair 30% of hull. Once per battle." },
  { k: "powdermonkeys", n: "Powder Monkeys", need: 9, desc: "Hurl firepots — 70% to set the enemy Ablaze. Once per battle." },
  { k: "gunner", n: "Master Gunner", need: 12, desc: "Next attack strikes twice as hard. Once per battle." },
  { k: "sailmaster", n: "Sailmaster", need: 15, desc: "Slip the wind — the enemy likely misses their next attack. Once per battle." },
  { k: "bosun", n: "Bosun", need: 18, desc: "Clear all ailments, patch 10% hull. Once per battle." },
  { k: "quartermaster", n: "Quartermaster", need: 22, desc: "Ransack mid-fight — seize 20g per enemy level. Once per battle." },
  { k: "chaplain", n: "Chaplain", need: 30, desc: "A hymn steadies every hand — repair 50% of hull. Once per battle." },
];


/* ---------------- JOBS ---------------- */
const JOB_FLAVOR = [
  "Royal dispatches", "Salt cod in barrels", "A notary and his chests", "Bells for the chapel",
  "Mail for the garrison", "Crates of indigo", "A merchant's ledgers", "Powder for the fort",
  "A crated harpsichord", "Casks of drinking water",
];
function genJobs(portKey, level) {
  const dests = PORTS.filter((p) => p.k !== portKey).map((p) => p.k);
  const chosen = [];
  while (chosen.length < 3 && dests.length) chosen.push(dests.splice(ri(0, dests.length - 1), 1)[0]);
  return chosen.map((d) => ({
    dest: d,
    flavor: pick(JOB_FLAVOR),
    pay: Math.round((30 + dist(portKey, d) * 3.5 + level * 12) / 5) * 5,
  }));
}



/* ---------------- RELICS (souvenirs) ---------------- */
const RELICS = {
  trident: { n: "Neptune's Trident", sym: "🔱", desc: "+8% attack" },
  charm: { n: "Barnacle Charm", sym: "🐚", desc: "+10% max hull" },
  chart: { n: "Silk Chart of the Ancients", sym: "🗺️", desc: "+8% escape chance" },
  eye: { n: "Kraken's Eye", sym: "👁️", desc: "+15% damage to sea monsters" },
  sextant: { n: "Golden Sextant", sym: "🧭", desc: "Trade Lane crossings one day faster" },
  comb: { n: "Mermaid's Comb", sym: "🪮", desc: "The sea mends 5% of your hull at every port" },
  lodestone: { n: "Lodestone Compass", sym: "🧲", desc: "+3 cargo hold" },
  powderhorn: { n: "Powder Horn of St. Elmo", sym: "⚡", desc: "+15% chance your shots Tangle, Burn, or Breach" },
  idol: { n: "Emerald Idol", sym: "💠", desc: "+10% gold plundered from battles" },
  bell: { n: "Bell of the Deep", sym: "🔔", desc: "-5% damage taken" },
};
/* Synced from component state each render so pure helpers can read passive relic effects. */
let ACTIVE_RELICS = [];
const hasRelic = (k) => ACTIVE_RELICS.includes(k);

const BOSSES = [
  { name: "The Pirate King, Bartholomew Vane", cat: "pirate", type: "boarding", spd: 7 },
  { name: "The Ghost Admiral", cat: "navy", type: "cannon", spd: 6 },
  { name: "The Leviathan King", cat: "monster", type: "ram", spd: 7 },
];

const BOUNTY_NAMES = ["One-Eyed Moreau", "Bloody Anne Rackham", "Cutter Jack", "The Gallows Dutchman", "Mad Isabel", "Silver-Tooth Santos", "Old Scratch Beaumont"];

/* ---------------- SEA WITCH BLESSINGS ---------------- */
const BLESSINGS = {
  witchwind: { n: "Witchwind", cost: 70, desc: "Your first escape attempt next voyage cannot fail." },
  saltward: { n: "Saltward", cost: 90, desc: "No fire, leak, or tangle can touch your ship next voyage." },
  plunderer: { n: "Plunderer's Eye", cost: 120, desc: "Half again as much gold from every battle next voyage." },
};

/* ---------------- NEW GAME ---------------- */
const newShip = (key, name) => ({
  key, name: name || pick(SHIP_NAMES),
  hp: SHIPS[key].hp, armor: 0, cannons: 0, sails: 0,
});

const newGame = () => ({
  screen: "port",
  gold: 10000, day: 1, level: 3, xp: 0,
  holdBonus: 10,
  port: "portroyal",
  prices: genPrices("portroyal"),
  fleet: [newShip("sloop", "Meridian")],
  active: 0,
  crew: 6,
  cargo: {},
  allies: {},
  battlesWon: 0, shipsLost: 0,
  jobs: genJobs("portroyal", 3),
  rumor: null, blessing: null,
  easyMode: false, hardMode: false, modMode: false,
  bossCooldownUntil: 0,
  relics: [], bounty: null,
  ownedMoves: [...STARTER_MOVES], loadout: [...STARTER_MOVES],
  rep: { portroyal: 1 },
  history: [], trips: 0, jobsDone: 0, cleanDeliveries: 0, bountiesClaimed: 0, diceNet: 0,
  pricesSeen: {},
  voyage: null, battle: null, event: null,
  over: false,
});

/* ---------------- DERIVED STATS ---------------- */
const maxHpOf = (ship, level) => Math.round(SHIPS[ship.key].hp * (1 + 0.06 * (level - 1)) * (hasRelic("charm") ? 1.1 : 1));
const atkOf = (ship, level) => SHIPS[ship.key].atk * (1 + 0.1 * ship.cannons) * (1 + 0.05 * (level - 1)) * (hasRelic("trident") ? 1.08 : 1);
const armorRed = (ship) => Math.min(0.35, ship.armor * 0.07);
const cargoCap = (fleet) => fleet.reduce((s, sh) => s + SHIPS[sh.key].cargo, 0);
const capOf = (fleet, holdBonus) => cargoCap(fleet) + (holdBonus || 0) + (hasRelic("lodestone") ? 3 : 0);
const crewCap = (fleet) => fleet.reduce((s, sh) => s + SHIPS[sh.key].crew, 0);
const cargoCount = (cargo) => Object.values(cargo).reduce((a, b) => a + b, 0);
const xpNeed = (level) => level * 120;

function trimCargo(cargo, cap) {
  const c = { ...cargo };
  let n = cargoCount(c);
  const keys = Object.keys(c);
  while (n > cap && keys.length) {
    const k = pick(keys.filter((x) => c[x] > 0));
    if (!k) break;
    c[k] -= 1; if (c[k] <= 0) delete c[k];
    n -= 1;
  }
  return c;
}

/* ---------------- ENEMY GENERATION ---------------- */
function genEnemy(game, risky) {
  const roll = Math.random();
  let cat = roll < 0.45 ? "pirate" : roll < 0.75 ? "navy" : "monster";
  const openNations = Object.keys(NATIONS).filter((n) => !game.allies[n]);
  if (cat === "navy" && openNations.length === 0) cat = "pirate";
  const hardBump = game.hardMode ? 1 : 0;
  const lvl = Math.max(1, game.level - 2 + hardBump + (risky ? ri(1, 3) : ri(-1, 1)));
  const tier = lvl < 4 ? 0 : lvl < 8 ? 1 : 2;
  const base = cat === "monster" ? pick(MONSTER_VARIANTS[tier])
    : cat === "pirate" && game.easyMode && !game.hardMode ? PIRATES_EASY[tier] : ENEMIES[cat][tier];
  const hardMult = game.hardMode ? 1.2 : 1;
  const nation = cat === "navy" ? pick(openNations) : null;
  return {
    cat, nation, lvl, tier,
    name: nation ? `${NATIONS[nation]} ${base.n}` : base.n,
    type: base.type, spd: base.spd, art: base.art,
    maxHp: Math.round(base.hp * (1 + 0.12 * lvl) * hardMult),
    hp: Math.round(base.hp * (1 + 0.12 * lvl) * hardMult),
    atk: base.atk * (1 + 0.09 * lvl) * (game.hardMode ? 1.15 : 1),
    statuses: [],
  };
}

/* =========================================================
   COMPONENT
   ========================================================= */
export default function Tradewinds() {
  const [g, setG] = useState(newGame());
  const [tab, setTab] = useState("market");
  const [loaded, setLoaded] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  /* ---- persistence ---- */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("tradewinds-save");
        if (r && r.value) {
          const s = JSON.parse(r.value);
          if (s && s.fleet && s.fleet.length) {
            if (!s.jobs) s.jobs = genJobs(s.port, s.level);
            s.relics = s.relics || []; s.rep = s.rep || {}; s.history = s.history || [];
            s.ownedMoves = s.ownedMoves || [...STARTER_MOVES]; s.loadout = s.loadout || [...STARTER_MOVES];
            s.pricesSeen = s.pricesSeen || {};
            s.trips = s.trips || 0; s.jobsDone = s.jobsDone || 0; s.cleanDeliveries = s.cleanDeliveries || 0;
            s.bountiesClaimed = s.bountiesClaimed || 0; s.diceNet = s.diceNet || 0;
            s.easyMode = !!s.easyMode; s.hardMode = !!s.hardMode; s.modMode = !!s.modMode;
            s.bossCooldownUntil = s.bossCooldownUntil || 0;
            setG(s);
          }
        }
      } catch (e) { /* no save yet */ }
      setLoaded(true);
    })();
  }, []);

  const save = async (state) => {
    try {
      const s = { ...state, battle: null, voyage: null, event: null, screen: "port" };
      await window.storage.set("tradewinds-save", JSON.stringify(s));
      setSaveNote("Log entered ✓");
      setTimeout(() => setSaveNote(""), 1800);
    } catch (e) { setSaveNote("Could not save"); setTimeout(() => setSaveNote(""), 1800); }
  };

  useEffect(() => {
    if (loaded && g.screen === "port" && !g.over) save(g);
    // eslint-disable-next-line
  }, [g.port, g.day, loaded]);

  const resetGame = async () => {
    try { await window.storage.delete("tradewinds-save"); } catch (e) {}
    setG(newGame()); setTab("market");
  };

  /* ---- shorthand ---- */
  ACTIVE_RELICS = g.relics || [];
  const repHere = (g.rep || {})[g.port] || 0;
  const repDisc = repHere >= 6 ? 0.85 : repHere >= 3 ? 0.9 : 1;
  const repTitle = repHere >= 6 ? "Favored" : repHere >= 3 ? "Known" : null;
  const ship = g.fleet[g.active];
  const sMaxHp = ship ? maxHpOf(ship, g.level) : 0;
  const cap = capOf(g.fleet, g.holdBonus);
  const cCap = crewCap(g.fleet);
  const held = cargoCount(g.cargo);

  /* =========================================================
     PORT ACTIONS
     ========================================================= */
  const buyGood = (k, qty) => {
    const price = g.prices[k];
    const canQty = Math.min(qty, cap - held, Math.floor(g.gold / price));
    if (canQty <= 0) return;
    setG((s) => ({
      ...s, gold: s.gold - price * canQty,
      cargo: { ...s.cargo, [k]: (s.cargo[k] || 0) + canQty },
    }));
  };
  const sellGood = (k, qty) => {
    const have = g.cargo[k] || 0;
    const q = Math.min(qty, have);
    if (q <= 0) return;
    setG((s) => {
      const c = { ...s.cargo, [k]: (s.cargo[k] || 0) - q };
      if (c[k] <= 0) delete c[k];
      return { ...s, gold: s.gold + s.prices[k] * q, cargo: c };
    });
  };

  const buyShip = (key) => {
    const def = SHIPS[key];
    if (g.gold < def.cost) return;
    setG((s) => ({ ...s, gold: s.gold - def.cost, fleet: [...s.fleet, newShip(key)] }));
  };

  const buyUpgrade = (stat) => {
    const lvl = ship[stat];
    if (lvl >= 5) return;
    const cost = Math.round(250 * (lvl + 1) * SHIPS[ship.key].tier * repDisc);
    if (g.gold < cost) return;
    setG((s) => {
      const fleet = s.fleet.map((sh, i) => (i === s.active ? { ...sh, [stat]: sh[stat] + 1 } : sh));
      return { ...s, gold: s.gold - cost, fleet };
    });
  };

  const repairShip = () => {
    const missing = sMaxHp - ship.hp;
    if (missing <= 0) return;
    const perHp = 2 * repDisc;
    const cost = Math.min(Math.ceil(missing * perHp), g.gold);
    const healed = Math.floor(cost / perHp);
    setG((s) => ({
      ...s, gold: s.gold - cost,
      fleet: s.fleet.map((sh, i) => (i === s.active ? { ...sh, hp: Math.min(maxHpOf(sh, s.level), sh.hp + healed) } : sh)),
    }));
  };

  const crewPrice = Math.round(25 * repDisc);
  const hireCrew = (n) => {
    const canN = Math.min(n, cCap - g.crew, Math.floor(g.gold / crewPrice));
    if (canN <= 0) return;
    setG((s) => ({ ...s, gold: s.gold - crewPrice * canN, crew: s.crew + canN }));
  };

  const setFlagship = (i) => setG((s) => ({ ...s, active: i }));

  /* =========================================================
     VOYAGE
     ========================================================= */
  const setSail = (destKey, risky, job = null) => {
    const days = routeDays(g.port, destKey, risky);
    const wages = g.crew * days;
    const checks = (risky ? 3 : 2) + (g.hardMode ? 1 : 0);
    setG((s) => ({
      ...s,
      gold: Math.max(0, s.gold + (job ? job.pay : 0) - wages),
      screen: "voyage",
      voyage: { dest: destKey, risky, days, wages, checksLeft: checks, total: checks, job, tookHit: false, lostCargo: false, blessing: s.blessing, blessUsed: false },
      blessing: null,
      event: null,
    }));
  };

  const rollEncounter = () => {
    const v = g.voyage;
    if (!v) return;
    if (v.checksLeft <= 0) { arrive(); return; }
    // A hunted pirate always finds you on the first leg to their waters
    if (g.bounty && g.bounty.accepted && g.bounty.dest === v.dest && v.checksLeft === v.total) {
      const lvl = g.bounty.lvl;
      const tier = lvl < 4 ? 0 : lvl < 8 ? 1 : 2;
      const base = g.easyMode ? PIRATES_EASY[tier] : ENEMIES.pirate[tier];
      startBattle({
        cat: "pirate", nation: null, lvl, tier,
        name: g.bounty.name, type: base.type, spd: base.spd,
        maxHp: Math.round(base.hp * (1 + 0.12 * lvl) * 1.15),
        hp: Math.round(base.hp * (1 + 0.12 * lvl) * 1.15),
        atk: base.atk * (1 + 0.09 * lvl) * 1.1,
        statuses: [], isBounty: true,
      }, v);
      return;
    }
    // ~1-in-10 legs turn up a lost treasure of the deep
    const missing = Object.keys(RELICS).filter((k) => !(g.relics || []).includes(k));
    if (missing.length && Math.random() < 0.1) {
      const k = pick(missing);
      setG((s) => ({
        ...s,
        relics: [...(s.relics || []), k],
        event: { kind: "relic", relic: k },
        voyage: { ...s.voyage, checksLeft: s.voyage.checksLeft - 1 },
      }));
      return;
    }
    const eventCh = v.risky ? 0.75 : 0.4;
    let ev = null;
    if (Math.random() < eventCh) {
      const r = Math.random();
      const kind = v.risky ? (r < 0.55 ? "battle" : r < 0.8 ? "friend" : "storm")
                          : (r < 0.4 ? "battle" : r < 0.75 ? "friend" : "storm");
      if (kind === "battle") {
        const enemy = genEnemy(g, v.risky);
        startBattle(enemy, v);
        return;
      }
      ev = kind === "storm" ? { kind: "storm" } : genFriend();
    } else {
      ev = { kind: "calm", text: pick([
        "Fair winds and a following sea. The watch sings from the crosstrees.",
        "Flying fish scatter off the bow. Nothing on the horizon.",
        "A quiet night's sail beneath the Southern Cross.",
      ]) };
    }
    setG((s) => ({ ...s, event: ev, voyage: { ...s.voyage, checksLeft: s.voyage.checksLeft - 1 } }));
  };

  const genFriend = () => {
    const allied = Object.keys(g.allies).filter((k) => g.allies[k]);
    const pool = ["dolphins", "turtle", "convoy"];
    if (allied.length) pool.push("alliedNavy");
    const kind = pick(pool);
    if (kind === "alliedNavy") return { kind, nation: pick(allied) };
    if (kind === "convoy") {
      const good = pick(GOODS);
      return { kind, good: good.k, price: Math.max(3, Math.round(good.base * 0.55)) };
    }
    return { kind };
  };

  const resolveEvent = (choice) => {
    const ev = g.event;
    if (!ev) return;
    let patch = {};
    let note = "";
    if (ev.kind === "storm") {
      if (choice === "jettison") {
        patch.cargo = trimCargo(g.cargo, Math.max(0, held - 2));
        patch.voyage = { ...g.voyage, lostCargo: true };
        note = "Two crates go over the side. The ship rights herself.";
      } else {
        const dmg = Math.max(4, Math.round(sMaxHp * 0.12));
        const fleet = g.fleet.map((sh, i) => (i === g.active ? { ...sh, hp: Math.max(1, sh.hp - dmg) } : sh));
        patch.fleet = fleet;
        note = `You lash the wheel and ride it out. Hull takes ${dmg} damage.`;
      }
    }
    if (ev.kind === "dolphins") {
      patch.voyage = { ...g.voyage, checksLeft: 0 };
      note = "The pod threads you through hidden shoals — the rest of the passage is clear.";
    }
    if (ev.kind === "turtle") {
      if (choice === "trade" && held > 0) {
        const k = pick(Object.keys(g.cargo).filter((x) => g.cargo[x] > 0));
        const c = { ...g.cargo, [k]: g.cargo[k] - 1 };
        if (c[k] <= 0) delete c[k];
        const reward = 120 + g.level * 25;
        patch.cargo = c; patch.gold = g.gold + reward;
        note = `The Elder accepts a crate of ${GOOD[k].n.toLowerCase()} and surfaces beside a sunken strongbox: +${reward}g.`;
      } else {
        note = "The ancient turtle regards you a long moment, then slips beneath the waves.";
      }
    }
    if (ev.kind === "convoy") {
      if (choice === "buy") {
        const q = Math.min(3, cap - held, Math.floor(g.gold / ev.price));
        if (q > 0) {
          patch.gold = g.gold - ev.price * q;
          patch.cargo = { ...g.cargo, [ev.good]: (g.cargo[ev.good] || 0) + q };
          note = `You take on ${q} ${GOOD[ev.good].n.toLowerCase()} at ${ev.price}g each.`;
        } else note = "No room in the hold or coin in the chest. The convoy sails on.";
      } else note = "You exchange news and part ways.";
    }
    if (ev.kind === "alliedNavy") {
      const gift = 60 + g.level * 12;
      const fleet = g.fleet.map((sh, i) =>
        i === g.active ? { ...sh, hp: Math.min(maxHpOf(sh, g.level), sh.hp + Math.round(sMaxHp * 0.25)) } : sh);
      patch.gold = g.gold + gift; patch.fleet = fleet;
      note = `The ${NATIONS[ev.nation]} squadron salutes your colors — carpenters mend your hull and the captain presses ${gift}g on you.`;
    }
    setG((s) => ({ ...s, ...patch, event: { kind: "resolved", text: note } }));
  };

  const arrive = () => {
    const v = g.voyage;
    const dest = v.dest;
    let bonusGold = 0;
    let notice = null;
    if (v.job) {
      const clean = !v.tookHit && !v.lostCargo;
      if (clean) {
        bonusGold = Math.round(v.job.pay * 0.25);
        notice = `Cargo delivered untouched — the client adds a ${gold$(bonusGold)} bonus to your ${gold$(v.job.pay)} fee.`;
      } else {
        notice = `Delivery made, but the goods arrived worse for wear. No bonus this time.`;
      }
    }
    setG((s) => {
      const newDay = s.day + s.voyage.days;
      let prices = genPrices(dest);
      let rumor = s.rumor;
      if (rumor && newDay > rumor.expires) rumor = null;
      if (rumor && rumor.port === dest) {
        prices = { ...prices, [rumor.good]: Math.round(GOOD[rumor.good].base * rumor.mult) };
        notice = (notice ? notice + " " : "") + `The rumor held true — ${GOOD[rumor.good].n} is fetching ${prices[rumor.good]}g here!`;
        rumor = null;
      }
      // Mermaid's Comb: the sea mends the flagship at every landfall
      let fleet = s.fleet;
      if (hasRelic("comb")) {
        fleet = s.fleet.map((sh, i) => i === s.active
          ? { ...sh, hp: Math.min(maxHpOf(sh, s.level), sh.hp + Math.max(1, Math.round(maxHpOf(sh, s.level) * 0.05))) }
          : sh);
      }
      // a fresh bounty may be posted if none is outstanding
      let bounty = s.bounty;
      if (!bounty && Math.random() < 0.6) {
        const bl = s.level + ri(1, 3);
        bounty = {
          name: pick(BOUNTY_NAMES),
          dest: pick(PORTS.filter((p) => p.k !== dest)).k,
          lvl: bl, reward: 200 + bl * 60, accepted: false,
        };
      }
      // the sea itself teaches: XP for days sailed, more for a delivered contract
      const voyageXp = v.days * 6 + (v.job ? 25 : 0);
      let xp = s.xp + voyageXp;
      let level = s.level;
      while (xp >= xpNeed(level)) { xp -= xpNeed(level); level += 1; }
      notice = (notice ? notice + " " : "") + `+${voyageXp} xp for the crossing.`;
      if (level > s.level) notice = notice + ` ⭐ Your legend grows — Level ${level}!`;
      return {
        ...s,
        screen: "port", port: dest,
        gold: s.gold + bonusGold,
        day: newDay, xp, level,
        prices, rumor, fleet, bounty,
        rep: { ...(s.rep || {}), [dest]: ((s.rep || {})[dest] || 0) + 1 },
        jobs: genJobs(dest, s.level),
        trips: (s.trips || 0) + 1,
        jobsDone: (s.jobsDone || 0) + (v.job ? 1 : 0),
        cleanDeliveries: (s.cleanDeliveries || 0) + (v.job && !v.tookHit && !v.lostCargo ? 1 : 0),
        history: [{ from: s.port, to: dest, risky: v.risky, day: newDay }, ...(s.history || [])].slice(0, 10),
        pricesSeen: { ...(s.pricesSeen || {}), [dest]: { day: newDay, prices } },
        notice,
        voyage: null, event: null,
      };
    });
    setTab("market");
  };

  /* =========================================================
     BATTLE
     ========================================================= */
  const startBattle = (enemy, voyage) => {
    const phase = enemy.cat === "navy" && !enemy.isBoss ? "parley" : "player";
    setG((s) => ({
      ...s,
      screen: "battle",
      voyage: { ...voyage, checksLeft: voyage.checksLeft - 1 },
      battle: {
        enemy, phase,
        log: [`${enemy.name} (Lv ${enemy.lvl}) closes on your position!`],
        used: {}, gunner: false, pStatuses: [], loot: null, braced: false, smoked: false,
      },
    }));
  };

  const tickStatuses = (statuses, maxHp) => {
    let dmg = 0; const lines = []; const next = [];
    statuses.forEach((st) => {
      const def = STATUS[st.k];
      if (def.tickPct) {
        const d = Math.max(1, Math.round(maxHp * def.tickPct));
        dmg += d; lines.push(`${def.sym} ${def.n} deals ${d} damage.`);
      }
      if (st.turns - 1 > 0) next.push({ ...st, turns: st.turns - 1 });
      else lines.push(`${def.n} subsides.`);
    });
    return { dmg, lines, next };
  };

  const tryInflict = (statuses, status) => {
    if (!status) return { statuses, line: null };
    if (Math.random() > status.ch) return { statuses, line: null };
    if (statuses.some((s) => s.k === status.k)) return { statuses, line: null };
    const def = STATUS[status.k];
    return { statuses: [...statuses, { k: status.k, turns: def.turns }], line: `${def.sym} Now ${def.n}!` };
  };

  const playerDamage = (move, enemy, gunner) => {
    const base = atkOf(ship, g.level);
    const pow = powOf(move, g.crew);
    const stab = SHIPS[ship.key].type === move.t ? 1.2 : 1;
    const eff = effOf(move.t, enemy.type);
    let dmg = base * pow * stab * eff * rf(0.85, 1.15);
    if (gunner) dmg *= 2;
    if (enemy.cat === "monster" && hasRelic("eye")) dmg *= 1.15;
    return { dmg: Math.max(1, Math.round(dmg)), eff };
  };

  const shopRange = (move) => {
    if (move.defense) return null;
    const base = atkOf(ship, g.level);
    const pow = powOf(move, g.crew);
    const stab = SHIPS[ship.key].type === move.t ? 1.2 : 1;
    return { lo: Math.max(1, Math.round(base * pow * stab * 0.85)), hi: Math.max(1, Math.round(base * pow * stab * 1.15)) };
  };

  const moveRange = (move, enemy, gunner) => {
    if (move.defense) return null;
    const base = atkOf(ship, g.level);
    const pow = powOf(move, g.crew);
    const stab = SHIPS[ship.key].type === move.t ? 1.2 : 1;
    const eff = effOf(move.t, enemy.type);
    const mult = gunner ? 2 : 1;
    return {
      lo: Math.max(1, Math.round(base * pow * stab * eff * 0.85 * mult)),
      hi: Math.max(1, Math.round(base * pow * stab * eff * 1.15 * mult)),
      eff,
    };
  };

  const doMove = (move) => {
    const b = g.battle;
    if (!b || b.phase !== "player") return;
    let enemy = { ...b.enemy, statuses: [...b.enemy.statuses] };
    let pStatuses = [...b.pStatuses];
    let fleet = g.fleet.map((sh) => ({ ...sh }));
    let active = g.active;
    let crew = g.crew;
    let log = [];
    let gunnerUsed = b.gunner;
    let braced = b.braced;
    let smoked = b.smoked;

    // -- player acts (tangled may skip) --
    const pTangled = pStatuses.some((s) => s.k === "tangled");
    if (pTangled && Math.random() < STATUS.tangled.skip) {
      log.push("🪢 Your rigging is fouled — the crew fights the lines and loses the turn!");
    } else if (move.defense === "brace") {
      braced = true;
      const heal = Math.max(1, Math.round(maxHpOf(fleet[active], g.level) * 0.08));
      fleet[active].hp = Math.min(maxHpOf(fleet[active], g.level), fleet[active].hp + heal);
      log.push(`🛡 All hands brace and shore the timbers — +${heal} hull, the next blow will be halved.`);
    } else if (move.defense === "smoke") {
      smoked = true;
      log.push("🌫 Powder smoke rolls thick across the water — they can barely see your masts.");
    } else if (move.defense === "rally") {
      const heal = Math.max(1, Math.round(maxHpOf(fleet[active], g.level) * 0.15));
      fleet[active].hp = Math.min(maxHpOf(fleet[active], g.level), fleet[active].hp + heal);
      log.push(`⚒ The crew rallies to the pumps and patches — +${heal} hull.`);
    } else {
      const { dmg, eff } = playerDamage(move, enemy, gunnerUsed);
      gunnerUsed = false;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      const effTxt = eff > 1 ? " It strikes true — devastating!" : eff < 1 ? " The blow glances…" : "";
      log.push(`${move.n} hits ${enemy.name} for ${dmg}.${effTxt}`);
      if (enemy.hp > 0) {
        const boost = (st) => {
          if (!st) return st;
          let ch = hasRelic("powderhorn") ? Math.min(0.95, st.ch + 0.15) : st.ch;
          if (enemy.isBoss) ch *= 0.5; // legends shrug off half of what would cripple lesser ships
          return { ...st, ch };
        };
        const inf = tryInflict(enemy.statuses, boost(move.status));
        enemy.statuses = inf.statuses;
        if (inf.line) log.push(`${enemy.name}: ${inf.line}`);
        if (move.status2) {
          const inf2 = tryInflict(enemy.statuses, boost(move.status2));
          enemy.statuses = inf2.statuses;
          if (inf2.line) log.push(`${enemy.name}: ${inf2.line}`);
        }
      }
      if (move.selfStatus) {
        const inf = tryInflict(pStatuses, move.selfStatus);
        pStatuses = inf.statuses;
        if (inf.line) log.push(`Your ship: ${inf.line} The maneuver takes its toll.`);
      }
    }

    // -- enemy status ticks --
    if (enemy.hp > 0) {
      const t = tickStatuses(enemy.statuses, enemy.maxHp);
      enemy.hp = Math.max(0, enemy.hp - t.dmg);
      enemy.statuses = t.next;
      t.lines.forEach((l) => log.push(`${enemy.name}: ${l}`));
    }

    if (enemy.hp <= 0) { finishVictory(enemy, log); return; }

    // -- enemy acts --
    const enraged = enemy.isBoss && enemy.hp > 0 && enemy.hp < enemy.maxHp * 0.3;
    if (enraged && !enemy.enrageAnnounced) {
      enemy.enrageAnnounced = true;
      log.push(`🩸 Blood in the water — ${enemy.name} is ENRAGED! Its blows land half again as hard.`);
    }
    const enemyStrike = () => {
      const em = pick(ENEMY_MOVES[enemy.type]);
      const stab = 1.2;
      const eff = effOf(em.t, SHIPS[fleet[active].key].type);
      let dmg = enemy.atk * em.pow * stab * eff * rf(0.85, 1.15);
      dmg *= 1 - armorRed(fleet[active]);
      if (hasRelic("bell")) dmg *= 0.95;
      if (enraged) dmg *= 1.5;
      if (braced) { dmg *= 0.5; braced = false; log.push("🛡 The braced timbers hold — the blow is halved!"); }
      dmg = Math.max(1, Math.round(dmg));
      fleet[active].hp = Math.max(0, fleet[active].hp - dmg);
      const effTxt = eff > 1 ? " A telling blow!" : eff < 1 ? " Your hull shrugs it off." : "";
      log.push(`${enemy.name} uses ${em.n} — ${dmg} damage.${effTxt}`);
      if (fleet[active].hp > 0) {
        if (g.voyage && g.voyage.blessing === "saltward") {
          if (em.status) log.push("🕯 The Saltward hisses — the ailment cannot take hold.");
        } else {
          const inf = tryInflict(pStatuses, em.status);
          pStatuses = inf.statuses;
          if (inf.line) log.push(`Your ship: ${inf.line}`);
        }
      }
    };
    const eTangled = enemy.statuses.some((s) => s.k === "tangled");
    if (eTangled && Math.random() < STATUS.tangled.skip) {
      log.push(`🪢 ${enemy.name} founders in its own tangled lines!`);
    } else if (smoked && Math.random() < 0.6) {
      smoked = false;
      log.push(`🌫 ${enemy.name} fires blind into the smoke — nothing but spray!`);
    } else {
      if (smoked) smoked = false;
      enemyStrike();
      // legends strike twice as often as not
      if (enemy.isBoss && fleet[active].hp > 0 && Math.random() < 0.5) {
        log.push(`⚔ ${enemy.name} comes about with impossible speed — a second strike!`);
        enemyStrike();
      }
    }

    // -- player status ticks --
    if (fleet[active].hp > 0) {
      const t = tickStatuses(pStatuses, maxHpOf(fleet[active], g.level));
      fleet[active].hp = Math.max(0, fleet[active].hp - t.dmg);
      pStatuses = t.next;
      t.lines.forEach((l) => log.push(`Your ship: ${l}`));
    }

    // -- sinking / fleet as lives --
    if (fleet[active].hp <= 0) {
      const sunk = fleet[active];
      fleet = fleet.filter((_, i) => i !== active);
      if (fleet.length === 0) {
        setG((s) => ({
          ...s, fleet: [], shipsLost: s.shipsLost + 1, over: true, screen: "gameover",
          battle: { ...b, log: [...b.log, ...log, `The ${sunk.name} slips beneath the waves…`] },
        }));
        return;
      }
      active = 0;
      const newCap = capOf(fleet, g.holdBonus);
      const cargo = trimCargo(g.cargo, newCap);
      crew = Math.min(crew, crewCap(fleet));
      log.push(`💥 The ${sunk.name} goes down! Survivors scramble aboard the ${fleet[0].name} — the fight goes on!`);
      pStatuses = [];
      setG((s) => ({
        ...s, fleet, active, cargo, crew, shipsLost: s.shipsLost + 1,
        voyage: s.voyage ? { ...s.voyage, tookHit: true, lostCargo: true } : s.voyage,
        battle: { ...b, enemy, pStatuses, gunner: gunnerUsed, braced, smoked, log: [...b.log, ...log].slice(-9) },
      }));
      return;
    }

    const hurt = fleet[active].hp < g.fleet[g.active].hp;
    setG((s) => ({
      ...s, fleet, active,
      voyage: hurt && s.voyage ? { ...s.voyage, tookHit: true } : s.voyage,
      battle: { ...b, enemy, pStatuses, gunner: gunnerUsed, braced, smoked, log: [...b.log, ...log].slice(-9) },
    }));
  };

  const useAbility = (ab) => {
    const b = g.battle;
    if (!b || b.phase !== "player" || b.used[ab.k] || g.crew < ab.need) return;
    let patch = { used: { ...b.used, [ab.k]: true } };
    let log = [];
    let fleet = g.fleet;
    let goldGain = 0;
    if (ab.k === "powdermonkeys") {
      const inf = tryInflict(b.enemy.statuses, { k: "ablaze", ch: b.enemy.isBoss ? 0.35 : 0.7 });
      patch.enemy = { ...b.enemy, statuses: inf.statuses };
      log.push(inf.line
        ? `🔥 The powder monkeys scramble the rigging and rain firepots — ${b.enemy.name} is Ablaze!`
        : `🔥 Firepots burst across ${b.enemy.name}'s deck, but the flames don't catch.`);
    }
    if (ab.k === "sailmaster") {
      patch.smoked = true;
      log.push("🌬 The Sailmaster reads a gust no one else sees — the enemy will likely fire at empty water.");
    }
    if (ab.k === "quartermaster") {
      goldGain = 20 * b.enemy.lvl;
      log.push(`💰 The Quartermaster's gang strips ${gold$(goldGain)} from their very deck mid-fight!`);
    }
    if (ab.k === "chaplain") {
      const heal = Math.round(sMaxHp * 0.5);
      fleet = g.fleet.map((sh, i) => (i === g.active ? { ...sh, hp: Math.min(sMaxHp, sh.hp + heal) } : sh));
      log.push(`✠ The Chaplain's hymn rises over the guns — +${heal} hull as every hand finds new strength.`);
    }
    if (ab.k === "carpenter") {
      const heal = Math.round(sMaxHp * 0.3);
      fleet = g.fleet.map((sh, i) => (i === g.active ? { ...sh, hp: Math.min(sMaxHp, sh.hp + heal) } : sh));
      log.push(`🔨 The carpenter's gang patches ${heal} hull.`);
    }
    if (ab.k === "gunner") { patch.gunner = true; log.push("🎯 The Master Gunner sights the next shot — it will strike twice as hard."); }
    if (ab.k === "bosun") {
      patch.pStatuses = [];
      const heal = Math.round(sMaxHp * 0.1);
      fleet = g.fleet.map((sh, i) => (i === g.active ? { ...sh, hp: Math.min(sMaxHp, sh.hp + heal) } : sh));
      log.push(`🧭 The Bosun clears fouled lines and fire alike. +${heal} hull.`);
    }
    setG((s) => ({ ...s, fleet, gold: s.gold + goldGain, battle: { ...b, ...patch, log: [...b.log, ...log].slice(-9) } }));
  };

  const tryFlee = () => {
    const b = g.battle;
    if (!b || b.phase !== "player") return;
    if (b.pStatuses.some((s) => s.k === "tangled")) {
      setG((s) => ({ ...s, battle: { ...b, log: [...b.log, "🪢 Tangled rigging! There is no running from this."].slice(-9) } }));
      return;
    }
    if (g.voyage && g.voyage.blessing === "witchwind" && !g.voyage.blessUsed) {
      setG((s) => ({
        ...s,
        voyage: { ...s.voyage, blessUsed: true },
        battle: { ...b, phase: "fled", log: [...b.log, "🕯 The Witchwind fills your sails from nowhere — you are simply gone."].slice(-9) },
      }));
      return;
    }
    const ch = clamp(0.35 + ship.sails * 0.08 + (SHIPS[ship.key].spd - b.enemy.spd) * 0.03 + (hasRelic("chart") ? 0.08 : 0), 0.1, 0.92);
    if (Math.random() < ch) {
      setG((s) => ({ ...s, battle: { ...b, phase: "fled", log: [...b.log, "You crowd on sail and slip away into the haze!"].slice(-9) } }));
    } else {
      // failed flee: enemy free hit
      let fleet = g.fleet.map((sh) => ({ ...sh }));
      const em = pick(ENEMY_MOVES[b.enemy.type]);
      let dmg = Math.max(1, Math.round(b.enemy.atk * em.pow * rf(0.85, 1.1) * (1 - armorRed(fleet[g.active]))));
      fleet[g.active].hp = Math.max(0, fleet[g.active].hp - dmg);
      if (fleet[g.active].hp <= 0) {
        const sunk = fleet[g.active];
        fleet = fleet.filter((_, i) => i !== g.active);
        if (fleet.length === 0) {
          setG((s) => ({ ...s, fleet: [], shipsLost: s.shipsLost + 1, over: true, screen: "gameover", battle: b }));
          return;
        }
        const cargo = trimCargo(g.cargo, capOf(fleet, g.holdBonus));
        setG((s) => ({
          ...s, fleet, active: 0, cargo, crew: Math.min(s.crew, crewCap(fleet)), shipsLost: s.shipsLost + 1,
          voyage: s.voyage ? { ...s.voyage, tookHit: true, lostCargo: true } : s.voyage,
          battle: { ...b, pStatuses: [], log: [...b.log, `Escape fails — ${em.n} rakes you for ${dmg}! The ${sunk.name} is lost; the ${fleet[0].name} takes up the fight!`].slice(-9) },
        }));
        return;
      }
      setG((s) => ({ ...s, fleet, voyage: s.voyage ? { ...s.voyage, tookHit: true } : s.voyage, battle: { ...b, log: [...b.log, `No luck — ${b.enemy.name} rakes your stern for ${dmg} as you turn!`].slice(-9) } }));
    }
  };

  const finishVictory = (enemy, log) => {
    // loot
    const plunder = (g.voyage && g.voyage.blessing === "plunderer" ? 1.5 : 1) * (hasRelic("idol") ? 1.1 : 1) * (g.hardMode ? 1.25 : 1);
    const goldLoot = Math.round((30 + enemy.lvl * 15 + ri(0, 30)) * plunder);
    const lootLines = [`Salvage: +${goldLoot}g`];
    let bountyGold = 0;
    if (enemy.isBounty && g.bounty) {
      bountyGold = g.bounty.reward;
      lootLines.unshift(`🏴 The bounty on ${enemy.name} is yours: +${gold$(bountyGold)}`);
    }
    if (enemy.isBoss) {
      const bossGold = enemy.reward || g.level * 100;
      bountyGold += bossGold;
      lootLines.unshift(`👑 ${enemy.name} is broken — the taverns will sing of this. +${gold$(bossGold)}`);
    }
    let cargo = { ...g.cargo };
    let gold = g.gold + goldLoot;
    if (Math.random() < 0.55) {
      const good = pick(GOODS);
      const q = Math.min(ri(1, 3), capOf(g.fleet, g.holdBonus) - cargoCount(cargo));
      if (q > 0) { cargo[good.k] = (cargo[good.k] || 0) + q; lootLines.push(`${q}× ${good.n} pulled from the wreck`); }
    }
    if (Math.random() < 0.12) {
      const relic = 300 + enemy.lvl * 40;
      gold += relic; lootLines.push(`✨ A golden idol in the captain's chest! +${relic}g`);
    }
    // xp
    const xpGain = 18 * enemy.lvl + 10;
    lootLines.push(`+${xpGain} xp`);
    let xp = g.xp + xpGain;
    let level = g.level;
    const lvlLines = [];
    while (xp >= xpNeed(level)) { xp -= xpNeed(level); level += 1; lvlLines.push(`⭐ Your legend grows — Level ${level}!`); }
    setG((s) => ({
      ...s, gold: gold + bountyGold, cargo, xp, level, battlesWon: s.battlesWon + 1,
      bounty: enemy.isBounty ? null : s.bounty,
      bountiesClaimed: enemy.isBounty ? (s.bountiesClaimed || 0) + 1 : s.bountiesClaimed,
      bossCooldownUntil: enemy.isBoss ? s.day + 8 : s.bossCooldownUntil,
      battle: { ...s.battle, enemy: { ...enemy, hp: 0 }, phase: "won", log: [...s.battle.log, ...log, `${enemy.name} strikes its colors!`, ...lvlLines].slice(-9), loot: lootLines },
    }));
  };

  const parley = (choice) => {
    const b = g.battle;
    const cost = 600 + b.enemy.lvl * 50;
    if (choice === "fight") setG((s) => ({ ...s, battle: { ...b, phase: "player", log: [...b.log, "You run out the guns. So be it."] } }));
    if (choice === "ally") {
      if (g.gold < cost) {
        setG((s) => ({ ...s, battle: { ...b, log: [...b.log, `The envoy scoffs — you lack the ${cost}g for the treaty.`] } }));
        return;
      }
      setG((s) => ({
        ...s, gold: s.gold - cost, allies: { ...s.allies, [b.enemy.nation]: true },
        battle: { ...b, phase: "allied", log: [...b.log, `Papers signed and sealed — ${NATIONS[b.enemy.nation]} now counts you a friend of the crown. Their patrols will guard, not hunt.`] },
      }));
    }
    if (choice === "flee") {
      const ch = clamp(0.5 + ship.sails * 0.08, 0.2, 0.9);
      if (Math.random() < ch) {
        setG((s) => ({ ...s, battle: { ...b, phase: "fled", log: [...b.log, "You show them your heels before the guns are even run out!"] } }));
      } else {
        setG((s) => ({ ...s, battle: { ...b, phase: "player", log: [...b.log, "They cut you off — the fight is joined!"] } }));
      }
    }
  };

  const battleDone = () => {
    setG((s) => ({
      ...s,
      screen: s.battle && s.battle.fromPort ? "port" : "voyage",
      bossCooldownUntil: s.battle && s.battle.fromPort && s.battle.phase === "fled"
        ? Math.max(s.bossCooldownUntil, s.day + 3) : s.bossCooldownUntil,
      battle: null,
    }));
  };

  /* =========================================================
     UI PIECES
     ========================================================= */
  const Seal = ({ t, small }) => (
    <span className={`seal ${small ? "small" : ""}`} style={{ background: TYPES[t].seal }} title={TYPES[t].n}>
      {TYPES[t].sym}<span className="sealTxt">{TYPES[t].n}</span>
    </span>
  );

  const HpBar = ({ hp, max, mine }) => (
    <div className="hpWrap">
      <div className="hpBar">
        <div className={`hpFill ${hp / max < 0.3 ? "low" : mine ? "mine" : ""}`} style={{ width: `${clamp((hp / max) * 100, 0, 100)}%` }} />
      </div>
      <span className="hpTxt">{hp}/{max}</span>
    </div>
  );

  const StatusRow = ({ list }) => (
    <div className="statusRow">
      {list.map((s, i) => <span key={i} className="statusChip">{STATUS[s.k].sym} {STATUS[s.k].n} {s.turns}</span>)}
    </div>
  );

  const Header = () => (
    <div className="hud">
      <div className="hudTop">
        <span className="hudGold">◉ {gold$(g.gold)}</span>
        <span>Day {g.day}</span>
        <span>Lv {g.level} <em className="xpNum">{g.xp}/{xpNeed(g.level)} xp</em></span>
        <span className="hudSave">{saveNote}</span>
      </div>
      <div className="xpBar"><div className="xpFill" style={{ width: `${(g.xp / xpNeed(g.level)) * 100}%` }} /></div>
      <div className="hudSub">
        <span>{ship ? `${ship.name} (${SHIPS[ship.key].n})` : "—"}</span>
        <span>Hull {ship ? `${ship.hp}/${sMaxHp}` : "—"}</span>
        <span>Hold {held}/{cap}</span>
        <span>Crew {g.crew}/{cCap}</span>
        <span className="flags">
          {Object.keys(NATIONS).map((n) => g.allies[n] ? <em key={n} title={`Allied with ${NATIONS[n]}`}>⚑{NATIONS[n][0]}</em> : null)}
        </span>
      </div>
    </div>
  );

  /* ---------------- SCREENS ---------------- */

  const routeRef = useRef(null);
  useEffect(() => {
    if (g.event && g.event.kind === "route" && routeRef.current) {
      routeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [g.event]);

  const MapView = () => {
    const sel = g.event && g.event.kind === "route" ? g.event.dest : null;
    return (
    <div className="panel">
      <h2>Chart a Course</h2>
      <svg viewBox="0 0 100 100" className="map">
        <defs>
          <radialGradient id="sea" cx="50%" cy="45%" r="80%">
            <stop offset="0%" stopColor="#2E5B68" /><stop offset="100%" stopColor="#1B3E4A" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#sea)" rx="2" />
        {/* faint chart grid */}
        {[20, 40, 60, 80].map((v) => (
          <g key={v} stroke="#D9C89E" strokeWidth="0.15" opacity="0.18">
            <line x1="0" y1={v} x2="100" y2={v} /><line x1={v} y1="0" x2={v} y2="100" />
          </g>
        ))}
        {/* landmasses — sepia parchment */}
        <g fill="#C9B689" stroke="#8A7347" strokeWidth="0.4">
          {/* Florida tip */}
          <path d="M2,2 L10,2 Q11,6 8,10 Q5,12 3,9 Z" />
          {/* Cuba */}
          <path d="M4,20 Q10,15 20,16 Q28,17 32,22 Q30,26 24,25 Q14,24 8,26 Q4,25 4,20 Z" />
          {/* Bahamas chain */}
          <ellipse cx="32" cy="7" rx="1.4" ry="0.7" /><ellipse cx="37" cy="12" rx="1.1" ry="0.6" />
          <ellipse cx="41" cy="16" rx="1" ry="0.6" /><ellipse cx="44" cy="20" rx="0.9" ry="0.5" />
          {/* Jamaica */}
          <ellipse cx="24" cy="47" rx="4.5" ry="2" />
          {/* Hispaniola (Tortuga off its north coast) */}
          <path d="M38,38 Q44,34 52,36 Q56,38 54,42 Q48,45 42,44 Q37,42 38,38 Z" />
          {/* Puerto Rico */}
          <rect x="57" y="39.5" width="7" height="3.2" rx="1.4" />
          {/* Lesser Antilles arc */}
          <ellipse cx="70" cy="38" rx="1" ry="0.6" /><ellipse cx="75" cy="41" rx="1" ry="0.7" />
          <ellipse cx="79" cy="45" rx="1.1" ry="0.7" /><ellipse cx="82" cy="50" rx="1.2" ry="0.8" />
          <ellipse cx="85" cy="58" rx="1.6" ry="1" /><ellipse cx="83" cy="65" rx="1.2" ry="0.8" />
          {/* Curaçao */}
          <ellipse cx="62" cy="74" rx="2" ry="0.9" />
          {/* Spanish Main — South American coast */}
          <path d="M0,96 Q10,88 22,90 Q28,86 36,88 Q46,84 56,86 Q70,82 82,86 Q92,84 100,88 L100,100 L0,100 Z" />
        </g>
        {/* wave flourishes */}
        <g stroke="#D9C89E" strokeWidth="0.3" fill="none" opacity="0.3">
          <path d="M10,66 q2,-1.5 4,0 q2,1.5 4,0" /><path d="M46,58 q2,-1.5 4,0 q2,1.5 4,0" />
          <path d="M70,20 q2,-1.5 4,0 q2,1.5 4,0" /><path d="M14,36 q2,-1.5 4,0 q2,1.5 4,0" />
        </g>
        {/* sea monster doodle — "here be dragons" */}
        <g stroke="#D9C89E" strokeWidth="0.4" fill="none" opacity="0.4">
          <path d="M50,66 q3,-4 6,0 q3,4 6,0 q3,-4 6,0" />
          <circle cx="50" cy="65" r="0.8" fill="#D9C89E" />
        </g>
        {/* compass rose */}
        <g opacity="0.6" transform="translate(90,12)" stroke="#D9C89E" fill="none" strokeWidth="0.4">
          <circle r="5.5" /><circle r="2.5" opacity="0.6" />
          <path d="M0,-7.5 L1.3,0 L0,7.5 L-1.3,0 Z" fill="#D9C89E" stroke="none" />
          <path d="M-7.5,0 L0,1.3 L7.5,0 L0,-1.3 Z" fill="#D9C89E" stroke="none" opacity="0.7" />
          <text y="-8.5" textAnchor="middle" style={{ fontSize: "3px", fill: "#D9C89E" }} stroke="none">N</text>
        </g>
        {/* faint lanes to all ports */}
        {PORTS.map((p) => p.k !== g.port && (
          <line key={"l" + p.k} x1={PORT[g.port].x} y1={PORT[g.port].y} x2={p.x} y2={p.y}
            stroke="#E7D9B4" strokeWidth="0.3" strokeDasharray="1.2 1.8" opacity="0.25" />
        ))}
        {/* bold course to the selected port */}
        {sel && (
          <line x1={PORT[g.port].x} y1={PORT[g.port].y} x2={PORT[sel].x} y2={PORT[sel].y}
            stroke="#C8A24A" strokeWidth="0.9" strokeDasharray="2.2 1.6" />
        )}
        {PORTS.map((p) => (
          <g key={p.k} onClick={() => p.k !== g.port && setG((s) => ({ ...s, event: { kind: "route", dest: p.k } }))}
            style={{ cursor: p.k === g.port ? "default" : "pointer" }}>
            {p.k === sel && <circle cx={p.x} cy={p.y} r="4" fill="none" stroke="#C8A24A" strokeWidth="0.7" />}
            <circle cx={p.x} cy={p.y} r={p.k === g.port ? 2.6 : 2.1}
              fill={p.k === g.port ? "#C8A24A" : p.k === sel ? "#E8C56A" : "#E7D9B4"} stroke="#2B2113" strokeWidth="0.4" />
            <text x={p.x} y={p.y - 3.6} textAnchor="middle" className="mapLabel">{p.n}{g.rumor && g.rumor.port === p.k ? " ✦" : ""}</text>
          </g>
        ))}
      </svg>
      {!sel && <p className="hint">Tap a port to plot a course. ⚑ gold marks your harbor.</p>}
      {sel && (
        <div className="routeCard" ref={routeRef}>
          <h3>{PORT[g.port].n} → {PORT[sel].n}</h3>
          <div className="routeOpts">
            <button className="btn safe" onClick={() => setSail(sel, false)}>
              <b>Trade Lanes</b><span>{routeDays(g.port, sel, false)} days · calm waters · wages {gold$(g.crew * routeDays(g.port, sel, false))}</span>
            </button>
            <button className="btn risky" onClick={() => setSail(sel, true)}>
              <b>Smuggler's Run</b><span>{routeDays(g.port, sel, true)} days · dangerous · richer prizes · wages {gold$(g.crew * routeDays(g.port, sel, true))}</span>
            </button>
          </div>
          <p className="hint">The long way is safer; the short way pays.</p>
        </div>
      )}
    </div>
    );
  };

  const Market = () => (
    <div className="panel">
      {g.rumor && <p className="rumorNote">🗺 Rumor: {GOOD[g.rumor.good].n} at {PORT[g.rumor.port].n} — until day {g.rumor.expires}</p>}
      <table className="tbl">
        <thead><tr><th>Good</th><th>Price</th><th>Held</th><th colSpan="2"></th></tr></thead>
        <tbody>
          {GOODS.map((gd) => {
            const price = g.prices[gd.k];
            const rel = price / gd.base;
            return (
              <tr key={gd.k}>
                <td>{gd.n}</td>
                <td className={rel < 0.85 ? "cheap" : rel > 1.2 ? "dear" : ""}>{price}g {rel < 0.85 ? "▾" : rel > 1.2 ? "▴" : ""}</td>
                <td>{g.cargo[gd.k] || 0}</td>
                <td><button className="mini" onClick={() => buyGood(gd.k, 1)}>Buy</button>
                    <button className="mini" onClick={() => buyGood(gd.k, 99)}>Max</button></td>
                <td><button className="mini sell" onClick={() => sellGood(gd.k, 1)}>Sell</button>
                    <button className="mini sell" onClick={() => sellGood(gd.k, 99)}>All</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">▾ below the usual rate — buy. ▴ above it — sell. Every port favors different goods.</p>
    </div>
  );

  const Shipyard = () => (
    <div className="panel">
      <div className="yardPortrait">
        <ShipArt kind="ship" tier={SHIPS[ship.key].tier} faction="player" armor={ship.armor} cannons={ship.cannons} sails={ship.sails} size={190} />
        <p className="hint">The {ship.name} — plating, gun ports, and canvas change as you refit her.</p>
      </div>
      <h3>Refit the {ship.name}</h3>
      {[["armor", "Armor Plating", "-7% damage taken each rank"], ["cannons", "Gun Batteries", "+10% attack each rank"], ["sails", "Cut Sails", "+8% escape chance each rank"]].map(([k, n, d]) => {
        const lvl = ship[k]; const cost = Math.round(250 * (lvl + 1) * SHIPS[ship.key].tier * repDisc);
        return (
          <div className="row" key={k}>
            <div><b>{n}</b> <span className="pips">{"●".repeat(lvl)}{"○".repeat(5 - lvl)}</span><br /><span className="hint">{d}</span></div>
            <button className="btn slim" disabled={lvl >= 5 || g.gold < cost} onClick={() => buyUpgrade(k)}>
              {lvl >= 5 ? "Mastered" : gold$(cost)}
            </button>
          </div>
        );
      })}
      <div className="row">
        <div><b>Careen & Repair</b><br /><span className="hint">{repDisc < 1 ? `${Math.round(2 * repDisc * 10) / 10}g` : "2g"} per point of hull</span></div>
        <button className="btn slim" disabled={ship.hp >= sMaxHp} onClick={repairShip}>{ship.hp >= sMaxHp ? "Sound" : `Mend (${gold$(Math.ceil((sMaxHp - ship.hp) * 2 * repDisc))})`}</button>
      </div>
      {(() => {
        const cost = fleetUpgradeCost();
        if (cost.total <= 0) return <p className="hint" style={{ marginTop: 8 }}>Every ship in your fleet is fully mastered and sound of hull — nothing left to do.</p>;
        return confirmFleet ? (
          <div className="evCard" style={{ marginTop: 8 }}>
            <p className="flavor">Do you want to upgrade all for your fleet? One rank of armor, guns, and sails for every ship{g.fleet.length > 1 ? ` (${g.fleet.length} ships)` : ""}, and every hull mended to full — <b>{gold$(cost.total)}</b>{cost.mending > 0 && cost.upgrades > 0 ? ` (${gold$(cost.upgrades)} refits + ${gold$(cost.mending)} mending)` : ""}.</p>
            <div className="diceRow">
              <button className="btn slim" disabled={g.gold < cost.total} onClick={upgradeFleet}>Aye — refit them all</button>
              <button className="btn slim danger2" onClick={() => setConfirmFleet(false)}>Belay that</button>
            </div>
            {g.gold < cost.total && <p className="hint">You're {gold$(cost.total - g.gold)} short.</p>}
          </div>
        ) : (
          <button className="btn wide" style={{ marginTop: 8 }} onClick={() => setConfirmFleet(true)}>
            ⚒ Refit & mend the whole fleet <span>+1 rank of everything, every hull to full · {gold$(cost.total)}</span>
          </button>
        );
      })()}

      <h3>The Gunnery Master</h3>
      <p className="hint">New maneuvers for your gun crews and topmen. You may carry <b>four</b> into battle — set your Battle Plan below.</p>
      {Object.entries(MOVES).filter(([k, m]) => m.cost && !(g.ownedMoves || []).includes(k)).map(([k, m]) => {
        const r = shopRange(m);
        return (
          <div className="row" key={k}>
            <div>
              <b>{m.n}</b> {m.defense ? <span className="seal small" style={{ background: "#5A5245" }}>🛡<span className="sealTxt">Defense</span></span> : <Seal t={m.t} small />}
              {r && <span className="dmgRange" style={{ display: "inline", marginLeft: 6 }}>{r.lo}–{r.hi} dmg</span>}
              {m.status && <span className="hint"> · {Math.round(m.status.ch * 100)}% {STATUS[m.status.k].n}</span>}
              {m.status2 && <span className="hint"> · {Math.round(m.status2.ch * 100)}% {STATUS[m.status2.k].n}</span>}
              {m.selfStatus && <span className="hint dear"> · {Math.round(m.selfStatus.ch * 100)}% self-{STATUS[m.selfStatus.k].n}</span>}
              <br /><span className="hint">{m.desc}</span>
            </div>
            <button className="btn slim" disabled={g.gold < m.cost} onClick={() => buyMove(k)}>{gold$(m.cost)}</button>
          </div>
        );
      })}
      {Object.entries(MOVES).filter(([k, m]) => m.cost && !(g.ownedMoves || []).includes(k)).length === 0 && (
        <p className="hint">Every maneuver known to the Indies is already yours.</p>
      )}

      <h3>Battle Plan</h3>
      <button className="btn slim" style={{ marginBottom: 6 }} onClick={equipBest}>⚙ Equip the best</button>
      <p className="hint">{swapSel ? `Tap a slot to swap in ${MOVES[swapSel].n}.` : "Your four battle moves. Tap a benched maneuver, then the slot to replace. Damage shown is against a neutral foe — the type triangle adds +50% or takes a third away."}</p>
      <div className="planRow">
        {(g.loadout || STARTER_MOVES).map((mk, i) => (
          <button key={i} className={`planSlot ${swapSel ? "target" : ""}`} onClick={() => swapInto(i)}>
            <span className="planNum">{i + 1}</span>
            <b>{MOVES[mk].n}</b>
            <span className="hint">{MOVES[mk].defense ? "Defense" : `${TYPES[MOVES[mk].t].n} · ${shopRange(MOVES[mk]).lo}–${shopRange(MOVES[mk]).hi} dmg`}</span>
          </button>
        ))}
      </div>
      <div className="benchRow">
        {(g.ownedMoves || STARTER_MOVES).filter((k) => !(g.loadout || STARTER_MOVES).includes(k)).map((k) => (
          <button key={k} className={`mini bench ${swapSel === k ? "picked" : ""}`} onClick={() => setSwapSel(swapSel === k ? null : k)}>
            {MOVES[k].n}
          </button>
        ))}
        {(g.ownedMoves || STARTER_MOVES).filter((k) => !(g.loadout || STARTER_MOVES).includes(k)).length === 0 && (
          <span className="hint">No benched maneuvers — buy more from the Gunnery Master.</span>
        )}
      </div>

      <h3>Ships for Purchase</h3>
      {Object.entries(SHIPS).filter(([k]) => k !== "sloop").map(([k, s]) => (
        <div className="row" key={k}>
          <div className="fleetArt"><ShipArt kind="ship" tier={s.tier} faction="player" size={78} /></div>
          <div style={{ flex: 1 }}><b>{s.n}</b> <Seal t={s.type} small /><br />
            <span className="hint">Hull {s.hp} · Hold {s.cargo} · Crew {s.crew} · Atk {s.atk}</span></div>
          <button className="btn slim" disabled={g.gold < s.cost} onClick={() => buyShip(k)}>{gold$(s.cost)}</button>
        </div>
      ))}
    </div>
  );

  const Tavern = () => (
    <div className="panel">
      <h3>The Salted Anchor</h3>
      <div className="row">
        <div><b>Hire hands</b><br /><span className="hint">{crewPrice}g each · 1g per head per day at sea · crew {g.crew}/{cCap}</span></div>
        <div>
          <button className="btn slim" disabled={g.crew >= cCap || g.gold < crewPrice} onClick={() => hireCrew(1)}>+1</button>{" "}
          <button className="btn slim" disabled={g.crew >= cCap || g.gold < crewPrice} onClick={() => hireCrew(5)}>+5</button>
        </div>
      </div>
      <h3>Ship's Company</h3>
      {ABILITIES.map((ab) => (
        <div className="row" key={ab.k}>
          <div><b className={g.crew >= ab.need ? "" : "locked"}>{ab.n}</b><br /><span className="hint">{ab.desc}</span></div>
          <span className={g.crew >= ab.need ? "unlocked" : "locked"}>{g.crew >= ab.need ? "Aboard" : `${ab.need} crew`}</span>
        </div>
      ))}

      <h3>Rumors over Rum</h3>
      {g.rumor ? (
        <p className="rumorNote">🗺 Word is <b>{GOOD[g.rumor.good].n}</b> will fetch a fortune at <b>{PORT[g.rumor.port].n}</b> — good until day {g.rumor.expires}. The port is starred on your chart.</p>
      ) : (
        <div className="row">
          <div><b>Buy a round, hear the talk</b><br /><span className="hint">20g · learn where a good will spike in price</span></div>
          <button className="btn slim" disabled={g.gold < 20} onClick={buyRumor}>20g</button>
        </div>
      )}

      <h3>Dice with the Bosun's Mate</h3>
      <p className="hint">Ship, Captain & Crew — find a 6, a 5, and a 4 in three throws; the last two dice are your cargo. High cargo takes the pot, even money.</p>
      <div className="diceRow">
        {[10, 25, 50, 100].map((b) => (
          <button key={b} className="btn slim" disabled={g.gold < b} onClick={() => playDice(b)}>Bet {b}g</button>
        ))}
      </div>
      {diceResult && <p className="flavor diceOut">{diceResult}</p>}

      <h3>The Sea Witch's Hut</h3>
      {g.blessing ? (
        <p className="rumorNote">🕯 <b>{BLESSINGS[g.blessing].n}</b> is upon your ship — it will spend itself on your next voyage.</p>
      ) : (
        Object.entries(BLESSINGS).map(([k, bl]) => (
          <div className="row" key={k}>
            <div><b>{bl.n}</b><br /><span className="hint">{bl.desc}</span></div>
            <button className="btn slim" disabled={g.gold < bl.cost} onClick={() => buyBlessing(k)}>{gold$(bl.cost)}</button>
          </div>
        ))
      )}
    </div>
  );

  const FleetView = () => (
    <div className="panel">
      {g.fleet.map((sh, i) => (
        <div className={`row shipRow ${i === g.active ? "flag" : ""}`} key={i}>
          <div className="fleetArt"><ShipArt kind="ship" tier={SHIPS[sh.key].tier} faction="player" armor={sh.armor} cannons={sh.cannons} sails={sh.sails} size={86} /></div>
          <div style={{ flex: 1 }}>
            <b>{sh.name}</b> — {SHIPS[sh.key].n} <Seal t={SHIPS[sh.key].type} small />
            <HpBar hp={sh.hp} max={maxHpOf(sh, g.level)} mine />
            <span className="hint">Armor {sh.armor} · Guns {sh.cannons} · Sails {sh.sails}</span>
          </div>
          {i === g.active ? <span className="unlocked">⚑ Flagship</span> :
            <button className="btn slim" onClick={() => setFlagship(i)}>Lead</button>}
        </div>
      ))}
      <p className="hint">Your flagship fights. If she sinks, the next ship takes up the battle — a fleet is your lives.</p>
      <button className="btn danger" onClick={resetGame}>Scuttle everything & start anew</button>
    </div>
  );

  const buyMove = (k) => {
    const m = MOVES[k];
    if (!m.cost || g.gold < m.cost || (g.ownedMoves || []).includes(k)) return;
    setG((s) => ({ ...s, gold: s.gold - m.cost, ownedMoves: [...(s.ownedMoves || STARTER_MOVES), k] }));
  };

  const [swapSel, setSwapSel] = useState(null);
  const equipBest = () => {
    const owned = g.ownedMoves || STARTER_MOVES;
    const mid = (k) => {
      const m = MOVES[k];
      if (m.defense) return 0;
      const stab = SHIPS[ship.key].type === m.t ? 1.2 : 1;
      return atkOf(ship, g.level) * powOf(m, g.crew) * stab;
    };
    // best damaging move of each type for full triangle coverage
    const picks = [];
    ["cannon", "ram", "boarding"].forEach((t) => {
      const best = owned.filter((k) => !MOVES[k].defense && MOVES[k].t === t)
        .sort((a, b) => mid(b) - mid(a))[0];
      if (best) picks.push(best);
    });
    // fourth slot: sustain first (rally > brace > smokescreen), else next-hardest hitter
    const defPref = ["rally", "brace", "smokescreen"].find((k) => owned.includes(k));
    if (defPref && picks.length < 4) picks.push(defPref);
    owned.filter((k) => !picks.includes(k) && !MOVES[k].defense)
      .sort((a, b) => mid(b) - mid(a))
      .forEach((k) => { if (picks.length < 4) picks.push(k); });
    if (picks.length === 4) {
      setG((s) => ({ ...s, loadout: picks }));
      setSwapSel(null);
    }
  };
  const [modAmt, setModAmt] = useState("1000");
  const [confirmFleet, setConfirmFleet] = useState(false);
  const fleetUpgradeCost = () => {
    let upgrades = 0, mending = 0;
    g.fleet.forEach((sh) => {
      ["armor", "cannons", "sails"].forEach((st) => {
        if (sh[st] < 5) upgrades += Math.round(250 * (sh[st] + 1) * SHIPS[sh.key].tier * repDisc);
      });
      const missing = maxHpOf(sh, g.level) - sh.hp;
      if (missing > 0) mending += Math.ceil(missing * 2 * repDisc);
    });
    return { upgrades, mending, total: upgrades + mending };
  };
  const upgradeFleet = () => {
    const cost = fleetUpgradeCost();
    if (cost.total <= 0 || g.gold < cost.total) return;
    setG((s) => ({
      ...s,
      gold: s.gold - cost.total,
      fleet: s.fleet.map((sh) => {
        const next = {
          ...sh,
          armor: Math.min(5, sh.armor + 1),
          cannons: Math.min(5, sh.cannons + 1),
          sails: Math.min(5, sh.sails + 1),
        };
        return { ...next, hp: maxHpOf(next, s.level) };
      }),
    }));
    setConfirmFleet(false);
  };
  const modGold = (n) => setG((s) => ({ ...s, gold: Math.max(0, s.gold + n) }));
  const modLevel = (n) => {
    const newLevel = Math.max(1, g.level + n);
    const newBounty = g.bounty
      ? { ...g.bounty, lvl: newLevel + ri(1, 3), reward: 200 + (newLevel + 2) * 60 }
      : null;
    setG((s) => ({
      ...s,
      level: newLevel, xp: 0,
      jobs: genJobs(s.port, newLevel),
      bounty: newBounty,
    }));
  };
  const swapInto = (slotIdx) => {
    if (!swapSel) return;
    setG((s) => {
      const lo = [...(s.loadout || STARTER_MOVES)];
      lo[slotIdx] = swapSel;
      return { ...s, loadout: lo };
    });
    setSwapSel(null);
  };

  const challengeBoss = () => {
    if (g.day < g.bossCooldownUntil) return;
    const def = pick(BOSSES);
    const lvl = g.level + 2 + (g.hardMode ? 1 : 0);
    const tierBase = ENEMIES[def.cat][2];
    const hardHp = g.hardMode ? 1.2 : 1;
    const hardAtk = g.hardMode ? 1.15 : 1;
    const boss = {
      cat: def.cat, nation: null, lvl, tier: 2,
      name: def.name, type: def.type, spd: def.spd,
      maxHp: Math.round(tierBase.hp * (1 + 0.12 * lvl) * 1.4 * hardHp),
      hp: Math.round(tierBase.hp * (1 + 0.12 * lvl) * 1.4 * hardHp),
      atk: tierBase.atk * (1 + 0.09 * lvl) * 1.15 * hardAtk,
      statuses: [], isBoss: true, reward: Math.round(g.level * 100 * (g.hardMode ? 1.25 : 1)),
    };
    setG((s) => ({
      ...s,
      screen: "battle",
      battle: {
        enemy: boss, phase: "player", fromPort: true,
        log: [`You sail out beyond the harbor mouth. ${boss.name} (Lv ${lvl}) rises to meet you.`],
        used: {}, gunner: false, pStatuses: [], loot: null, braced: false, smoked: false,
      },
    }));
  };

  const acceptBounty = () => setG((s) => ({ ...s, bounty: s.bounty ? { ...s.bounty, accepted: true } : null }));

  /* ---- tavern: rumors, dice, sea witch ---- */
  const buyRumor = () => {
    if (g.gold < 20 || g.rumor) return;
    const port = pick(PORTS.filter((p) => p.k !== g.port)).k;
    const good = pick(GOODS).k;
    const rumor = { port, good, mult: rf(1.7, 2.1), expires: g.day + 18 };
    setG((s) => ({ ...s, gold: s.gold - 20, rumor }));
  };

  const buyBlessing = (k) => {
    const bl = BLESSINGS[k];
    if (g.gold < bl.cost || g.blessing) return;
    setG((s) => ({ ...s, gold: s.gold - bl.cost, blessing: k }));
  };

  const rollSCC = () => {
    // Ship (6), Captain (5), Crew (4) claimed in order over 3 rolls; leftovers are cargo
    let need = ["6", "5", "4"]; let cargo = [];
    for (let round = 0; round < 3; round++) {
      const diceCount = need.length > 0 ? 5 - (3 - need.length) : 2;
      let dice = Array.from({ length: diceCount }, () => ri(1, 6));
      // claim in strict order
      for (const target of [...need]) {
        const idx = dice.indexOf(Number(target));
        if (idx >= 0) { dice.splice(idx, 1); need = need.filter((t) => t !== target); }
        else break;
      }
      if (need.length === 0) {
        if (cargo.length === 0 || dice.reduce((a, b) => a + b, 0) > cargo.reduce((a, b) => a + b, 0)) {
          if (dice.length === 2) cargo = dice;
        }
        if (cargo.reduce((a, b) => a + b, 0) >= 10) break; // stand on a strong hand
      }
    }
    const qualified = need.length === 0 && cargo.length === 2;
    return { qualified, cargo: qualified ? cargo[0] + cargo[1] : 0 };
  };

  const [diceResult, setDiceResult] = useState(null);
  const playDice = (bet) => {
    if (g.gold < bet) return;
    const you = rollSCC();
    const mate = rollSCC();
    let outcome, delta;
    if (!you.qualified && !mate.qualified) { outcome = "Neither of you finds Ship, Captain, and Crew — coins slide back across the table."; delta = 0; }
    else if (!you.qualified) { outcome = `You never find your Ship. The mate shows ${mate.cargo} cargo and sweeps the pot.`; delta = -bet; }
    else if (!mate.qualified) { outcome = `Ship, Captain & Crew with ${you.cargo} cargo — the mate busts! The table roars.`; delta = bet; }
    else if (you.cargo > mate.cargo) { outcome = `Your ${you.cargo} cargo beats the mate's ${mate.cargo}. The pot is yours!`; delta = bet; }
    else if (you.cargo < mate.cargo) { outcome = `Your ${you.cargo} cargo falls to the mate's ${mate.cargo}. He grins around his pipe.`; delta = -bet; }
    else { outcome = `Dead even at ${you.cargo} cargo apiece — a push.`; delta = 0; }
    setDiceResult(outcome);
    if (delta !== 0) setG((s) => ({ ...s, gold: s.gold + delta, diceNet: (s.diceNet || 0) + delta }));
  };

  const JobsBoard = () => (
    <div className="panel">
      {g.bounty && (
        <div className="wanted">
          <div className="wantedHead">WANTED</div>
          <b className="wantedName">{g.bounty.name}</b>
          <span className="hint">Pirate, Lv {g.bounty.lvl} · last seen in the waters off {PORT[g.bounty.dest].n}</span>
          <div className="wantedPay">Reward: {gold$(g.bounty.reward)}</div>
          {g.bounty.accepted
            ? <p className="contract">🏴 Hunt underway — sail for {PORT[g.bounty.dest].n} and they will find you.</p>
            : <button className="btn wide" onClick={acceptBounty}>Take the contract</button>}
        </div>
      )}
      <div className="trialCard">
        <h3 style={{ marginTop: 0 }}>⚔ Trial of the Deep</h3>
        <p className="flavor">Beyond the harbor mouth, a legend of the sea waits for any captain bold enough to seek it — matched to your strength (it will meet you at Lv {g.level + 2 + (g.hardMode ? 1 : 0)}{g.hardMode ? ", hardened by the season" : ""}).</p>
        <p className="hint">Legends strike twice as often as not, shrug off half of all ailments, and turn savage below a third of their hull. Victory pays <b>{g.hardMode ? "125g" : "100g"} per level</b> — {gold$(Math.round(g.level * 100 * (g.hardMode ? 1.25 : 1)))} at Lv {g.level} — atop the usual spoils. Retreat and they withdraw for 3 days.</p>
        {g.day < g.bossCooldownUntil ? (
          <p className="contract">The legends have withdrawn to the deep — return in {g.bossCooldownUntil - g.day} days.</p>
        ) : (
          <button className="btn wide" onClick={challengeBoss}>Sail out and face it</button>
        )}
      </div>
      <h3>The Harbormaster's Board</h3>
      <p className="hint">Freight contracts pay the full fee when you sign — enough to cover wages when the purse runs dry. Deliver without battle damage or lost cargo and the client adds 25% on arrival.</p>
      {(g.jobs || []).map((j, i) => (
        <div className="jobCard" key={i}>
          <div className="jobTop">
            <b>{j.flavor}</b>
            <span className="jobPay">{gold$(j.pay)} up front · +{gold$(Math.round(j.pay * 0.25))} bonus</span>
          </div>
          <span className="hint">Deliver to {PORT[j.dest].n} · {routeDays(g.port, j.dest, false)}d by the lanes, {routeDays(g.port, j.dest, true)}d by the run</span>
          <div className="routeOpts">
            <button className="btn safe slimRoute" onClick={() => setSail(j.dest, false, j)}>
              <b>Sign & take the Trade Lanes</b><span>wages {gold$(g.crew * routeDays(g.port, j.dest, false))}</span>
            </button>
            <button className="btn risky slimRoute" onClick={() => setSail(j.dest, true, j)}>
              <b>Sign & risk the Smuggler's Run</b><span>wages {gold$(g.crew * routeDays(g.port, j.dest, true))}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const CaptainsLog = () => {
    const shipValue = (sh) => (SHIPS[sh.key].cost || 800) + 125 * (sh.armor + sh.cannons + sh.sails) * SHIPS[sh.key].tier;
    const fleetValue = g.fleet.reduce((s, sh) => s + shipValue(sh), 0);
    const cargoValue = Object.entries(g.cargo).reduce((s, [k, q]) => s + GOOD[k].base * q, 0);
    const netWorth = g.gold + fleetValue + cargoValue;
    const cleanRate = g.jobsDone ? Math.round((g.cleanDeliveries / g.jobsDone) * 100) : null;
    return (
      <div className="panel">
        <h3>Modes</h3>
        <div className="row">
          <div><b>Easy Mode</b><br /><span className="hint">Pirates sail with lighter hulls and lighter guns.</span></div>
          <button className={`mini toggle ${g.easyMode ? "on" : ""}`} onClick={() => setG((s) => ({ ...s, easyMode: !s.easyMode, hardMode: s.easyMode ? s.hardMode : false }))}>{g.easyMode ? "On" : "Off"}</button>
        </div>
        <div className="row">
          <div><b>Hard Mode</b><br /><span className="hint">Every foe: +20% hull, +15% guns, +1 level. One extra encounter every voyage. Battle gold +25%.</span></div>
          <button className={`mini toggle ${g.hardMode ? "hardOn" : ""}`} onClick={() => setG((s) => ({ ...s, hardMode: !s.hardMode, easyMode: s.hardMode ? s.easyMode : false }))}>{g.hardMode ? "On" : "Off"}</button>
        </div>
        <div className="row">
          <div><b>Mod Mode</b><br /><span className="hint">Reveals the Quartermaster's Override below.</span></div>
          <button className={`mini toggle ${g.modMode ? "on" : ""}`} onClick={() => setG((s) => ({ ...s, modMode: !s.modMode }))}>{g.modMode ? "On" : "Off"}</button>
        </div>

        <h3>The Ledger</h3>
        <div className="row"><span>Day at sea</span><b>{g.day}</b></div>
        <div className="row"><span>Captain's level</span><b>{g.level} ({g.xp}/{xpNeed(g.level)} xp)</b></div>
        <div className="row"><span>Purse</span><b>{gold$(g.gold)}</b></div>
        <div className="row"><span>Fleet value</span><b>{gold$(fleetValue)}</b></div>
        <div className="row"><span>Cargo value (base rates)</span><b>{gold$(cargoValue)}</b></div>
        <div className="row"><span>Net worth</span><b className="worth">{gold$(netWorth)}</b></div>

        <h3>Service Record</h3>
        <div className="row"><span>Crossings completed</span><b>{g.trips || 0}</b></div>
        <div className="row"><span>Battles won</span><b>{g.battlesWon}</b></div>
        <div className="row"><span>Ships lost</span><b>{g.shipsLost}</b></div>
        <div className="row"><span>Bounties claimed</span><b>{g.bountiesClaimed || 0}</b></div>
        <div className="row"><span>Contracts delivered</span><b>{g.jobsDone || 0}{cleanRate !== null ? ` (${cleanRate}% clean)` : ""}</b></div>
        <div className="row"><span>Fortunes at dice</span><b className={g.diceNet > 0 ? "cheap" : g.diceNet < 0 ? "dear" : ""}>{g.diceNet >= 0 ? "+" : ""}{gold$(g.diceNet || 0)}</b></div>

        <h3>Souvenirs of the Deep — {(g.relics || []).length}/{Object.keys(RELICS).length}</h3>
        <div className="relicGrid">
          {Object.entries(RELICS).map(([k, r]) => (
            <div key={k} className={`relicSlot ${(g.relics || []).includes(k) ? "have" : ""}`}>
              <span className="relicSym">{(g.relics || []).includes(k) ? r.sym : "?"}</span>
              <b>{(g.relics || []).includes(k) ? r.n : "Undiscovered"}</b>
              <span className="hint">{(g.relics || []).includes(k) ? r.desc : "Somewhere on the open sea…"}</span>
            </div>
          ))}
        </div>

        <h3>Recent Voyages</h3>
        {(g.history || []).length === 0 && <p className="hint">No crossings logged yet.</p>}
        {(g.history || []).map((h, i) => (
          <div className="row" key={i}>
            <span>{PORT[h.from].n} → {PORT[h.to].n}</span>
            <span className="hint">{h.risky ? "the Run" : "the Lanes"} · day {h.day}</span>
          </div>
        ))}

        <h3>Price Memory</h3>
        <p className="hint">Last rates seen at each harbor. Old numbers drift — trust recent entries.</p>
        <div className="memWrap">
          <table className="tbl mem">
            <thead><tr><th>Port</th>{GOODS.map((gd) => <th key={gd.k}>{gd.n.slice(0, 4)}</th>)}<th>Day</th></tr></thead>
            <tbody>
              {PORTS.map((p) => {
                const seen = (g.pricesSeen || {})[p.k];
                return (
                  <tr key={p.k} className={p.k === g.port ? "memHere" : ""}>
                    <td>{p.n}</td>
                    {GOODS.map((gd) => {
                      const v = p.k === g.port ? g.prices[gd.k] : seen ? seen.prices[gd.k] : null;
                      const rel = v ? v / gd.base : 1;
                      return <td key={gd.k} className={v ? (rel < 0.85 ? "cheap" : rel > 1.2 ? "dear" : "") : ""}>{v || "—"}</td>;
                    })}
                    <td className="hint">{p.k === g.port ? "now" : seen ? seen.day : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {g.modMode && (<>
        <h3 className="modHead">⚙ Quartermaster's Override</h3>
        <p className="hint">Mod tools — conjure or burn gold at will. No judgment from the crew.</p>
        <div className="diceRow">
          {[100, 1000, 10000, 100000].map((n) => (
            <button key={n} className="mini" onClick={() => modGold(n)}>+{n.toLocaleString()}g</button>
          ))}
          <button className="mini sell" onClick={() => modGold(-1000)}>-1,000g</button>
        </div>
        <div className="modRow">
          <input
            className="modInput" type="number" min="0" step="100"
            value={modAmt} onChange={(ev) => setModAmt(ev.target.value)}
          />
          <button className="btn slim" onClick={() => modGold(Math.round(Number(modAmt) || 0))}>Add</button>
          <button className="btn slim" onClick={() => setG((s) => ({ ...s, gold: Math.max(0, Math.round(Number(modAmt) || 0)) }))}>Set purse</button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Captain's level — no ceiling. Every level: +5% attack, +6% hull, and the seas scale up to meet you.</p>
        <div className="diceRow">
          {[1, 5, 25, 100].map((n) => (
            <button key={n} className="mini" onClick={() => modLevel(n)}>+{n} lvl</button>
          ))}
          <button className="mini sell" onClick={() => modLevel(-1)}>-1 lvl</button>
          <button className="mini sell" onClick={() => modLevel(3 - g.level)}>Reset to 3</button>
        </div>
        </>)}
      </div>
    );
  };

  const PortScreen = () => (
    <div>
      <div className="portHead">
        <h1>{PORT[g.port].n}</h1>
        <p className="portSub">A merchant's fortune waits on the tide{repTitle ? ` · ⚜ ${repTitle} here (${repDisc < 1 ? Math.round((1 - repDisc) * 100) + "% off refits & hands" : ""})` : ""}</p>
      </div>
      {g.notice && (
        <div className="notice">
          <span>{g.notice}</span>
          <button className="noticeX" onClick={() => setG((s) => ({ ...s, notice: null }))}>×</button>
        </div>
      )}
      <div className="tabs">
        {[["market", "Market"], ["jobs", "Jobs"], ["map", "Set Sail"], ["shipyard", "Shipyard"], ["tavern", "Tavern"], ["fleet", "Fleet"], ["log", "Log"]].map(([k, n]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => { setTab(k); if (k !== "map") setG((s) => ({ ...s, event: null })); }}>{n}</button>
        ))}
      </div>
      {tab === "market" && <Market />}
      {tab === "jobs" && <JobsBoard />}
      {tab === "log" && <CaptainsLog />}
      {tab === "map" && <MapView />}
      {tab === "shipyard" && <Shipyard />}
      {tab === "tavern" && <Tavern />}
      {tab === "fleet" && <FleetView />}
    </div>
  );

  const VoyageScreen = () => {
    const v = g.voyage;
    const done = v.total - v.checksLeft;
    const ev = g.event;
    return (
      <div className="panel voyage">
        <h2>Bound for {PORT[v.dest].n}</h2>
        <p className="hint">{v.risky ? "The Smuggler's Run — eyes sharp." : "The trade lanes — steady as she goes."}</p>
        {v.blessing && !v.blessUsed && (
          <p className="contract">🕯 {BLESSINGS[v.blessing].n} rides with you</p>
        )}
        {v.job && (
          <p className={`contract ${v.tookHit || v.lostCargo ? "spoiled" : ""}`}>
            📜 Contract: {v.job.flavor} → {PORT[v.dest].n}
            {v.tookHit || v.lostCargo ? " — bonus forfeit" : ` — +${gold$(Math.round(v.job.pay * 0.25))} if delivered clean`}
          </p>
        )}
        <div className="legDots">
          {Array.from({ length: v.total + 1 }).map((_, i) => (
            <span key={i} className={`dot ${i <= done ? "past" : ""} ${i === v.total ? "portDot" : ""}`}>{i === v.total ? "⚓" : "•"}</span>
          ))}
        </div>
        {!ev && (
          <button className="btn wide" onClick={rollEncounter}>{v.checksLeft > 0 ? "Sail on ▸" : `Make port at ${PORT[v.dest].n} ⚓`}</button>
        )}
        {ev && ev.kind === "relic" && (
          <div className="evCard relicCard">
            <h3>{RELICS[ev.relic].sym} A treasure of the deep!</h3>
            <p className="flavor">Tangled in wreckage on the swell — the <b>{RELICS[ev.relic].n}</b>. {RELICS[ev.relic].desc}, from this day forward.</p>
            <p className="hint">Souvenirs collected: {(g.relics || []).length} of {Object.keys(RELICS).length}</p>
            <button className="btn wide" onClick={() => setG((s) => ({ ...s, event: null }))}>Stow it in the great cabin ▸</button>
          </div>)}
        {ev && ev.kind === "calm" && (<div className="evCard"><p className="flavor">{ev.text}</p><button className="btn wide" onClick={() => setG((s) => ({ ...s, event: null }))}>Sail on ▸</button></div>)}
        {ev && ev.kind === "resolved" && (<div className="evCard"><p className="flavor">{ev.text}</p><button className="btn wide" onClick={() => setG((s) => ({ ...s, event: null }))}>Sail on ▸</button></div>)}
        {ev && ev.kind === "storm" && (
          <div className="evCard"><h3>⛈ A squall bears down!</h3>
            <p className="flavor">Black clouds swallow the horizon. The bosun looks to you.</p>
            {held > 0 && <button className="btn wide" onClick={() => resolveEvent("jettison")}>Jettison 2 crates of cargo</button>}
            <button className="btn wide risky" onClick={() => resolveEvent("brave")}>Ride it out (hull damage)</button>
          </div>)}
        {ev && ev.kind === "dolphins" && (
          <div className="evCard friendly"><h3>🐬 A dolphin pod surfaces alongside</h3>
            <p className="flavor">They leap and wheel, then turn as one — inviting you to follow.</p>
            <button className="btn wide" onClick={() => resolveEvent("follow")}>Follow them</button>
          </div>)}
        {ev && ev.kind === "turtle" && (
          <div className="evCard friendly"><h3>🐢 The Sea Turtle Elder rises</h3>
            <p className="flavor">Barnacled and vast, older than any chart. It eyes your hold with ancient patience.</p>
            {held > 0 && <button className="btn wide" onClick={() => resolveEvent("trade")}>Offer a crate of goods</button>}
            <button className="btn wide" onClick={() => resolveEvent("decline")}>Bow and sail on</button>
          </div>)}
        {ev && ev.kind === "convoy" && (
          <div className="evCard friendly"><h3>⛵ A friendly merchant convoy</h3>
            <p className="flavor">They'll part with {GOOD[ev.good].n} at {ev.price}g the crate — well under the market.</p>
            <button className="btn wide" onClick={() => resolveEvent("buy")}>Buy up to 3 crates</button>
            <button className="btn wide" onClick={() => resolveEvent("decline")}>Decline</button>
          </div>)}
        {ev && ev.kind === "alliedNavy" && (
          <div className="evCard friendly"><h3>⚑ An allied {NATIONS[ev.nation]} squadron</h3>
            <p className="flavor">Colors dip in salute as they come alongside.</p>
            <button className="btn wide" onClick={() => resolveEvent("hail")}>Come alongside</button>
          </div>)}
      </div>
    );
  };

  const BattleScreen = () => {
    const b = g.battle;
    const e = b.enemy;
    return (
      <div className="panel battle">
        <div className="combatant enemy">
          <div className="cInfo">
            <div className="cHead"><b>{e.name}</b> <span className="lvl">Lv {e.lvl}</span> <Seal t={e.type} small /></div>
            <HpBar hp={e.hp} max={e.maxHp} />
            <StatusRow list={e.statuses} />
          </div>
          <div className={`artBox ${e.hp <= 0 ? "sunk" : ""}`}><ShipArt {...enemyArt(e)} flip size={118} /></div>
        </div>
        <div className="logBox">
          {b.log.map((l, i) => <p key={i} className={i === b.log.length - 1 ? "logNew" : ""}>{l}</p>)}
        </div>
        {ship && (
          <div className="combatant mineC">
            <div className="artBox"><ShipArt kind="ship" tier={SHIPS[ship.key].tier} faction="player" armor={ship.armor} cannons={ship.cannons} sails={ship.sails} size={118} /></div>
            <div className="cInfo">
              <div className="cHead"><b>{ship.name}</b> <span className="lvl">Lv {g.level}</span> <Seal t={SHIPS[ship.key].type} small /></div>
              <HpBar hp={ship.hp} max={sMaxHp} mine />
              <StatusRow list={b.pStatuses} />
            </div>
          </div>
        )}
        {b.phase === "parley" && (
          <div className="moves">
            <button className="btn wide" onClick={() => parley("fight")}>⚔ Run out the guns</button>
            <button className="btn wide" onClick={() => parley("ally")}>🤝 Offer alliance ({gold$(600 + e.lvl * 50)})</button>
            <button className="btn wide" onClick={() => parley("flee")}>💨 Crowd sail and run</button>
          </div>
        )}
        {b.phase === "player" && (
          <>
            <div className="moves grid2">
              {(g.loadout || STARTER_MOVES).map((mk) => {
                const m = { k: mk, ...MOVES[mk] };
                const r = moveRange(m, e, b.gunner);
                return (
                  <button key={m.k} className="moveBtn" onClick={() => doMove(m)}>
                    <span className="moveTop">{m.defense ? <span className="seal small" style={{ background: "#5A5245" }}>🛡<span className="sealTxt">Defense</span></span> : <Seal t={m.t} small />}{b.gunner && !m.defense ? " 🎯" : ""}</span>
                    <b>{m.n}</b>
                    {r ? (
                      <span className={`dmgRange ${r.eff > 1 ? "effUp" : r.eff < 1 ? "effDown" : ""}`}>
                        {r.lo}–{r.hi} dmg {r.eff > 1 ? "▲" : r.eff < 1 ? "▼" : ""}
                      </span>
                    ) : (
                      <span className="dmgRange">support</span>
                    )}
                    <span className="moveDesc">{m.status ? `${Math.round(m.status.ch * 100)}% ${STATUS[m.status.k].n}${m.status2 ? ` + ${Math.round(m.status2.ch * 100)}% ${STATUS[m.status2.k].n}` : ""}` : m.selfStatus ? `${Math.round(m.selfStatus.ch * 100)}% self-${STATUS[m.selfStatus.k].n}` : m.desc}</span>
                  </button>
                );
              })}
            </div>
            <div className="abilRow">
              {ABILITIES.filter((ab) => g.crew >= ab.need).map((ab) => (
                <button key={ab.k} className="mini abil" disabled={b.used[ab.k]} onClick={() => useAbility(ab)}>{ab.n}{b.used[ab.k] ? " ✓" : ""}</button>
              ))}
              <button className="mini flee" onClick={tryFlee}>Flee</button>
            </div>
          </>
        )}
        {b.phase === "won" && (
          <div className="evCard win"><h3>Victory!</h3>
            {b.loot && b.loot.map((l, i) => <p key={i} className="flavor">{l}</p>)}
            <button className="btn wide" onClick={battleDone}>Back to the helm ▸</button>
          </div>
        )}
        {(b.phase === "fled" || b.phase === "allied") && (
          <div className="evCard"><button className="btn wide" onClick={battleDone}>Back to the helm ▸</button></div>
        )}
      </div>
    );
  };

  const GameOver = () => (
    <div className="panel over">
      <h1>Lost with all hands</h1>
      <p className="flavor">The sea keeps what it takes. Word of your ventures spreads through every tavern in the Indies…</p>
      <div className="row"><span>Days at sea</span><b>{g.day}</b></div>
      <div className="row"><span>Level reached</span><b>{g.level}</b></div>
      <div className="row"><span>Battles won</span><b>{g.battlesWon}</b></div>
      <div className="row"><span>Final purse</span><b>{gold$(g.gold)}</b></div>
      <button className="btn wide" onClick={resetGame}>Begin a new venture ⚓</button>
    </div>
  );

  /* =========================================================
     RENDER
     ========================================================= */
  return (
    <div className="tw">
      <style>{CSS}</style>
      <div className="masthead">
        <span className="mastRule">✦ ✦ ✦</span>
        <h1 className="mastTitle">Tradewinds</h1>
        <p className="mastSub">A Merchant's Saga of the Caribbean Sea</p>
      </div>
      {!g.over && <Header />}
      {g.screen === "port" && !g.over && <PortScreen />}
      {g.screen === "voyage" && !g.over && <VoyageScreen />}
      {g.screen === "battle" && !g.over && g.battle && <BattleScreen />}
      {g.over && <GameOver />}
    </div>
  );
}

/* =========================================================
   STYLE — parchment chart, sepia ink, wax seals
   ========================================================= */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Alegreya:ital,wght@0,400;0,600;0,700;1,400&display=swap');

.tw { min-height: 100vh; padding: 14px 12px 60px;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(255,250,230,0.5), transparent 55%),
    radial-gradient(ellipse at 85% 90%, rgba(120,90,40,0.18), transparent 50%),
    linear-gradient(160deg, #EADDBC 0%, #E2D2A8 55%, #D6C295 100%);
  color: #2B2113; font-family: 'Alegreya', Georgia, serif; font-size: 16px; line-height: 1.45;
  max-width: 720px; margin: 0 auto; }
.tw * { box-sizing: border-box; }
.tw h1, .tw h2, .tw h3, .mastTitle { font-family: 'IM Fell English', Georgia, serif; font-weight: 400; letter-spacing: 0.01em; margin: 0 0 6px; }
.tw h2 { font-size: 24px; } .tw h3 { font-size: 19px; margin-top: 14px; }

.masthead { text-align: center; margin-bottom: 10px; }
.mastRule { color: #8E2F26; letter-spacing: 0.5em; font-size: 11px; }
.mastTitle { font-size: 40px; line-height: 1.05; margin: 2px 0 0; }
.mastSub { font-style: italic; color: #6B5738; margin: 0; font-size: 14px; }

.hud { border: 1.5px solid #6B5738; border-radius: 6px; background: rgba(255,250,235,0.55); padding: 8px 10px; margin-bottom: 12px; box-shadow: 0 1px 0 rgba(255,255,255,0.5) inset; }
.hudTop { display: flex; gap: 14px; align-items: baseline; font-weight: 700; }
.hudGold { color: #7A5A14; }
.hudSave { margin-left: auto; font-weight: 400; font-style: italic; font-size: 12px; color: #47694F; }
.xpNum { font-style: normal; font-weight: 400; font-size: 11.5px; color: #7A5A14; }
.xpBar { height: 4px; background: #D6C295; border-radius: 2px; margin: 6px 0; overflow: hidden; }
.xpFill { height: 100%; background: #C8A24A; }
.hudSub { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; color: #4A3B22; }
.flags em { font-style: normal; color: #47694F; font-weight: 700; margin-right: 4px; }

.portHead { text-align: center; margin: 2px 0 8px; }
.portHead h1 { font-size: 30px; }
.portSub { margin: -4px 0 0; font-style: italic; color: #6B5738; font-size: 13px; }

.tabs { display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap; }
.tab { flex: 1; min-width: 62px; padding: 8px 4px; font-family: 'IM Fell English', serif; font-size: 15px;
  background: transparent; border: 1.5px solid #6B5738; border-radius: 6px; color: #4A3B22; cursor: pointer; }
.tab.on { background: #2B2113; color: #EADDBC; border-color: #2B2113; }

.panel { border: 1.5px solid #6B5738; border-radius: 8px; background: rgba(255,250,235,0.5); padding: 14px; }

.tbl { width: 100%; border-collapse: collapse; }
.tbl th { font-family: 'IM Fell English', serif; font-weight: 400; text-align: left; border-bottom: 1px solid #6B5738; padding: 4px 2px; font-size: 14px; }
.tbl td { padding: 7px 2px; border-bottom: 1px dashed rgba(107,87,56,0.35); font-size: 15px; }
.cheap { color: #2F5D3A; font-weight: 700; } .dear { color: #8E2F26; font-weight: 700; }

.btn { font-family: 'Alegreya', serif; font-size: 15px; border: 1.5px solid #2B2113; border-radius: 6px;
  background: #2B2113; color: #EADDBC; padding: 10px 14px; cursor: pointer; display: block; }
.btn:disabled { opacity: 0.4; cursor: default; }
.btn.slim { padding: 6px 12px; display: inline-block; }
.btn.wide { width: 100%; margin-top: 8px; font-size: 16px; }
.btn.danger { background: transparent; color: #8E2F26; border-color: #8E2F26; margin-top: 14px; width: 100%; }
.btn b { display: block; font-family: 'IM Fell English', serif; font-size: 17px; font-weight: 400; }
.btn span { display: block; font-size: 12.5px; opacity: 0.85; }
.mini { border: 1px solid #6B5738; background: transparent; color: #2B2113; border-radius: 5px; padding: 4px 9px; margin: 1px 2px; cursor: pointer; font-family: 'Alegreya', serif; font-size: 13px; }
.mini.sell { border-color: #8E2F26; color: #8E2F26; }
.mini:disabled { opacity: 0.35; }

.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px dashed rgba(107,87,56,0.35); }
.row:last-of-type { border-bottom: none; }
.hint { font-size: 13px; font-style: italic; color: #6B5738; }
.pips { color: #7A5A14; letter-spacing: 2px; font-size: 12px; }
.locked { color: #A08D66; } .unlocked { color: #2F5D3A; font-weight: 700; }
.shipRow.flag { background: rgba(200,162,74,0.12); border-radius: 6px; padding-left: 8px; padding-right: 8px; }

.map { width: 100%; border-radius: 6px; border: 2px solid #2B2113; display: block; box-shadow: 0 3px 10px rgba(43,33,19,0.3); }
.mapLabel { font-size: 3.2px; fill: #EADDBC; font-family: Georgia, serif; letter-spacing: 0.05em; paint-order: stroke; stroke: rgba(30,50,58,0.8); stroke-width: 0.6px; }
.routeCard { margin-top: 10px; border: 1.5px solid #6B5738; border-radius: 8px; padding: 12px; background: rgba(255,250,235,0.7); }
.routeOpts { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 6px; }
.btn.safe { background: #274F5B; border-color: #274F5B; }
.btn.risky { background: #8E2F26; border-color: #8E2F26; }

.voyage h2 { text-align: center; }
.legDots { text-align: center; font-size: 22px; letter-spacing: 10px; color: #A08D66; margin: 10px 0; }
.dot.past { color: #2B2113; } .portDot { font-size: 18px; }
.evCard { border: 1.5px solid #6B5738; border-radius: 8px; padding: 12px; margin-top: 10px; background: rgba(255,250,235,0.75); }
.evCard.friendly { border-color: #47694F; }
.evCard.win { border-color: #7A5A14; background: rgba(200,162,74,0.15); }
.flavor { font-style: italic; color: #4A3B22; margin: 6px 0; }

.battle { padding: 12px; }
.combatant { border: 1.5px solid #6B5738; border-radius: 8px; padding: 10px 12px; background: rgba(255,250,235,0.7); display: flex; align-items: center; gap: 8px; }
.cInfo { flex: 1; min-width: 0; }
.artBox { flex-shrink: 0; }
.artBox.sunk { opacity: 0.35; filter: grayscale(0.6); }
.shipArt { display: block; }
.yardPortrait { text-align: center; padding-bottom: 6px; border-bottom: 1px dashed rgba(107,87,56,0.35); }
.yardPortrait .shipArt { margin: 0 auto; }
.fleetArt { flex-shrink: 0; }
.combatant.enemy { border-color: #8E2F26; }
.combatant.mineC { border-color: #274F5B; margin-top: 8px; }
.cHead { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.lvl { font-size: 12px; border: 1px solid #6B5738; border-radius: 10px; padding: 1px 7px; color: #4A3B22; }

.seal { display: inline-flex; align-items: center; gap: 4px; color: #EADDBC; border-radius: 10px; padding: 2px 8px; font-size: 12px; font-family: 'Alegreya', serif; box-shadow: 0 1px 2px rgba(43,33,19,0.4); }
.seal.small { padding: 1px 6px; font-size: 11px; }
.sealTxt { letter-spacing: 0.03em; }

.hpWrap { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.hpBar { flex: 1; height: 10px; background: #D6C295; border: 1px solid #6B5738; border-radius: 5px; overflow: hidden; }
.hpFill { height: 100%; background: #8E2F26; transition: width 0.4s ease; }
.hpFill.mine { background: #2F5D3A; }
.hpFill.low { background: #B4471E; }
.hpTxt { font-size: 12.5px; min-width: 56px; text-align: right; color: #4A3B22; }
.statusRow { margin-top: 5px; min-height: 4px; }
.statusChip { font-size: 12px; border: 1px dashed #8E2F26; border-radius: 10px; padding: 1px 7px; margin-right: 5px; color: #8E2F26; }

.logBox { margin: 8px 0; padding: 8px 12px; min-height: 74px; max-height: 150px; overflow-y: auto;
  border-left: 3px solid #C8A24A; background: rgba(43,33,19,0.05); font-style: italic; font-size: 14px; }
.logBox p { margin: 3px 0; color: #4A3B22; }
.logBox p.logNew { color: #2B2113; font-weight: 600; }

.moves { margin-top: 10px; }
.moves.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.moveBtn { border: 1.5px solid #2B2113; border-radius: 8px; background: rgba(255,250,235,0.85); padding: 8px 10px; cursor: pointer; text-align: left; font-family: 'Alegreya', serif; color: #2B2113; }
.moveBtn:active { transform: translateY(1px); }
.moveBtn b { font-family: 'IM Fell English', serif; font-weight: 400; font-size: 16px; display: block; margin-top: 3px; }
.moveTop { display: block; }
.moveDesc { font-size: 11.5px; color: #6B5738; display: block; }
.dmgRange { display: block; font-size: 13px; font-weight: 700; color: #4A3B22; margin: 1px 0; }
.dmgRange.effUp { color: #2F5D3A; }
.dmgRange.effDown { color: #8E2F26; }
.abilRow { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.mini.abil { border-color: #47694F; color: #2F5D3A; }
.mini.flee { border-color: #274F5B; color: #274F5B; margin-left: auto; }

.notice { display: flex; align-items: center; gap: 8px; border: 1.5px solid #7A5A14; background: rgba(200,162,74,0.18); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 14px; }
.noticeX { margin-left: auto; background: none; border: none; font-size: 18px; color: #6B5738; cursor: pointer; line-height: 1; }
.jobCard { border: 1.5px solid #6B5738; border-radius: 8px; padding: 10px 12px; margin-top: 10px; background: rgba(255,250,235,0.7); }
.jobTop { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.jobTop b { font-family: 'IM Fell English', serif; font-weight: 400; font-size: 17px; }
.jobPay { color: #7A5A14; font-weight: 700; font-size: 13.5px; }
.jobCard .routeOpts { margin-top: 8px; }
.btn.slimRoute { padding: 7px 12px; }
.btn.slimRoute b { font-size: 15px; }
.contract { text-align: center; font-size: 14px; color: #7A5A14; border: 1px dashed #7A5A14; border-radius: 6px; padding: 5px 8px; }
.contract.spoiled { color: #8E2F26; border-color: #8E2F26; }
.rumorNote { border: 1px dashed #7A5A14; border-radius: 6px; padding: 7px 10px; font-size: 14px; background: rgba(200,162,74,0.12); }
.diceRow { display: flex; gap: 6px; flex-wrap: wrap; }
.diceOut { border-left: 3px solid #C8A24A; padding-left: 10px; }
.wanted { border: 2px solid #2B2113; border-radius: 4px; padding: 12px; text-align: center; background: rgba(255,250,235,0.85); margin-bottom: 12px; box-shadow: 3px 3px 0 rgba(43,33,19,0.2); }
.wantedHead { font-family: 'IM Fell English', serif; font-size: 22px; letter-spacing: 0.35em; border-bottom: 1.5px solid #2B2113; padding-bottom: 4px; margin-bottom: 6px; }
.wantedName { font-family: 'IM Fell English', serif; font-size: 20px; display: block; }
.wantedPay { color: #8E2F26; font-weight: 700; margin: 6px 0; font-size: 16px; }
.relicCard { border-color: #7A5A14; background: rgba(200,162,74,0.18); }
.relicGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.relicSlot { border: 1.5px dashed #A08D66; border-radius: 8px; padding: 8px; text-align: center; }
.relicSlot.have { border-style: solid; border-color: #7A5A14; background: rgba(200,162,74,0.12); }
.relicSlot b { display: block; font-size: 13.5px; }
.relicSlot .hint { font-size: 11.5px; display: block; }
.relicSym { font-size: 22px; display: block; }
.worth { color: #7A5A14; }
.memWrap { overflow-x: auto; }
.tbl.mem { font-size: 12.5px; min-width: 520px; }
.tbl.mem td, .tbl.mem th { padding: 4px 3px; }
.memHere td { background: rgba(200,162,74,0.12); }
.planRow { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
.planSlot { border: 1.5px solid #2B2113; border-radius: 8px; background: rgba(255,250,235,0.85); padding: 7px 9px; text-align: left; cursor: pointer; font-family: 'Alegreya', serif; color: #2B2113; position: relative; }
.planSlot.target { border-color: #7A5A14; box-shadow: 0 0 0 2px rgba(200,162,74,0.5); }
.planSlot b { font-family: 'IM Fell English', serif; font-weight: 400; display: block; font-size: 15px; }
.planNum { position: absolute; top: 4px; right: 8px; font-size: 11px; color: #A08D66; }
.planSlot .hint { font-size: 11px; }
.benchRow { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.mini.bench { border-color: #2B2113; padding: 5px 10px; }
.mini.bench.picked { background: #2B2113; color: #EADDBC; }
.mini.toggle { min-width: 52px; }
.mini.toggle.on { background: #2F5D3A; border-color: #2F5D3A; color: #EADDBC; }
.mini.toggle.hardOn { background: #8E2F26; border-color: #8E2F26; color: #EADDBC; }
.btn.danger2 { background: transparent; color: #8E2F26; border-color: #8E2F26; }
.trialCard { border: 2px solid #274F5B; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: rgba(39,79,91,0.08); }
.modHead { color: #6B5738; }
.modRow { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.modInput { font-family: 'Alegreya', serif; font-size: 15px; padding: 8px 10px; border: 1.5px solid #6B5738; border-radius: 6px; background: rgba(255,250,235,0.85); color: #2B2113; width: 120px; }
.over { text-align: center; }
.over h1 { font-size: 32px; color: #8E2F26; }
.over .row { text-align: left; }

@media (prefers-reduced-motion: reduce) { .hpFill { transition: none; } }
`;
