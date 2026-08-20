const http=require("http"),https=require("https"),fs=require("fs"),path=require("path");
const Database=require("better-sqlite3");
const db=new Database(process.env.DB_FILE||"bundesliga.db");db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT,post_key TEXT,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,up INTEGER DEFAULT 0,down INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS replies(id INTEGER PRIMARY KEY AUTOINCREMENT,comment_id INTEGER,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS votes(comment_id INTEGER,voter_key TEXT,value INTEGER,PRIMARY KEY(comment_id,voter_key));`);
const PORT=process.env.PORT||3000,BASE=process.env.SPORTS_API_BASE||"https://v3.football.api-sports.io",KEY=process.env.SPORTS_API_KEY;
const pub=path.join(__dirname,"public"),clubs=JSON.parse(fs.readFileSync(path.join(__dirname,"data/clubs.json")));
function json(res,s,d){res.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(d))}
function get(url,headers={}){return new Promise((ok,no)=>{const r=https.get(url,{headers},res=>{let s="";res.on("data",c=>s+=c);res.on("end",()=>{try{ok({status:res.statusCode,data:JSON.parse(s)})}catch(e){no(e)}})});r.setTimeout(15000,()=>{r.destroy();no(new Error("timeout"))});r.on("error",no)})}
async function sport(endpoint,params={}){if(!KEY)throw Error("SPORTS_API_KEY fehlt");const u=new URL(BASE+endpoint);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);const r=await get(u.toString(),{"x-apisports-key":KEY});if(r.status>=400)throw Error("API HTTP "+r.status);return r.data.response||[]}
async function openliga(u){const r=await get("https://api.openligadb.de"+u);if(r.status>=400)throw Error("OpenLigaDB HTTP "+r.status);return r.data}
function body(req){return new Promise((ok,no)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{ok(JSON.parse(s||"{}"))}catch(e){no(e)}})})}
function comments(k){const a=db.prepare("SELECT * FROM comments WHERE post_key=? ORDER BY id DESC").all(k);for(const c of a)c.replies=db.prepare("SELECT * FROM replies WHERE comment_id=? ORDER BY id").all(c.id);return a}
async function route(req,res){
 try{
  if(req.method==="GET"&&req.url.startsWith("/api/comments")){const u=new URL(req.url,"http://x");return json(res,200,comments(u.searchParams.get("post")||"news"))}
  if(req.method==="POST"&&req.url==="/api/comments"){const b=await body(req);const r=db.prepare("INSERT INTO comments(post_key,user_name,text) VALUES(?,?,?)").run(b.postKey,b.userName||"Du",String(b.text||"").slice(0,1500));return json(res,201,{id:r.lastInsertRowid})}
  if(req.method==="POST"&&req.url==="/api/replies"){const b=await body(req);const r=db.prepare("INSERT INTO replies(comment_id,user_name,text) VALUES(?,?,?)").run(+b.commentId,b.userName||"Du",String(b.text||"").slice(0,1500));return json(res,201,{id:r.lastInsertRowid})}
  if(req.method==="POST"&&req.url==="/api/vote"){const b=await body(req),id=+b.commentId,v=String(b.voterKey),val=+b.value;const old=db.prepare("SELECT value FROM votes WHERE comment_id=? AND voter_key=?").get(id,v);const tx=db.transaction(()=>{if(old)db.prepare("DELETE FROM votes WHERE comment_id=? AND voter_key=?").run(id,v);if(val)db.prepare("INSERT INTO votes VALUES(?,?,?)").run(id,v,val);const x=db.prepare("SELECT value,COUNT(*) n FROM votes WHERE comment_id=? GROUP BY value").all(id);db.prepare("UPDATE comments SET up=?,down=? WHERE id=?").run(x.find(a=>a.value===1)?.n||0,x.find(a=>a.value===-1)?.n||0,id)});tx();return json(res,200,{ok:true})}
  if(req.method==="GET"&&req.url==="/api/clubs")return json(res,200,clubs);
  if(req.method==="GET"&&req.url==="/api/status")return json(res,200,{backend:true,sportsApi:!!KEY});
  if(req.method==="GET"&&req.url==="/api/matches"){try{if(KEY)return json(res,200,{source:"API-Football",data:await sport("/fixtures",{league:78,season:2026,next:30,timezone:"Europe/Berlin"})})}catch(e){}return json(res,200,{source:"OpenLigaDB",data:await openliga("/getmatchdata/bl1/2026")})}
  if(req.method==="GET"&&req.url==="/api/live"){if(!KEY)return json(res,200,{ok:false,message:"Echte Live-Daten benötigen SPORTS_API_KEY."});return json(res,200,{ok:true,data:await sport("/fixtures",{league:78,live:"all",timezone:"Europe/Berlin"})})}
  if(req.method==="GET"&&req.url==="/api/table"){try{if(KEY)return json(res,200,{data:await sport("/standings",{league:78,season:2026})})}catch(e){}return json(res,200,{data:await openliga("/getbltable/bl1/2026")})}
  if(req.method==="GET"&&req.url==="/api/transfers"){if(!KEY)return json(res,200,{data:[],message:"Transfers benötigen SPORTS_API_KEY."});const ts=await sport("/teams",{league:78,season:2026}),out=[];for(const t of ts){try{out.push(...await sport("/transfers",{team:t.team.id}))}catch(e){}}return json(res,200,{data:out})}
  if(req.method==="GET"&&req.url==="/api/injuries"){if(!KEY)return json(res,200,{data:[],message:"Verletzungen benötigen SPORTS_API_KEY."});return json(res,200,{data:await sport("/injuries",{league:78,season:2026})})}
  if(req.method==="GET"&&req.url.startsWith("/api/team/")){
    const name=decodeURIComponent(req.url.slice(10));if(!KEY)return json(res,200,{team:{name},players:[],lineup:null,message:"Für Kader, Bilder und S11 SPORTS_API_KEY konfigurieren."});
    const ts=await sport("/teams",{league:78,season:2026}),t=ts.find(x=>x.team.name.toLowerCase()===name.toLowerCase()||x.team.name.toLowerCase().includes(name.toLowerCase()));
    if(!t)return json(res,404,{error:"Verein nicht gefunden"});const sq=await sport("/players/squads",{team:t.team.id});
    return json(res,200,{team:t.team,players:sq[0]?.players||[],lineup:null});
  }
  if(req.method==="GET"&&req.url.startsWith("/api/player/")){if(!KEY)return json(res,200,{data:[],message:"Spielerprofil benötigt SPORTS_API_KEY"});return json(res,200,{data:await sport("/players",{id:req.url.slice(13),season:2026})})}
  if(req.method==="GET"){let f=path.join(pub,req.url.split("?")[0]);if(req.url==="/"||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(pub,"index.html");const ext=path.extname(f);res.writeHead(200,{"Content-Type":ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript":"text/css"});return fs.createReadStream(f).pipe(res)}
  json(res,404,{error:"not found"})
 }catch(e){json(res,503,{ok:false,error:e.message})}
}
http.createServer(route).listen(PORT,()=>console.log("Bundesliga Hub: http://localhost:"+PORT));
