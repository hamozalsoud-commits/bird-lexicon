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

  const norm = (ch) => (['أ', 'إ', 'آ', 'ء'].includes(ch) ? 'ا' : ch);
  const rank = (ch) => ALPHABET.indexOf(norm(ch));
  const bab = (b) => norm(b.root[0]);
  const fasl = (b) => norm(b.root[1]);
  const compareRoots = (a, b) => {
    for (let i = 0; i < Math.max(a.root.length, b.root.length); i++) {
      const d = rank(a.root[i] || '') - rank(b.root[i] || '');
      if (d) return d;
    }
    return 0;
  };

  const birds = window.BIRDS.slice().sort(compareRoots);
  const byId = Object.fromEntries(birds.map((b) => [b.id, b]));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const babName = (l) => 'باب ' + LETTER_NAMES[l];
  const faslName = (l) => 'فصل ' + LETTER_NAMES[l];
  const stripTashkeel = (s) => s.replace(/[ً-ْٰ]/g, '');

  // ---------- التوثيق: ترقيم الحواشي لكل طائر ----------
  function makeNotes(bird) {
    const list = [];
    const index = new Map();
    const resolve = (ref) => {
      if (typeof ref === 'string') {
        const s = bird.sources[ref];
        return { key: 'local:' + ref, ...s };
      }
      const g = window.SOURCES[ref.s];
      return { key: ref.s + ':' + ref.at, ...g, at: ref.at, url: ref.url || g.url };
    };
    const cite = (refs) => (refs || []).map((ref) => {
      const src = resolve(ref);
      if (!index.has(src.key)) { list.push(src); index.set(src.key, list.length); }
      const n = index.get(src.key);
      return `<a class="fn" href="#note-${bird.id}-${n}" data-note="${bird.id}-${n}">${n}</a>`;
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
      if (src.type === 'web') link += ` <span class="muted">(تاريخ الاطلاع ${esc(window.ACCESS_DATE)})</span>`;
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
      : esc(m.license);
    return `<li><strong>${MEDIA_LABEL[kind]}:</strong> «${esc(m.file)}»، تصوير/تسجيل: ${esc(m.author || 'غير مذكور')}، الرخصة: ${lic}، المصدر: <a href="${esc(m.page)}" target="_blank" rel="noopener">ويكيميديا كومنز</a>${origin} <span class="badge ok">موثّق برابط</span></li>`;
  }

  // ---------- بناء صفحتي الطائر ----------
  function birdSheets(bird, { print = false } = {}) {
    const media = (window.MEDIA || {})[bird.id] || {};
    const { list, cite } = makeNotes(bird);
    const para = (items) => items.map((x) => `<p>${esc(x.t)}${cite(x.c)}</p>`).join('');
    const entries = (items) => `<dl class="entries">${items.map((x) => `<dt>${esc(x.w)}</dt><dd>${esc(x.m)}${cite(x.c)}</dd>`).join('')}</dl>`;
    const pending = '<p class="gap">لم نثبت في هذا الباب مادة موثّقة بعد.</p>';
    const placeLine = `${babName(bab(bird))} · ${faslName(fasl(bird))} · الجذر (${bird.root.join(' ')})`;

    const img = media.image
      ? `<figure class="bird-figure">
           <img src="${esc(media.image.thumb || media.image.src)}" alt="صورة ${esc(bird.name)} (${esc(bird.scientific)})" loading="lazy">
           <figcaption>${esc(media.image.author)} · ${esc(media.image.license)} · ويكيميديا كومنز</figcaption>
         </figure>`
      : '';

    // الصفحة الأولى: التعريف والوصف
    const sheet1 = `
      <article class="sheet" aria-label="الصفحة الأولى: ${esc(bird.name)}">
        <header class="sheet-head">
          <p class="place">${placeLine}</p>
          <h2 class="entry-title">${esc(bird.name)}</h2>
          <p class="sci"><bdi lang="la">${esc(bird.scientific)}</bdi> · ${esc(bird.common)}</p>
          <span class="page-no">الصفحة ١</span>
        </header>
        ${img}
        ${SECTIONS.map(([k, label]) => `
          <section class="field">
            <h3>${label}</h3>
            ${bird[k] && bird[k].length ? para(bird[k]) : pending}
          </section>`).join('')}
      </article>`;

    // الصفحة الثانية: اللغة والوسائط والمصادر
    const lx = bird.lexical;
    const audio = media.audio
      ? (print
          ? `<p>استمع إلى التسجيل: <a href="${esc(media.audio.page)}">${esc(media.audio.page)}</a></p>`
          : `<audio controls preload="none" src="${esc(media.audio.src)}"></audio>`)
      : pending;
    const video = media.video
      ? (print
          ? `<p>شاهد المقطع: <a href="${esc(media.video.page)}">${esc(media.video.page)}</a></p>`
          : `<video controls preload="none" src="${esc(media.video.src)}" poster="${esc(media.image ? (media.image.thumb || '') : '')}"></video>`)
      : pending;

    const sheet2Body = `
        <section class="field">
          <h3>الجذر والمعنى المعجمي</h3>
          <p class="root-chips">${bird.root.map((r) => `<span>${esc(r)}</span>`).join('')}</p>
          ${para(lx.meaning)}
        </section>
        <section class="field">
          <h3>الاشتقاقات</h3>
          ${lx.derivations.length ? entries(lx.derivations) : pending}
        </section>
        <section class="field">
          <h3>ألفاظ الصوت</h3>
          ${lx.sounds.length ? entries(lx.sounds) : pending}
        </section>
        ${lx.quran.length ? `
        <section class="field">
          <h3>الشواهد القرآنية</h3>
          ${lx.quran.map((x) => `<blockquote class="ayah">﴿${esc(x.t)}﴾${cite(x.c)}</blockquote>`).join('')}
        </section>` : ''}
        <section class="field media-block">
          <h3>صوته</h3>
          ${audio}
        </section>
        <section class="field media-block">
          <h3>مقطع مرئي</h3>
          ${video}
        </section>`;

    // الحواشي تُبنى بعد ما كل الاستشهادات انحسبت
    const sheet2 = `
      <article class="sheet" aria-label="الصفحة الثانية: ${esc(bird.name)}">
        <header class="sheet-head small">
          <p class="place">${placeLine}</p>
          <h2 class="entry-title">${esc(bird.name)} <span class="muted">— اللغة والوسائط</span></h2>
          <span class="page-no">الصفحة ٢</span>
        </header>
        ${sheet2Body}
        <section class="field notes">
          <h3>المصادر والحواشي</h3>
          <ol>${list.map((s, i) => noteHtml(s, i + 1, bird.id)).join('')}</ol>
          <h4>توثيق الوسائط</h4>
          <ul class="media-credits">${['image', 'audio', 'video'].filter((k) => media[k]).map((k) => mediaCredit(media[k], k)).join('')}</ul>
        </section>
      </article>`;

    return sheet1 + sheet2;
  }

  // ---------- الواجهات ----------
  const app = document.getElementById('app');

  function groupByBab(list) {
    const out = new Map();
    for (const b of list) {
      const k = bab(b);
      if (!out.has(k)) out.set(k, new Map());
      const f = fasl(b);
      if (!out.get(k).has(f)) out.get(k).set(f, []);
      out.get(k).get(f).push(b);
    }
    return out;
  }

  function viewHome() {
    const groups = groupByBab(birds);
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">معجم موسوعي موثّق</p>
        <h1>معجم الطيور</h1>
        <p class="subtitle">أصواتها، وأشكالها، وصفاتها في العربية</p>
        <p class="lead">لكل طائر صفحتان: الأولى للتعريف به ووصف شكله وألوانه وغذائه وصوته، والثانية لجذره اللغوي واشتقاقاته وألفاظ صوته، مع صورته وتسجيل صوته ومقطع مرئي له. وكل معلومة منسوبة إلى مصدرها.</p>
        <label class="search">
          <span class="sr-only">ابحث عن طائر أو جذر</span>
          <input id="q" type="search" placeholder="ابحث عن طائر أو جذر… (مثال: غراب، ن س ر)" autocomplete="off">
        </label>
        <div id="results" class="results" aria-live="polite"></div>
      </section>

      <section class="abwab">
        <h2 class="section-title">الأبواب</h2>
        <p class="muted">المعجم مرتب على الجذور كما في المعجم الوسيط: الباب للحرف الأول من الجذر، والفصل للحرف الثاني.</p>
        <div class="letters">
          ${ALPHABET.map((l) => {
            const g = groups.get(l);
            const n = g ? [...g.values()].reduce((a, x) => a + x.length, 0) : 0;
            return n
              ? `<a class="letter" href="#/bab/${encodeURIComponent(l)}"><span class="ch">${l}</span><span class="cnt">${n} ${n === 1 ? 'طائر' : 'طيور'}</span></a>`
              : `<span class="letter empty" aria-disabled="true"><span class="ch">${l}</span><span class="cnt">—</span></span>`;
          }).join('')}
        </div>
      </section>`;

    const q = document.getElementById('q');
    const results = document.getElementById('results');
    q.addEventListener('input', () => {
      const v = stripTashkeel(q.value.trim()).replace(/\s+/g, '');
      if (!v) { results.innerHTML = ''; return; }
      const hits = birds.filter((b) =>
        stripTashkeel(b.name).replace(/^ال/, '').includes(v.replace(/^ال/, '')) ||
        b.root.join('') === v ||
        stripTashkeel(b.common).includes(v) ||
        b.scientific.toLowerCase().includes(v.toLowerCase()));
      results.innerHTML = hits.length
        ? hits.map((b) => `<a href="#/bird/${b.id}">${esc(b.name)} <span class="muted">(${b.root.join(' ')})</span></a>`).join('')
        : '<p class="muted">ما في نتيجة بعد لهالبحث.</p>';
    });
  }

  function viewBab(letter) {
    const g = groupByBab(birds).get(letter);
    if (!g) return viewNotFound();
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <span>${babName(letter)}</span></nav>
      <header class="page-head">
        <h1>${babName(letter)}</h1>
        <button type="button" class="btn" data-export="bab" data-key="${letter}">تنزيل الباب PDF</button>
      </header>
      ${[...g.entries()].map(([f, list]) => `
        <section class="fasl">
          <header class="fasl-head">
            <h2>${faslName(f)}</h2>
            <button type="button" class="btn btn-ghost" data-export="fasl" data-key="${letter}${f}">تنزيل الفصل</button>
          </header>
          <ul class="bird-list">
            ${list.map((b) => {
              const m = (window.MEDIA[b.id] || {}).image;
              return `<li><a href="#/bird/${b.id}">
                ${m ? `<img src="${esc(m.thumb)}" alt="" loading="lazy">` : ''}
                <span class="nm">${esc(b.name)}</span>
                <span class="rt">(${b.root.join(' ')})</span>
              </a></li>`;
            }).join('')}
          </ul>
        </section>`).join('')}`;
  }

  function viewBird(id) {
    const b = byId[id];
    if (!b) return viewNotFound();
    const i = birds.indexOf(b);
    const prev = birds[i - 1], next = birds[i + 1];
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <a href="#/bab/${encodeURIComponent(bab(b))}">${babName(bab(b))}</a> / <span>${esc(b.name)}</span></nav>
      <div class="bird-tools">
        <button type="button" class="btn" data-export="bird" data-key="${b.id}">تنزيل صفحتي الطائر PDF</button>
      </div>
      <div class="spread">${birdSheets(b)}</div>
      <nav class="pager">
        ${prev ? `<a href="#/bird/${prev.id}">→ ${esc(prev.name)}</a>` : '<span></span>'}
        ${next ? `<a href="#/bird/${next.id}">${esc(next.name)} ←</a>` : '<span></span>'}
      </nav>`;
  }

  function viewMethod() {
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">الأبواب</a> / <span>منهج التوثيق</span></nav>
      <article class="prose">
        <h1>منهج التوثيق</h1>
        <p>كل جملة في المعجم تحمل رقم حاشية يدلّ على مصدرها، والحواشي مجموعة في آخر الصفحة الثانية لكل طائر.</p>
        <h2>أنواع المصادر</h2>
        <ul>
          <li><span class="badge ok">موثّق برابط</span> مصدر رقمي له رابط ثابت. مقالات ويكيبيديا مربوطة بنسخة مثبّتة (oldid) حتى لا يتغير النص بعد التوثيق.</li>
          <li><span class="badge pending">يحتاج رقم الجزء والصفحة</span> مصدر ورقي (لسان العرب، المعجم الوسيط) موثّق بالمادة، ويحتاج مطابقة الجزء والصفحة في طبعة محددة قبل النشر النهائي.</li>
        </ul>
        <h2>الوسائط</h2>
        <p>الصور والتسجيلات الصوتية والمقاطع المرئية مأخوذة من ويكيميديا كومنز برخص حرّة (المشاع الإبداعي أو الملك العام)، ومذكور مع كل ملف: اسمه، وصاحبه، ورخصته، ورابط صفحته. والتسجيلات المأخوذة أصلًا من موقع xeno-canto مربوطة برقم تسجيلها الأصلي.</p>
        <h2>الترتيب</h2>
        <p>على طريقة المعجم الوسيط: تُرتّب المواد على حروف الجذر، فالباب للحرف الأول والفصل للحرف الثاني، ثم يُرتّب ما في الفصل على الحرف الثالث.</p>
        <h2>التنزيل</h2>
        <p>يمكن تنزيل المعجم كاملًا، أو بابًا، أو فصلًا، أو صفحتي طائر واحد. يفتح المتصفح نافذة الطباعة، فاختر «حفظ بتنسيق PDF».</p>
      </article>`;
  }

  function viewNotFound() {
    app.innerHTML = '<article class="prose"><h1>الصفحة غير موجودة</h1><p><a href="#/">ارجع للأبواب</a></p></article>';
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (parts[0] === 'bab') viewBab(parts[1]);
    else if (parts[0] === 'bird') viewBird(parts[1]);
    else if (parts[0] === 'method') viewMethod();
    else viewHome();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  // ---------- التنزيل PDF عبر الطباعة ----------
  const printRoot = document.getElementById('print-root');

  function exportBirds(list, title, subtitle) {
    printRoot.innerHTML = `
      <section class="cover">
        <p class="eyebrow">معجم الطيور: أصواتها، وأشكالها، وصفاتها في العربية</p>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        <p class="muted">عدد المواد: ${list.length} · تاريخ الإصدار: ${esc(window.ACCESS_DATE)}</p>
      </section>
      ${list.map((b) => birdSheets(b, { print: true })).join('')}`;
    const imgs = [...printRoot.querySelectorAll('img')];
    imgs.forEach((im) => { im.loading = 'eager'; });
    const prevTitle = document.title;
    document.title = 'معجم الطيور - ' + title;
    Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))))
      .then(() => {
        window.print();
        document.title = prevTitle;
      });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-export]');
    if (!btn) return;
    const kind = btn.dataset.export;
    const key = btn.dataset.key;
    if (kind === 'all') exportBirds(birds, 'المعجم كاملًا');
    else if (kind === 'bab') exportBirds(birds.filter((b) => bab(b) === key), babName(key));
    else if (kind === 'fasl') exportBirds(birds.filter((b) => bab(b) === key[0] && fasl(b) === key[1]), faslName(key[1]), babName(key[0]));
    else if (kind === 'bird') exportBirds([byId[key]], byId[key].name);
  });

  window.addEventListener('afterprint', () => { printRoot.innerHTML = ''; });
  window.addEventListener('hashchange', route);
  route();
})();
