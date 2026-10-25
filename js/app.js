(() => {
  'use strict';

  // ترتيب الحروف كما في المعجم الوسيط
  const ALPHABET = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
  const LETTER_NAMES = {
    'ا': 'الهمزة', 'ب': 'الباء', 'ت': 'التاء', 'ث': 'الثاء', 'ج': 'الجيم', 'ح': 'الحاء', 'خ': 'الخاء',
    'د': 'الدال', 'ذ': 'الذال', 'ر': 'الراء', 'ز': 'الزاي', 'س': 'السين', 'ش': 'الشين', 'ص': 'الصاد',
    'ض': 'الضاد', 'ط': 'الطاء', 'ظ': 'الظاء', 'ع': 'العين', 'غ': 'الغين', 'ف': 'الفاء', 'ق': 'القاف',
    'ك': 'الكاف', 'ل': 'اللام', 'م': 'الميم', 'ن': 'النون', 'ه': 'الهاء', 'و': 'الواو', 'ي': 'الياء'
  };
  const SECTIONS = [
    ['about', 'التعريف'],
    ['shape', 'الشكل والحجم'],
    ['colors', 'الألوان'],
    ['food', 'الغذاء'],
    ['voice', 'الصوت']
  ];
  const MEDIA_LABEL = { image: 'الصورة', audio: 'التسجيل الصوتي', video: 'المقطع المرئي' };
  const IUCN = {
    LC: 'غير مهدَّد (أقل اهتمام)', NT: 'قريب من التهديد', VU: 'معرَّض للخطر', EN: 'مهدَّد بالانقراض',
    CR: 'مهدَّد بشدة بالانقراض', EW: 'منقرض في البرية', EX: 'منقرض', DD: 'بيانات ناقصة'
  };
  const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/';
  const PRINT_IMAGE_LIMIT = 300;

  const norm = (ch) => (['أ', 'إ', 'آ', 'ء'].includes(ch) ? 'ا' : ch);
  const rank = (ch) => ALPHABET.indexOf(norm(ch));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const babName = (l) => 'باب ' + LETTER_NAMES[l];
  const faslName = (l) => 'فصل ' + LETTER_NAMES[l];
  const stripTashkeel = (s) => (s || '').replace(/[ً-ْٰـ]/g, '');
  const normName = (s) => stripTashkeel(s).replace(/[أإآ]/g, 'ا').replace(/^ال/, '');
  const fmt = (n) => n.toLocaleString('ar-EG');
  const small = (thumb) => (thumb ? COMMONS + thumb.replace(/\/\d+px-/, '/250px-') : '');

  // ---------- البيانات ----------
  // المواد المحرّرة يدويًا (data/birds.js) + فهرس طيور العالم (data/world/index.json)
  const curated = window.BIRDS;
  const curatedById = Object.fromEntries(curated.map((b) => [b.id, b]));
  const curatedBySci = Object.fromEntries(curated.map((b) => [b.scientific, b]));
  let entries = [];       // كل الطيور
  let byId = {};
  let families = [];
  let familyById = {};
  let built = '';
  const famCache = new Map();

  function makeEntry(row) {
    const [id, ar, sci, en, fam, bab, fasl, thumb, aud, iucn] = row;
    const c = curatedBySci[sci];
    const e = { id, ar, sci, en, fam, bab, fasl, thumb, aud, iucn, curated: c || null };
    if (c) {
      e.ar = c.name;
      e.bab = norm(c.root[0]);
      e.fasl = norm(c.root[1]);
      e.root = c.root;
    }
    return e;
  }

  function compareEntries(a, b) {
    return rank(a.bab) - rank(b.bab) || rank(a.fasl) - rank(b.fasl) ||
      normName(a.ar).localeCompare(normName(b.ar), 'ar') || a.sci.localeCompare(b.sci);
  }

  async function loadIndex() {
    const res = await fetch('data/world/index.json');
    if (!res.ok) throw new Error('index');
    const data = await res.json();
    built = data.built;
    families = data.families;
    familyById = Object.fromEntries(families.map((f) => [f.id, f]));
    entries = data.birds.map(makeEntry);
    entries.sort((a, b) => (a.bab ? 0 : 1) - (b.bab ? 0 : 1) || (a.bab ? compareEntries(a, b) : a.sci.localeCompare(b.sci)));
    byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    for (const c of curated) {
      const e = entries.find((x) => x.curated === c);
      if (e) byId[c.id] = e;
    }
  }

  async function loadFamily(id) {
    if (!famCache.has(id)) {
      famCache.set(id, fetch('data/world/fam/' + id + '.json').then((r) => {
        if (!r.ok) throw new Error('fam');
        return r.json();
      }));
    }
    return famCache.get(id);
  }

  async function worldRecord(entry) {
    const fam = await loadFamily(entry.fam);
    return { bird: fam.birds.find((b) => b.id === entry.id), fam };
  }

  const named = () => entries.filter((e) => e.bab);
  const unnamed = () => entries.filter((e) => !e.bab);

  // ---------- التوثيق: ترقيم الحواشي لكل طائر ----------
  function makeNotes(localSources, birdId) {
    const list = [];
    const index = new Map();
    const resolve = (ref) => {
      if (typeof ref === 'string') return { key: 'local:' + ref, ...localSources[ref] };
      const g = window.SOURCES[ref.s];
      return { key: ref.s + ':' + ref.at, ...g, at: ref.at, url: ref.url || g.url };
    };
    const cite = (refs) => (refs || []).map((ref) => {
      const src = resolve(ref);
      if (!index.has(src.key)) { list.push(src); index.set(src.key, list.length); }
      const n = index.get(src.key);
      return `<a class="fn" href="#note-${birdId}-${n}" data-note="${birdId}-${n}">${n}</a>`;
    }).join('');
    return { list, cite };
  }

  function noteHtml(src, n, birdId) {
    const parts = [`<strong>${esc(src.title)}</strong>`];
    if (src.author) parts.push(esc(src.author));
    if (src.at) parts.push(esc(src.at));
    if (src.detail) parts.push(esc(src.detail));
    let link = '';
    if (src.url) {
      link = ` — <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.url)}</a>`;
      if (src.type === 'web') link += ` <span class="muted">(تاريخ الاطلاع ${esc(src.accessed || window.ACCESS_DATE)})</span>`;
    }
    const badge = src.verified
      ? '<span class="badge ok" title="رُوجع من الرابط مباشرة">موثّق برابط</span>'
      : '<span class="badge pending" title="يحتاج مطابقة الجزء والصفحة في طبعة محددة">يحتاج رقم الجزء والصفحة</span>';
    return `<li id="note-${birdId}-${n}">${parts.join('، ')}${link} ${badge}</li>`;
  }

  function mediaCredit(m, kind) {
    const origin = m.origin ? ` — التسجيل الأصلي: <a href="${esc(m.origin)}" target="_blank" rel="noopener">${esc(m.origin)}</a>` : '';
    const lic = m.licenseUrl
      ? `<a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener">${esc(m.license)}</a>`
      : esc(m.license || 'غير مذكورة');
    return `<li><strong>${MEDIA_LABEL[kind]}:</strong> «${esc(m.file)}»، تصوير/تسجيل: ${esc(m.author || 'غير مذكور')}، الرخصة: ${lic}، المصدر: <a href="${esc(m.page)}" target="_blank" rel="noopener">ويكيميديا كومنز</a>${origin} <span class="badge ok">موثّق برابط</span></li>`;
  }

  const pending = '<p class="gap">لم نثبت في هذا الباب مادة موثّقة بعد.</p>';

  function figure(img, name, sci) {
    return img
      ? `<figure class="bird-figure">
           <img src="${esc(img.thumb || img.src)}" alt="صورة ${esc(name)} (${esc(sci)})" loading="lazy">
           <figcaption>${esc(img.author)} · ${esc(img.license)} · ويكيميديا كومنز</figcaption>
         </figure>`
      : '';
  }

  function mediaBlocks(media, print) {
    const audio = media.audio
      ? (print
          ? `<p>استمع إلى التسجيل: <a href="${esc(media.audio.page)}">${esc(media.audio.page)}</a></p>`
          : `<audio controls preload="none" src="${esc(media.audio.src)}"></audio>`)
      : '<p class="gap">لا يوجد تسجيل موثّق لصوته بعد.</p>';
    const video = media.video
      ? (print
          ? `<p>شاهد المقطع: <a href="${esc(media.video.page)}">${esc(media.video.page)}</a></p>`
          : `<video controls preload="none" src="${esc(media.video.src)}" poster="${esc(media.image ? (media.image.thumb || '') : '')}"></video>`)
      : '<p class="gap">لا يوجد مقطع مرئي موثّق بعد.</p>';
    return `
        <section class="field media-block"><h3>صوته</h3>${audio}</section>
        <section class="field media-block"><h3>مقطع مرئي</h3>${video}</section>`;
  }

  function notesBlock(list, birdId, media) {
    return `
        <section class="field notes">
          <h3>المصادر والحواشي</h3>
          <ol>${list.map((s, i) => noteHtml(s, i + 1, birdId)).join('')}</ol>
          <h4>توثيق الوسائط</h4>
          <ul class="media-credits">${['image', 'audio', 'video'].filter((k) => media[k]).map((k) => mediaCredit(media[k], k)).join('') || '<li class="muted">لا توجد وسائط.</li>'}</ul>
        </section>`;
  }

  function placeLine(e) {
    if (!e.bab) return 'طيور بلا اسم عربي موثّق';
    const root = e.root ? ` · الجذر (${e.root.join(' ')})` : '';
    return `${babName(e.bab)} · ${faslName(e.fasl)}${root}`;
  }

  // ---------- صفحتا الطائر المحرَّر يدويًا ----------
  function curatedSheets(bird, entry, { print = false, images = true } = {}) {
    const media = (window.MEDIA || {})[bird.id] || {};
    const { list, cite } = makeNotes(bird.sources, bird.id);
    const para = (items) => items.map((x) => `<p>${esc(x.t)}${cite(x.c)}</p>`).join('');
    const entriesDl = (items) => `<dl class="entries">${items.map((x) => `<div><dt>${esc(x.w)}</dt><dd>${esc(x.m)}${cite(x.c)}</dd></div>`).join('')}</dl>`;
    const lx = bird.lexical;

    const sheet1 = `
      <article class="sheet" aria-label="الصفحة الأولى: ${esc(bird.name)}">
        <header class="sheet-head">
          <p class="place">${placeLine(entry)}</p>
          <h2 class="entry-title">${esc(bird.name)}</h2>
          <p class="sci"><bdi lang="la">${esc(bird.scientific)}</bdi> · ${esc(bird.common)}</p>
          <span class="page-no">الصفحة ١</span>
        </header>
        ${images ? figure(media.image, bird.name, bird.scientific) : ''}
        ${SECTIONS.map(([k, label]) => `
          <section class="field">
            <h3>${label}</h3>
            ${bird[k] && bird[k].length ? para(bird[k]) : pending}
          </section>`).join('')}
      </article>`;

    const body2 = `
        <section class="field">
          <h3>الجذر والمعنى المعجمي</h3>
          <p class="root-chips">${bird.root.map((r) => `<span>${esc(r)}</span>`).join('')}</p>
          ${para(lx.meaning)}
        </section>
        <section class="field"><h3>الاشتقاقات</h3>${lx.derivations.length ? entriesDl(lx.derivations) : pending}</section>
        <section class="field"><h3>ألفاظ الصوت</h3>${lx.sounds.length ? entriesDl(lx.sounds) : pending}</section>
        ${lx.quran.length ? `
        <section class="field">
          <h3>الشواهد القرآنية</h3>
          ${lx.quran.map((x) => `<blockquote class="ayah">﴿${esc(x.t)}﴾${cite(x.c)}</blockquote>`).join('')}
        </section>` : ''}
        ${mediaBlocks(media, print)}`;

    const sheet2 = `
      <article class="sheet" aria-label="الصفحة الثانية: ${esc(bird.name)}">
        <header class="sheet-head small">
          <p class="place">${placeLine(entry)}</p>
          <h2 class="entry-title">${esc(bird.name)} <span class="muted">— اللغة والوسائط</span></h2>
          <span class="page-no">الصفحة ٢</span>
        </header>
        ${body2}
        ${notesBlock(list, bird.id, media)}
      </article>`;
    return sheet1 + sheet2;
  }

  // ---------- صفحتا الطائر من بيانات العالم ----------
  function worldSheets(b, fam, entry, { print = false, images = true } = {}) {
    const sources = {
      wd: {
        type: 'web', title: 'ويكيداتا: ' + b.sci + ' (' + b.id + ')',
        detail: b.wdrev ? 'النسخة المثبّتة رقم ' + b.wdrev : '',
        url: 'https://www.wikidata.org/w/index.php?title=' + b.id + (b.wdrev ? '&oldid=' + b.wdrev : ''),
        verified: true, accessed: built
      }
    };
    if (b.arwiki) {
      sources.ar = {
        type: 'web', title: 'ويكيبيديا العربية: ' + b.arwiki.title, detail: 'النسخة المثبّتة رقم ' + b.arwiki.rev,
        url: 'https://ar.wikipedia.org/w/index.php?oldid=' + b.arwiki.rev, verified: true, accessed: built
      };
    }
    const { list, cite } = makeNotes(sources, b.id);
    const name = b.ar || b.en || b.sci;
    const media = { image: b.image, audio: b.audio, video: b.video };
    const famLine = fam.ar ? `${esc(fam.ar)} <bdi lang="la">(${esc(fam.sci)})</bdi>` : `<bdi lang="la">${esc(fam.sci || '—')}</bdi>`;
    const ordLine = fam.ord.ar ? `${esc(fam.ord.ar)} <bdi lang="la">(${esc(fam.ord.sci)})</bdi>` : `<bdi lang="la">${esc(fam.ord.sci || '—')}</bdi>`;

    const about = b.arwiki
      ? b.arwiki.text.map((p) => `<p>${esc(p)}${cite(['ar'])}</p>`).join('')
      : `<p class="gap">لا توجد مقالة عربية عن هذا الطائر بعد.${b.enwiki ? ` للاستزادة: <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(b.enwiki.replace(/ /g, '_'))}" target="_blank" rel="noopener">ويكيبيديا الإنجليزية</a>.` : ''}</p>`;

    const sheet1 = `
      <article class="sheet" aria-label="الصفحة الأولى: ${esc(name)}">
        <header class="sheet-head">
          <p class="place">${placeLine(entry)}</p>
          <h2 class="entry-title">${esc(name)}</h2>
          <p class="sci"><bdi lang="la">${esc(b.sci)}</bdi>${b.en ? ` · <bdi lang="en">${esc(b.en)}</bdi>` : ''}</p>
          <span class="page-no">الصفحة ١</span>
        </header>
        ${images ? figure(b.image, name, b.sci) : ''}
        <section class="field"><h3>التعريف</h3>${about}</section>
        <section class="field">
          <h3>التصنيف</h3>
          <dl class="facts">
            <dt>الرتبة</dt><dd>${ordLine}${cite(['wd'])}</dd>
            <dt>الفصيلة</dt><dd>${famLine}${cite(['wd'])}</dd>
            <dt>الاسم العلمي</dt><dd><bdi lang="la">${esc(b.sci)}</bdi>${cite(['wd'])}</dd>
            ${b.iucn ? `<dt>حالة الحفظ</dt><dd><span class="iucn iucn-${b.iucn}">${IUCN[b.iucn]}</span>${cite(['wd'])}</dd>` : ''}
          </dl>
        </section>
      </article>`;

    const rootBlock = entry.bab
      ? `<p>يُرتَّب في ${babName(entry.bab)}، ${faslName(entry.fasl)}، على الكلمة الأولى من اسمه «${esc(b.head)}».</p>
         ${b.root ? `<p class="root-chips">${b.root.split(' ').map((r) => `<span>${esc(r)}</span>`).join('')}</p>
                     <p class="gap">جذر مقترح من اسمه، لم تُحرَّر مادته اللغوية بعد.</p>`
                  : '<p class="gap">لم يُحقَّق جذر اسمه بعد، فرُتِّب على حروف الاسم نفسه.</p>'}`
      : '<p class="gap">لا يوجد اسم عربي موثّق لهذا الطائر في المصادر المعتمدة بعد، فوُضع في قسم الطيور بلا اسم عربي.</p>';

    const sheet2 = `
      <article class="sheet" aria-label="الصفحة الثانية: ${esc(name)}">
        <header class="sheet-head small">
          <p class="place">${placeLine(entry)}</p>
          <h2 class="entry-title">${esc(name)} <span class="muted">— اللغة والوسائط</span></h2>
          <span class="page-no">الصفحة ٢</span>
        </header>
        <section class="field">
          <h3>أسماؤه</h3>
          <dl class="facts">
            <dt>بالعربية</dt><dd>${b.ar ? esc(b.ar) + cite(['wd']) : '<span class="gap">غير موثّق</span>'}</dd>
            <dt>بالإنجليزية</dt><dd><bdi lang="en">${esc(b.en || '—')}</bdi>${b.en ? cite(['wd']) : ''}</dd>
            <dt>علميًا</dt><dd><bdi lang="la">${esc(b.sci)}</bdi>${cite(['wd'])}</dd>
          </dl>
        </section>
        <section class="field"><h3>الجذر والترتيب</h3>${rootBlock}</section>
        ${mediaBlocks(media, print)}
        ${b.audioFromSearch && b.audio ? '<p class="gap">التسجيل وُجد بالبحث في كومنز باسم النوع العلمي.</p>' : ''}
        ${notesBlock(list, b.id, media)}
      </article>`;
    return sheet1 + sheet2;
  }

  async function sheetsFor(entry, opts) {
    if (entry.curated) return curatedSheets(entry.curated, entry, opts);
    const { bird, fam } = await worldRecord(entry);
    return worldSheets(bird, fam, entry, opts);
  }

  // ---------- الواجهات ----------
  const app = document.getElementById('app');

  const icon = (id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const hrefOf = (e) => '#/bird/' + (e.curated ? e.curated.id : e.id);
  const thumbOf = (e) => (e.curated && window.MEDIA[e.curated.id] ? window.MEDIA[e.curated.id].image.thumb : small(e.thumb));

  const birdLink = (e) => `<a class="bird-card" href="${hrefOf(e)}">
      <span class="ph">
        ${e.thumb || e.curated ? `<img src="${esc(thumbOf(e))}" alt="" loading="lazy" decoding="async" width="250" height="188">` : `<span class="noimg">${icon('bird')}</span>`}
        <span class="tags">
          ${e.curated ? '<span class="tag edited">مادة محرَّرة</span>' : '<span></span>'}
          ${e.aud || e.curated ? `<span class="tag" title="له تسجيل صوتي">${icon('sound')}<span class="sr-only">له تسجيل صوتي</span></span>` : ''}
        </span>
      </span>
      <span class="body">
        <span class="nm">${esc(e.ar || e.en || e.sci)}</span>
        <span class="sci">${esc(e.sci)}</span>
        ${e.iucn ? `<span class="status"><span class="dot ${e.iucn}"></span>${IUCN[e.iucn]}</span>` : ''}
      </span>
    </a>`;

  function viewHome() {
    const counts = {};
    for (const e of named()) counts[e.bab] = (counts[e.bab] || 0) + 1;
    const nNamed = named().length;
    const nUn = unnamed().length;
    // صور الواجهة: ست صور تملأ شبكة ٣×٣ (الأولى تأخذ مربعين في مربعين)
    const featured = ['Q61865', 'hudhud', 'Q170718', 'uqab', 'Q30535', 'ghurab']
      .map((k) => byId[k]).filter((e) => e && (e.thumb || e.curated)).slice(0, 6);
    app.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">معجم موسوعي موثّق لطيور العالم</p>
          <h1>معجم الطيور</h1>
          <p class="subtitle">أصواتها، وأشكالها، وصفاتها في العربية</p>
          <p class="lead">${fmt(entries.length)} نوعًا من طيور العالم. لكل طائر صفحتان: الأولى للتعريف به وتصنيفه، والثانية لاسمه وجذره وصوته وصورته، وكل معلومة منسوبة إلى مصدرها.</p>
          <label class="search" for="q">
            <span class="sr-only">ابحث عن طائر</span>
            ${icon('search')}
            <input id="q" type="search" placeholder="ابحث: هدهد، Upupa، hoopoe…" autocomplete="off">
          </label>
          <div id="results" class="results" aria-live="polite"></div>
        </div>
        <div class="mosaic" aria-label="طيور مختارة">
          ${featured.map((e) => `<a href="${hrefOf(e)}"><img src="${esc(thumbOf(e).replace('/250px-', '/500px-'))}" alt="${esc(e.ar || e.sci)}" loading="lazy"><span>${esc(e.ar || e.sci)}</span></a>`).join('')}
        </div>
      </section>

      <dl class="stats">
        <div><dt>أنواع الطيور</dt><dd>${fmt(entries.length)}</dd></div>
        <div><dt>لها اسم عربي</dt><dd>${fmt(nNamed)}</dd></div>
        <div><dt>الفصائل</dt><dd>${fmt(families.length)}</dd></div>
        <div><dt>مواد محرَّرة لغويًا</dt><dd>${fmt(curated.length)}</dd></div>
      </dl>

      <section class="abwab">
        <h2 class="section-title">الأبواب</h2>
        <p class="section-note">مرتبة كما في المعجم الوسيط: الباب للحرف الأول من الجذر، والفصل للحرف الثاني. وما لم يُحقَّق جذره رُتِّب على حروف اسمه.</p>
        <div class="letters">
          ${ALPHABET.map((l) => {
            const n = counts[l] || 0;
            return n
              ? `<a class="letter" href="#/bab/${encodeURIComponent(l)}" aria-label="${babName(l)}، ${fmt(n)} طائرًا"><span class="ch">${l}</span><span class="cnt">${fmt(n)}</span></a>`
              : `<span class="letter empty" aria-label="${babName(l)}، لا مواد"><span class="ch">${l}</span><span class="cnt">—</span></span>`;
          }).join('')}
        </div>
        <div class="more-links">
          <a class="card-link" href="#/families">
            <span class="ic">${icon('tree')}</span>
            <span><strong>التصفّح بالفصائل</strong><small>${fmt(families.length)} فصيلة مرتبة على الرتب</small></span>
            <span class="arrow">${icon('chev')}</span>
          </a>
          <a class="card-link" href="#/unnamed">
            <span class="ic">${icon('globe')}</span>
            <span><strong>طيور بلا اسم عربي موثّق</strong><small>${fmt(nUn)} نوعًا، مرتبة على الفصائل</small></span>
            <span class="arrow">${icon('chev')}</span>
          </a>
        </div>
      </section>`;

    const q = document.getElementById('q');
    const results = document.getElementById('results');
    q.addEventListener('input', () => {
      const raw = q.value.trim();
      const v = normName(raw).replace(/\s+/g, ' ');
      if (v.length < 2) { results.innerHTML = ''; return; }
      const low = raw.toLowerCase();
      const hits = [];
      for (const e of entries) {
        if ((e.ar && normName(e.ar).includes(v)) || e.sci.toLowerCase().includes(low) || (e.en && e.en.toLowerCase().includes(low))) {
          hits.push(e);
          if (hits.length >= 40) break;
        }
      }
      results.innerHTML = hits.length
        ? hits.map((e) => `<a href="${hrefOf(e)}">${esc(e.ar || e.en || e.sci)} <span class="muted"><bdi lang="la">${esc(e.sci)}</bdi></span></a>`).join('')
        : '<p class="muted">ما في نتيجة لهالبحث.</p>';
    });
  }

  function viewBab(letter) {
    const list = named().filter((e) => e.bab === letter);
    if (!list.length) return viewNotFound();
    const groups = new Map();
    for (const e of list) {
      if (!groups.has(e.fasl)) groups.set(e.fasl, []);
      groups.get(e.fasl).push(e);
    }
    const ordered = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <span>${babName(letter)}</span></nav>
      <header class="page-head">
        <h1>${babName(letter)} <span class="count">${fmt(list.length)} طائرًا</span></h1>
        <button type="button" class="btn" data-export="bab" data-key="${letter}">${icon('download')}تنزيل الباب PDF</button>
      </header>
      <nav class="fasl-index" aria-label="فصول الباب">
        ${ordered.map(([f, l]) => `<a href="#fasl-${encodeURIComponent(f)}" data-jump="fasl-${f}">${faslName(f)} <span class="n">${fmt(l.length)}</span></a>`).join('')}
      </nav>
      ${ordered.map(([f, l]) => `
        <section class="fasl" id="fasl-${f}">
          <header class="fasl-head">
            <h2>${faslName(f)} <span class="count">${fmt(l.length)}</span></h2>
            <button type="button" class="btn btn-ghost" data-export="fasl" data-key="${letter}${f}">${icon('download')}تنزيل الفصل</button>
          </header>
          <div class="bird-grid">${l.map(birdLink).join('')}</div>
        </section>`).join('')}`;
  }

  function viewFamilies(onlyUnnamed) {
    const pool = onlyUnnamed ? unnamed() : entries;
    const count = {};
    for (const e of pool) count[e.fam] = (count[e.fam] || 0) + 1;
    const byOrder = new Map();
    for (const f of families) {
      if (!count[f.id]) continue;
      const k = f.ord.sci || '—';
      if (!byOrder.has(k)) byOrder.set(k, { ord: f.ord, fams: [] });
      byOrder.get(k).fams.push(f);
    }
    const title = onlyUnnamed ? 'طيور بلا اسم عربي موثّق' : 'الفصائل';
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <span>${title}</span></nav>
      <header class="page-head"><h1>${title} <span class="count">${fmt(pool.length)} نوعًا</span></h1></header>
      ${onlyUnnamed ? '<p class="page-meta">هذه أنواع ليس لها اسم عربي في المصادر المعتمدة بعد. لم نترجم أسماءها من عندنا حتى لا ننسب إليها اسمًا غير موثّق.</p>' : '<p class="page-meta">الفصائل مجمّعة تحت رتبها، والرقم عدد الأنواع في كل فصيلة.</p>'}
      ${[...byOrder.values()].map(({ ord, fams }) => `
        <section class="order">
          <h2 class="order-title">${esc(ord.ar || ord.sci)} <bdi lang="la">${esc(ord.sci || '')}</bdi></h2>
          <ul class="fam-list">
            ${fams.map((f) => `<li><a href="#/fam/${f.id}${onlyUnnamed ? '/unnamed' : ''}"><span class="fn-ar">${esc(f.ar || f.sci)}</span><bdi lang="la">${esc(f.sci || '')}</bdi><span class="cnt">${fmt(count[f.id])}</span></a></li>`).join('')}
          </ul>
        </section>`).join('')}`;
  }

  function viewFamily(id, onlyUnnamed) {
    const f = familyById[id];
    if (!f) return viewNotFound();
    const list = entries.filter((e) => e.fam === id && (!onlyUnnamed || !e.bab));
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <a href="#/${onlyUnnamed ? 'unnamed' : 'families'}">${onlyUnnamed ? 'طيور بلا اسم عربي' : 'الفصائل'}</a> / <span>${esc(f.ar || f.sci)}</span></nav>
      <header class="page-head">
        <h1>${esc(f.ar || f.sci)} <span class="count"><bdi lang="la">${esc(f.sci || '')}</bdi></span></h1>
        <button type="button" class="btn" data-export="fam" data-key="${id}${onlyUnnamed ? ':u' : ''}">${icon('download')}تنزيل الفصيلة PDF</button>
      </header>
      <p class="page-meta">الرتبة: ${esc(f.ord.ar || '')} <bdi lang="la">${esc(f.ord.sci || '')}</bdi> · ${fmt(list.length)} نوعًا</p>
      <div class="bird-grid">${list.map(birdLink).join('')}</div>`;
  }

  async function viewBird(id) {
    const e = byId[id];
    if (!e) return viewNotFound();
    const pool = e.bab ? named() : entries.filter((x) => x.fam === e.fam && !x.bab);
    const i = pool.indexOf(e);
    const prev = pool[i - 1], next = pool[i + 1];
    const link = (x) => '#/bird/' + (x.curated ? x.curated.id : x.id);
    const crumbs = e.bab
      ? `<a href="#/bab/${encodeURIComponent(e.bab)}">${babName(e.bab)}</a>`
      : `<a href="#/fam/${e.fam}/unnamed">${esc((familyById[e.fam] || {}).ar || 'الفصيلة')}</a>`;
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / ${crumbs} / <span>${esc(e.ar || e.en || e.sci)}</span></nav>
      <div class="bird-tools">
        <span class="muted">${e.curated ? 'مادة محرَّرة لغويًا' : 'مادة مجموعة آليًا من مصادر موثّقة'}</span>
        <button type="button" class="btn" data-export="bird" data-key="${e.id}">${icon('download')}تنزيل صفحتي الطائر PDF</button>
      </div>
      <div class="spread"><p class="loading">جارٍ التحميل…</p></div>
      <nav class="pager" aria-label="التنقل بين الطيور">
        ${prev ? `<a href="${link(prev)}"><small>السابق</small><strong>${esc(prev.ar || prev.en || prev.sci)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${link(next)}"><small>التالي</small><strong>${esc(next.ar || next.en || next.sci)}</strong></a>` : '<span></span>'}
      </nav>`;
    const html = await sheetsFor(e).catch(() => '<p class="gap">تعذّر تحميل مادة هذا الطائر. تأكد من الاتصال وحاول مرة ثانية.</p>');
    if (byId[currentBird] === e) app.querySelector('.spread').innerHTML = html;
  }

  function viewMethod() {
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <span>منهج التوثيق</span></nav>
      <article class="prose">
        <h1>منهج التوثيق</h1>
        <p>كل معلومة في المعجم تحمل رقم حاشية يدلّ على مصدرها، والحواشي مجموعة في آخر الصفحة الثانية لكل طائر.</p>
        <h2>طبقتا المعجم</h2>
        <ul>
          <li><span class="badge ok">مادة محرَّرة</span> طيور حُرِّرت مادتها يدويًا: وصف مفصّل، وجذر لغوي، واشتقاقات، وألفاظ صوت، وشواهد.</li>
          <li>بقية طيور العالم (${fmt(entries.length)} نوعًا) جُمعت بياناتها آليًا من ويكيداتا وويكيبيديا العربية وويكيميديا كومنز في ${esc(built)}، وكل معلومة منها مربوطة بنسخة مثبّتة من مصدرها.</li>
        </ul>
        <h2>أنواع المصادر</h2>
        <ul>
          <li><span class="badge ok">موثّق برابط</span> مصدر رقمي له رابط ثابت. مقالات ويكيبيديا وعناصر ويكيداتا مربوطة بنسخة مثبّتة (oldid) حتى لا يتغير النص بعد التوثيق.</li>
          <li><span class="badge pending">يحتاج رقم الجزء والصفحة</span> مصدر ورقي (لسان العرب، المعجم الوسيط) موثّق بالمادة، ويحتاج مطابقة الجزء والصفحة في طبعة محددة.</li>
        </ul>
        <h2>الأسماء العربية</h2>
        <p>الاسم العربي مأخوذ من ويكيداتا. الطيور التي ليس لها اسم عربي هناك لم نترجم أسماءها من عندنا، ووضعناها في قسم «طيور بلا اسم عربي موثّق».</p>
        <h2>الترتيب</h2>
        <p>على طريقة المعجم الوسيط: الباب للحرف الأول من الجذر والفصل للحرف الثاني. يؤخذ الجذر من الكلمة الأولى في اسم الطائر (مثل «حمام» في «حمام طوراني»). وما لم يُحقَّق جذره رُتِّب على حروف الكلمة نفسها.</p>
        <h2>الوسائط</h2>
        <p>الصور والتسجيلات والمقاطع من ويكيميديا كومنز برخص حرّة، ومذكور مع كل ملف اسمه وصاحبه ورخصته ورابطه. وبعض التسجيلات وُجدت بالبحث في كومنز باسم النوع العلمي، وهي مُعلَّمة بذلك.</p>
        <h2>التنزيل</h2>
        <p>يمكن تنزيل المعجم كاملًا، أو بابًا، أو فصلًا، أو فصيلة، أو صفحتي طائر واحد. يفتح المتصفح نافذة الطباعة، فاختر «حفظ بتنسيق PDF». إذا زاد التنزيل عن ${fmt(PRINT_IMAGE_LIMIT)} طائر يُنزَّل بلا صور حتى لا يثقل الملف.</p>
      </article>`;
  }

  function viewNotFound() {
    app.innerHTML = '<article class="prose"><h1>الصفحة غير موجودة</h1><p><a href="#/">ارجع للأبواب</a></p></article>';
  }

  let currentBird = null;
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    currentBird = null;
    if (parts[0] === 'bab') viewBab(parts[1]);
    else if (parts[0] === 'bird') { currentBird = parts[1]; viewBird(parts[1]); }
    else if (parts[0] === 'families') viewFamilies(false);
    else if (parts[0] === 'unnamed') viewFamilies(true);
    else if (parts[0] === 'fam') viewFamily(parts[1], parts[2] === 'unnamed');
    else if (parts[0] === 'method') viewMethod();
    else if (parts[0] === '' || !location.hash.startsWith('#/')) {
      if (location.hash.startsWith('#fasl-') || location.hash.startsWith('#note-')) return;
      viewHome();
    } else viewNotFound();
    const section = { bab: 'home', bird: 'home', '': 'home', families: 'families', fam: 'families', unnamed: 'families', method: 'method' }[parts[0]];
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  // ---------- التنزيل PDF عبر الطباعة ----------
  const printRoot = document.getElementById('print-root');

  async function exportEntries(list, title, subtitle) {
    if (!list.length) return;
    if (list.length > 1000 && !window.confirm(`هذا التنزيل فيه ${fmt(list.length)} طائرًا (حوالي ${fmt(list.length * 2)} صفحة) وقد يأخذ وقتًا طويلًا. متابعة؟`)) return;
    const images = list.length <= PRINT_IMAGE_LIMIT;
    document.body.classList.add('exporting');
    try {
      const famIds = [...new Set(list.filter((e) => !e.curated).map((e) => e.fam))];
      await Promise.all(famIds.map(loadFamily));
      const sheets = [];
      for (const e of list) sheets.push(await sheetsFor(e, { print: true, images }));
      printRoot.innerHTML = `
        <section class="cover">
          <p class="eyebrow">معجم الطيور: أصواتها، وأشكالها، وصفاتها في العربية</p>
          <h1>${esc(title)}</h1>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
          <p class="muted">عدد المواد: ${fmt(list.length)} · تاريخ الإصدار: ${esc(built)}${images ? '' : ' · بلا صور'}</p>
        </section>
        ${sheets.join('')}`;
      const imgs = [...printRoot.querySelectorAll('img')];
      imgs.forEach((im) => { im.loading = 'eager'; });
      await Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    } finally {
      document.body.classList.remove('exporting');
    }
    const prevTitle = document.title;
    document.title = 'معجم الطيور - ' + title;
    window.print();
    document.title = prevTitle;
  }

  document.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const btn = e.target.closest('[data-export]');
    if (!btn) return;
    const kind = btn.dataset.export;
    const key = btn.dataset.key;
    if (kind === 'all') exportEntries(entries, 'المعجم كاملًا');
    else if (kind === 'bab') exportEntries(named().filter((x) => x.bab === key), babName(key));
    else if (kind === 'fasl') exportEntries(named().filter((x) => x.bab === key[0] && x.fasl === key[1]), faslName(key[1]), babName(key[0]));
    else if (kind === 'fam') {
      const [id, u] = key.split(':');
      const f = familyById[id];
      exportEntries(entries.filter((x) => x.fam === id && (!u || !x.bab)), f.ar || f.sci, 'فصيلة');
    } else if (kind === 'bird') exportEntries([byId[key]], byId[key].ar || byId[key].sci);
  });

  window.addEventListener('afterprint', () => { printRoot.innerHTML = ''; });
  window.addEventListener('hashchange', route);

  app.innerHTML = '<p class="loading">جارٍ تحميل المعجم…</p>';
  loadIndex().then(route).catch(() => {
    app.innerHTML = '<article class="prose"><h1>تعذّر تحميل المعجم</h1><p>افتح الموقع عبر سيرفر (وليس كملف مباشر)، أو تأكد من الاتصال وحدّث الصفحة.</p></article>';
  });
})();
