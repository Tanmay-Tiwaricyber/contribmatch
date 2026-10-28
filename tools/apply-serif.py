#!/usr/bin/env python3
"""Apply the 'one Instrument Serif italic phrase per heading' rule to the
translation dictionaries.

Each heading gets exactly one <em class="serif"> phrase. The script refuses to
run if a heading ends up with zero or more than one phrase.
"""
import re
import sys

FILES = {
    "js/i18n/en.js": {
        "hero.title": 'Find an issue <em class="serif">you can actually finish</em>',
        "how.title": 'Four agents, <em class="serif">one shortlist</em>',
        "features.title": 'Built for <em class="serif">the first pull request</em>',
        "open.title": 'Open weights, open data, <em class="serif">open contribution</em>',
        "packs.title": 'Packs written <em class="serif">by the community</em>',
        "cta.title": 'Pick one issue. <em class="serif">That is the whole job.</em>',
        "app.title": 'Your issue <em class="serif">shortlist</em>',
        "issue.title": 'Your plan <em class="serif">for this issue</em>',
        "shortlist.title": 'Your saved <em class="serif">issues</em>',
        "docs.title": 'Setup, settings and the <em class="serif">privacy model</em>',
        "contribute.title": 'Help make ContribMatch <em class="serif">better</em>',
        "privacy.title": 'What ContribMatch <em class="serif">stores</em>',
        "design.title": 'Living <em class="serif">style guide</em>',
        "notFound.title": 'This page <em class="serif">does not exist</em>',
        "packsPage.title": 'Community <em class="serif">packs</em>',
        "hero.eyebrow": 'One issue at a time',
    },
    "js/i18n/hi.js": {
        "hero.title": 'ऐसा issue ढूँढें <em class="serif">जो आप सचमुच पूरा कर सकें</em>',
        "how.title": 'चार एजेंट, <em class="serif">एक छँटी सूची</em>',
        "features.title": '<em class="serif">पहले pull request</em> के लिए बना',
        "open.title": 'ओपन वेट्स, ओपन डेटा, <em class="serif">ओपन योगदान</em>',
        "packs.title": 'समुदाय के लिए <em class="serif">लिखे पैक</em>',
        "cta.title": 'एक issue चुनिए। <em class="serif">बस इतना ही काम है।</em>',
        "app.title": 'आपकी issue <em class="serif">सूची</em>',
        "issue.title": 'इस issue की आपकी <em class="serif">योजना</em>',
        "shortlist.title": 'आपके <em class="serif">सेव किए issues</em>',
        "docs.title": 'सेटअप, सेटिंग्स और <em class="serif">प्राइवेसी मॉडल</em>',
        "contribute.title": 'ContribMatch को <em class="serif">बेहतर</em> बनाने में मदद करें',
        "privacy.title": 'ContribMatch <em class="serif">क्या सेव करता है</em>',
        "design.title": '<em class="serif">जीवंत</em> स्टाइल गाइड',
        "notFound.title": 'यह पेज <em class="serif">मौजूद नहीं है</em>',
        "packsPage.title": 'कम्युनिटी <em class="serif">पैक</em>',
        "hero.eyebrow": 'एक बार में एक issue',
    },
    "js/i18n/hinglish.js": {
        "hero.title": 'Ek issue dhundo <em class="serif">jo aap sach mein finish kar sako</em>',
        "how.title": 'Char agents, <em class="serif">ek shortlist</em>',
        "features.title": '<em class="serif">Pehle PR</em> ke liye bana hai',
        "open.title": 'Open weights, open data, <em class="serif">open contribution</em>',
        "packs.title": 'Community ke <em class="serif">likhe packs</em>',
        "cta.title": 'Ek issue chuno. <em class="serif">Bas itna hi kaam hai.</em>',
        "app.title": 'Aapki issue <em class="serif">shortlist</em>',
        "issue.title": 'Is issue ke liye aapka <em class="serif">plan</em>',
        "shortlist.title": 'Aapke <em class="serif">saved issues</em>',
        "docs.title": 'Setup, settings aur <em class="serif">privacy model</em>',
        "contribute.title": 'ContribMatch ko <em class="serif">behtar</em> banane mein madad karo',
        "privacy.title": 'ContribMatch <em class="serif">kya store karta hai</em>',
        "design.title": '<em class="serif">Living</em> style guide',
        "notFound.title": 'Ye page <em class="serif">exist nahi karta</em>',
        "packsPage.title": 'Community <em class="serif">packs</em>',
        "hero.eyebrow": 'Ek issue, ek time',
    },
}

for path, values in FILES.items():
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    for key, value in values.items():
        pattern = re.compile(r"(\'" + re.escape(key) + r"\'\s*:\s*)([\'\"].*?[\'\"],)", re.S)
        if not pattern.search(text):
            print(f"  ! {path}: key {key} not found")
            continue
        text = pattern.sub(lambda m: m.group(1) + "'" + value.replace("'", "\\'") + "',", text, count=1)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"updated {path}")

# Verify: exactly one serif phrase per heading key.
for path in FILES:
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    for key in FILES[path]:
        m = re.search(r"'" + re.escape(key) + r"'\s*:\s*'([^']*)'", text)
        if not m:
            print(f"  ! cannot read {key} in {path}")
            continue
        count = m.group(1).count('<em class="serif">')
        if count != 1:
            print(f"  ! {path}: {key} has {count} serif phrases")
            sys.exit(1)
print("all heading keys carry exactly one serif phrase")
