"""SHOP TALK with AAAA-RON — the one-liner library (round one). Each line renders
as a stage clip and runs through the show format (cover + cold-open hook + bit +
outro). Avatar alternates lookA (AAAA-RON) / lookB for visual variety; series
chrome stays 'SHOP TALK · with AAAA-RON' throughout. Competitor names kept as
written (comedy). 'PILOT' = the 5 we validate first."""
LOOKA = "ec564e1e4d0942c19cbba4fe23940d19"  # AAAA-RON (stage)
LOOKB = "1f8411c83f2f4d2e82fc3c381c2f2592"
VOICE = "41c46ea57c0a4dd29e3acd1de0765c05"

# (id, category, text) — punctuation kept; periods drive the beats.
_RAW = [
 ("trade", "Hail damage is the sky filing a complaint. And your roof is the only name on it."),
 ("trade", "A gutter is a river with low self-esteem. And a job it settled for."),
 ("trade", "A brick is a tiny wall that succeeded. And it won't let the other bricks forget it."),
 ("trade", "Carpet is a floor that decided to be a sweater."),
 ("trade", "A door that sticks isn't broken. It's just unsure. And taking it out on your shoulder."),
 ("trade", "I built a deck. Now the backyard has a stage, an audience of one, and no talent."),
 ("trade", "A screw is a nail that believes in itself. And makes everyone turn for it."),
 ("trade", "A hinge is the only part of the door willing to compromise. Which is why it's exhausted."),
 ("trade", "A baseboard is trim that knows its place. It's made peace with the floor."),
 ("trade", "A joist is a beam with impostor syndrome."),
 ("trade", "Plywood is wood that found strength in numbers. Because alone, it was nothing."),
 ("trade", "A dimmer is a switch that can't fully commit. And calls it ambiance."),
 ("trade", "A sander is a tool that smooths things over. And leaves the mess for someone else."),
 ("trade", "Stucco is a wall that joined a texture cult."),
 ("trade", "A spiral staircase is a regular staircase having a breakdown."),
 ("trade", "A French drain is a regular drain that thinks it's better than you. Because it has a name."),
 ("trade", "A garbage disposal is a blender with a dark past."),
 ("trade", "A ceiling fan is a helicopter that gave up on its dreams."),
 ("trade", "A space heater is a tiny sun. You're not supposed to trust it or leave it alone."),
 ("trade", "A chain-link fence is a fence that gave up on secrets. It lets the whole street watch."),
 ("trade", "A weather vane is a rooster that chose a career in meteorology."),
 ("trade", "A screen door is a door with boundary issues. It lets everything in but the dog."),
 ("trade", "A nightlight is a lamp that never grew out of it. And still can't sleep."),
 ("trade", "A mini fridge is a fridge that never left college."),
 ("trade", "A dishwasher is an appliance that does the bare minimum. And acts exhausted."),
 ("trade", "A bar stool is a chair that's just here for a good time. And never remembers it."),
 ("trade", "A power strip is an outlet that started a commune."),
 ("trade", "A welcome mat is a doormat that chose to stay positive. Which is its whole problem."),
 ("trade", "A cul-de-sac is a street that gave up halfway and built a life there."),
 ("mktg", "Thumbtack is the friend who introduces you to people who aren't home. And still asks for forty dollars."),
 ("mktg", "The Google algorithm is a teacher who changes the test, won't say what's on it, and takes it personally when you ask."),
 ("mktg", "Google is the friend who knows everything about you, pretends you just met, and writes it all down."),
 ("mktg", "A Facebook ad is a billboard that follows you home, waits outside, and remembers you almost bought boots."),
 ("mktg", "Meta is the neighbor who swears it isn't listening. And knows your shoe size."),
 ("mktg", "A cookie banner is a doorman who asks permission after you're already inside. And took your coat."),
 ("mktg", "A privacy policy is a novel nobody has read, including the author. And it's about you."),
 ("mktg", "Consent is the polite knock everyone decided was optional. Right before walking in."),
 ("mktg", "Google Analytics is a friend who tells you exactly what happened, never why, and acts hurt when you ask."),
 ("mktg", "Angi is a wingman who sets you up with people who aren't interested, bills you for the heartbreak, and lines up the next one."),
 ("mktg", "A shared lead is a blind date who brought four other contractors. And will probably have their cousin do the work."),
 ("mktg", "A tire kicker test-drives the whole lot, asks about financing, and then takes the bus home."),
 ("mktg", "A one-star review is a stranger who waited eight months to tell the world you exist. And spelled it wrong."),
 ("mktg", "The lowest bidder is a guy you meet twice. The second time, he's not there."),
 ("mktg", "My buddy can do it cheaper is a sentence with a sequel. And you've read the script."),
 ("anec", "I played poker with the plumber while he fixed my toilet. His flush beat my full house. And the toilet still runs."),
 ("anec", "I asked Thumbtack to fix my dishwasher. They sent a guy who offered to take my wife out. I don't think he meant dinner."),
 ("anec", "I told my roofer I was single. He said so were half my shingles. Two of them left during the estimate."),
 ("anec", "My electrician told me I wasn't grounded. Turned out neither was the house. But only one of us was fixable by Tuesday."),
 ("anec", "The painter promised he'd cut corners for me. I didn't realize that was the technique."),
 ("anec", "I called a locksmith when I got locked out. He had my door open in nine seconds. And I've slept worse ever since."),
 ("anec", "I asked the SEO guy when I'd hit page one. He said soon, the same way a contractor says it. I'm still waiting on both."),
]
LINES = [{"id": f"{i+1:02d}", "cat": c, "text": t, "avatar": LOOKA if i % 2 == 0 else LOOKB}
         for i, (c, t) in enumerate(_RAW)]
BY_ID = {l["id"]: l for l in LINES}
# Cut during review — excluded from re-render + the gallery.
DELETED = {"01", "03", "04", "10", "14", "17", "22", "23", "27", "35", "36", "37", "38", "43", "47", "48", "49"}
# pilot across categories: short trade, medium trade, competitor, privacy, long anecdote
PILOT = ["10", "11", "30", "35", "45"]
