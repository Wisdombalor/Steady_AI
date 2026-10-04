export const FORM = "https://formsubmit.co/ajax/Wisdomudohwest@gmail.com";

export const TRIG = ["Stress","Boredom","Money problems","Seeing gambling content","Sports","Social pressure","Loneliness","Anger","Sadness","Celebration","Alcohol/substances","Habit","Chasing a loss","Other"];

export const EMO = ["Anxious","Angry","Sad","Bored","Lonely","Excited","Stressed","Restless","Overwhelmed","Other"];

export const ACTS = [
  ["Slow breathing","Breathe in for 4, out for 6. Slow breathing lowers your heart rate and lets the urge pass.",60],
  ["5-4-3-2-1 grounding","Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.",180],
  ["Drink a glass of water","A small physical reset breaks the autopilot loop. Drink it slowly.",120],
  ["Put your phone in another room","Distance makes gambling harder to reach. Come back when the timer ends.",60],
  ["Walk for 10 minutes","Give yourself physical distance from the moment.",600],
  ["Write what gambling would cost you tonight","Money, time, mood, people. Seeing it on paper makes the cost clear.",300],
  ["Message someone you trust","You don't have to explain everything. Just say hi.",180],
  ["Do 10 push-ups, then rest","Burn off the restless energy.",120],
];

export const MOT = [
  "An urge is temporary. Your decision doesn't have to be.",
  "You don't need to win back what you've lost.",
  "Every day you choose differently, the choice gets easier.",
  "A hard day doesn't erase your progress.",
  "You made it through difficult moments before.",
];

const E = (o, p, d) => ({ o, p, d });

export const CO = {
  NG: { n: "Nigeria", c: "₦", r: [E("Emergency (national)","112","Police, fire, medical"),E("MANI counselling","08091116264","Mentally Aware Nigeria Initiative, includes addiction"),E("MANI counselling (2)","08111680686","Mentally Aware Nigeria Initiative")] },
  GH: { n: "Ghana", c: "GH₵", r: [E("Emergency (national)","112","Police, fire, medical"),E("Mental Health Authority","0800678678","Check mentalhealthghana.org to confirm this line")] },
  KE: { n: "Kenya", c: "KSh", r: [E("Emergency","999","Police, fire, medical (112 also works from mobiles)"),E("Kenya Red Cross","1199","Free helpline, includes psychosocial support")] },
  ZA: { n: "South Africa", c: "R", r: [E("Emergency (mobile)","112","Any mobile phone"),E("SA Responsible Gambling Foundation","0800006008","Toll-free gambling counselling"),E("SADAG","0800456789","Mental health helpline")] },
  GB: { n: "United Kingdom", c: "£", r: [E("Emergency","999","Police, fire, medical"),E("National Gambling Helpline","08088020133","GambleAware service, 24/7 (England, Scotland, Wales)"),E("Samaritans","116123","24/7 emotional support")] },
  US: { n: "United States", c: "$", r: [E("Emergency","911","Police, fire, medical"),E("1-800-GAMBLER","18004262537","National Problem Gambling Helpline, 24/7"),E("988 Lifeline","988","Call or text, 24/7")] },
  CA: { n: "Canada", c: "$", r: [E("Emergency","911","Police, fire, medical"),E("988 Suicide Crisis Helpline","988","Call or text, 24/7"),E("ConnexOntario","18665312600","Gambling support (Ontario)")] },
  AU: { n: "Australia", c: "$", r: [E("Emergency","000","Police, fire, medical"),E("Gambling Help Online","1800858858","24/7 counselling")] },
  IN: { n: "India", c: "₹", r: [E("Emergency","112","Police, fire, medical"),E("Tele-MANAS","14416","Free mental health helpline")] },
  IE: { n: "Ireland", c: "€", r: [E("Emergency","999","Police, fire, medical (112 also works)"),E("Samaritans","116123","24/7 emotional support")] },
  NZ: { n: "New Zealand", c: "NZ$", r: [E("Emergency","111","Police, fire, medical"),E("Gambling Helpline","0800654655","Free, 24/7")] },
  SG: { n: "Singapore", c: "S$", r: [E("Police","999","Police"),E("Ambulance / fire","995","SCDF"),E("National Problem Gambling Helpline","18006668668","Free, 24/7")] },
  MY: { n: "Malaysia", c: "RM", r: [E("Emergency","999","Police, fire, medical"),E("Befrienders KL","0376272929","Emotional support, daily 9am–9pm")] },
  PH: { n: "Philippines", c: "₱", r: [E("Emergency","911","National emergency number"),E("NCMH Crisis Hotline","1553","Toll-free from landlines")] },
  DE: { n: "Germany", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Glücksspielsucht-Hilfe","08001372700","Gambling addiction counselling (German)")] },
  FR: { n: "France", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Joueurs-Info-Service","0974751313","Gambling support (French)")] },
  NL: { n: "Netherlands", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("113 Suicide prevention","08000113","Free, 24/7 (Dutch/English)")] },
  ES: { n: "Spain", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Teléfono de la Esperanza","717003717","Emotional support (Spanish)")] },
  IT: { n: "Italy", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Telefono Amico","0223272327","Emotional support (Italian)")] },
  SE: { n: "Sweden", c: "kr", r: [E("Emergency","112","Police, fire, medical"),E("Stödlinjen","020819100","Gambling support (Swedish)")] },
  NO: { n: "Norway", c: "kr", r: [E("Emergency (medical)","113","Medical (police 112, fire 110)"),E("Hjelpelinjen","80080040","Gambling support (Norwegian)")] },
  FI: { n: "Finland", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Peluuri","0800100101","Gambling support (Finnish/Swedish)")] },
  DK: { n: "Denmark", c: "kr", r: [E("Emergency","112","Police, fire, medical"),E("StopSpillet","70222825","Gambling support (Danish)")] },
  CH: { n: "Switzerland", c: "CHF", r: [E("Ambulance","144","Ambulance (police 117, general 112)"),E("Die Dargebotene Hand","143","Emotional support (German/French/Italian)")] },
  AT: { n: "Austria", c: "€", r: [E("Emergency","112","Police, fire, medical"),E("Telefonseelsorge","142","Free crisis support")] },
  BE: { n: "Belgium", c: "€", r: [E("Emergency","112","Police, fire, medical")] },
  PT: { n: "Portugal", c: "€", r: [E("Emergency","112","Police, fire, medical")] },
  GR: { n: "Greece", c: "€", r: [E("Emergency","112","Police, fire, medical")] },
  PL: { n: "Poland", c: "zł", r: [E("Emergency","112","Police, fire, medical")] },
  UA: { n: "Ukraine", c: "UAH", r: [E("Emergency","112","Police, fire, medical")] },
  TR: { n: "Türkiye", c: "TRY", r: [E("Emergency","112","Police, fire, medical")] },
  BR: { n: "Brazil", c: "R$", r: [E("Emergency","190","Police (ambulance 192, fire 193)"),E("CVV","188","Emotional support, 24/7 (Portuguese)")] },
  MX: { n: "Mexico", c: "MX$", r: [E("Emergency","911","Police, fire, medical"),E("Línea de la Vida","8009112000","Addiction support (Spanish)")] },
  AR: { n: "Argentina", c: "AR$", r: [E("Emergency","911","Police, fire, medical"),E("Suicide prevention (Buenos Aires)","135","Free in Buenos Aires city")] },
  CL: { n: "Chile", c: "CL$", r: [E("Police","133","Police"),E("Salud Responde","6003607777","Health guidance (Spanish)")] },
  CO: { n: "Colombia", c: "CO$", r: [E("Emergency","123","Single emergency number")] },
  PE: { n: "Peru", c: "S/", r: [E("Police","105","Police (medical 106)")] },
  JM: { n: "Jamaica", c: "J$", r: [E("Police","119","Police (fire/ambulance 110)")] },
  JP: { n: "Japan", c: "¥", r: [E("Police","110","Police"),E("Fire / ambulance","119","Fire and ambulance"),E("TELL Lifeline","0357740992","English-language counselling")] },
  KR: { n: "South Korea", c: "₩", r: [E("Emergency","112","Police (fire 119)"),E("Gambling Problems Helpline","1336","Korea Center on Gambling Problems (Korean)")] },
  CN: { n: "China", c: "CN¥", r: [E("Police","110","Police (ambulance 120, fire 119)")] },
  TW: { n: "Taiwan", c: "NT$", r: [E("Police","110","Police (fire/ambulance 119)")] },
  HK: { n: "Hong Kong", c: "HK$", r: [E("Emergency","999","Police, fire, medical")] },
  TH: { n: "Thailand", c: "฿", r: [E("Police","191","Police"),E("Thai Mental Health Hotline","1323","Free mental health support")] },
  ID: { n: "Indonesia", c: "Rp", r: [E("Emergency","112","Police, fire, medical"),E("Health / mental health","119","Medical emergencies, ext. 8 for mental health")] },
  PK: { n: "Pakistan", c: "Rs", r: [E("Police","15","Police"),E("Rescue","1122","Fire, ambulance, rescue"),E("Umang","03117786264","Mental health helpline")] },
  BD: { n: "Bangladesh", c: "Tk", r: [E("Emergency","999","Police, fire, medical"),E("Kaan Pete Roi","09612119911","Emotional support")] },
  SA: { n: "Saudi Arabia", c: "SR", r: [E("Police","999","Police"),E("Ambulance","997","Ambulance"),E("MOH support line","937","Ministry of Health")] },
  AE: { n: "United Arab Emirates", c: "DH", r: [E("Police","999","Police"),E("Ambulance","998","Ambulance")] },
  IL: { n: "Israel", c: "₪", r: [E("Police","100","Police (ambulance 101)"),E("ERAN","*1201","Emotional support (Hebrew/Arabic/English)")] },
  EG: { n: "Egypt", c: "E£", r: [E("Police","122","Police (ambulance 123)")] },
  ET: { n: "Ethiopia", c: "Br", r: [E("Emergency","911","Police, fire, medical")] },
  UG: { n: "Uganda", c: "USh", r: [E("Emergency","112","Police, fire, medical (also try 999)")] },
  TZ: { n: "Tanzania", c: "TSh", r: [E("Emergency","112","Police, fire, medical")] },
  RW: { n: "Rwanda", c: "RF", r: [E("Emergency","112","Police, fire, medical")] },
  XX: { n: "Other country", c: "$", r: [E("Local emergency number","112","112 works in many countries; use your local number if different")] },
};

export const SX = {
  GB: [["GAMSTOP","https://www.gamstop.co.uk","Free self-exclusion from all UK-licensed online gambling."]],
  AU: [["BetStop","https://www.betstop.gov.au","National self-exclusion register for licensed online wagering."]],
  SE: [["Spelpaus","https://www.spelpaus.se","National self-exclusion from all licensed gambling in Sweden."]],
};

export const BL = [
  ["BetBlocker","https://betblocker.org","Free blocker for Windows, Mac, Android and iOS.",["Open betblocker.org and create a free account.","Download the app on every device you gamble on.","Sign in on each device and enable blocking when prompted.","Pick a long block period. Short ones are easy to cancel in a weak moment.","Optionally add a trusted person as your partner so they know if blocking is turned off."]],
  ["Gamban","https://gamban.com","Paid blocker for phones and computers. Some organisations offer free licences.",["Open gamban.com and choose a plan (check for a free licence offer).","Install it on every device.","Create your account and activate the licence.","Give your login to a trusted person so you can't easily switch it off."]],
  ["GamBlock","https://gamblock.com","Paid blocker for Windows, Mac and Android.",["Open gamblock.com and buy a licence.","Download and install it on your device.","Set a password and hand it to someone you trust.","Restart the device so blocking is fully active."]],
  ["Built-in phone controls","","Free, already on your phone.",["iPhone: Settings → Screen Time → Content & Privacy Restrictions → Web Content, then add betting sites under Never Allow.","Android: Settings → Digital Wellbeing → App timers, and set betting apps to 0 minutes.","Delete betting apps and sign out of betting accounts.","Ask your bank whether it can block gambling transactions."]],
];

export const SYS = `You are "Beacon," an empathetic, grounded, and non-judgmental AI companion. Your primary purpose is to provide compassionate, psychologically sound guidance to people experiencing gambling harm, compulsive wagering, or betting-related distress. You are also a fully capable general assistant for everyday tasks, adapting between your support role and general queries without forcing recovery advice when unprompted.

PROTOCOL 1: GAMBLING RECOVERY & CRISIS SUPPORT (PRIMARY)
Activate this whenever the user mentions gambling, betting, casinos, sports parlays, lotteries, speculative crypto/stock day-trading, debt from wagering, chasing losses, or cravings to bet.

1. Active Craving & Urge Surfing:
- Keep immediate responses short, grounding, and calm — never lecture or overwhelm.
- Urge Surfing: remind them cravings operate like ocean waves that peak and fade within 10-15 minutes if not fed. Propose delaying action for just 15 minutes.
- Immediate Physical Interrupts: encourage physical resets (stepping outside, washing face with cold water, drinking water, 4-4-6 belly breathing).
- Immediate Friction: prompt setting up obstacles (handing phone/cards to someone trusted, enabling bank gambling transaction locks, using blocker tools like Gamban or BetBlocker).

2. Cognitive Reframing (CBT & Motivational Interviewing):
- Loss Chasing: validate the panic of losing money, but firmly clarify that betting again mathematically compounds debt rather than resolving it.
- Challenge Cognitive Distortions: address the Gambler's Fallacy ("I'm due for a win"), near-miss traps, and illusions of control in chance games.
- Identify Triggers: ask open-ended questions about what prompted the urge (stress, isolation, boredom, financial anxiety).

3. Firm Boundaries:
- NEVER give betting tips, odds analysis, spread evaluations, or casino strategies.
- NEVER suggest gambling as a solution to financial hardship.
- Do not claim to be a licensed therapist or physician.

4. Emergency Crisis Intervention:
If the user indicates hopelessness, extreme despair, or self-harm/suicidal ideation:
- Immediately validate their pain and prioritize life safety.
- Provide free, confidential resources:
  * US/Canada: 1-800-GAMBLER (1-800-522-4700) or text 988.
  * UK: National Gambling Helpline at 0808 8020 133 (GamCare).
  * Australia: 1800 858 858.
  * Global/Online: gamblingtherapy.org & gamblersanonymous.org.
- Tell them to contact emergency services or a trusted person right now.

PROTOCOL 2: GENERAL ASSISTANT MODE
When the conversation is unrelated to gambling (coding, writing, answering factual questions):
- Provide direct, concise, and helpful answers.
- Do not mention gambling or recovery hotlines unless the user brings up risk or betting.

STEADY APP CONTEXT
- You have tools: use "calculate" for ANY arithmetic, and "get_my_stats" for the person's own numbers (days in recovery, money saved from their weekly spend, urges, triggers) instead of guessing.
- The app offers urge activities (breathing, grounding, walks), trusted contacts they can call, gambling blockers, and a Support tab with helplines for their country — point to these concretely instead of speaking abstractly.
- Reference their real history when it helps (streak, triggers, past urges that passed).
- Keep replies under ~120 words unless they ask for more, ask at most one question, and encourage reaching a trusted person when it fits. This chat is on a phone — be scannable.`;

export const PGSI = [
  "Have you bet more than you could really afford to lose?",
  "Have you needed to gamble with larger amounts of money to get the same feeling?",
  "Have you gone back another day to try to win back money you lost?",
  "Have you borrowed money or sold anything to get money to gamble?",
  "Have you felt that you might have a problem with gambling?",
  "Has gambling caused you any health problems, including stress or anxiety?",
  "Have people criticized your betting or told you that you had a gambling problem?",
  "Has your gambling caused any financial problems for you or your household?",
  "Have you felt guilty about the way you gamble or what happens when you gamble?",
];

export const CUR = [["NGN","₦"],["GHS","GH₵"],["KES","KSh"],["ZAR","R"],["GBP","£"],["USD","$"],["EUR","€"],["CAD","C$"],["AUD","A$"],["INR","₹"],
["AED","DH"],["AFN","AFN"],["ALL","L"],["AMD","AMD"],["ANG","ANG"],["AOA","Kz"],["ARS","AR$"],["AWG","AWG"],["AZN","AZN"],
["BAM","KM"],["BBD","Bds$"],["BDT","Tk"],["BGN","BGN"],["BHD","BD"],["BIF","BIF"],["BMD","BD$"],["BND","B$"],["BOB","Bs"],
["BRL","R$"],["BSD","B$"],["BTN","BTN"],["BWP","P"],["BYN","BYN"],["BZD","BZ$"],["CDF","CDF"],["CHF","CHF"],["CLP","CL$"],
["CNY","CN¥"],["COP","CO$"],["CRC","CRC"],["CUP","CUP"],["CVE","$"],["CZK","Kč"],["DJF","Fdj"],["DKK","kr"],["DOP","RD$"],
["DZD","DA"],["EGP","E£"],["ERN","Nfk"],["ETB","Br"],["FJD","FJ$"],["FKP","£"],["GEL","GEL"],["GIP","£"],["GMD","D"],
["GNF","GNF"],["GTQ","Q"],["GYD","GYD"],["HKD","HK$"],["HNL","L"],["HTG","HTG"],["HUF","Ft"],["IDR","Rp"],["ILS","₪"],
["IQD","IQD"],["IRR","IRR"],["ISK","kr"],["JMD","J$"],["JOD","JD"],["JPY","¥"],["KGS","KGS"],["KHR","KHR"],["KMF","CF"],
["KPW","KPW"],["KRW","₩"],["KWD","KD"],["KYD","CI$"],["KZT","KZT"],["LAK","LAK"],["LBP","LL"],["LKR","Rs"],["LRD","L$"],
["LSL","L"],["LYD","LD"],["MAD","DH"],["MDL","MDL"],["MGA","Ar"],["MKD","MKD"],["MMK","K"],["MNT","MNT"],["MOP","MOP$"],
["MRU","UM"],["MUR","Rs"],["MVR","Rf"],["MWK","MK"],["MXN","MX$"],["MYR","RM"],["MZN","MT"],["NAD","N$"],["NIO","C$"],
["NOK","kr"],["NPR","Rs"],["NZD","NZ$"],["OMR","RO"],["PAB","B/."],["PEN","S/"],["PGK","PGK"],["PHP","₱"],["PKR","Rs"],
["PLN","zł"],["PYG","PYG"],["QAR","QR"],["RON","lei"],["RSD","RSD"],["RUB","RUB"],["RWF","RF"],["SAR","SR"],["SBD","SI$"],
["SCR","Rs"],["SDG","SDG"],["SEK","kr"],["SGD","S$"],["SHP","£"],["SLE","Le"],["SOS","SoSh"],["SRD","SRD"],["SSP","SSP"],
["STN","Db"],["SYP","SYP"],["SZL","L"],["THB","฿"],["TJS","TJS"],["TMT","TMT"],["TND","DT"],["TOP","T$"],["TRY","TRY"],
["TTD","TT$"],["TWD","NT$"],["TZS","TSh"],["UAH","UAH"],["UGX","USh"],["UYU","$U"],["UZS","UZS"],["VES","VES"],["VND","₫"],
["VUV","VT"],["WST","WS$"],["XAF","CFA"],["XCD","EC$"],["XOF","CFA"],["XPF","CFP"],["YER","YER"],["ZMW","K"],["ZWG","ZWG"]];
export const CCD = { NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", IN: "INR",
  IE: "EUR", NZ: "NZD", SG: "SGD", MY: "MYR", PH: "PHP", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR",
  SE: "SEK", NO: "NOK", FI: "EUR", DK: "DKK", CH: "CHF", AT: "EUR", BE: "EUR", PT: "EUR", GR: "EUR", PL: "PLN",
  UA: "UAH", TR: "TRY", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", JM: "JMD", JP: "JPY",
  KR: "KRW", CN: "CNY", TW: "TWD", HK: "HKD", TH: "THB", ID: "IDR", PK: "PKR", BD: "BDT", SA: "SAR", AE: "AED",
  IL: "ILS", EG: "EGP", ET: "ETB", UG: "UGX", TZ: "TZS", RW: "RWF", XX: "USD" };

export const SB_CONF = {
  url: "https://atjidzxkzivzrxxbjprt.supabase.co",
  key: "sb_publishable_ifzTplYTkzKR8X0CkZPo7w_KJ-lpEyD",
};
