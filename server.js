const http=require("http"),fs=require("fs"),path=require("path"),https=require("https");
const Database=require("better-sqlite3");
const db=new Database(process.env.DB_FILE||"bundesliga.db");db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT,post_key TEXT NOT NULL,user_name TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,up INTEGER DEFAULT 0,down INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS replies(id INTEGER PRIMARY KEY AUTOINCREMENT,comment_id INTEGER NOT NULL,user_name TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS votes(comment_id INTEGER NOT NULL,voter_key TEXT NOT NULL,value INTEGER NOT NULL,PRIMARY KEY(comment_id,voter_key));
CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,json TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT,source TEXT,title TEXT,excerpt TEXT,url TEXT UNIQUE,published_at TEXT,cluster_key TEXT,trust REAL);
`);
const PORT=process.env.PORT||3000,BASE=process.env.SPORTS_API_BASE||"https://v3.football.api-sports.io",LEAGUE=process.env.BUNDESLIGA_LEAGUE_ID||78,SEASON=process.env.SEASON||2026;
const pub=path.join(__dirname,"public"),clubs=JSON.parse(fs.readFileSync(path.join(__dirname,"data/clubs.json"),"utf8"));
function json(res,s,d){res.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(d))}
function readBody(req){return new Promise((ok,no)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{ok(s?JSON.parse(s):{})}catch(e){no(e)}})})}
function get(url,headers={}){return new Promise((ok,no)=>{const u=new URL(url);const r=https.get(u,{headers},res=>{let s="";res.on("data",c=>s+=c);res.on("end",()=>{try{ok({status:res.statusCode,data:JSON.parse(s)})}catch(e){no(e)}})});r.setTimeout(15000,()=>{r.destroy();no(new Error("timeout"))});r.on("error",no)})}
async function sport(endpoint,params={}){
 if(!process.env.SPORTS_API_KEY) throw new Error("SPORTS_API_KEY missing");
 const u=new URL(BASE+endpoint);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v);
 const r=await get(u.toString(),{"x-apisports-key":process.env.SPORTS_API_KEY});
 if(r.status<200||r.status>=300)throw new Error("Sports API HTTP "+r.status);
 if(r.data.errors&&Object.keys(r.data.errors).length)throw new Error(JSON.stringify(r.data.errors));
 return r.data.response||[];
}
async function openLiga(pathname){const r=await get("https://api.openligadb.de"+pathname);if(r.status<200||r.status>=300)throw new Error("OpenLigaDB HTTP "+r.status);return r.data}
function comments(k){let a=db.prepare("SELECT * FROM comments WHERE post_key=? ORDER BY datetime(created_at) DESC").all(k);for(const c of a)c.replies=db.prepare("SELECT * FROM replies WHERE comment_id=? ORDER BY datetime(created_at)").all(c.id);return a}
function esc(v){return String(v||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
async function route(req,res){
 try{
  if(req.method==="GET"&&req.url.startsWith("/api/comments")){let u=new URL(req.url,"http://x");return json(res,200,comments(u.searchParams.get("post")||"home"))}
  if(req.method==="POST"&&req.url==="/api/comments"){let b=await readBody(req);if(!b.postKey||!b.text)return json(res,400,{error:"missing"});let r=db.prepare("INSERT INTO comments(post_key,user_name,text) VALUES(?,?,?)").run(String(b.postKey),b.userName||"Du",String(b.text).slice(0,1500));return json(res,201,{id:r.lastInsertRowid})}
  if(req.method==="POST"&&req.url==="/api/replies"){let b=await readBody(req);let r=db.prepare("INSERT INTO replies(comment_id,user_name,text) VALUES(?,?,?)").run(+b.commentId,b.userName||"Du",String(b.text).slice(0,1500));return json(res,201,{id:r.lastInsertRowid})}
  if(req.method==="POST"&&req.url==="/api/vote"){let b=await readBody(req),id=+b.commentId,v=String(b.voterKey),val=+b.value;if(!id||![1,-1,0].includes(val))return json(res,400,{error:"invalid"});let old=db.prepare("SELECT value FROM votes WHERE comment_id=? AND voter_key=?").get(id,v);const tx=db.transaction(()=>{if(old)db.prepare("DELETE FROM votes WHERE comment_id=? AND voter_key=?").run(id,v);if(val)db.prepare("INSERT INTO votes VALUES(?,?,?)").run(id,v,val);let a=db.prepare("SELECT value,COUNT(*) n FROM votes WHERE comment_id=? GROUP BY value").all(id);db.prepare("UPDATE comments SET up=?,down=? WHERE id=?").run(a.find(x=>x.value===1)?.n||0,a.find(x=>x.value===-1)?.n||0,id)});tx();return json(res,200,{ok:true})}

  if(req.method==="GET"&&req.url==="/api/clubs")return json(res,200,clubs);
  if(req.method==="GET"&&req.url.startsWith("/api/team/")){
    const q=decodeURIComponent(req.url.slice("/api/team/".length));
    let local=clubs.find(x=>x[0].toLowerCase()===q.toLowerCase()||x[1].toLowerCase()===q.toLowerCase());
    if(process.env.SPORTS_API_KEY){
      const teams=await sport("/teams",{league:LEAGUE,season:SEASON});
      const t=teams.find(x=>x.team.name.toLowerCase()===q.toLowerCase()||x.team.name.toLowerCase().includes(q.toLowerCase()));
      if(t){const players=await sport("/players/squads",{team:t.team.id});return json(res,200,{ok:true,team:t.team,players:players?.[0]?.players||[]})}
    }
    return json(res,200,{ok:true,team:{name:local?.[0]||q,logo:""},players:[]});
  }
  if(req.method==="GET"&&req.url==="/api/table"){
    try{if(process.env.SPORTS_API_KEY)return json(res,200,{ok:true,source:"API-Football",table:await sport("/standings",{league:LEAGUE,season:SEASON})});
    }catch(e){}
    return json(res,200,{ok:true,source:"OpenLigaDB",table:await openLiga(`/getbltable/bl1/${SEASON}`)});
  }
  if(req.method==="GET"&&req.url==="/api/matches"){
    try{if(process.env.SPORTS_API_KEY)return json(res,200,{ok:true,source:"API-Football",matches:await sport("/fixtures",{league:LEAGUE,season:SEASON,next:20,timezone:"Europe/Berlin"})});
    }catch(e){}
    return json(res,200,{ok:true,source:"OpenLigaDB",matches:await openLiga(`/getmatchdata/bl1/${SEASON}`)});
  }
  if(req.method==="GET"&&req.url==="/api/live"){
    if(process.env.SPORTS_API_KEY)return json(res,200,{ok:true,source:"API-Football",matches:await sport("/fixtures",{league:LEAGUE,live:"all",timezone:"Europe/Berlin"})});
    return json(res,200,{ok:false,source:"OpenLigaDB",message:"Für echte Live-Spielereignisse SPORTS_API_KEY konfigurieren."});
  }
  if(req.method==="GET"&&req.url==="/api/transfers"){
    if(!process.env.SPORTS_API_KEY)return json(res,200,{ok:false,message:"SPORTS_API_KEY erforderlich"});
    const teams=await sport("/teams",{league:LEAGUE,season:SEASON});let all=[];for(const x of teams){try{const z=await sport("/transfers",{team:x.team.id});all.push(...z.map(v=>({...v,club:x.team.name,logo:x.team.logo})))}catch(e){}}
    return json(res,200,{ok:true,items:all});
  }
  if(req.method==="GET"&&req.url==="/api/injuries"){
    if(!process.env.SPORTS_API_KEY)return json(res,200,{ok:false,message:"SPORTS_API_KEY erforderlich"});
    return json(res,200,{ok:true,items:await sport("/injuries",{league:LEAGUE,season:SEASON})});
  }
  if(req.method==="GET"&&req.url.startsWith("/api/lineup/")){
    if(!process.env.SPORTS_API_KEY)return json(res,200,{ok:false,message:"SPORTS_API_KEY erforderlich"});
    const id=req.url.slice("/api/lineup/".length);return json(res,200,{ok:true,items:await sport("/fixtures/lineups",{fixture:id})});
  }
  if(req.method==="GET"&&req.url.startsWith("/api/player/")){
    if(!process.env.SPORTS_API_KEY)return json(res,200,{ok:false,message:"SPORTS_API_KEY erforderlich"});
    const id=req.url.slice("/api/player/".length);return json(res,200,{ok:true,items:await sport("/players",{id,season:SEASON})});
  }
  if(req.method==="GET"&&req.url==="/api/news")return json(res,200,{ok:true,items:db.prepare("SELECT * FROM news ORDER BY datetime(published_at) DESC LIMIT 100").all()});
  if(req.method==="GET"){let f=path.join(pub,req.url.split("?")[0]);if(req.url==="/"||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(pub,"index.html");let ct=f.endsWith(".html")?"text/html":f.endsWith(".js")?"text/javascript":"text/css";res.writeHead(200,{"Content-Type":ct+"; charset=utf-8"});return fs.createReadStream(f).pipe(res)}
  json(res,404,{error:"not found"});
 }catch(e){json(res,503,{ok:false,error:e.message})}
}
http.createServer(route).listen(PORT,()=>console.log("Bundesliga Hub: http://localhost:"+PORT));
