# يبني ملفات البيانات للموقع من نتائج السحب: فهرس خفيف + ملف لكل فصيلة.
import json, os, re, sys, urllib.parse, shutil
OUT = sys.argv[1]
rows = json.load(open('species.json', encoding='utf-8'))['results']['bindings']
wdrev = json.load(open('wdrev.json'))
arwiki = json.load(open('arwiki.json', encoding='utf-8'))
commons = json.load(open('commons.json', encoding='utf-8'))
xc = json.load(open('xc.json', encoding='utf-8')) if os.path.exists('xc.json') else {}

v = lambda r, k: r[k + '_']['value'] if k + '_' in r else None
qid = lambda u: u.rsplit('/', 1)[1] if u else None
fname = lambda u: urllib.parse.unquote(u.rsplit('/', 1)[1]).replace('_', ' ')

IUCN = {'Q211005': 'LC', 'Q719675': 'NT', 'Q278113': 'VU', 'Q11394': 'EN', 'Q219127': 'CR',
        'Q239509': 'EW', 'Q237350': 'EX', 'Q3245245': 'DD'}

# جذور أسماء الطيور الشائعة (الكلمة الأولى من الاسم). الباقي يُرتّب على حروف الاسم نفسه.
ROOTS = {
  'حمام': 'حمم', 'حمامة': 'حمم', 'يمام': 'يمم', 'يمامة': 'يمم', 'عقاب': 'عقب', 'غراب': 'غرب',
  'نسر': 'نسر', 'هدهد': 'هدهد', 'صقر': 'صقر', 'بوم': 'بوم', 'بومة': 'بوم', 'عصفور': 'عصفر',
  'قطا': 'قطو', 'قطاة': 'قطو', 'حجل': 'حجل', 'دجاج': 'دجج', 'دجاجة': 'دجج', 'بط': 'بطط', 'بطة': 'بطط',
  'نعام': 'نعم', 'نعامة': 'نعم', 'لقلق': 'لقلق', 'كركي': 'كرك', 'طاووس': 'طوس', 'بلبل': 'بلبل',
  'نقار': 'نقر', 'قمري': 'قمر', 'فاختة': 'فخت', 'زرزور': 'زرزر', 'خطاف': 'خطف', 'حداة': 'حدا',
  'رخمة': 'رخم', 'عقعق': 'عقعق', 'قبرة': 'قبر', 'كروان': 'كرو', 'صرد': 'صرد', 'حبارى': 'حبر',
  'هازجة': 'هزج',
}
TASHKEEL = re.compile(r'[ً-ْٰـ]')

def norm(s):
    s = TASHKEEL.sub('', s)
    return s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ؤ', 'و').replace('ئ', 'ي').replace('ى', 'ى')

def placement(ar):
    """يرجّع (الكلمة الأولى، الجذر أو None، الباب، الفصل)."""
    if not ar or not re.search(r'[ء-ي]', ar):
        return None, None, None, None
    head = norm(ar.split()[0])
    if head.startswith('ال') and len(head) > 3:
        head = head[2:]
    letters = [c for c in head if 'ء' <= c <= 'ي']
    root = ROOTS.get(head)
    base = list(root) if root else letters
    base = ['ا' if c in 'ءأإآ' else ('ي' if c == 'ى' else ('ه' if c == 'ة' else c)) for c in base]
    return head, (' '.join(root) if root else None), base[0], (base[1] if len(base) > 1 else base[0])

def media(file):
    if not file or file not in commons:
        return None
    m = commons[file]
    xcid = re.search(r'XC(\d+)', file)
    return {'file': file, **m, 'origin': ('https://xeno-canto.org/' + xcid.group(1)) if xcid else None}

families = {}
index = []
for r in rows:
    q = qid(r['s']['value'])
    sci = v(r, 'sci')
    ar = v(r, 'ar')
    if ar and not re.search(r'[ء-ي]', ar):
        ar = None
    head, root, bab, fasl = placement(ar)
    fam = qid(v(r, 'fam')) or 'none'
    arw = fname(v(r, 'arw')) if v(r, 'arw') else None
    aw = arwiki.get(arw) if arw else None
    text = None
    if aw and aw['text']:
        text = [p.strip() for p in aw['text'].split('\n') if len(p.strip()) > 20][:4]
    aud = fname(v(r, 'aud')) if v(r, 'aud') else xc.get(sci)
    bird = {
        'id': q, 'ar': ar, 'sci': sci, 'en': v(r, 'en'), 'iucn': IUCN.get(qid(v(r, 'iucn'))),
        'wdrev': wdrev.get(q), 'head': head, 'root': root,
        'arwiki': {'title': aw['title'], 'rev': aw['rev'], 'text': text} if aw and text else None,
        'enwiki': fname(v(r, 'enw')) if v(r, 'enw') else None,
        'image': media(fname(v(r, 'img'))) if v(r, 'img') else None,
        'audio': media(aud),
        'audioFromSearch': bool(aud and not v(r, 'aud')),
        'video': media(fname(v(r, 'vid'))) if v(r, 'vid') else None,
    }
    f = families.setdefault(fam, {'id': fam, 'sci': v(r, 'famsci'), 'ar': v(r, 'famar'),
                                  'ord': {'id': qid(v(r, 'ord')), 'sci': v(r, 'ordsci'), 'ar': v(r, 'ordar')}, 'birds': []})
    f['birds'].append(bird)
    thumb = bird['image']['thumb'] if bird['image'] else ''
    # الفهرس: [المعرّف، الاسم العربي، العلمي، الإنجليزي، الفصيلة، الباب، الفصل، صورة مصغرة، صوت؟، حالة الحفظ]
    index.append([q, ar, sci, bird['en'], fam, bab, fasl, thumb.split('/commons/', 1)[-1] if thumb else '',
                  1 if bird['audio'] else 0, bird['iucn']])

d = os.path.join(OUT, 'world')
shutil.rmtree(d, ignore_errors=True)
os.makedirs(os.path.join(d, 'fam'))
for fid, f in families.items():
    f['birds'].sort(key=lambda b: (b['ar'] is None, norm(b['ar'] or ''), b['sci']))
    json.dump(f, open(os.path.join(d, 'fam', fid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
fams = sorted(({'id': f['id'], 'sci': f['sci'], 'ar': f['ar'], 'ord': f['ord'], 'n': len(f['birds'])} for f in families.values()),
              key=lambda f: (f['ord']['sci'] or '', f['sci'] or ''))
json.dump({'built': sys.argv[2], 'families': fams, 'birds': index},
          open(os.path.join(d, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
named = sum(1 for b in index if b[1])
print('species', len(index), 'named', named, 'families', len(families), 'with audio', sum(b[8] for b in index),
      'with image', sum(1 for b in index if b[7]), 'with arwiki text', sum(1 for f in families.values() for b in f['birds'] if b['arwiki']))
print('index size KB', os.path.getsize(os.path.join(d, 'index.json')) // 1024)
