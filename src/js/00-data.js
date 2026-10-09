/* Clean rebuild: immutable game definitions and card/art data. */
const CHARACTERS = {
  "Exorcist": {img:"./assets/embedded/d106eea5-50272.webp", subtitle:"Demon Slayer", rituals:[
    {n:"Cast Into Hell",m:0,b:3,h:"Deal 6 damage to a Demon or Boss.",f:"Deal 10 damage. If a normal Demon is defeated, its negative defeat ability does not trigger.",kind:"castHell"},
    {n:"Sever the Unholy",m:0,b:2,h:"Turn up to 2 Greater Demons back into their Lesser forms. If none exist, deal 4 damage to any target.",f:"Turn up to 2 Greater Demons back into their Lesser forms, then deal 4 damage to each. If none exist, deal 6 damage to any target.",kind:"severUnholy"},
    {n:"Final Exorcism",m:0,b:4,h:"Deal 5 damage to a Demon or Boss; +4 damage if the target is a Greater Demon.",f:"Deal 10 damage to a Demon or Boss; +4 damage if the target is a Greater Demon.",kind:"finalExorcism"}
  ]},
  "Oracle": {img:"./assets/embedded/f029f4d7-55968.webp", subtitle:"Seer and Controller", rituals:[
    {n:"Vision of Fate",m:0,b:2,h:"Look at the top 5 Priest cards and add up to 2 to your hand.",f:"Look at the top 8 Priest cards and add up to 3 to your hand.",kind:"visionFate"},
    {n:"Foretold Death",m:0,b:2,h:"Mark a Demon or Boss. The next 2 damage sources against it each deal +5 damage.",f:"Mark a Demon or Boss. The next 2 damage sources against it each deal +8 damage.",kind:"foretoldDeath"},
    {n:"Rewrite Destiny",m:0,b:2,h:"Bank 2 Ritual rerolls. Any player may spend them after seeing future Ritual rolls.",f:"The next Ritual used this round automatically rolls an 18.",kind:"rewriteDestiny"}
  ]},
  "Crusader": {img:"./assets/embedded/0ff78dd0-50908.webp", subtitle:"Guardian of the Sanctum", rituals:[
    {n:"Smite",art:"./assets/embedded/c43b5c80-30024.webp",m:0,b:3,h:"Deal 6 damage to a Demon or Boss.",f:"Deal 11 damage to a Demon or Boss.",kind:"crusaderSmite"},
    {n:"Hold the Line",m:0,b:2,h:"Choose up to 2 Demons. They do not move this Demon Phase.",f:"Choose up to 2 rooms. All Demons there do not move this Demon Phase.",kind:"holdLine"},
    {n:"Martyr's Guard",m:0,b:2,h:"Restore 4 Altar Protection.",f:"Restore 6 Altar Protection and gain 2 Demon Blood.",kind:"martyrGuard"}
  ]},
  "High Priestess": {img:"./assets/embedded/876fc5af-52872.webp", subtitle:"Protector • Marking • Control", rituals:[
    {n:"Sacred Mark",m:0,b:2,h:"Mark a Demon or Boss. The next 2 damage sources against it each deal +4 damage.",f:"Mark a Demon or Boss. The next 3 damage sources against it each deal +4 damage.",kind:"sacredMark"},
    {n:"Divine Intervention",m:0,b:3,h:"Restore 5 Altar Protection.",f:"Restore 8 Altar Protection and gain 3 shared Mana.",kind:"divineIntervention"},
    {n:"Chains of Faith",m:0,b:2,h:"Move up to 2 different Demons back 1 room.",f:"Move up to 3 different Demons back 1 room.",kind:"chainsFaith"}
  ]},
  "Monk": {img:"./assets/embedded/7687d2a5-59728.webp", subtitle:"Mind-Bound Ascetic", rituals:[
    {n:"Palm of Judgment",m:0,b:3,h:"Deal 3 damage to a Demon or Boss. If a Demon is targeted, move it back up to 2 rooms if possible.",f:"Deal 7 damage to a Demon or Boss. If a Demon is targeted, move it back up to 2 rooms if possible.",kind:"palmJudgment"},
    {n:"Still the Wicked",m:0,b:2,h:"Choose up to 2 Demons. They do not move this Demon Phase.",f:"Choose up to 2 rooms. All Demons there do not move this Demon Phase.",kind:"stillWicked"},
    {n:"Inner Peace",m:0,b:2,h:"Gain 3 Demon Blood.",f:"Gain 4 Demon Blood and draw 2 Priest cards.",kind:"innerPeace"}
  ]},
  "Abbess": {img:"./assets/embedded/e95d771f-80184.webp", subtitle:"Mistress of Echoed Grace", rituals:[
    {n:"Echoed Grace",m:0,b:3,h:"Copy up to 2 Priest cards held by another player into your hand as temporary normal cards. Copies vanish when they leave your hand.",f:"Copy up to 2 Priest cards held by another player into your hand as temporary EMPOWERED • READY cards. Copies vanish when they leave your hand.",kind:"echoedGrace"},
    {n:"Sacred Rebuke",m:0,b:2,h:"Deal 5 damage to a Demon or Boss.",f:"Deal 9 damage to a Demon or Boss.",kind:"abbessRebuke"},
    {n:"Miracle of Unity",m:0,b:3,h:"Choose another player. They gain 3 Demon Blood.",f:"Choose another player. They gain 3 Demon Blood, then restore 4 Altar Protection.",kind:"miracleUnity"}
  ]}
};

const PRIEST = [
 {n:"Holy Bolt",m:2,e:"Deal 3 damage.",x:"Deal 7 damage.",k:"damage",v:3,xv:7},
 {n:"Radiant Spear",m:3,e:"Deal 4 damage.",x:"Deal 9 damage.",k:"damage",v:4,xv:9},
 {n:"Smite",m:1,e:"Deal 2 damage.",x:"Deal 5 damage.",k:"damage",v:2,xv:5},
 {n:"Judgment",m:4,e:"Deal 6 damage.",x:"Deal 14 damage.",k:"damage",v:6,xv:14},
 {n:"Dawnfire",m:3,e:"Deal 3 damage to up to 2 different Demon/Boss targets.",x:"Deal 7 damage to up to 2 different Demon/Boss targets.",k:"multiDamage",v:3,xv:7},
 {n:"Sacred Brand",m:2,e:"Mark a Demon; next attack +2.",x:"Mark a Demon; next attack +5.",k:"mark",v:2,xv:5},
 {n:"Sunburst",m:4,e:"Deal 5 damage to all Demons in one room.",x:"Deal 12 damage to all Demons in one room.",k:"roomDamage",v:5,xv:12},
 {n:"Purifying Flame",m:2,e:"Remove target Demon’s ability; deal 2 damage.",x:"Remove target Demon’s ability; deal 5 damage.",k:"purify",v:2,xv:5},
 {n:"Light of Truth",m:1,e:"Reveal the top 3 Demon cards. Choose 1 to banish to the Demon discard pile.",x:"Reveal the top 6 Demon cards. Choose 2 to banish to the Demon discard pile.",k:"peekDemon",v:3,xv:6,banish:1,xbanish:2},
 {n:"Divine Wrath",m:5,e:"Deal 7 damage.",x:"Deal 16 damage.",k:"damage",v:7,xv:16},
 {n:"Divine Shield",m:2,e:"Restore 2 Altar Protection. At the start of the next 2 Priest turns, restore 1 more.",x:"Restore 4 Altar Protection. At the start of the next 2 Priest turns, restore 3 more.",k:"altarTurnRenewal",v:2,xv:4,regen:1,xregen:3,ticks:2,xticks:2},
 {n:"Blessed Steel",m:3,e:"Deal 5 damage.",x:"Deal 12 damage.",k:"damage",v:5,xv:12},
 {n:"Sacred Nova",m:4,e:"Deal 4 damage to all Demons in one room.",x:"Deal 10 damage to all Demons in one room.",k:"roomDamage",v:4,xv:10},
 {n:"Holy Barrier",m:1,e:"Deal 1 damage to a Demon. Until the end of this round, prevent the next 2 Altar Protection loss.",x:"Deal 4 damage to a Demon. Until the end of this round, prevent the next 5 Altar Protection loss.",k:"altarBarrierDamage",v:1,xv:4,guard:2,xguard:5},
 {n:"Guardian Prayer",m:2,e:"Stop 1 Demon movement.",x:"Stop up to 3 different Demon movements.",k:"stop",v:1,xv:3},
 {n:"Shield of Faith",m:3,e:"Deal 3 damage to a Demon. The next 2 Demons defeated each restore 1 additional Altar Protection.",x:"Deal 7 damage to a Demon. The next 3 Demons defeated each restore 2 additional Altar Protection.",k:"altarDefeatBlessingDamage",v:3,xv:7,defeatHeal:1,xdefeatHeal:2,charges:2,xcharges:3},
 {n:"Circle of Protection",m:4,e:"Restore 3 Altar Protection. At the start of each of the next 2 rounds, restore 2 Altar Protection.",x:"Restore 6 Altar Protection. At the start of each of the next 3 rounds, restore 3 Altar Protection.",k:"altarRoundRenewal",v:3,xv:6,roundHeal:2,xroundHeal:3,rounds:2,xrounds:3},
 {n:"Last Rites",m:2,e:"If a Demon has 3 HP or less, defeat it.",x:"If a Demon has 7 HP or less, defeat it.",k:"execute",v:3,xv:7},
 {n:"Iron Faith",m:1,e:"Until the end of this round, prevent the next 2 Altar Protection loss.",x:"Until the end of this round, prevent the next 5 Altar Protection loss and draw 1 Priest card.",k:"iron",v:2,xv:5},
 {n:"Wrath of the Saints",m:5,e:"Deal 8 damage.",x:"Deal 18 damage.",k:"damage",v:8,xv:18},
 {n:"Mana Blessing",m:1,e:"Gain 2 shared Mana.",x:"Gain 5 shared Mana.",k:"mana",v:2,xv:5},
 {n:"Shared Faith",m:1,e:"Another player draws 1 card.",x:"Distribute 3 Priest card draws among other players; the same Priest may receive multiple draws.",k:"sharedDraw",v:1,xv:3},
 {n:"Quick Prayer",m:1,e:"Draw 1 Priest card.",x:"Draw 3 Priest cards.",k:"draw",v:1,xv:3},
 {n:"Consecration",m:3,e:"Choose 1: Restore 3 Altar Protection OR deal 3 damage to a Demon.",x:"Choose 1: Restore 7 Altar Protection OR deal 7 damage to a Demon.",k:"altarChoice",v:3,xv:7},
 {n:"Holy Echo",m:2,e:"Repeat the last successfully played non-Holy Echo Priest card using its normal effect.",x:"Repeat the last successfully played non-Holy Echo Priest card using its Empowered effect.",k:"echo",v:2,xv:3},
 {n:"Blood Tithe",m:1,e:"Drain 1 Demon Blood from target Demon. Gain that Blood.",x:"Drain 2 Demon Blood from target Demon. Gain that Blood.",k:"drainBlood",v:1,xv:2,eb:0},
 {n:"Crimson Siphon",m:2,e:"Drain 1 Demon Blood from target Demon. Draw 1 Priest card.",x:"Drain 2 Demon Blood from target Demon. Draw 3 Priest cards.",k:"drainBloodDraw",v:1,xv:2,draw:1,xdraw:3,eb:0},
 {n:"Leech Rite",m:2,e:"Drain 1 Demon Blood from target Demon. Gain 1 shared Mana.",x:"Drain 2 Demon Blood from target Demon. Gain 3 shared Mana.",k:"drainBloodMana",v:1,xv:2,manaGain:1,xmanaGain:3,eb:0},
 {n:"Essence Decanter",m:3,e:"Choose up to 2 Demons. Drain 1 Demon Blood from each. Gain that Blood.",x:"Choose up to 5 Demons. Drain 1 Demon Blood from each. Gain that Blood.",k:"multiDrainBlood",v:2,xv:5,eb:0},
 {n:"Mana Distillation",m:1,e:"Choose and convert up to 2 shared Mana into Demon Blood at 2 Mana per 1 Blood.",x:"Choose and convert up to 6 shared Mana into Demon Blood at 2 Mana per 1 Blood.",k:"manaToBlood",v:2,xv:6,eb:0},
 {n:"Altar Exchange",m:2,e:"Choose and convert up to 4 shared Mana into Demon Blood at 2 Mana per 1 Blood.",x:"Choose and convert up to 10 shared Mana into Demon Blood at 2 Mana per 1 Blood.",k:"manaToBlood",v:4,xv:10,eb:0},
 {n:"Sanguine Channel",m:2,e:"Choose and convert up to 6 shared Mana into Demon Blood at 2 Mana per 1 Blood.",x:"Choose and convert up to 12 shared Mana into Demon Blood at 2 Mana per 1 Blood.",k:"manaToBlood",v:6,xv:12,eb:0}
];

const DEMON_TYPES = [
 // DEMON SHEET 1 — Imps
 {key:"imp_lesser",family:"Imp",n:"Lesser Imp",g:"Greater Imp",hp:4,b:1,atk:1,ghp:12,gb:2,gatk:2,ability:"When this demon is defeated, gain 1 Blood.",gability:"When this demon is defeated, gain 2 Blood.",a:"defeatBlood",v:1,ga:"defeatBlood",gv:2,art:"./assets/embedded/6224178d-17708.webp",gart:"./assets/embedded/6224178d-17708.webp"},
 {key:"imp_fire",family:"Imp",n:"Fire Imp",g:"Inferno Imp",hp:5,b:2,atk:2,ghp:10,gb:4,gatk:3,ability:"If this demon reaches the Altar, it removes 1 additional Altar Protection.",gability:"If this demon reaches the Altar, it removes 2 additional Altar Protection.",a:"altarPlus",v:1,ga:"altarPlus",gv:2,art:"./assets/embedded/28229fd3-25784.webp",gart:"./assets/embedded/28229fd3-25784.webp"},
 {key:"imp_carrion",family:"Imp",n:"Carrion Imp",g:"Carrion Behemoth",hp:5,b:2,atk:2,ghp:11,gb:3,gatk:3,ability:"When this demon is defeated, the next demon in line moves forward 1 space.",gability:"When this demon is defeated, the next demon in line moves forward 2 spaces.",a:"defeatPush",v:1,ga:"defeatPush",gv:2,art:"./assets/embedded/cc48fc9c-22008.webp",gart:"./assets/embedded/cc8fd4a2-36184.webp"},
 {key:"imp_ruin",family:"Imp",n:"Ruin Imp",g:"Ruin Behemoth",hp:4,b:2,atk:2,ghp:9,gb:3,gatk:3,ability:"When this demon is defeated, the next demon in line deals +1 Altar damage if it reaches the Altar this round.",gability:"When this demon is defeated, the next demon in line deals +2 Altar damage if it reaches the Altar this round.",a:"defeatRuin",v:1,ga:"defeatRuin",gv:2,art:"./assets/embedded/00be3b86-30704.webp",gart:"./assets/embedded/f55e8584-39656.webp"},
 {key:"imp_night",family:"Imp",n:"Night Imp",g:"Night Behemoth",hp:6,b:2,atk:2,ghp:11,gb:4,gatk:3,ability:"During the Demon Phase, if this demon is alone in its room, it moves 1 additional space.",gability:"During the Demon Phase, if this demon is alone in its room, it moves 2 additional spaces.",a:"fast",v:1,ga:"fast",gv:2,art:"./assets/embedded/c3b3437c-19740.webp",gart:"./assets/embedded/c3b3437c-19740.webp"},

 // DEMON SHEET 2 — Undead
 {key:"undead_lich",family:"Undead",n:"Grave Lich",g:"Plague Bringer",hp:7,b:3,atk:3,ghp:15,gb:4,gatk:4,ability:"At the end of the Demon Phase, heal 1 HP.",gability:"At the end of the Demon Phase, heal 2 HP.",a:"endHeal",v:1,ga:"endHeal",gv:2,art:"./assets/embedded/3e8645a9-30452.webp",gart:"./assets/embedded/3e8645a9-30452.webp"},
 {key:"undead_wraith",family:"Undead",n:"Dread Wraith",g:"Soul Harvester",hp:6,b:3,atk:3,ghp:12,gb:4,gatk:4,ability:"This demon ignores the first 1 damage dealt to it each round.",gability:"This demon ignores the first 2 damage dealt to it each round.",a:"ignoreDamage",v:1,ga:"ignoreDamage",gv:2,art:"./assets/embedded/c4976adf-22096.webp",gart:"./assets/embedded/c4976adf-22096.webp"},
 {key:"undead_banshee",family:"Undead",n:"Death Banshee",g:"Blood Matron",hp:6,b:3,atk:2,ghp:11,gb:4,gatk:4,ability:"When this demon enters play, lose 1 shared Mana.",gability:"When this demon enters play, lose 2 shared Mana.",a:"enterMana",v:1,ga:"enterMana",gv:2,art:"./assets/embedded/53ebd56b-30540.webp",gart:"./assets/embedded/53ebd56b-30540.webp"},
 {key:"undead_warden",family:"Undead",n:"Ossuary Warden",g:"Bone Tyrant",hp:8,b:3,atk:2,ghp:14,gb:5,gatk:5,ability:"Prevent the first movement-stopping effect used on this demon each round.",gability:"Prevent the first two movement-stopping effects used on this demon each round.",a:"stopWard",v:1,ga:"stopWard",gv:2,art:"./assets/embedded/c1c8eaa1-32888.webp",gart:"./assets/embedded/c1c8eaa1-32888.webp"},
 {key:"undead_hierophant",family:"Undead",n:"Death Hierophant",g:"Soul Conqueror",hp:8,b:4,atk:3,ghp:15,gb:5,gatk:5,ability:"When another Undead enters play, it gains +1 Attack this round.",gability:"When another Undead enters play, it gains +2 Attack this round.",a:"undeadAttack",v:1,ga:"undeadAttack",gv:2,art:"./assets/embedded/956496d5-27148.webp",gart:"./assets/embedded/956496d5-27148.webp",manual:true},

 // DEMON SHEET 3 — Beasts
 {key:"beast_hound",family:"Beast",n:"Hellfire Hound",g:"Blightfang Matriarch",hp:9,b:3,atk:3,ghp:17,gb:4,gatk:4,ability:"When this demon enters a room, deal 1 Altar loss.",gability:"When this demon enters a room, deal 2 Altar loss.",a:"roomAltar",v:1,ga:"roomAltar",gv:2,art:"./assets/embedded/ec891cc3-35528.webp",gart:"./assets/embedded/ec891cc3-35528.webp"},
 {key:"beast_moonfang",family:"Beast",n:"Moonfang Alpha",g:"Bloodhowl Packlord",hp:8,b:3,atk:3,ghp:14,gb:4,gatk:4,ability:"If another demon is in this room, +1 Attack.",gability:"If another demon is in this room, +2 Attack.",a:"packAttack",v:1,ga:"packAttack",gv:2,art:"./assets/embedded/dd4bf8fb-36272.webp",gart:"./assets/embedded/dd4bf8fb-36272.webp",manual:true},
 {key:"beast_cinder",family:"Beast",n:"Cinder Colossus",g:"Molten Titan",hp:9,b:4,atk:3,ghp:15,gb:5,gatk:4,ability:"When defeated, lose 1 shared Mana.",gability:"When defeated, lose 2 shared Mana.",a:"defeatMana",v:1,ga:"defeatMana",gv:2,art:"./assets/embedded/d9605d8d-34608.webp",gart:"./assets/embedded/d9605d8d-34608.webp"},
 {key:"beast_gargoyle",family:"Beast",n:"War-Gargoyle",g:"Obsidian Warden",hp:10,b:4,atk:2,ghp:16,gb:5,gatk:3,ability:"This demon takes 1 less damage from Rituals.",gability:"This demon takes 2 less damage from Rituals.",a:"ritualArmor",v:1,ga:"ritualArmor",gv:2,art:"./assets/embedded/c3b3437c-19740.webp",gart:"./assets/embedded/00be3b86-30704.webp"},
 {key:"beast_drake",family:"Beast",n:"Infernal Bone Drake",g:"Apocalypse Drake",hp:11,b:4,atk:4,ghp:18,gb:6,gatk:5,ability:"When this demon attacks, the next demon gains +1 movement this phase.",gability:"When this demon attacks, the next demon gains +2 movement this phase.",a:"attackMove",v:1,ga:"attackMove",gv:2,art:"./assets/embedded/dbec53ed-33500.webp",gart:"./assets/embedded/dbec53ed-33500.webp",manual:true},

 // DEMON SHEET 4 — Fiends
 {key:"fiend_cultist",family:"Fiend",n:"Cultist",g:"Blood Cultist",hp:5,b:1,atk:1,ghp:10,gb:3,gatk:3,ability:"When this demon is defeated, the next demon gains +1 Attack.",gability:"When this demon is defeated, the next demon gains +2 Attack.",a:"defeatAttack",v:1,ga:"defeatAttack",gv:2,art:"./assets/embedded/163d7b40-34472.webp",gart:"./assets/embedded/163d7b40-34472.webp",manual:true},
 {key:"fiend_possessor",family:"Fiend",n:"Possessor",g:"Arch-Possessor",hp:7,b:3,atk:2,ghp:13,gb:5,gatk:4,ability:"Priest cards cost +1 shared Mana while this demon is in play.",gability:"Priest cards cost +2 shared Mana while this demon is in play.",a:"priestTax",v:1,ga:"priestTax",gv:2,art:"./assets/embedded/09aaceaf-33832.webp",gart:"./assets/embedded/ba5e0bb8-33244.webp"},
 {key:"fiend_tormentor",family:"Fiend",n:"Tormentor",g:"Pain Tyrant",hp:9,b:4,atk:3,ghp:16,gb:6,gatk:5,ability:"After this demon is damaged, lose 1 shared Mana.",gability:"After this demon is damaged, lose 2 shared Mana.",a:"hurtMana",v:1,ga:"hurtMana",gv:2,art:"./assets/embedded/e13aefaa-32216.webp",gart:"./assets/embedded/e13aefaa-32216.webp"},
 {key:"fiend_mage",family:"Fiend",n:"Infernal Mage",g:"Abyssal Mage",hp:10,b:5,atk:3,ghp:17,gb:6,gatk:5,ability:"At the start of the Demon Phase, move 1 demon forward 1 room.",gability:"At the start of the Demon Phase, move up to 2 demons forward 1 room.",a:"phasePush",v:1,ga:"phasePush",gv:2,art:"./assets/embedded/dc07ca16-36112.webp",gart:"./assets/embedded/dc07ca16-36112.webp"},
 {key:"fiend_gatekeeper",family:"Fiend",n:"Gatekeeper",g:"Hell Gatekeeper",hp:11,b:5,atk:3,ghp:18,gb:6,gatk:5,ability:"Demons in this room gain +1 Attack.",gability:"Demons in this room gain +2 Attack.",a:"roomAttack",v:1,ga:"roomAttack",gv:2,art:"./assets/embedded/c595a1b4-33884.webp",gart:"./assets/embedded/c595a1b4-33884.webp",manual:true},

 // DEMON SHEET 5 — Greater family
 {key:"greater_imp",family:"Greater",n:"Lesser Imp",g:"Greater Imp",hp:12,b:4,atk:4,ghp:19,gb:4,gatk:4,ability:"When defeated, gain 2 Blood.",gability:"When defeated, gain 3 Blood.",a:"defeatBlood",v:2,ga:"defeatBlood",gv:3,art:"./assets/embedded/6224178d-17708.webp",gart:"./assets/embedded/28229fd3-25784.webp"},
 {key:"greater_lich",family:"Greater",n:"Grave Lich",g:"Grave Lich Ascendant",hp:15,b:5,atk:5,ghp:22,gb:6,gatk:6,ability:"At the end of the Demon Phase, heal 2 HP.",gability:"At the end of the Demon Phase, heal 3 HP.",a:"endHeal",v:2,ga:"endHeal",gv:3,art:"./assets/embedded/3e8645a9-30452.webp",gart:"./assets/embedded/6262f71f-45376.webp"},
 {key:"greater_hound",family:"Greater",n:"Abyssal Hound",g:"Alpha Hellfire Hound",hp:17,b:6,atk:5,ghp:24,gb:8,gatk:6,ability:"When this demon enters a room, deal 2 Altar loss.",gability:"When this demon enters a room, deal 3 Altar loss.",a:"roomAltar",v:2,ga:"roomAltar",gv:3,art:"./assets/embedded/ec891cc3-35528.webp",gart:"./assets/embedded/dd4bf8fb-36272.webp"},
 {key:"greater_overlord",family:"Greater",n:"Demon Overlord",g:"Abyssal Warmaster",hp:18,b:7,atk:5,ghp:26,gb:9,gatk:6,ability:"The first Ritual used against this demon each round has half effect.",gability:"The first two Rituals used against this demon each round have half effect.",a:"ritualHalf",v:1,ga:"ritualHalf",gv:2,art:"./assets/embedded/809f7315-32536.webp",gart:"./assets/embedded/7a3d8e8e-42820.webp"},
 {key:"greater_temptation",family:"Greater",n:"Lord of Temptation",g:"Demon King",hp:20,b:8,atk:7,ghp:30,gb:10,gatk:7,ability:"At the start of the Demon Phase, spawn 1 Imp in the Entrance.",gability:"At the start of the Demon Phase, spawn 2 Imps in the Entrance.",a:"spawnImp",v:1,ga:"spawnImp",gv:2,art:"./assets/embedded/7a3d8e8e-42820.webp",gart:"./assets/embedded/7a3d8e8e-42820.webp"}
];

const CONFIRMED_IMPS = DEMON_TYPES.slice(0,5);
const BOSSES=[{"key":"blackSovereign","n":"The Black Sovereign","subtitle":"Edicts of the Damned","hp":172,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Edict of Silence","The first Ritual used each round has half effect."],["Royal Summons","After this boss activates, summon 1 lesser demon into the Entrance. Boss-summoned demons cannot merge."]],"art":"./assets/embedded/030d33e8-52112.webp"},{"key":"soulTyrant","n":"The Soul Tyrant","subtitle":"Chains of Dominion","hp":164,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Tyrant's Claim","Whenever a lesser demon is defeated, the players gain 1 less Demon Blood from that demon, to a minimum of 0."],["Chains of Dominion","The first Support Ritual used each round has half effect."]],"art":"./assets/embedded/1459ef67-55308.webp"},{"key":"boneKing","n":"The Bone King","subtitle":"Grave Recall","hp":148,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Ossuary Court","Demons in the Crypt gain 1 HP while this boss remains in play."],["Grave Recall","After this boss activates, return the oldest defeated lesser demon from the defeated row to the Entrance and remove it from the defeated count."]],"art":"./assets/embedded/1fb49192-51636.webp"},{"key":"fallenSeraph","n":"The Fallen Seraph","subtitle":"Blasphemous Radiance","hp":158,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Profane Halo","The first Ritual that targets this boss each round has half effect."],["Heresy Unbound","At the start of each round, remove 2 Mana from the shared Mana pool while this boss remains in play."]],"art":"./assets/embedded/58373cc5-53528.webp"},{"key":"plagueFather","n":"Plague Father","subtitle":"Pestilent Bloom","hp":140,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Pestilent Bloom","At the end of each Boss Phase, the frontmost demon in every occupied room gains 1 HP."],["Corruption Spores","When a demon is defeated, the next demon to enter that room gains 1 HP."]],"art":"./assets/embedded/f2980c98-55616.webp"},{"key":"crimsonOracle","n":"The Crimson Oracle","subtitle":"Blood Prophecy","hp":126,"b":5,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 5 Altar Protection at the end of each Boss Phase."],["Blood Prophecy","At the start of each Boss Phase, look at the top 2 Demon cards and place them back in any order."],["Omen Unbound","The next demon to enter play each round gains 2 HP."]],"art":"./assets/embedded/dcaeee22-52756.webp"},{"key":"gatebreaker","n":"The Gatebreaker","subtitle":"Breach of the Sanctum","hp":178,"b":7,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 7 Altar Protection at the end of each Boss Phase."],["Breach the Sanctum","The first demon to enter the Hall or Chapel each round immediately moves 1 additional room forward."],["Crushing Advance","After this boss activates, summon 2 lesser demons into the Entrance. Boss-summoned demons cannot merge."]],"art":"./assets/embedded/7dcd5cba-56580.webp"},{"key":"lordOfAsh","n":"Lord of Ash","subtitle":"Crown of Cinders","hp":154,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Ashen Wake","The first demon that reaches the Altar each round removes 1 additional Altar Protection."],["Cinder Court","After this boss activates, summon 1 Fire Imp into the Entrance. Boss-summoned demons cannot merge."]],"art":"./assets/embedded/042597b5-56448.webp"},{"key":"dreadReaper","n":"The Dread Reaper","subtitle":"Harvester of Graves","hp":134,"b":6,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 6 Altar Protection at the end of each Boss Phase."],["Harvest Unending","The first time this boss would take damage each round, prevent 2 of that damage."],["Grave Procession","After this boss activates, return the oldest defeated lesser demon from the defeated row to the Entrance and remove it from the defeated count."]],"art":"./assets/embedded/97385aa2-57280.webp"},{"key":"devourer","n":"The Devourer","subtitle":"Maw of the Abyss","hp":170,"b":7,"rules":[["Boss Rule","While this demon remains in the Boss Room, it drains 7 Altar Protection at the end of each Boss Phase."],["Hungering Maw","Rituals that deal damage to this boss deal 1 less damage, to a minimum of 1."],["Voracious Call","After this boss activates, summon 1 lesser demon into the Entrance. Boss-summoned demons cannot merge."],["Feast of Ruin","Whenever a lesser demon is defeated, The Devourer heals 1 HP."]],"art":"./assets/embedded/a38bc3d5-56168.webp"}];
const CRUCIFIX=[
 {n:"Holy Respite",t:"good",txt:"Restore 3 Altar Protection.",fx:s=>healAltar(3)},
 {n:"Merciful Light",t:"good",txt:"Restore the shared Mana pool by 2.",fx:s=>addMana(2)},
 {n:"Sacred Reprieve",t:"good",txt:"The current player draws 2 Priest cards.",fx:s=>drawPriest(s.players[s.current],2)},
 {n:"Blood Returned",t:"good",txt:"Each player gains 1 Demon Blood, up to 10.",fx:s=>s.players.forEach(p=>p.blood=Math.min(10,p.blood+1))},
 {n:"Ground Opens",t:"good",txt:"Banish all current normal Demons. They do not count as defeated.",fx:s=>{s.rooms=[[],[],[],[]];}},
 {n:"Sealed Passage",art:"./assets/embedded/8081e497-16960.webp",t:"good",txt:"Demons in the Gateway will not move this Demon Phase.",fx:s=>s.roomStop[0]=true},
 {n:"Shattered Reliquary",art:"./assets/embedded/f1694a34-15948.webp",t:"bad",txt:"Lose 3 Altar Protection.",fx:s=>damageAltar(3,"Crucifix")},
 {n:"Mana Blight",art:"./assets/embedded/0ae02867-10392.webp",t:"bad",txt:"Lose 2 shared Mana.",fx:s=>addMana(-2)},
 {n:"Dark Tide",art:"./assets/embedded/6fbf6014-14024.webp",t:"bad",txt:"Spawn 1 additional Demon immediately.",fx:s=>spawnOne()},
 {n:"Profane Echo",art:"./assets/embedded/44dcebdb-11612.webp",t:"bad",txt:"The closest Demon to the Altar heals 3 HP.",fx:s=>healClosest(3)},
 {n:"Cracked Seal",art:"./assets/embedded/b7f07222-15876.webp",t:"bad",txt:"The next Altar loss is increased by 2.",fx:s=>s.nextAltarBonus+=2},
 {n:"Whispering Void",art:"./assets/embedded/938164ba-13060.webp",t:"bad",txt:"Current player discards 1 random Priest card.",fx:s=>discardRandom(s.players[s.current])},
 {n:"Blood for Light",art:"./assets/embedded/2c18d5ed-15180.webp",t:"double",txt:"Restore 5 Altar Protection; current player loses 2 Demon Blood if possible.",fx:s=>{healAltar(5);s.players[s.current].blood=Math.max(0,s.players[s.current].blood-2)}},
 {n:"Fevered Prayer",art:"./assets/embedded/b8403fad-14160.webp",t:"double",txt:"Gain 3 Mana, then spawn 1 Demon.",fx:s=>{addMana(3);spawnOne()}},
 {n:"Ashen Bargain",art:"./assets/embedded/40e4f456-16320.webp",t:"double",txt:"Current player draws 3 Priest cards; lose 2 Altar Protection.",fx:s=>{drawPriest(s.players[s.current],3);damageAltar(2,"Crucifix")}},
 {n:"Unquiet Dead",art:"./assets/embedded/c2c2d671-14300.webp",t:"double",txt:"Move the closest Demon one room toward the Altar; restore 2 Mana.",fx:s=>{forceMoveClosest();addMana(2)}},
 {n:"Martyr's Hour",art:"./assets/embedded/85d7f1da-13748.webp",t:"double",txt:"Each player gains 1 Blood; lose 2 Altar Protection.",fx:s=>{s.players.forEach(p=>p.blood=Math.min(10,p.blood+1));damageAltar(2,"Crucifix")}},
 {n:"Redemption",art:"./assets/embedded/dfb7f32f-16164.webp",t:"good",txt:"Remove all temporary negative statuses from Demons.",fx:s=>clearDemonStatuses()}
];


const CHOICE_CRUCIFIX=[
 {
  n:"The Blood Tithe",t:"double",choice:true,
  txt:"The Crucifix demands payment. Choose how the Sanctum answers.",
  choices:[
   {label:"Pay in Blood",desc:"Spend 3 total Demon Blood from the party. Restore 6 Altar Protection.",
    can:s=>crucifixPartyBlood()>=3,
    fx:s=>{crucifixSpendPartyBlood(3);healAltar(6,"The Blood Tithe");return "3 Demon Blood was sacrificed. The Altar restores 6 Protection.";}},
   {label:"Refuse the Tithe",desc:"Lose 3 Altar Protection. Each player gains 1 Demon Blood.",
    fx:s=>{damageAltar(3,"The Blood Tithe");crucifixGiveAllBlood(1);return "The Altar loses 3 Protection. Each player gains 1 Demon Blood.";}}
  ]
 },
 {
  n:"The Broken Halo",t:"double",choice:true,
  txt:"A fractured halo spills both power and corruption.",
  choices:[
   {label:"Claim Its Power",desc:"Gain 5 shared Mana. Add 1 Corruption to every room.",
    fx:s=>{addMana(5);for(let i=0;i<4;i++)addCorruption(i,"The Broken Halo");return "The party gains 5 Mana, but Corruption spreads through the Sanctum.";}},
   {label:"Shatter the Halo",desc:"Set shared Mana to 0. Cleanse all Corruption from every room.",
    fx:s=>{s.mana=0;for(let i=0;i<4;i++)setRoomCorruption(i,0,s);return "All Corruption is cleansed, but the shared Mana pool falls to 0.";}}
  ]
 },
 {
  n:"Candle of the Last Breath",t:"double",choice:true,
  txt:"A dying candle offers either a costly miracle or a smaller mercy.",
  choices:[
   {label:"Feed the Flame",desc:"Current player spends 3 Demon Blood. Restore 7 Altar Protection.",
    can:s=>s.players[s.current]&&s.players[s.current].blood>=3,
    fx:s=>{s.players[s.current].blood-=3;healAltar(7,"Candle of the Last Breath");return `${s.players[s.current].name} spends 3 Demon Blood. The Altar restores 7 Protection.`;}},
   {label:"Accept the Ember",desc:"Restore 2 Altar Protection. Current player draws 1 Priest card.",
    fx:s=>{healAltar(2,"Candle of the Last Breath");drawPriest(s.players[s.current],1);return "The Altar restores 2 Protection and the current player draws 1 Priest card.";}}
  ]
 },
 {
  n:"Offering of Pages",t:"double",choice:true,
  txt:"The Crucifix asks whether knowledge or safety should be sacrificed.",
  choices:[
   {label:"Burn the Pages",desc:"Each player with cards discards 1 random Priest card. Restore 5 Altar Protection.",
    can:s=>s.players.some(p=>p.hand&&p.hand.length),
    fx:s=>{s.players.forEach(p=>discardRandom(p));healAltar(5,"Offering of Pages");return "Each possible player discards 1 random Priest card. The Altar restores 5 Protection.";}},
   {label:"Preserve the Pages",desc:"Each player draws 1 Priest card. Lose 4 Altar Protection.",
    fx:s=>{s.players.forEach(p=>drawPriest(p,1));damageAltar(4,"Offering of Pages");return "Each player draws 1 Priest card, but the Altar loses 4 Protection.";}}
  ]
 },
 {
  n:"Profane Treasury",t:"double",choice:true,
  txt:"A black reliquary opens, offering strength at a price.",
  choices:[
   {label:"Take the Blood",desc:"Each player gains 2 Demon Blood. Lose 5 Altar Protection.",
    fx:s=>{crucifixGiveAllBlood(2);damageAltar(5,"Profane Treasury");return "Each player gains 2 Demon Blood. The Altar loses 5 Protection.";}},
   {label:"Seal the Treasury",desc:"Spend 2 total Demon Blood from the party. Gain 4 shared Mana.",
    can:s=>crucifixPartyBlood()>=2,
    fx:s=>{crucifixSpendPartyBlood(2);addMana(4);return "The party sacrifices 2 Demon Blood and gains 4 shared Mana.";}}
  ]
 },
 {
  n:"Scoured Threshold",t:"double",choice:true,
  txt:"The Gateway can be purified—or exploited.",
  choices:[
   {label:"Cleanse the Threshold",desc:"Remove all Gateway Corruption. Gain 2 shared Mana.",
    fx:s=>{setRoomCorruption(0,0,s);addMana(2);return "Gateway Corruption is cleansed and the party gains 2 Mana.";}},
   {label:"Exploit the Taint",desc:"Add 2 Gateway Corruption. Restore 5 Altar Protection.",
    fx:s=>{addCorruption(0,"Scoured Threshold");addCorruption(0,"Scoured Threshold");healAltar(5,"Scoured Threshold");return "The Gateway grows more corrupt, but the Altar restores 5 Protection.";}}
  ]
 },
 {
  n:"Bell of Ash",t:"double",choice:true,
  txt:"A distant bell tolls. Answer it, or silence it.",
  choices:[
   {label:"Answer the Bell",desc:"Spawn 1 extra Demon. Restore 5 Altar Protection.",
    fx:s=>{spawnOne(true);healAltar(5,"Bell of Ash");return "An extra Demon enters the Sanctum. The Altar restores 5 Protection.";}},
   {label:"Silence the Bell",desc:"Do not spawn an extra Demon. Lose 3 shared Mana.",
    fx:s=>{addMana(-3);return "The bell is silenced. The shared Mana pool loses 3.";}}
  ]
 },
 {
  n:"The Wounded Saint",t:"double",choice:true,
  txt:"A wounded saint offers power to whoever bears the burden.",
  choices:[
   {label:"Carry the Wound",desc:"Current player discards 2 random Priest cards, then gains 3 Demon Blood and 3 Mana.",
    can:s=>s.players[s.current]&&s.players[s.current].hand.length>=2,
    fx:s=>{let p=s.players[s.current];discardRandom(p);discardRandom(p);p.blood=Math.min(10,p.blood+3);addMana(3);return `${p.name} discards 2 cards, gains 3 Demon Blood, and the party gains 3 Mana.`;}},
   {label:"Leave the Wound",desc:"Lose 3 Altar Protection. Current player draws 2 Priest cards.",
    fx:s=>{damageAltar(3,"The Wounded Saint");drawPriest(s.players[s.current],2);return "The Altar loses 3 Protection and the current player draws 2 Priest cards.";}}
  ]
 },
 {
  n:"The Chapel's Demand",t:"double",choice:true,
  txt:"The chapel demands either power or protection.",
  choices:[
   {label:"Spend the Mana",desc:"Spend 4 shared Mana. Restore 6 Altar Protection.",
    can:s=>s.mana>=4,
    fx:s=>{addMana(-4);healAltar(6,"The Chapel's Demand");return "The party spends 4 Mana and restores 6 Altar Protection.";}},
   {label:"Spend the Stone",desc:"Lose 3 Altar Protection. Gain 3 shared Mana.",
    fx:s=>{damageAltar(3,"The Chapel's Demand");addMana(3);return "The Altar loses 3 Protection and the party gains 3 Mana.";}}
  ]
 },
 {
  n:"Mercy of the Grave",t:"double",choice:true,
  txt:"The dead offer to take one enemy with them.",
  choices:[
   {label:"Accept the Mercy",desc:"Banish the Demon closest to the Altar without reward. Lose 4 Altar Protection.",
    can:s=>!!closestDemon(),
    fx:s=>{let d=closestDemon();let name=d?demonName(d):"the Demon";if(d)crucifixBanishDemon(d);damageAltar(4,"Mercy of the Grave");return `${name} is banished without reward. The Altar loses 4 Protection.`;}},
   {label:"Refuse the Dead",desc:"Leave all Demons in play. Gain 1 shared Mana.",
    fx:s=>{addMana(1);return "The dead are refused. The party gains 1 Mana.";}}
  ]
 },
 {
  n:"Borrowed Dawn",t:"double",choice:true,
  txt:"A false sunrise grants knowledge while feeding the Chapel's corruption.",
  choices:[
   {label:"Take the Dawn",desc:"Current player draws 2 Priest cards. Add 2 Corruption to the Chapel.",
    fx:s=>{drawPriest(s.players[s.current],2);addCorruption(2,"Borrowed Dawn");addCorruption(2,"Borrowed Dawn");return "The current player draws 2 Priest cards, but the Chapel gains 2 Corruption.";}},
   {label:"Turn Away",desc:"Current player discards 1 random Priest card. Restore 4 Altar Protection.",
    can:s=>s.players[s.current]&&s.players[s.current].hand.length>0,
    fx:s=>{discardRandom(s.players[s.current]);healAltar(4,"Borrowed Dawn");return "The current player discards 1 random Priest card and the Altar restores 4 Protection.";}}
  ]
 },
 {
  n:"The Unpaid Vow",t:"double",choice:true,
  txt:"An ancient vow demands that the party either honor it or break it.",
  choices:[
   {label:"Honor the Vow",desc:"Every player spends 1 Demon Blood. Restore 5 Altar Protection.",
    can:s=>s.players.length>0&&s.players.every(p=>p.blood>=1),
    fx:s=>{s.players.forEach(p=>p.blood--);healAltar(5,"The Unpaid Vow");return "Every player spends 1 Demon Blood. The Altar restores 5 Protection.";}},
   {label:"Break the Vow",desc:"Lose 2 Altar Protection. Every player gains 1 Demon Blood.",
    fx:s=>{damageAltar(2,"The Unpaid Vow");crucifixGiveAllBlood(1);return "The Altar loses 2 Protection. Every player gains 1 Demon Blood.";}}
  ]
 },
 {
  n:"Cross of Cinders",t:"double",choice:true,
  txt:"Ash gathers on the Crucifix. Cleanse it or draw power from it.",
  choices:[
   {label:"Sweep Away the Ash",desc:"Spend 3 shared Mana. Remove 1 Corruption from every room.",
    can:s=>s.mana>=3,
    fx:s=>{addMana(-3);for(let i=0;i<4;i++)setRoomCorruption(i,(s.corruption[i]||0)-1,s);return "The party spends 3 Mana and removes 1 Corruption from every room.";}},
   {label:"Breathe the Ash",desc:"Gain 4 shared Mana. Add 1 Corruption to every room.",
    fx:s=>{addMana(4);for(let i=0;i<4;i++)addCorruption(i,"Cross of Cinders");return "The party gains 4 Mana, but every room gains 1 Corruption.";}}
  ]
 },
 {
  n:"The Saint's Gamble",t:"double",choice:true,
  txt:"The Crucifix offers certainty—or a dangerous throw of fate.",
  choices:[
   {label:"Gamble on Faith",desc:"Roll d20: 1–9 lose 4 Altar; 10–19 restore 6; Natural 20 restore 8 and gain 2 Mana.",
    fx:s=>{let r=Math.floor(Math.random()*20)+1;if(r===20){healAltar(8,"The Saint's Gamble");addMana(2);return `Natural 20! Restore 8 Altar Protection and gain 2 Mana.`}if(r>=10){healAltar(6,"The Saint's Gamble");return `Rolled ${r}. Restore 6 Altar Protection.`}damageAltar(4,"The Saint's Gamble");return `Rolled ${r}. The Altar loses 4 Protection.`;}},
   {label:"Choose Certainty",desc:"Restore 2 Altar Protection with no roll.",
    fx:s=>{healAltar(2,"The Saint's Gamble");return "The party refuses the gamble and restores 2 Altar Protection.";}}
  ]
 },
 {
  n:"Burdened Reliquary",t:"double",choice:true,
  txt:"A sealed reliquary can be opened only by surrendering power.",
  choices:[
   {label:"Empty the Vessel",desc:"Current player loses all Demon Blood. Restore that much Altar Protection, plus 2.",
    can:s=>s.players[s.current]&&s.players[s.current].blood>0,
    fx:s=>{let p=s.players[s.current],lost=p.blood;p.blood=0;healAltar(lost+2,"Burdened Reliquary");return `${p.name} loses ${lost} Demon Blood. The Altar restores ${lost+2} Protection.`;}},
   {label:"Leave It Sealed",desc:"Lose 2 shared Mana. Add 1 Corruption to the Crypt.",
    fx:s=>{addMana(-2);addCorruption(3,"Burdened Reliquary");return "The reliquary remains sealed. Lose 2 Mana and add 1 Corruption to the Crypt.";}}
  ]
 }
];


CRUCIFIX.push(...CHOICE_CRUCIFIX);

const CURSED_CRUCIFIX=[
 {
  n:"Legion of the Pit",
  t:"cursed",
  cursed:true,
  txt:"Add 1 Demon to every room. If a room is already full, that Demon is sent to the Gate Queue.",
  fx:s=>{
   let placed=0,queued=0;
   for(let r=0;r<4;r++){
    let result=crucifixSpawnDemonIntoRoom(r);
    if(result==='placed')placed++;
    else if(result==='queued')queued++;
   }
   log(`CURSED CRUCIFIX — Legion of the Pit adds ${placed} Demon${placed===1?'':'s'} directly to the Sanctum${queued?` and sends ${queued} to the Gate Queue`:''}.`,'bad');
  }
 },
 {
  n:"Black Mass",
  t:"cursed",
  cursed:true,
  txt:"Lose 6 Altar Protection. Set shared Mana to 0. Add 1 Corruption to every room.",
  fx:s=>{
   damageAltar(6,"Black Mass");
   s.mana=0;
   for(let r=0;r<4;r++)addCorruption(r,"Black Mass");
   log("CURSED CRUCIFIX — Black Mass drains the Mana pool and corrupts every room.",'bad');
  }
 },
 {
  n:"March of Damnation",
  t:"cursed",
  cursed:true,
  txt:"Every Demon immediately moves forward 1 room. Demons reaching the Altar attack normally.",
  fx:s=>{
   let march=allDemons().sort((a,b)=>b.r-a.r).map(x=>x.d);
   let moved=0;
   for(let d of march){
    if(findDemonLocation(d)&&moveOneForward(d,"March of Damnation"))moved++;
   }
   log(`CURSED CRUCIFIX — March of Damnation forces ${moved} Demon${moved===1?'':'s'} forward.`,'bad');
  }
 }
];

CRUCIFIX.push(...CURSED_CRUCIFIX);

const priestArtByName = Object.fromEntries(PRIEST.filter(c=>c.art).map(c=>[c.n,c.art]));
const PRIEST_CARD_ARTS = {"Blessed Steel":"./assets/embedded/50507fe2-34688.webp","Circle of Protection":"./assets/embedded/1cc817d7-34488.webp","Consecration":"./assets/embedded/544ba5a8-37296.webp","Dawnfire":"./assets/embedded/dceb33de-29084.webp","Divine Shield":"./assets/embedded/3a4deaa9-34444.webp","Divine Wrath":"./assets/embedded/4fae8728-33852.webp","Guardian Prayer":"./assets/embedded/01e038a8-41244.webp","Holy Barrier":"./assets/embedded/9984c66d-32592.webp","Holy Bolt":"./assets/embedded/e0da572d-23512.webp","Holy Echo":"./assets/embedded/7b352f21-34496.webp","Iron Faith":"./assets/embedded/ccd31a4a-41664.webp","Judgment":"./assets/embedded/04b51eec-26704.webp","Last Rites":"./assets/embedded/a877c3e8-34576.webp","Light of Truth":"./assets/embedded/9f783f3e-38384.webp","Mana Blessing":"./assets/embedded/6dc8c6d9-36488.webp","Purifying Flame":"./assets/embedded/b3bc0dcf-41920.webp","Quick Prayer":"./assets/embedded/17da3e85-29144.webp","Radiant Spear":"./assets/embedded/68506439-29320.webp","Sacred Brand":"./assets/embedded/d046909f-35268.webp","Sacred Nova":"./assets/embedded/17d4c420-34856.webp","Shared Faith":"./assets/embedded/c6aa6fb0-38616.webp","Shield of Faith":"./assets/embedded/daa5cb37-39592.webp","Smite":"./assets/embedded/8ccc28ed-27624.webp","Sunburst":"./assets/embedded/840ed6f0-36568.webp","Wrath of the Saints":"./assets/embedded/c7022245-37240.webp","Blood Tithe":"./assets/embedded/71296315-31216.webp","Crimson Siphon":"./assets/embedded/8e72b943-30600.webp","Leech Rite":"./assets/embedded/6197f959-30560.webp","Essence Decanter":"./assets/embedded/fa1aa7fb-33256.webp","Mana Distillation":"./assets/embedded/a9865bb9-29152.webp","Altar Exchange":"./assets/embedded/d440d50c-30196.webp","Sanguine Channel":"./assets/embedded/dc230a4f-36464.webp"};
const priestArtFallbacks = {
  "Cast Into Hell":"Divine Wrath",
  "Sever the Unholy":"Radiant Spear",
  "Final Exorcism":"Last Rites",
  "Vision of Fate":"Light of Truth",
  "Foretold Death":"Judgment",
  "Rewrite Destiny":"Holy Echo",
  "Hold the Line":"Divine Shield",
  "Martyr's Guard":"Guardian Prayer",
  "Sacred Mark":"Sacred Brand",
  "Divine Intervention":"Guardian Prayer",
  "Chains of Faith":"Circle of Protection",
  "Palm of Judgment":"Judgment",
  "Still the Wicked":"Divine Shield",
  "Inner Peace":"Mana Blessing",
  "Echoed Grace":"Holy Echo",
  "Sacred Rebuke":"Divine Wrath",
  "Miracle of Unity":"Shared Faith"
};
PRIEST.forEach(c=>{ if(!c.art){ c.art = priestArtByName[priestArtFallbacks[c.n]] || priestArtByName['Guardian Prayer'] || ''; } });
