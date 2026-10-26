import json, urllib.request, urllib.parse, re, sys
UA={'User-Agent':'BirdLexiconResearch/0.1 (https://github.com/hamozalsoud-commits/bird-lexicon)'}
def get(url,params):
    u=url+'?'+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
def strip(s): return re.sub(r'<[^>]+>','',s or '').strip()
def fileinfo(titles):
    r=get('https://commons.wikimedia.org/w/api.php',{'action':'query','titles':'|'.join(titles),'prop':'imageinfo','iiprop':'url|extmetadata|mime','iiurlwidth':900,'format':'json'})
    out=[]
    for p in r['query']['pages'].values():
        if 'imageinfo' not in p: continue
        ii=p['imageinfo'][0]; m=ii.get('extmetadata',{})
        out.append({'title':p['title'],'url':ii['url'],'thumb':ii.get('thumburl'),'page':ii['descriptionurl'],'mime':ii.get('mime'),
          'artist':strip(m.get('Artist',{}).get('value')),'license':m.get('LicenseShortName',{}).get('value'),'licenseUrl':m.get('LicenseUrl',{}).get('value'),'credit':strip(m.get('Credit',{}).get('value'))[:150]})
    return out
species=sys.argv[1:]
res={}
for sp in species:
    d={}
    # main image from en wikipedia
    r=get('https://en.wikipedia.org/w/api.php',{'action':'query','titles':sp,'redirects':1,'prop':'pageimages|langlinks','piprop':'original|name','lllang':'ar','format':'json'})
    pg=list(r['query']['pages'].values())[0]
    d['enTitle']=pg.get('title'); d['arTitle']=(pg.get('langlinks') or [{}])[0].get('*')
    img=pg.get('pageimage')
    d['image']=fileinfo(['File:'+img]) if img else []
    # audio search on commons
    s=get('https://commons.wikimedia.org/w/api.php',{'action':'query','list':'search','srsearch':sp+' filemime:audio','srnamespace':6,'srlimit':5,'format':'json'})
    at=[x['title'] for x in s['query']['search']]
    d['audio']=fileinfo(at[:3]) if at else []
    s=get('https://commons.wikimedia.org/w/api.php',{'action':'query','list':'search','srsearch':sp+' filemime:video','srnamespace':6,'srlimit':3,'format':'json'})
    vt=[x['title'] for x in s['query']['search']]
    d['video']=fileinfo(vt[:2]) if vt else []
    if d['arTitle']:
        a=get('https://ar.wikipedia.org/w/api.php',{'action':'query','titles':d['arTitle'],'prop':'extracts|revisions','rvprop':'ids','explaintext':1,'exchars':2500,'format':'json'})
        ap=list(a['query']['pages'].values())[0]
        d['arExtract']=ap.get('extract'); d['arRev']=ap['revisions'][0]['revid']
    res[sp]=d
json.dump(res,open('out.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
for k,v in res.items(): print(k,v['arTitle'],len(v['image']),[a['title'] for a in v['audio']],[x['title'] for x in v['video']])
