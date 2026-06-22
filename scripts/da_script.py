#!/usr/bin/env python3
"""'$2,000 Lead Disaster' — panels + scene list. Look comes from the Recraft style_id;
panels stay B&W (no green) and green is added in compositing on the positive beats."""

VOICES = {"mike": "xtULFA9zNGQyyZJJR4mQ", "frank": "0e671a523e3d4cd7b6d5c580de70931e"}

FRANK = "Foreman Frank, 50-year-old construction foreman, gray beard, safety glasses, hard hat, work shirt, tool belt, highly expressive face. "
MIKE = "Marketing Mike, 30-year-old digital marketing guy, slim blazer over a t-shirt, trendy haircut, glasses, holding a tablet, highly expressive face. "
PAL = " Black and white comic, bold clean outlines, flat shading, only black, white and navy #0A1628, no green. Plain white background, no scenery, no gradients. Chest-up, centered, headroom around the head."

PANELS = {
 "mike_confident": MIKE + "Big confident grin, holding up the tablet proudly, presenting great news." + PAL,
 "mike_pause":     MIKE + "Awkward sheepish half-smile, hesitating, eyes shifting to the side." + PAL,
 "mike_nervous":   MIKE + "Nervous, one sweat bead, anxiously swiping the tablet, forced smile." + PAL,
 "mike_defeated":  MIKE + "Shrinking small and defeated, wincing, holding the tablet limply." + PAL,
 "frank_coffee":   FRANK + "Holding a coffee mug, looking up with a flat unimpressed expression." + PAL,
 "frank_deadpan":  FRANK + "Arms crossed, completely deadpan, flat blank stare at the viewer." + PAL,
 "frank_eyebrow":  FRANK + "Arms crossed, one eyebrow raised high, skeptical smirk." + PAL,
 "frank_camera":   FRANK + "Arms crossed, serious and confident, looking directly at the camera." + PAL,
 "frank_approve":  FRANK + "Satisfied approving smile, giving a thumbs up." + PAL,
}

# scale = character height fraction of frame; zoom = push-in intensity
SCENES = [
 {"id":"s1","panel":"mike_confident","voice":"mike","vo":"Frank! Great news. Your latest campaign generated fourteen thousand, three hundred seventy-two impressions!","on":{"big":"14,372","sub":"IMPRESSIONS"},"scale":0.74,"zoom":0.05},
 {"id":"s2","panel":"frank_coffee","voice":"frank","vo":"How many jobs?","on":None,"scale":0.80,"zoom":0.08},
 {"id":"s3","panel":"mike_pause","voice":"mike","vo":"Well... fourteen thousand, three hundred seventy-two impressions.","on":{"small":"14,372 impressions"},"scale":0.74,"zoom":0.05},
 {"id":"s4","panel":"frank_deadpan","voice":"frank","vo":"That's not what I asked.","on":None,"scale":0.92,"zoom":0.12},
 {"id":"s5","panel":"mike_nervous","voice":"mike","vo":"Okay... forty-seven website visitors.","on":{"big":"47","sub":"VISITORS"},"scale":0.74,"zoom":0.05},
 {"id":"s6","panel":"frank_eyebrow","voice":"frank","vo":"How many jobs?","on":None,"scale":0.82,"zoom":0.09},
 {"id":"s7","panel":"mike_defeated","voice":"mike","vo":"Zero.","on":{"huge":"0"},"scale":0.80,"zoom":0.14},
 {"id":"s8","panel":"frank_camera","voice":"frank","vo":"Contractors can't deposit impressions. They deposit customers.","on":None,"scale":0.82,"zoom":0.07},
 {"id":"s9","panel":None,"voice":None,"vo":None,"on":{"special":"green_turn"},"scale":0,"zoom":0.04,"secs":2.6},
 {"id":"s10","panel":"frank_approve","voice":"frank","vo":"Now we're talking.","on":{"special":"endcard"},"scale":0.66,"zoom":0.03,"secs":4.2},
]
