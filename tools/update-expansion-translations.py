"""Merge expansion messages into POT/PO catalogs, retaining untranslated English fallback.

Requires Babel (python -m pip install Babel). Existing catalog formatting is preserved.
"""
import json
import re
from io import BytesIO
from pathlib import Path
from babel.messages.extract import extract
from babel.messages.pofile import read_po

root = Path(__file__).resolve().parents[1]
translations = json.loads((root / 'lang/crystal-expansion-zh_cn.json').read_text(encoding='utf-8'))
translations.update(json.loads((root / 'lang/expansion-interface-zh_cn.json').read_text(encoding='utf-8')))
for item in ['energy blade', 'fluid recycler', 'cargo drone', 'kinetic armour',
             'disruptor', 'hypo', 'stim', 'plasma rifle', 'glowstone']:
    translations[item + ' blueprint'] = translations[item] + '蓝图'
for key in list(translations):
    if key.startswith(('A ', 'Abandoned ')):
        translations[key.replace(' ', '&nbsp;')] = translations[key]

files = ['script/events/industry.js', 'script/events/ships.js', 'script/ship.js',
         'script/events/frontier.js',
         'script/events/encounters.js', 'script/events/marketing.js',
         'script/events/executioner.js', 'script/fabricator.js', 'script/mobile.js', 'script/space.js']
messages = set(translations)
for filename in files:
    for _, message, _, _ in extract('javascript', BytesIO((root / filename).read_bytes()), keywords={'_': None}):
        if isinstance(message, str):
            messages.add(message)

catalogs = [root / 'lang/adarkroom.pot', *sorted((root / 'lang').glob('*/strings.po'))]
for path in catalogs:
    original = path.read_text(encoding='utf-8')
    if path.parent.name == 'zh_cn':
        # Update existing (including empty) entries without reformatting the legacy catalog.
        blocks = re.split(r'(\n\s*\n)', original)
        for index in range(0, len(blocks), 2):
            block = blocks[index]
            match = re.search(r'^msgid (".*"(?:\n".*")*)', block, re.M)
            if not match:
                continue
            key = ''.join(json.loads(line) for line in match.group(1).splitlines())
            if key not in translations:
                continue
            block = re.sub(r'^msgstr ".*"(?:\n".*")*',
                           lambda _: 'msgstr ' + json.dumps(translations[key], ensure_ascii=False), block, flags=re.M)
            block = re.sub(r'^#, fuzzy\n', '', block, flags=re.M)
            blocks[index] = block
        updated = ''.join(blocks)
        if updated != original:
            path.write_text(updated, encoding='utf-8')
    source = re.sub(rb'^"(?:PO-Revision-Date|POT-Creation-Date):[^\n]*\n', b'', path.read_bytes(), flags=re.M)
    catalog = read_po(BytesIO(source))
    added = []
    for message in sorted(messages):
        if message in catalog:
            continue
        translated = translations.get(message, '') if path.parent.name == 'zh_cn' else ''
        added.append('\n#. Crystal expedition expansion; empty translations use the English source.\n'
                     f'msgid {json.dumps(message, ensure_ascii=False)}\n'
                     f'msgstr {json.dumps(translated, ensure_ascii=False)}\n')
    if added:
        with path.open('a', encoding='utf-8', newline='\n') as target:
            target.write(''.join(added))

# The game loads a generated JS dictionary, so merge without overwriting legacy translations.
path = root / 'lang/zh_cn/strings.js'
source = path.read_text(encoding='utf-8')
start, end = source.index('{'), source.rindex('}') + 1
dictionary = json.loads(source[start:end])
dictionary.update(translations)
path.write_text(source[:start] + json.dumps(dictionary, ensure_ascii=True) + source[end:], encoding='utf-8')
print(f'Updated {len(catalogs)} catalogs and Simplified Chinese runtime strings.')
