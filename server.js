const http=require("http"),fs=require("fs"),path=require("path");
const Database=require("better-sqlite3");
const https=require("https");
const db=new Database(process.env.DB_FILE||"bundesliga.db"); db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT,post_key TEXT,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,up INTEGER DEFAULT 0,down INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS replies(id INTEGER PRIMARY KEY AUTOINCREMENT,comment_id INTEGER,user_name TEXT,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS votes(comment_id INTEGER,voter_key TEXT,value INTEGER,PRIMARY KEY(comment_id,voter_key));`);
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
 if(req.method==="GET"&&req.url==="/api/live"){try{const base="https://api.openligadb.de";const [matches,table]=await Promise.all([apiGet(base+"/getmatchdata/bl1/2026"),apiGet(base+"/getbltable/bl1/2026")]);return json(res,200,{ok:true,matches,table,source:"OpenLigaDB"})}catch(e){return json(res,503,{ok:false,error:"Datenquelle momentan nicht erreichbar"})}}
 if(req.method==="GET"){let p=path.join(pub,req.url.split("?")[0]);if(req.url==="/"||!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(pub,"index.html");res.writeHead(200,{"Content-Type":p.endsWith(".html")?"text/html; charset=utf-8":"text/plain"});return fs.createReadStream(p).pipe(res)}
 json(res,404,{error:"not found"});
}
http.createServer(route).listen(PORT,()=>console.log("Bundesliga Hub auf Port "+PORT));
