# يجمع: نصوص ويكيبيديا العربية (مع رقم النسخة)، رقم نسخة ويكيداتا، وتوثيق ملفات كومنز (مؤلف/رخصة).
import json, urllib.request, urllib.parse, re, time, os, sys
from concurrent.futures import ThreadPoolExecutor
UA={'User-Agent':'BirdLexiconResearch/0.2 (https://github.com/hamozalsoud-commits/bird-lexicon)'}
def get(url,params,tries=5):
    params={**params,'format':'json'}
    u=url+'?'+urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            j=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))
            if 'error' not in j: return j
        except Exception as e:
            pass
        time.sleep(3*(i+1))
    raise RuntimeError('fail '+u[:120])
def strip(s): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',s or '')).strip()
def chunks(a,n): return [a[i:i+n] for i in range(0,len(a),n)]
rows=json.load(open('species.json',encoding='utf-8'))['results']['bindings']
v=lambda r,k: r[k+'_']['value'] if k+'_' in r else None
qid=lambda u: u.rsplit('/',1)[1]
fname=lambda u: urllib.parse.unquote(u.rsplit('/',1)[1]).replace('_',' ')
step=sys.argv[1]
if step=='wd':
    ids=[qid(r['s']['value']) for r in rows]; out={}
    def job(c):
        j=get('https://www.wikidata.org/w/api.php',{'action':'wbgetentities','ids':'|'.join(c),'props':'info'})
        return {k:e.get('lastrevid') for k,e in j['entities'].items()}
    with ThreadPoolExecutor(3) as ex:
        for r in ex.map(job,chunks(ids,50)): out.update(r)
    json.dump(out,open('wdrev.json','w'),indent=0); print('wd',len(out))
if step=='ar':
    titles=[fname(v(r,'arw')) for r in rows if v(r,'arw')]; out={}
    def job(c):
        res={}
        try: j=get('https://ar.wikipedia.org/w/api.php',{'action':'query','titles':'|'.join(c),'redirects':1,'prop':'extracts|revisions','rvprop':'ids','exintro':1,'explaintext':1,'exlimit':20},tries=3)
        except RuntimeError:
            if len(c)==1: return res
            for t in c: res.update(job([t]))
            return res
        q=j['query']; back={x['to']:x['from'] for x in q.get('redirects',[])+q.get('normalized',[])}
        for p in q['pages'].values():
            if 'revisions' not in p: continue
            t=p['title']; orig=back.get(t,t); orig=back.get(orig,orig)
            res[orig]={'title':t,'rev':p['revisions'][0]['revid'],'text':(p.get('extract') or '').strip()}
        return res
    with ThreadPoolExecutor(3) as ex:
        for r in ex.map(job,chunks(titles,20)): out.update(r)
    json.dump(out,open('arwiki.json','w',encoding='utf-8'),ensure_ascii=False); print('ar',len(out),'of',len(titles))
if step=='files':
    files=set()
    for r in rows:
        for k in ['img','aud','vid']:
            if v(r,k): files.add(fname(v(r,k)))
    extra=json.load(open('xc.json',encoding='utf-8')) if os.path.exists('xc.json') else {}
    files|=set(extra.values())
    files=sorted(files); out={}
    def job(c):
        res={}
        try: j=get('https://commons.wikimedia.org/w/api.php',{'action':'query','titles':'|'.join('File:'+f for f in c),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':800},tries=3)
        except RuntimeError:
            if len(c)==1: return res
            h=len(c)//2
            res.update(job(c[:h])); res.update(job(c[h:])); return res
        q=j['query']; back={x['to']:x['from'] for x in q.get('normalized',[])}
        for p in q['pages'].values():
            if 'imageinfo' not in p: continue
            ii=p['imageinfo'][0]; m=ii.get('extmetadata',{})
            t=p['title']; key=back.get(t,t)[5:]
            a=strip(m.get('Artist',{}).get('value'))
            if not a and 'British Library' in strip(m.get('Credit',{}).get('value')): a='British Library'
            res[key]={'src':re.sub(r'\?utm.*','',ii['url']),'thumb':re.sub(r'\?utm.*','',ii.get('thumburl') or ''),'page':ii['descriptionurl'],
                      'author':a[:160],'license':m.get('LicenseShortName',{}).get('value'),'licenseUrl':m.get('LicenseUrl',{}).get('value')}
        return res
    with ThreadPoolExecutor(3) as ex:
        for r in ex.map(job,chunks(files,25)): out.update(r)
    json.dump(out,open('commons.json','w',encoding='utf-8'),ensure_ascii=False); print('files',len(out),'of',len(files))
if step=='xc':
    # بحث في كومنز عن تسجيلات xeno-canto المرفوعة باسم النوع، للطيور اللي ما إلها صوت بويكيداتا
    need=[v(r,'sci') for r in rows if not v(r,'aud')]
    out=json.load(open('xc.json',encoding='utf-8')) if os.path.exists('xc.json') else {}
    done=set(json.load(open('xc_done.json'))) if os.path.exists('xc_done.json') else set()
    need=[s for s in need if s not in done]
    def job(sci):
        try: j=get('https://commons.wikimedia.org/w/api.php',{'action':'query','list':'search','srsearch':'intitle:"%s" filemime:audio'%sci,'srnamespace':6,'srlimit':5})
        except RuntimeError: return sci,False
        hits=[x['title'][5:] for x in j['query']['search'] if x['title'][5:].lower().startswith(sci.lower())]
        hits.sort(key=lambda t:(0 if 'XC' in t else 1, len(t)))
        return sci,(hits[0] if hits else None)
    n=0
    with ThreadPoolExecutor(4) as ex:
        for sci,h in ex.map(job,need):
            n+=1
            if h is False: continue
            done.add(sci)
            if h: out[sci]=h
            if n%500==0:
                json.dump(out,open('xc.json','w',encoding='utf-8'),ensure_ascii=False); json.dump(sorted(done),open('xc_done.json','w')); print(n,len(out),flush=True)
    json.dump(out,open('xc.json','w',encoding='utf-8'),ensure_ascii=False); json.dump(sorted(done),open('xc_done.json','w')); print('xc found',len(out))
