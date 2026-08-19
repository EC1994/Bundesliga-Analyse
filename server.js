const http=require("http"),fs=require("fs"),path=require("path");
const zlib=require("zlib"),https=require("https");
const Database=require("better-sqlite3");
const https=require("https");
const db=new Database(process.env.DB_FILE||"bundesliga.db"); db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT,post_key TEXT,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,up INTEGER DEFAULT 0,down INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS replies(id INTEGER PRIMARY KEY AUTOINCREMENT,comment_id INTEGER,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS votes(comment_id INTEGER,voter_key TEXT,value INTEGER,PRIMARY KEY(comment_id,voter_key));`);
const SOURCES=JSON.parse(fs.readFileSync(path.join(__dirname,"sources.json"),"utf8"));
db.exec(`CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,name TEXT,type TEXT,trust REAL,enabled INTEGER);
CREATE TABLE IF NOT EXISTS feed_items(id INTEGER PRIMARY KEY AUTOINCREMENT,source_id TEXT,title TEXT,excerpt TEXT,url TEXT UNIQUE,published_at TEXT,category TEXT,cluster_key TEXT,source_trust REAL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sync_log(id INTEGER PRIMARY KEY AUTOINCREMENT,source_id TEXT,started_at TEXT,finished_at TEXT,items INTEGER,status TEXT,error TEXT);
CREATE TABLE IF NOT EXISTS facts(id INTEGER PRIMARY KEY AUTOINCREMENT,fact_type TEXT,entity_key TEXT,payload TEXT,confidence REAL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(fact_type,entity_key));`);
for(const group of ["primary","sports_media"]){for(const x of SOURCES[group]||[])db.prepare("INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?)").run(x.id,x.name,x.type,x.trust,x.enabled?1:0)}
function cleanText(v){return String(v||"").replace(/<[^>]+>/g," ").replace(/\\s+/g," ").trim()}
function normTitle(v){return cleanText(v).toLowerCase().replace(/[^a-z0-9äöüß ]/gi,"").replace(/\\s+/g," ").slice(0,180)}
function confidence(items){
  if(!items.length)return 0;
  let independent=[...new Set(items.map(x=>x.source_id))];
  let weighted=1-Math.exp(-independent.reduce((a,id)=>a+(items.find(x=>x.source_id===id)?.source_trust||0),0)/1.8);
  return Math.min(.99,weighted);
}
function parseFeed(xml){
  const out=[], blocks=xml.match(/<item[\\s\\S]*?<\\/item>/gi)||xml.match(/<entry[\\s\\S]*?<\\/entry>/gi)||[];
  for(const b of blocks){
    const title=(b.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)||[])[1];
    const link=(b.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)||[])[1]||(b.match(/<link[^>]*>([\\s\\S]*?)<\\/link>/i)||[])[1];
    const desc=(b.match(/<(description|summary|content)[^>]*>([\\s\\S]*?)<\\/(description|summary|content)>/i)||[])[2];
    const date=(b.match(/<(pubDate|published|updated)[^>]*>([\\s\\S]*?)<\\/(pubDate|published|updated)>/i)||[])[2];
    if(title&&link)out.push({title:cleanText(title),excerpt:cleanText(desc).slice(0,500),url:cleanText(link),published_at:date?new Date(cleanText(date)).toISOString():new Date().toISOString()});
  } return out;
}
function fetchText(url){
 return new Promise((ok,no)=>{
  const u=new URL(url), opts={headers:{"User-Agent":"BundesligaHub/1.0 (+respectful feed reader)","Accept":"application/rss+xml, application/atom+xml, text/xml, */*"}};
  const req=https.get(u,opts,r=>{let chunks=[];r.on("data",c=>chunks.push(c));r.on("end",()=>{let b=Buffer.concat(chunks);try{if((r.headers["content-encoding"]||"").includes("gzip"))b=zlib.gunzipSync(b);if((r.headers["content-encoding"]||"").includes("deflate"))b=zlib.inflateSync(b);ok(b.toString("utf8"))}catch(e){no(e)}})});
  req.setTimeout(12000,()=>{req.destroy();no(new Error("timeout"))}); req.on("error",no);
 })
}
async function syncFeeds(){
 const all=[...(SOURCES.primary||[]),...(SOURCES.sports_media||[])].filter(x=>x.enabled&&x.feed);
 for(const src of all){
   const started=new Date().toISOString(); let n=0;
   try{
    const xml=await fetchText(src.feed), items=parseFeed(xml);
    const ins=db.prepare("INSERT OR IGNORE INTO feed_items(source_id,title,excerpt,url,published_at,category,cluster_key,source_trust) VALUES(?,?,?,?,?,?,?,?)");
    const tx=db.transaction(rows=>{for(const x of rows){let k=normTitle(x.title);let r=ins.run(src.id,x.title,x.excerpt,x.url,x.published_at,"news",k,src.trust);n+=r.changes}});
    tx(items); db.prepare("INSERT INTO sync_log(source_id,started_at,finished_at,items,status) VALUES(?,?,?,?,?)").run(src.id,started,new Date().toISOString(),n,"ok");
   }catch(e){db.prepare("INSERT INTO sync_log(source_id,started_at,finished_at,items,status,error) VALUES(?,?,?,?,?,?)").run(src.id,started,new Date().toISOString(),0,"error",String(e.message))}
 }
}

const PORT=process.env.PORT||3000, pub=path.join(__dirname,"public");

function json(res,s,d){res.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"});res.end(JSON.stringify(d))}
function body(req){return new Promise((ok,no)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{ok(s?JSON.parse(s):{})}catch(e){no(e)}})})}
function apiGet(url){return new Promise((ok,no)=>https.get(url,r=>{let s="";r.on("data",c=>s+=c);r.on("end",()=>{try{ok(JSON.parse(s))}catch(e){no(e)}})}).on("error",no))}
function comments(k){let a=db.prepare("SELECT * FROM comments WHERE post_key=? ORDER BY created_at DESC").all(k);for(const c of a)c.replies=db.prepare("SELECT * FROM replies WHERE comment_id=? ORDER BY created_at").all(c.id);return a}
async function route(req,res){
 if(req.method==="GET"&&req.url.startsWith("/api/comments")){let u=new URL(req.url,"http://x");return json(res,200,comments(u.searchParams.get("post")||"home"))}
 if(req.method==="POST"&&req.url==="/api/comments"){try{let b=await body(req);if(!b.postKey||!b.text)return json(res,400,{error:"missing"});let r=db.prepare("INSERT INTO comments(post_key,user_name,text) VALUES(?,?,?)").run(b.postKey,b.userName||"Du",String(b.text).slice(0,1000));return json(res,201,{id:r.lastInsertRowid})}catch(e){return json(res,400,{error:"bad request"})}}
 if(req.method==="POST"&&req.url==="/api/replies"){try{let b=await body(req);let r=db.prepare("INSERT INTO replies(comment_id,user_name,text) VALUES(?,?,?)").run(+b.commentId,b.userName||"Du",String(b.text).slice(0,1000));return json(res,201,{id:r.lastInsertRowid})}catch(e){return json(res,400,{error:"bad request"})}}
 if(req.method==="POST"&&req.url==="/api/vote"){try{let b=await body(req),id=+b.commentId,v=String(b.voterKey),val=+b.value;let old=db.prepare("SELECT value FROM votes WHERE comment_id=? AND voter_key=?").get(id,v);const tx=db.transaction(()=>{if(old)db.prepare("DELETE FROM votes WHERE comment_id=? AND voter_key=?").run(id,v);if(val!==0)db.prepare("INSERT INTO votes VALUES(?,?,?)").run(id,v,val);let a=db.prepare("SELECT value,COUNT(*) n FROM votes WHERE comment_id=? GROUP BY value").all(id);db.prepare("UPDATE comments SET up=?,down=? WHERE id=?").run(a.find(x=>x.value===1)?.n||0,a.find(x=>x.value===-1)?.n||0,id)});tx();return json(res,200,{ok:true})}catch(e){return json(res,400,{error:"bad request"})}}
 if(req.method==="GET"&&req.url.startsWith("/api/team/")){
   const name=decodeURIComponent(req.url.slice("/api/team/".length));
   // Generic adapter: set SPORTS_API_URL and SPORTS_API_KEY on the server.
   // The adapter expects the provider to return {players:[{name,position,number,photo,...}]}.
   if(!process.env.SPORTS_API_URL) return json(res,200,{ok:false,team:name,players:[],message:"No player-data provider configured"});
   try{
     const u=new URL(process.env.SPORTS_API_URL);
     u.searchParams.set("team",name);
     const opts={headers:process.env.SPORTS_API_KEY?{"x-apisports-key":process.env.SPORTS_API_KEY}:{}};
     const data=await new Promise((ok,no)=>https.get(u,opts,r=>{let s="";r.on("data",c=>s+=c);r.on("end",()=>{try{ok(JSON.parse(s))}catch(e){no(e)}})}).on("error",no));
     // Supports the common API-Sports response shape: response:[{player:{...}}]
     const players=(data.response||data.players||[]).map(x=>x.player||x);
     return json(res,200,{ok:true,team:name,players});
   }catch(e){return json(res,503,{ok:false,team:name,players:[],error:"Player data provider unavailable"})}
 }
 if(req.method==="GET"&&req.url.startsWith("/api/news")){
   let u=new URL(req.url,"http://x"), limit=Math.min(100,Math.max(1,+(u.searchParams.get("limit")||30)));
   let rows=db.prepare(`SELECT f.*,s.name source_name FROM feed_items f JOIN sources s ON s.id=f.source_id ORDER BY datetime(f.published_at) DESC LIMIT ?`).all(limit);
   // Cross-source confidence per normalized headline cluster.
   const groups={}; for(const x of rows)(groups[x.cluster_key]??=[]).push(x);
   rows=rows.map(x=>({...x,source_count:(groups[x.cluster_key]||[]).length,confidence:confidence(groups[x.cluster_key]||[])}));
   return json(res,200,{ok:true,items:rows});
}
if(req.method==="POST"&&req.url==="/api/sync"){syncFeeds().then(()=>json(res,200,{ok:true})).catch(e=>json(res,500,{ok:false,error:e.message}));return}
if(req.method==="GET"&&req.url==="/api/live"){try{const base="https://api.openligadb.de";const [matches,table]=await Promise.all([apiGet(base+"/getmatchdata/bl1/2026"),apiGet(base+"/getbltable/bl1/2026")]);return json(res,200,{ok:true,matches,table,source:"OpenLigaDB"})}catch(e){return json(res,503,{ok:false,error:"Datenquelle momentan nicht erreichbar"})}}
 if(req.method==="GET"){let p=path.join(pub,req.url.split("?")[0]);if(req.url==="/"||!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(pub,"index.html");res.writeHead(200,{"Content-Type":p.endsWith(".html")?"text/html; charset=utf-8":"text/plain"});return fs.createReadStream(p).pipe(res)}
 json(res,404,{error:"not found"});
}
setInterval(()=>syncFeeds().catch(()=>{}),60*60*1000);
http.createServer(route).listen(PORT,()=>{syncFeeds().catch(()=>{});console.log("Bundesliga Hub auf Port "+PORT)});
