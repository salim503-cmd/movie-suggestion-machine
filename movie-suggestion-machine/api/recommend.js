// Movie Suggestion Machine: server function. Keeps your TMDB token secret.
const T="https://api.themoviedb.org/3";
const get=async(p,q={})=>{const u=new URL(T+p);for(const k in q)if(q[k]!==undefined&&q[k]!=="")u.searchParams.set(k,q[k]);
 const r=await fetch(u,{headers:{Authorization:"Bearer "+process.env.TMDB_TOKEN,accept:"application/json"}});if(!r.ok)throw new Error("TMDB "+r.status);return r.json()};
const GID={Thriller:53,Crime:80,Mystery:9648,Drama:18,Action:28,Comedy:35,Horror:27,"Sci-fi":878,Historical:36,War:10752,Romance:10749,Adventure:12,Family:10751};
const KW={Psychological:"psychological thriller",Biographical:"biography",Political:"politics",Courtroom:"courtroom",Gangster:"gangster",Heist:"heist",Survival:"survival"};
const MOOD={"Relaxed / entertained":[35,10751,12],"Excited":[28,12],"Suspenseful":[53,9648],"Thrilled":[53,28],"Emotionally moved":[18,10749],"Thought-provoking":[18,878,9648],"Inspired":[18,36],"Scared":[27],"Laugh":[35],"Dark / disturbing":[27,53,80],"Escapist":[14,12,878],"Something intellectually challenging":[878,9648,53]};
const LANG={English:"en",Hindi:"hi",Malayalam:"ml",Tamil:"ta",Telugu:"te",Korean:"ko",Japanese:"ja",Spanish:"es",French:"fr",Persian:"fa",Arabic:"ar"};
const FAST=[28,53,12,80,27],SLOW=[18,36,10749],EASY=[35,10751,16,10749,12],HARD=[9648,878,53,18],DARK=[27,80,10752,53],HAPPY=[35,10749,10751,16,10402];
const RANK={U:0,G:0,PG:1,UA:2,"PG-13":2,R:3,A:3,"NC-17":4,S:4},LV={"Very little":1,"Some":2,"Moderate":3,"Heavy":4};
const cr=c=>{c=String(c||"").replace("/","").trim();return !c?null:c.startsWith("UA")?2:(RANK[c]??null)};
const uniq=a=>[...new Set(a)];
module.exports=async(req,res)=>{
 try{
  if(!process.env.TMDB_TOKEN)throw new Error("TMDB_TOKEN is not set");
  const {ans={},seen=[]}=req.body||{};
  const yr=new Date().getFullYear(),ago={"Only recent — last 2–3 years":3,"Last 5 years":5,"Last 10 years":10}[ans.age];
  const gte=ago?`${yr-ago}-01-01`:ans.age==="Any movie after 2000"?"2000-01-01":undefined;
  const best=ans.age==="Give me the best movie regardless of age";
  const langs=(ans.lang||[]).map(l=>LANG[l]).filter(Boolean),ug=ans.genre||[];
  const gids=ug.map(g=>GID[g]).filter(Boolean),mids=uniq((ans.mood||[]).flatMap(m=>MOOD[m]||[]));
  const kws=(await Promise.all(ug.filter(g=>KW[g]).map(g=>get("/search/keyword",{query:KW[g]}).then(r=>r.results[0]&&r.results[0].id).catch(()=>null)))).filter(Boolean);
  const base={include_adult:false,"vote_count.gte":best?1000:150,"vote_average.gte":best?7.5:6.3,"primary_release_date.gte":gte,page:1+Math.floor(Math.random()*3)};
  const sets=[];if(gids.length)sets.push({with_genres:gids.join("|")});if(kws.length)sets.push({with_keywords:kws.join("|")});if(mids.length)sets.push({with_genres:mids.join("|")});if(!sets.length)sets.push({});
  const jobs=[];for(const l of langs.length?langs:[undefined])for(const s of sets)for(const sort of ["popularity.desc","vote_average.desc"])jobs.push(get("/discover/movie",{...base,...s,with_original_language:l,sort_by:sort,watch_region:"IN"}).catch(()=>({results:[]})));
  const pool=new Map();(await Promise.all(jobs)).forEach(r=>r.results.forEach(m=>{if(!seen.includes(m.id)&&m.poster_path)pool.set(m.id,m)}));
  const has=(m,a)=>a.filter(x=>m.genre_ids.includes(x)).length,st=(v,...p)=>p.some(x=>String(v||"").startsWith(x));
  const who=ans.who,sc=m=>{let s=(m.vote_average-6)*1.5+Math.log10(m.popularity+1)+has(m,gids)*3+has(m,mids)*1.5;
   if(st(ans.hook,"Hook")||ans.pace==="Fast")s+=has(m,FAST);
   if(st(ans.hook,"Slow-burn")||ans.pace==="Slow")s+=has(m,SLOW)*1.5-has(m,FAST)*.5;
   if(st(ans.brain,"Easy")||st(ans.att,"Brain tired"))s+=has(m,EASY)*1.5-has(m,HARD)*.5;
   if(st(ans.brain,"Intelligent","Complex","Very")||st(ans.att,"I'm fresh"))s+=has(m,HARD)*1.5;
   if(st(ans.att,"I want something"))s+=has(m,[53,9648,80,28])*1.5+(m.vote_average-7);
   if(ans.end==="Happy")s+=has(m,HAPPY)*2-has(m,DARK);if(st(ans.end,"I absolutely"))s+=has(m,HAPPY)*2-has(m,[27,10752])*3;
   if(ans.end==="Dark")s+=has(m,DARK)*2;if(ans.end==="Twist ending"||ans.end==="Shocking")s+=has(m,[53,9648,27]);
   if(ans.end==="Bittersweet")s+=has(m,[18,10749]);if(ans.end==="Ambiguous")s+=has(m,[9648,878,18]);
   if(who==="Children")s+=has(m,[16,10751])*3-has(m,[27,53])*3;if(who==="Family")s+=has(m,[10751,16,35,12])*1.5;
   if(who==="Wife/partner")s+=has(m,[10749,35])*1.5;if(who==="Friends")s+=has(m,[35,28,12,27]);return s+Math.random()};
  const top=[...pool.values()].sort((a,b)=>sc(b)-sc(a)).slice(0,14);
  let lim=Math.min(4,...Object.values(ans.cont||{}).map(v=>LV[v]||4));if(who==="Children")lim=Math.min(lim,1);if(who==="Family")lim=Math.min(lim,2);
  const dn=new Intl.DisplayNames(["en"],{type:"language"});
  const det=await Promise.all(top.map(m=>get("/movie/"+m.id,{append_to_response:"watch/providers,release_dates"}).then(d=>({m,d})).catch(()=>null)));
  const out=[];for(const x of det){if(!x||out.length>=5)continue;const {m,d}=x;
   const rs=(d.release_dates&&d.release_dates.results||[]).filter(r=>r.iso_3166_1==="IN"||r.iso_3166_1==="US").flatMap(r=>r.release_dates.map(y=>y.certification));
   const ranks=rs.map(cr).filter(v=>v!==null);if(ranks.length&&Math.max(...ranks)>lim)continue;
   const P=(d["watch/providers"]&&d["watch/providers"].results&&d["watch/providers"].results.IN)||{},nm=a=>uniq((a||[]).map(p=>p.provider_name));
   const gm=ug.filter(g=>GID[g]&&m.genre_ids.includes(GID[g])),mm=(ans.mood||[]).filter(k=>(MOOD[k]||[]).some(i=>m.genre_ids.includes(i)));
   out.push({id:m.id,title:d.title,year:(d.release_date||"").slice(0,4),runtime:d.runtime,lang:dn.of(d.original_language)||d.original_language,poster:m.poster_path,score:d.vote_average.toFixed(1),
    overview:(d.overview||"").slice(0,200),cert:rs.find(Boolean)||"",fits:[...gm,...(mm[0]?[mm[0]]:[]),...(langs.length?[dn.of(d.original_language)]:[])].filter(Boolean).concat(!gm.length&&!mm.length?["highly rated"]:[]),
    stream:nm(P.flatrate),rent:nm([...(P.rent||[]),...(P.buy||[])]),link:"https://www.themoviedb.org/movie/"+m.id,imdb:d.imdb_id||""})}
  res.status(200).json({movies:out,note:out.length?"Live from TMDB, matched to your answers. Pace, ending and complexity are estimated from genres."+(out.length<5?" Few films matched, try skipping a question.":""):"No films matched. Try skipping a few questions."});
 }catch(e){res.status(500).json({error:e.message})}
};
