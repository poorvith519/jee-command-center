import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const JEE_DATE = new Date("2026-04-13T09:00:00");
const TOTAL_MOCKS = 20;
const APP = "jcc";

const SUBJECTS = {
  Physics:     { color:"#f97316", icon:"⚡", short:"PHY" },
  Chemistry:   { color:"#22d3ee", icon:"🧪", short:"CHEM" },
  Mathematics: { color:"#a78bfa", icon:"∑",  short:"MATH" },
};

const ALL_CHAPTERS = {
  Physics:     ["Mechanics","Kinematics","Work & Energy","Rotational Motion","Gravitation","Fluid Mechanics","Thermodynamics","Waves","Electrostatics","Current Electricity","Magnetism","Electromagnetic Induction","Optics","Modern Physics","Semiconductors","Units & Measurement"],
  Chemistry:   ["Mole Concept","Atomic Structure","Chemical Bonding","States of Matter","Thermochemistry","Chemical Equilibrium","Electrochemistry","Chemical Kinetics","Surface Chemistry","p-Block Elements","d-Block Elements","Coordination Compounds","Organic Basics","Hydrocarbons","Alcohols & Ethers","Aldehydes & Ketones","Carboxylic Acids","Amines","Polymers","Biomolecules"],
  Mathematics: ["Sets & Relations","Complex Numbers","Sequences & Series","Quadratic Equations","Permutation & Combination","Binomial Theorem","Matrices & Determinants","Probability","Trigonometry","Coordinate Geometry","3D Geometry","Vectors","Limits & Continuity","Differentiation","Integration","Differential Equations","Statistics"],
};

const TOPIC_COLORS = ["#f97316","#22d3ee","#a78bfa","#4ade80","#fbbf24","#f472b6","#60a5fa","#34d399"];

/* ══════════════════════════════════════════════════════════════
   STORAGE
══════════════════════════════════════════════════════════════ */
const K = {
  profile:  `${APP}-profile`,
  chapters: `${APP}-chapters`,
  mastery:  `${APP}-mastery`,
  mocks:    `${APP}-mocks`,
  daily:    `${APP}-daily`,
  tasks:    `${APP}-tasks`,
  onboard:  `${APP}-onboard`,
  streak:   `${APP}-streak`,
};

async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

/* ══════════════════════════════════════════════════════════════
   API
══════════════════════════════════════════════════════════════ */
async function ai(messages, system = "", maxTokens = 1500) {
  const body = { model:"claude-sonnet-4-20250514", max_tokens:maxTokens, messages };
  if (system) body.system = system;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
  });
  const d = await r.json();
  return d.content?.find(b => b.type==="text")?.text || "";
}

async function aiWithImage(text, base64, mediaType="image/jpeg") {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:800,
      messages:[{ role:"user", content:[
        { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 }},
        { type:"text", text },
      ]}],
    }),
  });
  const d = await r.json();
  return d.content?.find(b => b.type==="text")?.text || "";
}

/* ══════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════ */
const todayStr = () => new Date().toISOString().slice(0,10);
const greet = () => { const h = new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };
const avg = obj => { const v=Object.values(obj).filter(x=>x>0); return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0; };
function getCountdown() {
  const diff = JEE_DATE - new Date(); if(diff<=0) return {days:0,hours:0,mins:0,secs:0};
  return { days:Math.floor(diff/86400000), hours:Math.floor((diff%86400000)/3600000), mins:Math.floor((diff%3600000)/60000), secs:Math.floor((diff%60000)/1000) };
}
function fileToB64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=()=>rej(); r.readAsDataURL(file); });
}

/* ══════════════════════════════════════════════════════════════
   UI ATOMS
══════════════════════════════════════════════════════════════ */
const S = { // shared styles
  card: { background:"#0a0e1a", border:"1px solid #1f2937", borderRadius:12, padding:20 },
  label: { fontSize:10, color:"#6b7280", letterSpacing:2 },
  orbitron: { fontFamily:"'Orbitron',monospace" },
};

function Spin({ size=20, color="#22d3ee" }) {
  return <div style={{width:size,height:size,border:`2px solid ${color}22`,borderTopColor:color,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>;
}

function Pulse({ color="#4ade80" }) {
  return <div style={{width:8,height:8,borderRadius:"50%",background:color,animation:"pulse-dot 2s infinite"}}/>;
}

function CountdownUnit({value,label}) {
  return (
    <div style={{textAlign:"center"}}>
      <div style={{...S.orbitron,fontSize:32,fontWeight:900,color:"#f97316",lineHeight:1,textShadow:"0 0 20px rgba(249,115,22,0.6)"}}>{String(value).padStart(2,"0")}</div>
      <div style={{fontSize:9,color:"#6b7280",letterSpacing:3,marginTop:3}}>{label}</div>
    </div>
  );
}

function MBar({label,value,color,dim=false}) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:11,color:dim?"#4b5563":"#9ca3af"}}>{label}</span>
        <span style={{fontSize:11,color,fontFamily:"monospace",fontWeight:700}}>{value}%</span>
      </div>
      <div style={{background:"#1f2937",borderRadius:2,height:5}}>
        <div style={{width:`${value}%`,height:"100%",borderRadius:2,background:`linear-gradient(90deg,${color}55,${color})`,transition:"width 0.8s ease"}}/>
      </div>
    </div>
  );
}

function StatCard({label,value,sub,color="#f97316",size=26}) {
  return (
    <div style={{...S.card,borderLeft:`3px solid ${color}`}}>
      <div style={{...S.label,marginBottom:4}}>{label}</div>
      <div style={{...S.orbitron,fontSize:size,color,fontWeight:700}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{sub}</div>}
    </div>
  );
}

function Tag({text,color="#374151",bg}) {
  return <span style={{fontSize:10,color,background:bg||`${color}22`,padding:"2px 8px",borderRadius:4,letterSpacing:1}}>{text}</span>;
}

// MCQ option button
function MCQOption({label,text,selected,hovered,onClick,onEnter,onLeave}) {
  return (
    <button onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{
      background:selected?"#22d3ee18":hovered?"#0f1a20":"#0d1117",
      border:`1px solid ${selected?"#22d3ee":hovered?"#22d3ee66":"#1f2937"}`,
      borderRadius:10,padding:"13px 16px",textAlign:"left",cursor:"pointer",
      display:"flex",alignItems:"center",gap:12,transition:"all 0.12s",width:"100%",
    }}>
      <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,fontFamily:"monospace",flexShrink:0,
        background:selected?"#22d3ee33":hovered?"#22d3ee22":"#1f2937",color:selected||hovered?"#22d3ee":"#4b5563",border:selected?"1px solid #22d3ee":"1px solid transparent"}}>
        {label}
      </div>
      <span style={{fontSize:13,color:selected||hovered?"#e5e7eb":"#9ca3af",lineHeight:1.5}}>{text}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH — WELCOME
══════════════════════════════════════════════════════════════ */
function WelcomeScreen({onLogin,onRegister}) {
  return (
    <div style={{minHeight:"100vh",background:"#030712",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center",maxWidth:460,padding:32}}>
        <div style={{width:72,height:72,borderRadius:18,background:"linear-gradient(135deg,#f97316,#dc2626)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 24px",boxShadow:"0 0 40px rgba(249,115,22,0.4)"}}>⚔</div>
        <div style={{...S.orbitron,fontSize:22,fontWeight:900,color:"#f97316",letterSpacing:3,marginBottom:8}}>JEE COMMAND CENTER</div>
        <div style={{fontSize:11,color:"#4b5563",letterSpacing:3,marginBottom:8}}>POWERED BY ZEUS AI</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:40,lineHeight:1.8}}>Your personal AI teacher. Tracks your preparation, tests your concepts, plans your days — built for <span style={{color:"#22d3ee"}}>JEE 2026</span>.</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <button onClick={onRegister} style={{background:"linear-gradient(135deg,#22d3ee,#0891b2)",border:"none",borderRadius:12,padding:"16px",color:"#000",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 24px rgba(34,211,238,0.35)",letterSpacing:1}}>
            🚀 START MY JOURNEY
          </button>
          <button onClick={onLogin} style={{background:"#0a0e1a",border:"1px solid #1f2937",borderRadius:12,padding:"14px",color:"#9ca3af",fontSize:13,cursor:"pointer"}}>
            Already set up? Login →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH — REGISTER
══════════════════════════════════════════════════════════════ */
function RegisterScreen({onComplete}) {
  const [step,setStep] = useState(0);
  const [name,setName] = useState("");
  const [target,setTarget] = useState("250");
  const [college,setCollege] = useState("IIT Bombay");
  const [pin,setPin] = useState("");
  const [pin2,setPin2] = useState("");
  const [err,setErr] = useState("");

  const colleges = ["IIT Bombay","IIT Delhi","IIT Madras","IIT Kanpur","IIT Kharagpur","IIT Roorkee","IIT Guwahati","NIT Trichy","Top NIT","BITS Pilani","Any IIT"];

  async function finish() {
    if(pin.length!==4||pin!==pin2){ setErr("PINs don't match / must be 4 digits"); return; }
    const profile = { name:name.trim(), targetScore:parseInt(target), targetCollege:college, pin, joinDate:todayStr() };
    await save(K.profile, profile);
    await save(K.mocks, []);
    await save(K.tasks, []);
    await save(K.daily, []);
    await save(K.streak, { count:0, last:"" });
    onComplete(profile);
  }

  const inp = (val,set,ph,type="text",max) => (
    <input value={val} onChange={e=>set(e.target.value)} type={type} maxLength={max} placeholder={ph}
      style={{width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"12px 14px",color:"#e5e7eb",fontSize:14,outline:"none",marginBottom:12}}/>
  );

  return (
    <div style={{minHeight:"100vh",background:"#030712",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",color:"#e5e7eb"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{width:"100%",maxWidth:480,padding:24}}>
        <div style={{...S.card,animation:"fadeUp 0.4s ease"}}>
          <div style={{...S.label,marginBottom:20}}>STEP {step+1} OF 3 — REGISTRATION</div>
          <div style={{background:"#1f2937",borderRadius:2,height:3,marginBottom:28}}>
            <div style={{width:`${(step+1)/3*100}%`,height:"100%",background:"linear-gradient(90deg,#22d3ee,#a78bfa)",borderRadius:2,transition:"width 0.4s"}}/>
          </div>

          {step===0&&(
            <>
              <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>What's your name?</div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:20}}>ZEUS will use this throughout your prep journey.</div>
              {inp(name,setName,"Enter your full name")}
              <button disabled={!name.trim()} onClick={()=>setStep(1)} style={{width:"100%",background:name.trim()?"linear-gradient(135deg,#22d3ee,#0891b2)":"#1f2937",border:"none",borderRadius:10,padding:"13px",color:name.trim()?"#000":"#374151",fontSize:13,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed"}}>
                Continue →
              </button>
            </>
          )}
          {step===1&&(
            <>
              <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>Set your targets</div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:20}}>ZEUS will calibrate your plan around this.</div>
              <div style={{...S.label,marginBottom:8}}>TARGET SCORE</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
                {["200","220","240","250","260","270","280","290+"].map(v=>(
                  <button key={v} onClick={()=>setTarget(v==="290+"?"290":v)} style={{background:target===(v==="290+"?"290":v)?"#22d3ee22":"#111827",border:`1px solid ${target===(v==="290+"?"290":v)?"#22d3ee":"#374151"}`,borderRadius:8,padding:"10px",color:target===(v==="290+"?"290":v)?"#22d3ee":"#6b7280",fontSize:12,cursor:"pointer"}}>
                    {v}
                  </button>
                ))}
              </div>
              <div style={{...S.label,marginBottom:8}}>TARGET COLLEGE</div>
              <select value={college} onChange={e=>setCollege(e.target.value)} style={{width:"100%",background:"#111827",border:"1px solid #374151",color:"#e5e7eb",borderRadius:8,padding:"12px",fontSize:13,outline:"none",marginBottom:20}}>
                {colleges.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(0)} style={{flex:1,background:"#111827",border:"1px solid #1f2937",borderRadius:10,padding:"13px",color:"#6b7280",fontSize:13,cursor:"pointer"}}>← Back</button>
                <button onClick={()=>setStep(2)} style={{flex:2,background:"linear-gradient(135deg,#22d3ee,#0891b2)",border:"none",borderRadius:10,padding:"13px",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>Continue →</button>
              </div>
            </>
          )}
          {step===2&&(
            <>
              <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>Create your PIN</div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:20}}>4-digit PIN to access your dashboard each session.</div>
              {inp(pin,setPin,"4-digit PIN","password",4)}
              {inp(pin2,setPin2,"Confirm PIN","password",4)}
              {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:12}}>⚠ {err}</div>}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setStep(1)} style={{flex:1,background:"#111827",border:"1px solid #1f2937",borderRadius:10,padding:"13px",color:"#6b7280",fontSize:13,cursor:"pointer"}}>← Back</button>
                <button onClick={finish} style={{flex:2,background:"linear-gradient(135deg,#4ade80,#16a34a)",border:"none",borderRadius:10,padding:"13px",color:"#000",fontSize:13,fontWeight:800,cursor:"pointer"}}>🚀 CREATE ACCOUNT</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH — LOGIN
══════════════════════════════════════════════════════════════ */
function LoginScreen({profile,onSuccess}) {
  const [pin,setPin] = useState("");
  const [err,setErr] = useState("");
  const [shake,setShake] = useState(false);

  function tryLogin() {
    if(pin===profile.pin){ onSuccess(); }
    else{ setErr("Wrong PIN"); setShake(true); setPin(""); setTimeout(()=>setShake(false),600); }
  }

  return (
    <div style={{minHeight:"100vh",background:"#030712",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",color:"#e5e7eb"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap'); @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
      <div style={{width:"100%",maxWidth:360,padding:24}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{...S.orbitron,fontSize:14,color:"#f97316",letterSpacing:2,fontWeight:900}}>JEE COMMAND CENTER</div>
          <div style={{fontSize:28,fontWeight:700,marginTop:8}}>Welcome back,<br/><span style={{color:"#22d3ee"}}>{profile.name}</span> 👋</div>
        </div>
        <div style={{...S.card,animation:shake?"shake 0.5s ease":"fadeUp 0.4s ease"}}>
          <div style={{...S.label,marginBottom:16,textAlign:"center"}}>ENTER YOUR PIN</div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:50,height:56,background:"#111827",border:`2px solid ${pin.length>i?"#22d3ee":"#1f2937"}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#22d3ee"}}>
                {pin.length>i?"●":""}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[1,2,3,4,5,6,7,8,9,"","0","⌫"].map((k,i)=>(
              <button key={i} onClick={()=>{
                if(k==="⌫") setPin(p=>p.slice(0,-1));
                else if(k!==""&&pin.length<4) { const np=pin+k; setPin(np); if(np.length===4) setTimeout(()=>{ if(np===profile.pin) onSuccess(); else{setErr("Wrong PIN");setShake(true);setTimeout(()=>setShake(false),600);setPin("");} },100); }
              }} style={{
                background:k==="⌫"?"#1f2937":"#111827",border:"1px solid #1f2937",borderRadius:10,padding:"16px",fontSize:16,color:k==="⌫"?"#f87171":"#e5e7eb",cursor:"pointer",fontWeight:600,
              }}>{k}</button>
            ))}
          </div>
          {err&&<div style={{fontSize:12,color:"#f87171",textAlign:"center"}}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ONBOARDING — CHAPTER SELECTION
══════════════════════════════════════════════════════════════ */
function OnboardChapters({profile,onComplete}) {
  const [selected,setSelected] = useState({Physics:[],Chemistry:[],Mathematics:[]});
  const [activeSub,setActiveSub] = useState("Physics");

  function toggle(sub,ch) {
    setSelected(s=>({...s,[sub]:s[sub].includes(ch)?s[sub].filter(x=>x!==ch):[...s[sub],ch]}));
  }
  const total = Object.values(selected).flat().length;

  return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'DM Sans',sans-serif",color:"#e5e7eb",padding:24}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{marginBottom:28,textAlign:"center"}}>
          <div style={{...S.orbitron,fontSize:14,color:"#22d3ee",letterSpacing:2,marginBottom:8}}>ONBOARDING — STEP 1 OF 2</div>
          <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>Which chapters have you studied, <span style={{color:"#f97316"}}>{profile.name}</span>?</div>
          <div style={{fontSize:13,color:"#6b7280"}}>ZEUS will test you on these with PYQs to build your baseline. Be honest — this shapes your entire plan.</div>
        </div>

        {/* Subject tabs */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {Object.entries(SUBJECTS).map(([sub,info])=>(
            <button key={sub} onClick={()=>setActiveSub(sub)} style={{
              flex:1,background:activeSub===sub?`${info.color}22`:"#0a0e1a",border:`1px solid ${activeSub===sub?info.color:"#1f2937"}`,borderRadius:10,padding:"12px",cursor:"pointer",transition:"all 0.2s",
            }}>
              <div style={{fontSize:18,marginBottom:4}}>{info.icon}</div>
              <div style={{fontSize:11,color:activeSub===sub?info.color:"#6b7280",fontWeight:600,letterSpacing:1}}>{sub.toUpperCase()}</div>
              <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{selected[sub].length} selected</div>
            </button>
          ))}
        </div>

        {/* Chapter grid */}
        <div style={{...S.card,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{...S.label}}>{activeSub.toUpperCase()} — SELECT COMPLETED CHAPTERS</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setSelected(s=>({...s,[activeSub]:[...ALL_CHAPTERS[activeSub]]}))} style={{fontSize:10,color:"#22d3ee",background:"#22d3ee22",border:"1px solid #22d3ee44",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Select All</button>
              <button onClick={()=>setSelected(s=>({...s,[activeSub]:[]}))} style={{fontSize:10,color:"#6b7280",background:"#1f2937",border:"none",borderRadius:4,padding:"3px 8px",cursor:"pointer"}}>Clear</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
            {ALL_CHAPTERS[activeSub].map(ch=>{
              const done = selected[activeSub].includes(ch);
              const c = SUBJECTS[activeSub].color;
              return (
                <button key={ch} onClick={()=>toggle(activeSub,ch)} style={{
                  background:done?`${c}18`:"#0d1117",border:`1px solid ${done?c:"#1f2937"}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",textAlign:"left",transition:"all 0.15s",display:"flex",alignItems:"center",gap:8,
                }}>
                  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${done?c:"#374151"}`,background:done?c:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#000"}}>
                    {done&&"✓"}
                  </div>
                  <span style={{fontSize:12,color:done?"#e5e7eb":"#6b7280"}}>{ch}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,color:"#6b7280"}}><span style={{color:"#22d3ee",fontWeight:700}}>{total}</span> chapters selected across all subjects</div>
          <button disabled={total<3} onClick={()=>onComplete(selected)} style={{
            background:total>=3?"linear-gradient(135deg,#22d3ee,#0891b2)":"#1f2937",border:"none",borderRadius:12,padding:"14px 28px",color:total>=3?"#000":"#374151",fontSize:13,fontWeight:800,cursor:total>=3?"pointer":"not-allowed",
          }}>
            START PYQ TEST ({total} chapters) →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ONBOARDING — PYQ TEST
══════════════════════════════════════════════════════════════ */
function OnboardPYQ({profile,chapters,onComplete}) {
  const [phase,setPhase] = useState("generating"); // generating|testing|evaluating|done
  const [questions,setQuestions] = useState([]);
  const [qIdx,setQIdx] = useState(0);
  const [answers,setAnswers] = useState([]);
  const [hovered,setHovered] = useState(null);
  const [mastery,setMastery] = useState({});
  const [statusMsg,setStatusMsg] = useState("ZEUS is preparing your assessment…");

  const totalChapters = Object.values(chapters).flat();

  useEffect(()=>{ generateQuestions(); },[]);

  async function generateQuestions() {
    setStatusMsg("Generating JEE PYQ-style questions for your chapters…");
    const chapterList = [];
    Object.entries(chapters).forEach(([sub,chs])=>chs.forEach(ch=>chapterList.push({sub,ch})));
    // Pick up to 20 chapters to test (to keep it manageable)
    const toTest = chapterList.slice(0,Math.min(chapterList.length,20));

    const prompt = `Generate 2 JEE PYQ-style MCQ questions for EACH of these chapters. Questions should be actual JEE level (conceptual + numerical mix).

Chapters: ${toTest.map(x=>`${x.sub} - ${x.ch}`).join(", ")}

Return ONLY valid JSON array:
[
  {
    "subject": "Physics",
    "chapter": "Mechanics",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct": 0,
    "explanation": "brief explanation"
  }
]

Generate exactly ${toTest.length*2} questions total (2 per chapter). Mix conceptual and numerical. Make them genuinely JEE-level.`;

    try {
      const raw = await ai([{role:"user",content:prompt}]);
      const json = raw.replace(/```json|```/g,"").trim();
      const qs = JSON.parse(json);
      setQuestions(qs);
      setPhase("testing");
    } catch(e) {
      // fallback: simple questions
      const fallback = toTest.flatMap(({sub,ch})=>[
        {subject:sub,chapter:ch,question:`What is a fundamental concept in ${ch}?`,options:["A. Concept 1","B. Concept 2","C. Concept 3","D. Concept 4"],correct:0,explanation:""},
        {subject:sub,chapter:ch,question:`Apply ${ch} to solve: standard problem`,options:["A. Option A","B. Option B","C. Option C","D. Option D"],correct:1,explanation:""},
      ]);
      setQuestions(fallback);
      setPhase("testing");
    }
  }

  function selectAnswer(optIdx) {
    const newAnswers = [...answers, {qIdx, chosen:optIdx, correct:questions[qIdx].correct, chapter:questions[qIdx].chapter, subject:questions[qIdx].subject}];
    setAnswers(newAnswers);
    setHovered(null);
    setTimeout(()=>{
      if(qIdx < questions.length-1) setQIdx(q=>q+1);
      else evaluateResults(newAnswers);
    },350);
  }

  async function evaluateResults(allAnswers) {
    setPhase("evaluating");
    setStatusMsg("ZEUS is calculating your baseline mastery…");

    // Calculate per-chapter scores
    const chapterScores = {};
    allAnswers.forEach(a=>{
      if(!chapterScores[a.chapter]) chapterScores[a.chapter]={correct:0,total:0,subject:a.subject};
      chapterScores[a.chapter].total++;
      if(a.chosen===a.correct) chapterScores[a.chapter].correct++;
    });

    // Build mastery object
    const masteryObj = {};
    Object.entries(SUBJECTS).forEach(([sub])=>{
      masteryObj[sub]={};
      ALL_CHAPTERS[sub].forEach(ch=>{ masteryObj[sub][ch]=0; });
    });

    // For tested chapters, assign based on score
    Object.entries(chapterScores).forEach(([ch,data])=>{
      const score = data.correct/data.total;
      const mastery = score===1?85:score>=0.5?65:score>0?40:20;
      if(masteryObj[data.subject]) masteryObj[data.subject][ch] = mastery;
    });

    // For selected but not tested chapters, assign 50 baseline
    Object.entries(chapters).forEach(([sub,chs])=>{
      chs.forEach(ch=>{
        if(masteryObj[sub][ch]===0 && !chapterScores[ch]) masteryObj[sub][ch] = 50;
      });
    });

    await save(K.mastery, masteryObj);
    await save(K.chapters, chapters);
    await save(K.onboard, {complete:true, date:todayStr()});
    setMastery(masteryObj);
    setPhase("done");
  }

  const q = questions[qIdx];
  const progress = questions.length>0 ? (qIdx/questions.length)*100 : 0;

  return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'DM Sans',sans-serif",color:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:680}}>

        {(phase==="generating"||phase==="evaluating")&&(
          <div style={{textAlign:"center"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><Spin size={52} color="#22d3ee"/></div>
            <div style={{...S.orbitron,fontSize:13,color:"#22d3ee",letterSpacing:2,marginBottom:8}}>ZEUS AT WORK</div>
            <div style={{fontSize:13,color:"#6b7280"}}>{statusMsg}</div>
          </div>
        )}

        {phase==="testing"&&q&&(
          <div>
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{...S.label}}>ONBOARDING — PYQ ASSESSMENT</div>
                <div style={{...S.label}}>{qIdx+1} / {questions.length}</div>
              </div>
              <div style={{background:"#1f2937",borderRadius:2,height:3}}>
                <div style={{width:`${progress}%`,height:"100%",background:"linear-gradient(90deg,#22d3ee,#a78bfa)",borderRadius:2,transition:"width 0.3s"}}/>
              </div>
            </div>

            <div style={{...S.card,marginBottom:16}}>
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                <Tag text={q.subject} color={SUBJECTS[q.subject]?.color||"#9ca3af"}/>
                <Tag text={q.chapter} color="#6b7280" bg="#1f2937"/>
                <Tag text="JEE PYQ LEVEL" color="#fbbf24" bg="#fbbf2422"/>
              </div>
              <div style={{fontSize:16,color:"#e5e7eb",lineHeight:1.7,fontWeight:500}}>{q.question}</div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {q.options.map((opt,i)=>(
                <MCQOption key={i} label={String.fromCharCode(65+i)} text={opt.replace(/^[A-D]\.\s*/,"")}
                  selected={false} hovered={hovered===i}
                  onClick={()=>selectAnswer(i)} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)}/>
              ))}
            </div>

            <div style={{fontSize:11,color:"#374151",textAlign:"center"}}>
              {q.subject} · {q.chapter} · {questions.length - qIdx - 1} questions remaining
            </div>
          </div>
        )}

        {phase==="done"&&(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:16}}>🎯</div>
            <div style={{...S.orbitron,fontSize:16,color:"#4ade80",letterSpacing:2,marginBottom:8}}>BASELINE SET!</div>
            <div style={{fontSize:14,color:"#9ca3af",marginBottom:8}}>
              You answered {answers.filter(a=>a.chosen===a.correct).length}/{answers.length} questions correctly.
            </div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:24}}>ZEUS has mapped your starting mastery. Your preparation journey begins now.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:28}}>
              {Object.entries(SUBJECTS).map(([sub,info])=>(
                <div key={sub} style={{background:`${info.color}11`,border:`1px solid ${info.color}33`,borderRadius:10,padding:16}}>
                  <div style={{fontSize:24,marginBottom:4}}>{info.icon}</div>
                  <div style={{fontSize:11,color:info.color,letterSpacing:1}}>{sub.toUpperCase()}</div>
                  <div style={{...S.orbitron,fontSize:22,color:info.color,fontWeight:900,marginTop:4}}>{avg(mastery[sub]||{})}%</div>
                  <div style={{fontSize:10,color:"#4b5563"}}>baseline mastery</div>
                </div>
              ))}
            </div>
            <button onClick={()=>onComplete(mastery)} style={{background:"linear-gradient(135deg,#4ade80,#16a34a)",border:"none",borderRadius:12,padding:"16px 32px",color:"#000",fontSize:14,fontWeight:800,cursor:"pointer"}}>
              🚀 ENTER COMMAND CENTER →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DAILY CHECK-IN TAB
══════════════════════════════════════════════════════════════ */
const CHECKIN_QS = [
  { id:"subject", icon:"📚", text:"What was your main study focus today?", opts:["Physics","Chemistry","Mathematics","Mixed (2+ subjects)","Didn't study today"] },
  { id:"hours",   icon:"⏱", text:"How many hours did you study today?",   opts:["Less than 2 hours","2–3 hours","3–5 hours","5–7 hours","7+ hours (beast mode)"] },
  { id:"quality", icon:"🧠", text:"How was your understanding today?",      opts:["Crystal clear — I can teach it (90%+)","Mostly got it (70–85%)","Partial understanding (50–65%)","Struggled — need to redo (below 50%)","Only revised / didn't learn new"] },
  { id:"method",  icon:"✍",  text:"What type of study did you do?",         opts:["Theory reading only","Theory + some solved examples","Mostly practice problems","Past year questions","Full mock test"] },
  { id:"blocks",  icon:"🚧", text:"Did you face any mental/focus blocks?", opts:["No — sharp focus all day","Mild distractions, but recovered","Lost 1–2 hours to phone/distraction","Couldn't concentrate — wasted session","Was stressed / burnt out"] },
  { id:"target",  icon:"🎯", text:"How do you feel going into tomorrow?",   opts:["Energised — ready to push harder","On track — steady progress","Need to catch up — falling behind","Burnt out — need to pace myself","Anxious about upcoming mock"] },
];

function DailyTab({profile,mastery,chapters,streak,onUpdate}) {
  const [phase,setPhase]           = useState("checking"); // checking|done_today|mcq|screen_time|tasks|planning|complete
  const [todayLog,setTodayLog]     = useState(null);
  const [qIdx,setQIdx]             = useState(0);
  const [answers,setAnswers]       = useState({});
  const [hovered,setHovered]       = useState(null);
  const [plan,setPlan]             = useState("");
  const [tasks,setTasks]           = useState([]);
  const [newTask,setNewTask]       = useState("");
  const [screenImg,setScreenImg]   = useState(null);
  const [screenLoading,setScreenLoading] = useState(false);
  const [screenResult,setScreenResult]   = useState(null);
  const [generating,setGenerating] = useState(false);
  const imgRef = useRef(null);
  const [countdown,setCountdown]   = useState(getCountdown());

  useEffect(()=>{ const t=setInterval(()=>setCountdown(getCountdown()),1000); return ()=>clearInterval(t); },[]);

  useEffect(()=>{
    async function check() {
      const daily = await load(K.daily)||[];
      const t = await load(K.tasks)||[];
      const existing = daily.find(d=>d.date===todayStr());
      setTasks(t.filter(tk=>!tk.done||tk.date===todayStr()));
      if(existing){ setTodayLog(existing); setPhase("done_today"); }
      else setPhase("mcq");
    }
    check();
  },[]);

  function selectAnswer(optIdx) {
    const newA = {...answers, [CHECKIN_QS[qIdx].id]: CHECKIN_QS[qIdx].opts[optIdx]};
    setAnswers(newA);
    setHovered(null);
    setTimeout(()=>{
      if(qIdx<CHECKIN_QS.length-1) setQIdx(i=>i+1);
      else setPhase("screen_time");
    },320);
  }

  async function analyzeScreenTime(file) {
    setScreenLoading(true);
    try {
      const b64 = await fileToB64(file);
      const mtype = file.type||"image/jpeg";
      const res = await aiWithImage(
        `This is a screen time screenshot from a student's phone. Extract study-related app usage (YouTube, Khan Academy, Studywise, Unacademy, BYJU's, Vedantu, etc.) and total screen time. Return JSON only: {"totalStudyHours": number, "totalScreenHours": number, "topApps": [{"name":"...","hours":number}], "studyPercentage": number}`,
        b64, mtype
      );
      const data = JSON.parse(res.replace(/```json|```/g,"").trim());
      setScreenResult(data);
    } catch { setScreenResult({totalStudyHours:0,note:"Could not parse. Enter manually."}); }
    setScreenLoading(false);
  }

  async function generatePlan() {
    setPhase("planning"); setGenerating(true);
    const chapterList = Object.values(chapters).flat();
    const weakChapters = Object.entries(mastery).flatMap(([sub,chs])=>
      Object.entries(chs).filter(([,v])=>v>0&&v<50).map(([ch,v])=>({sub,ch,v}))
    ).sort((a,b)=>a.v-b.v).slice(0,5);

    const system = `You are ZEUS — Poorvith's personal JEE teacher. You know his preparation history, weak areas, and daily patterns. You give precise, personalised daily guidance.`;
    const msg = `
Student: ${profile.name} | Target: ${profile.targetScore}/300 | Days to JEE: ${countdown.days}

TODAY'S CHECK-IN:
${Object.entries(answers).map(([k,v])=>`- ${CHECKIN_QS.find(q=>q.id===k)?.text||k}: "${v}"`).join("\n")}
${screenResult?`Screen time: ${screenResult.totalStudyHours||"?"}h study / ${screenResult.totalScreenHours||"?"}h total`:""}

WEAK CHAPTERS: ${weakChapters.map(w=>`${w.ch}(${w.sub}):${w.v}%`).join(", ")||"None identified yet"}

Generate a concise daily feedback + tomorrow's plan. Format EXACTLY:

## 💬 ZEUS SAYS
(2-3 sentences personal feedback based on today's check-in. Address the student directly.)

## ⚡ WHAT YOU MUST DO TOMORROW
1. [Subject] [Chapter] — [Specific action] — [Duration]
2. [Subject] [Chapter] — [Specific action] — [Duration]
3. [Subject] [Chapter] — [Specific action] — [Duration]

## 📌 3 TASKS FOR TOMORROW
- Task 1 (be specific, e.g. "Solve 20 Rotational Motion problems from HC Verma")
- Task 2
- Task 3

## 🧠 CONCEPT TO REVISE TONIGHT
[One chapter + one specific concept or formula to review before sleeping]`;

    const raw = await ai([{role:"user",content:msg}],system);
    setPlan(raw);

    // Extract tasks from plan and add to task list
    const taskLines = raw.match(/- Task \d.*|^\- .+$/gm)||[];
    const planTasks = taskLines.slice(0,3).map((t,i)=>({
      id:`${todayStr()}-plan-${i}`,text:t.replace(/^-\s*/,"").replace(/Task \d:\s*/,""),done:false,date:todayStr(),auto:true,
    }));

    // Save everything
    const logEntry = { date:todayStr(), answers, screenResult, plan:raw, timestamp:new Date().toISOString() };
    const daily = await load(K.daily)||[];
    await save(K.daily, [...daily, logEntry]);

    const allTasks = await load(K.tasks)||[];
    await save(K.tasks, [...allTasks.filter(t=>t.date!==todayStr()||!t.auto), ...planTasks]);
    setTasks(t=>[...t.filter(tk=>!tk.auto||tk.date!==todayStr()), ...planTasks]);

    // Update mastery based on check-in
    const qualityMap = {"Crystal clear — I can teach it (90%+)":15,"Mostly got it (70–85%)":8,"Partial understanding (50–65%)":3,"Struggled — need to redo (below 50%)":-3,"Only revised / didn't review new":2};
    const delta = qualityMap[answers.quality]||0;
    if(answers.subject && answers.subject!=="Mixed (2+ subjects)"&&answers.subject!=="Didn't study today"&&delta!==0) {
      const sub = answers.subject;
      // Apply delta to the least mastered chapter of that subject as proxy
      const newM = JSON.parse(JSON.stringify(mastery));
      const chs = Object.entries(newM[sub]||{}).filter(([,v])=>v>0).sort((a,b)=>a[1]-b[1]);
      if(chs.length>0){
        const ch = chs[0][0];
        newM[sub][ch] = Math.max(0,Math.min(100,(newM[sub][ch]||0)+delta));
        await save(K.mastery,newM);
      }
    }

    // Update streak
    const s = await load(K.streak)||{count:0,last:""};
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yst = yesterday.toISOString().slice(0,10);
    const newStreak = s.last===yst?{count:s.count+1,last:todayStr()}:s.last===todayStr()?s:{count:1,last:todayStr()};
    await save(K.streak,newStreak);

    setGenerating(false);
    setPhase("complete");
    onUpdate();
  }

  async function toggleTask(id) {
    const updated = tasks.map(t=>t.id===id?{...t,done:!t.done}:t);
    setTasks(updated);
    const all = await load(K.tasks)||[];
    await save(K.tasks,all.map(t=>t.id===id?{...t,done:!t.done}:t));
  }

  async function addTask() {
    if(!newTask.trim()) return;
    const t = {id:`${todayStr()}-${Date.now()}`,text:newTask.trim(),done:false,date:todayStr(),auto:false};
    setTasks(prev=>[...prev,t]);
    const all = await load(K.tasks)||[];
    await save(K.tasks,[...all,t]);
    setNewTask("");
  }

  const q = CHECKIN_QS[qIdx];

  if(phase==="checking") return <div style={{display:"flex",justifyContent:"center",padding:80}}><Spin size={40}/></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Countdown header */}
      <div style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{...S.orbitron,fontSize:11,color:"#f97316",letterSpacing:2}}>{greet()}, {profile.name}!</div>
          <div style={{fontSize:11,color:"#4b5563",marginTop:3}}>Today is {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})} · Streak: <span style={{color:"#4ade80"}}>{streak?.count||0} days 🔥</span></div>
        </div>
        <div style={{display:"flex",gap:14,padding:"8px 16px",background:"#0a0a0f",border:"1px solid #1f2937",borderRadius:8}}>
          <CountdownUnit value={countdown.days} label="DAYS"/>:<CountdownUnit value={countdown.hours} label="HRS"/>:<CountdownUnit value={countdown.mins} label="MIN"/>
        </div>
      </div>

      {/* MCQ Phase */}
      {phase==="mcq"&&q&&(
        <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:16}}>
          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{...S.label,marginBottom:6}}>DAILY CHECK-IN</div>
            {CHECKIN_QS.map((cq,i)=>(
              <div key={cq.id} style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,
                  background:answers[cq.id]?"#22d3ee22":i===qIdx?"#f9731622":"#111827",
                  border:answers[cq.id]?"1px solid #22d3ee66":i===qIdx?"1px solid #f97316":"1px solid #1f2937",
                  color:answers[cq.id]?"#22d3ee":i===qIdx?"#f97316":"#4b5563"}}>
                  {answers[cq.id]?"✓":i===qIdx?"→":i+1}
                </div>
                <span style={{fontSize:11,color:i===qIdx?"#e5e7eb":answers[cq.id]?"#22d3ee":"#4b5563"}}>{cq.icon} {cq.text.slice(0,32)}…</span>
              </div>
            ))}
          </div>

          <div style={{...S.card,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{background:"#1f2937",borderRadius:2,height:3,marginBottom:24}}>
              <div style={{width:`${(qIdx/CHECKIN_QS.length)*100}%`,height:"100%",background:"linear-gradient(90deg,#f97316,#22d3ee)",borderRadius:2,transition:"width 0.3s"}}/>
            </div>
            <div style={{fontSize:30,marginBottom:10}}>{q.icon}</div>
            <div style={{fontSize:18,color:"#e5e7eb",fontWeight:600,marginBottom:24,lineHeight:1.5}}>{q.text}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {q.opts.map((opt,i)=>(
                <MCQOption key={i} label={String.fromCharCode(65+i)} text={opt}
                  selected={false} hovered={hovered===i}
                  onClick={()=>selectAnswer(i)} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen Time Phase */}
      {phase==="screen_time"&&(
        <div style={{...S.card,display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
          <div>
            <div style={{fontSize:24,marginBottom:8}}>📱</div>
            <div style={{fontSize:18,fontWeight:600,marginBottom:6}}>Share your screen time</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:20,lineHeight:1.7}}>Optional but powerful — ZEUS reads your phone's screen time report to track study app usage vs distraction.</div>

            <div onClick={()=>imgRef.current?.click()} style={{border:"2px dashed #1f2937",borderRadius:10,padding:"24px",textAlign:"center",cursor:"pointer",background:"#07090d",marginBottom:16}} onMouseOver={e=>e.currentTarget.style.borderColor="#22d3ee"} onMouseOut={e=>e.currentTarget.style.borderColor="#1f2937"}>
              <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){setScreenImg(URL.createObjectURL(f));await analyzeScreenTime(f);}}}/>
              {screenImg ? <img src={screenImg} alt="screen time" style={{maxHeight:160,borderRadius:8,objectFit:"contain"}}/> : (
                <>
                  <div style={{fontSize:32,marginBottom:8}}>📸</div>
                  <div style={{fontSize:13,color:"#6b7280"}}>Tap to upload screen time screenshot</div>
                </>
              )}
            </div>

            {screenLoading&&<div style={{display:"flex",gap:8,alignItems:"center",color:"#6b7280",fontSize:12}}><Spin size={16}/> Analysing your screen time…</div>}
            {screenResult&&!screenLoading&&(
              <div style={{background:"#0d1a0d",border:"1px solid #16a34a33",borderRadius:8,padding:14}}>
                <div style={{fontSize:11,color:"#4ade80",marginBottom:8}}>✅ SCREEN TIME LOGGED</div>
                <div style={{fontSize:12,color:"#9ca3af"}}>Study hours: <span style={{color:"#4ade80",fontWeight:700}}>{screenResult.totalStudyHours||"?"}h</span></div>
                {screenResult.topApps?.slice(0,3).map((a,i)=>(
                  <div key={i} style={{fontSize:11,color:"#6b7280",marginTop:4}}>{a.name}: {a.hours}h</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{fontSize:18,fontWeight:600,marginBottom:4}}>Today's Tasks</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Add tasks you want to do today before ZEUS gives you tomorrow's plan.</div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Add a task…"
                style={{flex:1,background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"10px 12px",color:"#e5e7eb",fontSize:12,outline:"none"}}/>
              <button onClick={addTask} style={{background:"#22d3ee",border:"none",borderRadius:8,padding:"10px 14px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:12}}>+</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20,maxHeight:200,overflowY:"auto"}}>
              {tasks.filter(t=>t.date===todayStr()).map(t=>(
                <div key={t.id} style={{display:"flex",gap:10,alignItems:"center",background:"#0d1117",borderRadius:8,padding:"10px 12px",border:"1px solid #1f2937"}}>
                  <button onClick={()=>toggleTask(t.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${t.done?"#22d3ee":"#374151"}`,background:t.done?"#22d3ee":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#000"}}>{t.done&&"✓"}</button>
                  <span style={{fontSize:12,color:t.done?"#4b5563":"#9ca3af",textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                </div>
              ))}
            </div>
            <button onClick={generatePlan} style={{width:"100%",background:"linear-gradient(135deg,#f97316,#dc2626)",border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 20px rgba(249,115,22,0.3)",letterSpacing:1}}>
              ⚡ GET ZEUS'S PLAN FOR TOMORROW →
            </button>
          </div>
        </div>
      )}

      {/* Generating plan */}
      {phase==="planning"&&(
        <div style={{...S.card,textAlign:"center",padding:60}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><Spin size={44} color="#f97316"/></div>
          <div style={{...S.orbitron,fontSize:13,color:"#f97316",letterSpacing:2,marginBottom:8}}>ZEUS IS CRAFTING YOUR PLAN</div>
          <div style={{fontSize:12,color:"#4b5563"}}>Analysing today's session + your weak areas…</div>
        </div>
      )}

      {/* Complete phase */}
      {phase==="complete"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Plan sections */}
          {plan.split(/^## /m).filter(Boolean).map((section,i)=>{
            const [title,...body] = section.split("\n");
            const colors=["#22d3ee","#f97316","#4ade80","#a78bfa"];
            const c = colors[i%colors.length];
            return (
              <div key={i} style={{...S.card,borderLeft:`3px solid ${c}`}}>
                <div style={{fontSize:12,color:c,fontWeight:700,letterSpacing:1,marginBottom:10}}>## {title.trim()}</div>
                <div style={{fontSize:13,color:"#d1d5db",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{body.join("\n").trim()}</div>
              </div>
            );
          })}

          {/* Tasks */}
          <div style={{...S.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{...S.label}}>TODAY'S TASKS</div>
              <span style={{fontSize:11,color:"#22d3ee"}}>{tasks.filter(t=>t.date===todayStr()&&t.done).length}/{tasks.filter(t=>t.date===todayStr()).length} done</span>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Add custom task…"
                style={{flex:1,background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"9px 12px",color:"#e5e7eb",fontSize:12,outline:"none"}}/>
              <button onClick={addTask} style={{background:"#22d3ee22",border:"1px solid #22d3ee44",borderRadius:8,padding:"9px 14px",color:"#22d3ee",cursor:"pointer",fontSize:12,fontWeight:700}}>+</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {tasks.filter(t=>t.date===todayStr()).map(t=>(
                <div key={t.id} style={{display:"flex",gap:10,alignItems:"center",background:t.done?"#0d1a0d":"#0d1117",borderRadius:8,padding:"10px 14px",border:`1px solid ${t.done?"#16a34a33":"#1f2937"}`}}>
                  <button onClick={()=>toggleTask(t.id)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${t.done?"#22d3ee":"#374151"}`,background:t.done?"#22d3ee":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#000"}}>{t.done&&"✓"}</button>
                  <span style={{fontSize:12,color:t.done?"#4b5563":"#9ca3af",flex:1,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                  {t.auto&&<Tag text="ZEUS" color="#f97316" bg="#f9731622"/>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Already done today */}
      {phase==="done_today"&&todayLog&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{...S.card,background:"#040d04",border:"1px solid #16a34a33",display:"flex",gap:12,alignItems:"center"}}>
            <div style={{fontSize:28}}>✅</div>
            <div>
              <div style={{fontSize:14,color:"#4ade80",fontWeight:600}}>Today's check-in complete!</div>
              <div style={{fontSize:12,color:"#4b5563"}}>Logged at {new Date(todayLog.timestamp).toLocaleTimeString()} · Streak: {streak?.count||0} days 🔥</div>
            </div>
          </div>
          {todayLog.plan&&todayLog.plan.split(/^## /m).filter(Boolean).map((section,i)=>{
            const [title,...body] = section.split("\n");
            const colors=["#22d3ee","#f97316","#4ade80","#a78bfa"];
            const c = colors[i%colors.length];
            return (
              <div key={i} style={{...S.card,borderLeft:`3px solid ${c}`}}>
                <div style={{fontSize:12,color:c,fontWeight:700,marginBottom:8}}>## {title.trim()}</div>
                <div style={{fontSize:13,color:"#d1d5db",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{body.join("\n").trim()}</div>
              </div>
            );
          })}

          {/* Tasks */}
          <div style={{...S.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{...S.label}}>TASKS</div>
              <span style={{fontSize:11,color:"#22d3ee"}}>{tasks.filter(t=>t.date===todayStr()&&t.done).length}/{tasks.filter(t=>t.date===todayStr()).length} done</span>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Add task…"
                style={{flex:1,background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"9px 12px",color:"#e5e7eb",fontSize:12,outline:"none"}}/>
              <button onClick={addTask} style={{background:"#22d3ee22",border:"1px solid #22d3ee44",borderRadius:8,padding:"9px 14px",color:"#22d3ee",cursor:"pointer",fontSize:12,fontWeight:700}}>+</button>
            </div>
            {tasks.filter(t=>t.date===todayStr()).map(t=>(
              <div key={t.id} style={{display:"flex",gap:10,alignItems:"center",background:t.done?"#0d1a0d":"#0d1117",borderRadius:8,padding:"10px 14px",border:`1px solid ${t.done?"#16a34a33":"#1f2937"}`,marginBottom:8}}>
                <button onClick={()=>toggleTask(t.id)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${t.done?"#22d3ee":"#374151"}`,background:t.done?"#22d3ee":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"#000"}}>{t.done&&"✓"}</button>
                <span style={{fontSize:12,color:t.done?"#4b5563":"#9ca3af",flex:1,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                {t.auto&&<Tag text="ZEUS" color="#f97316"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS TAB
══════════════════════════════════════════════════════════════ */
function ProgressTab({mastery,mocks,chapters}) {
  const [activeSub,setActiveSub] = useState("Physics");
  const radarD = (ALL_CHAPTERS[activeSub]||[]).slice(0,8).map(ch=>({
    topic:ch.length>10?ch.slice(0,10)+"…":ch,value:mastery[activeSub]?.[ch]||0,
  }));
  const subBar = Object.entries(SUBJECTS).map(([sub,info])=>({subject:sub.slice(0,4),mastery:avg(mastery[sub]||{}),color:info.color}));
  const weakAll = Object.entries(mastery).flatMap(([sub,chs])=>
    Object.entries(chs).filter(([,v])=>v>0&&v<60).map(([ch,v])=>({sub,ch,v}))
  ).sort((a,b)=>a.v-b.v).slice(0,6);

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {Object.entries(SUBJECTS).map(([sub,info])=>(
          <StatCard key={sub} label={`${sub.toUpperCase()} MASTERY`} value={`${avg(mastery[sub]||{})}%`} color={info.color} sub={`${Object.values(mastery[sub]||{}).filter(v=>v>0).length} chapters mapped`}/>
        ))}
      </div>

      <div style={{gridColumn:"1/-1",...S.card}}>
        <div style={{...S.label,marginBottom:12}}>MOCK SCORE HISTORY</div>
        {mocks.length>0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mocks}>
              <XAxis dataKey="test" tick={{fill:"#4b5563",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis domain={[100,300]} tick={{fill:"#4b5563",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,fontSize:12}}/>
              <Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2.5} dot={{fill:"#f97316",r:4,strokeWidth:0}}/>
            </LineChart>
          </ResponsiveContainer>
        ) : <div style={{padding:"40px 0",textAlign:"center",color:"#374151",fontSize:13}}>Upload your first mock report in the MENTOR tab to see trends here.</div>}
      </div>

      {/* Subject switcher */}
      <div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {Object.entries(SUBJECTS).map(([sub,info])=>(
            <button key={sub} onClick={()=>setActiveSub(sub)} style={{flex:1,background:activeSub===sub?`${info.color}22`:"#0a0e1a",border:`1px solid ${activeSub===sub?info.color:"#1f2937"}`,borderRadius:8,padding:"8px",cursor:"pointer",fontSize:11,color:activeSub===sub?info.color:"#6b7280"}}>
              {info.icon} {sub.slice(0,4).toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{...S.card}}>
          <div style={{...S.label,marginBottom:14}}>{activeSub.toUpperCase()} — MASTERY</div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {ALL_CHAPTERS[activeSub].filter(ch=>(mastery[activeSub]?.[ch]||0)>0).map(ch=>(
              <MBar key={ch} label={ch} value={mastery[activeSub]?.[ch]||0} color={SUBJECTS[activeSub].color}/>
            ))}
            {ALL_CHAPTERS[activeSub].filter(ch=>!(mastery[activeSub]?.[ch])).map(ch=>(
              <MBar key={ch} label={ch} value={0} color="#374151" dim/>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{...S.card}}>
          <div style={{...S.label,marginBottom:14}}>⚠ WEAK ZONES (PRIORITY)</div>
          {weakAll.length>0 ? weakAll.map((w,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div><span style={{fontSize:12,color:"#e5e7eb"}}>{w.ch}</span><span style={{fontSize:10,color:"#4b5563",marginLeft:8}}>{w.sub}</span></div>
                <span style={{fontSize:12,color:"#ef4444",fontFamily:"monospace",fontWeight:700}}>{w.v}%</span>
              </div>
              <div style={{background:"#1f2937",borderRadius:2,height:4}}><div style={{width:`${w.v}%`,height:"100%",background:"linear-gradient(90deg,#ef444488,#ef4444)",borderRadius:2}}/></div>
            </div>
          )) : <div style={{fontSize:12,color:"#4b5563",padding:"20px 0",textAlign:"center"}}>Complete your check-ins to map weak areas.</div>}
        </div>
        <div style={{...S.card}}>
          <div style={{...S.label,marginBottom:12}}>SUBJECT OVERVIEW</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={subBar} barSize={36}>
              <XAxis dataKey="subject" tick={{fill:"#9ca3af",fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:"#4b5563",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#111827",border:"1px solid #374151",borderRadius:8,fontSize:12}} formatter={v=>[`${v}%`,"Mastery"]}/>
              <Bar dataKey="mastery" radius={[4,4,0,0]}>{subBar.map((s,i)=><Cell key={i} fill={s.color}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOCK MENTOR TAB (PDF + MCQ + Plan)
══════════════════════════════════════════════════════════════ */
const MOCK_QS = [
  {id:"time",   icon:"⏱", text:"How was your time management?",      opts:["Left many questions — ran out of time","Rushed at end but managed","Had spare time but made errors","Timing was fine — not the issue"]},
  {id:"reason", icon:"🧠", text:"Primary reason for losing marks?",    opts:["Silly calculation/sign errors","Didn't know concept at all","Knew concept but couldn't apply","Negative marking — guessed too much"]},
  {id:"hard",   icon:"📚", text:"Which subject felt hardest?",         opts:["Physics","Chemistry","Mathematics","All equally hard"]},
  {id:"strat",  icon:"🔍", text:"How was your attempt strategy?",      opts:["Spent too long on hard Qs","Skipped easy Qs by mistake","Good strategy but execution failed","No strategy — went question by question"]},
  {id:"mind",   icon:"😤", text:"Your mental state during the test?",  opts:["Panicked early — lost focus","Good start, stressed at end","Calm — purely knowledge gap","Overconfident and careless"]},
];

function MentorTab({profile,mastery,mocks,setMocks,setMastery}) {
  const [phase,setPhase] = useState("idle");
  const [pdf,setPdf]     = useState(null);
  const [drag,setDrag]   = useState(false);
  const [status,setStatus] = useState("");
  const [report,setReport] = useState(null);
  const [qIdx,setQIdx]   = useState(0);
  const [answers,setAnswers] = useState({});
  const [hovered,setHovered] = useState(null);
  const [plan,setPlan]   = useState([]);
  const [err,setErr]     = useState("");
  const fRef = useRef(null);
  const mockNum = mocks.length+1;

  function handleDrop(e) {
    e.preventDefault(); setDrag(false);
    const f=e.dataTransfer.files[0];
    if(f?.type==="application/pdf"){setPdf(f);setErr("");}else setErr("Please drop a PDF file.");
  }

  async function startScan() {
    if(!pdf) return; setPhase("scanning"); setErr("");
    try {
      setStatus("Reading PDF…");
      const b64 = await fileToB64(pdf);
      setStatus("Extracting scores and topic data…");
      const prompt=`Analyze this JEE mock test PDF and extract all data. Return ONLY valid JSON:
{"testName":"string","totalScore":number,"physicsScore":number,"chemistryScore":number,"mathScore":number,"physicsCorrect":number,"physicsWrong":number,"physicsUnattempted":number,"chemistryCorrect":number,"chemistryWrong":number,"chemistryUnattempted":number,"mathCorrect":number,"mathWrong":number,"mathUnattempted":number,"topicData":{"Physics":{"chapter":accuracy_0to100_or_null},"Chemistry":{...},"Mathematics":{...}},"percentile":number|null,"rank":number|null}
For topicData, use chapters from: Physics:${ALL_CHAPTERS.Physics.join(",")}\nChemistry:${ALL_CHAPTERS.Chemistry.join(",")}\nMath:${ALL_CHAPTERS.Mathematics.join(",")}`;
      const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:prompt}]}]})});
      const d = await r.json();
      const raw = d.content?.find(b=>b.type==="text")?.text||"{}";
      const data = JSON.parse(raw.replace(/```json|```/g,"").trim());
      setReport(data); setPhase("mcq"); setQIdx(0); setAnswers({});
    } catch(e) { setErr("Could not parse report. "+e.message); setPhase("idle"); }
  }

  function pick(optIdx) {
    const newA = {...answers,[MOCK_QS[qIdx].id]:MOCK_QS[qIdx].opts[optIdx]};
    setAnswers(newA); setHovered(null);
    setTimeout(()=>{ if(qIdx<MOCK_QS.length-1)setQIdx(i=>i+1); else buildPlan(newA); },320);
  }

  async function buildPlan(finalAnswers) {
    setPhase("building");
    const system=`You are ZEUS — ${profile.name}'s personal JEE teacher. You've analysed their mock report and their self-assessment answers. Give a surgical, personalised plan.`;
    const msg=`Mock #${mockNum} Report:
Total: ${report.totalScore}/300 | Phy:${report.physicsScore} Chem:${report.chemistryScore} Math:${report.mathScore}
Physics: ✓${report.physicsCorrect} ✗${report.physicsWrong} –${report.physicsUnattempted}
Chemistry: ✓${report.chemistryCorrect} ✗${report.chemistryWrong} –${report.chemistryUnattempted}
Math: ✓${report.mathCorrect} ✗${report.mathWrong} –${report.mathUnattempted}
Percentile: ${report.percentile||"N/A"}

Student Self-Assessment:
${MOCK_QS.map(q=>finalAnswers[q.id]?`- ${q.text}: "${finalAnswers[q.id]}"`:null).filter(Boolean).join("\n")}

Generate plan with sections:
## 🔬 ROOT CAUSE ANALYSIS
## ⚠️ 3 CRITICAL FIXES
## 📅 7-DAY BATTLE PLAN
## 🎯 CHAPTER PRIORITY (top 5)
## 🧪 EXAM STRATEGY UPGRADE
## 🏁 TARGET FOR MOCK #${mockNum+1}`;
    const raw = await ai([{role:"user",content:msg}],system,2000);

    // Update mocks + mastery
    const nm = {test:`M${mockNum}`,score:report.totalScore,phy:report.physicsScore,chem:report.chemistryScore,math:report.mathScore,date:todayStr()};
    const newMocks=[...mocks,nm]; await save(K.mocks,newMocks); setMocks(newMocks);
    if(report.topicData){
      const newM=JSON.parse(JSON.stringify(mastery));
      Object.entries(report.topicData).forEach(([sub,chs])=>{
        if(!newM[sub])return;
        Object.entries(chs).forEach(([ch,val])=>{ if(val!==null&&newM[sub][ch]!==undefined)newM[sub][ch]=Math.round((newM[sub][ch]||0)*0.4+val*0.6); });
      });
      await save(K.mastery,newM); setMastery(newM);
    }

    const sections=raw.split(/^## /m).filter(Boolean).map(s=>{const[t,...b]=s.split("\n");return{title:t.trim(),body:b.join("\n").trim()};});
    setPlan(sections); setPhase("done");
  }

  function reset(){setPhase("idle");setPdf(null);setReport(null);setAnswers({});setQIdx(0);setPlan([]);setErr("");}

  const q = MOCK_QS[qIdx];
  const colors=["#f97316","#ef4444","#22d3ee","#4ade80","#a78bfa","#fbbf24"];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Series progress */}
      <div style={{...S.card}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...S.orbitron,fontSize:11,color:"#22d3ee",letterSpacing:2}}>MOCK SERIES</div>
          <div style={{...S.orbitron,fontSize:20,color:"#22d3ee"}}>{mocks.length}<span style={{fontSize:11,color:"#4b5563"}}>/{TOTAL_MOCKS}</span></div>
        </div>
        <div style={{background:"#111827",borderRadius:3,height:6,overflow:"hidden"}}>
          <div style={{width:`${mocks.length/TOTAL_MOCKS*100}%`,height:"100%",background:"linear-gradient(90deg,#0891b2,#22d3ee)",borderRadius:3,transition:"width 0.5s"}}/>
        </div>
        <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
          {Array.from({length:TOTAL_MOCKS}).map((_,i)=>(
            <div key={i} title={mocks[i]?`M${i+1}: ${mocks[i].score}/300`:""} style={{width:12,height:12,borderRadius:"50%",background:i<mocks.length?"#22d3ee":i===mocks.length?"#f97316":"#1f2937",boxShadow:i===mocks.length?"0 0 8px rgba(249,115,22,0.8)":"none"}}/>
          ))}
        </div>
      </div>

      {phase==="idle"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{...S.card,background:"linear-gradient(135deg,#00101a,#000a12)",border:"1px solid #22d3ee33"}}>
              <div style={{fontSize:24,marginBottom:10}}>🎓</div>
              <div style={{...S.orbitron,fontSize:12,color:"#22d3ee",letterSpacing:1,marginBottom:6}}>MOCK DEBRIEF · M{mockNum}</div>
              <div style={{fontSize:12,color:"#6b7280",lineHeight:1.8}}>Upload your report PDF → Answer 5 MCQs → Get personalised 7-day battle plan.</div>
            </div>
            <div className="drop-zone" onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={handleDrop} onClick={()=>fRef.current?.click()}
              style={{border:`2px dashed ${drag?"#22d3ee":pdf?"#22d3ee66":"#1f2937"}`,borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:drag?"#021018":pdf?"#031218":"#07090d",transition:"all 0.2s"}}>
              <input ref={fRef} type="file" accept=".pdf" onChange={e=>{const f=e.target.files[0];if(f){setPdf(f);setErr("");}}} style={{display:"none"}}/>
              {pdf?(<><div style={{fontSize:28,marginBottom:6}}>✅</div><div style={{fontSize:12,color:"#22d3ee"}}>{pdf.name}</div></>):(
                <><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13,color:"#6b7280"}}>Drop Mock #{mockNum} PDF here</div></>
              )}
            </div>
            {err&&<div style={{fontSize:12,color:"#f87171",background:"#140606",borderRadius:8,padding:10}}>⚠ {err}</div>}
            <button disabled={!pdf} onClick={startScan} style={{background:pdf?"linear-gradient(135deg,#22d3ee,#0891b2)":"#1f2937",border:"none",borderRadius:12,padding:"14px",color:pdf?"#000":"#374151",fontSize:13,fontWeight:800,cursor:pdf?"pointer":"not-allowed"}}>
              ⚡ SCAN & DEBRIEF →
            </button>
          </div>
          <div style={{...S.card}}>
            <div style={{...S.label,marginBottom:14}}>PREVIOUS MOCKS</div>
            {mocks.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...mocks].reverse().slice(0,6).map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0d1117",borderRadius:8,padding:"10px 14px",border:"1px solid #1f2937"}}>
                    <span style={{fontFamily:"monospace",fontSize:12,color:"#f97316"}}>{m.test}</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{m.score}/300</span>
                    <div style={{display:"flex",gap:6}}>
                      {[["P",m.phy,"#f97316"],["C",m.chem,"#22d3ee"],["M",m.math,"#a78bfa"]].map(([l,v,c])=>(
                        <span key={l} style={{fontSize:10,color:c,fontFamily:"monospace"}}>{l}:{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ):<div style={{fontSize:12,color:"#374151",padding:"30px 0",textAlign:"center"}}>No mocks logged yet.</div>}
          </div>
        </div>
      )}

      {(phase==="scanning"||phase==="building")&&(
        <div style={{...S.card,textAlign:"center",padding:60}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><Spin size={44} color="#22d3ee"/></div>
          <div style={{...S.orbitron,fontSize:12,color:"#22d3ee",letterSpacing:2,marginBottom:8}}>{phase==="scanning"?"SCANNING REPORT":"ZEUS BUILDING YOUR PLAN"}</div>
          <div style={{fontSize:12,color:"#4b5563"}}>{status||"Please wait…"}</div>
        </div>
      )}

      {phase==="mcq"&&q&&(
        <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:16}}>
          <div style={{...S.card}}>
            <div style={{...S.label,marginBottom:12}}>REPORT EXTRACTED</div>
            <div style={{...S.orbitron,fontSize:26,color:"#f97316",fontWeight:900}}>{report?.totalScore}/300</div>
            <div style={{fontSize:11,color:"#4b5563",marginBottom:14}}>{report?.testName}</div>
            {[["Physics",report?.physicsScore,"#f97316"],["Chemistry",report?.chemistryScore,"#22d3ee"],["Mathematics",report?.mathScore,"#a78bfa"]].map(([s,v,c])=>(
              <div key={s} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:11,color:"#6b7280"}}>{s}</span>
                <span style={{fontFamily:"monospace",fontSize:11,color:c,fontWeight:700}}>{v}/100</span>
              </div>
            ))}
            <div style={{marginTop:14,borderTop:"1px solid #1f2937",paddingTop:14}}>
              {MOCK_QS.map((mq,i)=>(
                <div key={mq.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0,
                    background:answers[mq.id]?"#22d3ee22":i===qIdx?"#f9731622":"#111827",border:answers[mq.id]?"1px solid #22d3ee66":i===qIdx?"1px solid #f97316":"1px solid #1f2937",
                    color:answers[mq.id]?"#22d3ee":i===qIdx?"#f97316":"#4b5563"}}>
                    {answers[mq.id]?"✓":i===qIdx?"→":i+1}
                  </div>
                  <span style={{fontSize:10,color:i===qIdx?"#e5e7eb":answers[mq.id]?"#22d3ee":"#4b5563"}}>{mq.icon} {mq.text.slice(0,28)}…</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{...S.card,display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{background:"#1f2937",borderRadius:2,height:3,marginBottom:24}}>
              <div style={{width:`${(qIdx/MOCK_QS.length)*100}%`,height:"100%",background:"linear-gradient(90deg,#a78bfa,#22d3ee)",borderRadius:2,transition:"width 0.3s"}}/>
            </div>
            <div style={{fontSize:28,marginBottom:10}}>{q.icon}</div>
            <div style={{fontSize:17,color:"#e5e7eb",fontWeight:600,marginBottom:22,lineHeight:1.5}}>{q.text}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {q.opts.map((opt,i)=>(
                <MCQOption key={i} label={String.fromCharCode(65+i)} text={opt} selected={false} hovered={hovered===i}
                  onClick={()=>pick(i)} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase==="done"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{...S.card,background:"#040f04",border:"1px solid #16a34a44",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{...S.orbitron,fontSize:12,color:"#4ade80",letterSpacing:2}}>M{mockNum} BATTLE PLAN READY · TRACKER UPDATED ✅</div>
              <div style={{fontSize:11,color:"#4b5563",marginTop:3}}>{report?.totalScore}/300 · Mastery scores blended from report</div>
            </div>
            <button onClick={reset} style={{background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"8px 14px",color:"#9ca3af",fontSize:11,cursor:"pointer"}}>+ NEW</button>
          </div>
          {plan.map((sec,i)=>(
            <div key={i} style={{...S.card,borderLeft:`3px solid ${colors[i%colors.length]}`}}>
              <div style={{fontSize:12,color:colors[i%colors.length],fontWeight:700,marginBottom:10}}>{sec.title}</div>
              <div style={{fontSize:13,color:"#d1d5db",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{sec.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ZEUS CHAT TAB
══════════════════════════════════════════════════════════════ */
function ZeusTab({profile,mastery,mocks}) {
  const [hist,setHist] = useState([]);
  const [inp,setInp] = useState("");
  const [loading,setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[hist]);

  const system=`You are ZEUS — ${profile.name}'s personal JEE teacher and coach. You know their data:
Physics avg: ${avg(mastery.Physics||{})}% | Chemistry avg: ${avg(mastery.Chemistry||{})}% | Math avg: ${avg(mastery.Mathematics||{})}%
Mocks done: ${mocks.length}/${TOTAL_MOCKS} | Latest: ${mocks[mocks.length-1]?.score||"N/A"}/300
Target: ${profile.targetScore}/300 for ${profile.targetCollege}
Days to JEE: ~${getCountdown().days}
Be direct, precise, teacher-like. Use numbered points. 150-200 words.`;

  async function send() {
    const q=inp.trim(); if(!q) return;
    setHist(h=>[...h,{role:"user",text:q}]); setInp(""); setLoading(true);
    try { const r=await ai([{role:"user",content:q}],system); setHist(h=>[...h,{role:"zeus",text:r}]); }
    catch { setHist(h=>[...h,{role:"zeus",text:"ZEUS is offline."}]); }
    setLoading(false);
  }

  return (
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,height:"calc(100vh - 200px)",minHeight:500}}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:"linear-gradient(135deg,#1a0a00,#0a0000)",border:"1px solid #f9731633",borderRadius:12,padding:20,textAlign:"center"}}>
          <div style={{fontSize:38,marginBottom:8}}>⚡</div>
          <div style={{...S.orbitron,fontSize:15,color:"#f97316",letterSpacing:2,fontWeight:900}}>ZEUS</div>
          <div style={{...S.label,marginTop:4}}>AI TEACHER</div>
          <div style={{fontSize:11,color:"#4b5563",marginTop:10,lineHeight:1.6}}>{mocks.length} mocks in memory</div>
        </div>
        <button onClick={async()=>{
          setHist([]); setLoading(true);
          try{const r=await ai([{role:"user",content:"Give me a complete weekly briefing and battle plan."}],system);setHist([{role:"zeus",text:r}]);}
          catch{setHist([{role:"zeus",text:"ZEUS offline."}]);}
          setLoading(false);
        }} style={{background:"linear-gradient(135deg,#f97316,#dc2626)",border:"none",borderRadius:10,padding:"13px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(249,115,22,0.3)",letterSpacing:1}}>
          ⚡ WEEKLY BRIEF
        </button>
        <div style={{...S.card}}>
          <div style={{...S.label,marginBottom:10}}>QUICK ASKS</div>
          {["What should I study today?","My weakest chapter right now?","Am I on track for target?","How do I improve Chemistry?","Give me a 3-day sprint plan"].map((q,i)=>(
            <button key={i} onClick={()=>setInp(q)} style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"1px solid #1f2937",borderRadius:6,padding:"8px 10px",color:"#6b7280",fontSize:11,cursor:"pointer",marginBottom:6,transition:"all 0.15s"}} onMouseOver={e=>{e.currentTarget.style.borderColor="#f97316";e.currentTarget.style.color="#f97316";}} onMouseOut={e=>{e.currentTarget.style.borderColor="#1f2937";e.currentTarget.style.color="#6b7280";}}>
              {q}
            </button>
          ))}
        </div>
      </div>
      <div style={{...S.card,display:"flex",flexDirection:"column",overflow:"hidden",padding:0}}>
        <div style={{padding:"13px 20px",borderBottom:"1px solid #111827",display:"flex",gap:8,alignItems:"center"}}>
          <Pulse/><span style={{...S.label}}>ZEUS ONLINE · {profile.name.toUpperCase()}'S PERSONAL AI TEACHER</span>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
          {hist.length===0&&(
            <div style={{textAlign:"center",marginTop:60}}>
              <div style={{fontSize:44}}>⚡</div>
              <div style={{...S.orbitron,fontSize:12,color:"#374151",marginTop:12,letterSpacing:1}}>ZEUS AWAITS YOUR COMMAND</div>
            </div>
          )}
          {hist.map((m,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",animation:"fadeUp 0.3s ease"}}>
              <div style={{fontSize:10,color:"#4b5563",marginBottom:4,letterSpacing:1}}>{m.role==="user"?"YOU":"⚡ ZEUS"}</div>
              <div style={{maxWidth:"85%",padding:"12px 16px",borderRadius:10,fontSize:13,lineHeight:1.75,background:m.role==="user"?"#1f2937":"#0d1117",border:m.role==="user"?"1px solid #374151":"1px solid #f9731633",color:m.role==="user"?"#e5e7eb":"#fcd34d",whiteSpace:"pre-wrap"}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:5,padding:"12px 16px",background:"#0d1117",border:"1px solid #f9731633",borderRadius:10,width:"fit-content"}}>
            {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#f97316",animation:`pulse-dot 1.2s ${i*0.2}s infinite`}}/>)}
          </div>}
          <div ref={endRef}/>
        </div>
        <div style={{padding:14,borderTop:"1px solid #111827",display:"flex",gap:10}}>
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask ZEUS anything about your preparation…"
            style={{flex:1,background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"10px 14px",color:"#e5e7eb",fontSize:13,outline:"none"}}/>
          <button onClick={send} style={{background:"linear-gradient(135deg,#f97316,#dc2626)",border:"none",borderRadius:8,padding:"10px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>FIRE ⚡</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen,setScreen]     = useState("loading");
  const [profile,setProfile]   = useState(null);
  const [mastery,setMastery]   = useState({});
  const [chapters,setChapters] = useState({Physics:[],Chemistry:[],Mathematics:[]});
  const [mocks,setMocks]       = useState([]);
  const [streak,setStreak]     = useState({count:0,last:""});
  const [tab,setTab]           = useState("today");
  const [countdown,setCountdown] = useState(getCountdown());

  useEffect(()=>{ const t=setInterval(()=>setCountdown(getCountdown()),1000); return ()=>clearInterval(t); },[]);

  // Bootstrap
  useEffect(()=>{
    async function boot() {
      const p = await load(K.profile);
      if(!p){ setScreen("welcome"); return; }
      setProfile(p);
      const ob = await load(K.onboard);
      if(!ob?.complete){ setScreen("onboard_chapters"); return; }
      const m = await load(K.mastery)||{}; setMastery(m);
      const ch = await load(K.chapters)||{Physics:[],Chemistry:[],Mathematics:[]}; setChapters(ch);
      const mk = await load(K.mocks)||[]; setMocks(mk);
      const sk = await load(K.streak)||{count:0,last:""}; setStreak(sk);
      setScreen("login");
    }
    boot();
  },[]);

  async function afterOnboardChapters(selected) {
    setChapters(selected);
    setScreen("onboard_pyq");
  }

  async function afterPYQ(newMastery) {
    setMastery(newMastery);
    const p = await load(K.profile);
    setProfile(p);
    const mk = await load(K.mocks)||[]; setMocks(mk);
    const sk = await load(K.streak)||{count:0,last:""}; setStreak(sk);
    setScreen("app");
  }

  async function refreshData() {
    const m=await load(K.mastery)||{}; setMastery(m);
    const mk=await load(K.mocks)||[]; setMocks(mk);
    const sk=await load(K.streak)||{count:0,last:""}; setStreak(sk);
  }

  const TABS = [
    {id:"today",    label:"📅 TODAY"},
    {id:"progress", label:"📊 PROGRESS"},
    {id:"mentor",   label:"🎓 MENTOR"},
    {id:"zeus",     label:"⚡ ZEUS"},
  ];

  if(screen==="loading") return (
    <div style={{minHeight:"100vh",background:"#030712",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Spin size={40}/>
    </div>
  );

  if(screen==="welcome") return <WelcomeScreen onLogin={async()=>{const p=await load(K.profile);if(p){setProfile(p);setScreen("login");}}} onRegister={()=>setScreen("register")}/>;

  if(screen==="register") return <RegisterScreen onComplete={p=>{setProfile(p);setScreen("onboard_chapters");}}/>;

  if(screen==="login") return <LoginScreen profile={profile} onSuccess={()=>setScreen("app")}/>;

  if(screen==="onboard_chapters") return <OnboardChapters profile={profile} onComplete={afterOnboardChapters}/>;

  if(screen==="onboard_pyq") return <OnboardPYQ profile={profile} chapters={chapters} onComplete={afterPYQ}/>;

  // MAIN APP
  return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#e5e7eb"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#374151;border-radius:2px}
        input:focus,textarea:focus,select:focus{outline:none}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .drop-zone:hover{border-color:#22d3ee!important}
      `}</style>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:999,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)"}}/>

      {/* Header */}
      <div style={{borderBottom:"1px solid #1f2937",background:"#030712ee",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100,padding:"0 24px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#f97316,#dc2626)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 0 12px rgba(249,115,22,0.4)"}}>⚔</div>
            <div>
              <div style={{...S.orbitron,fontSize:12,fontWeight:900,letterSpacing:2,color:"#f97316"}}>JEE COMMAND CENTER</div>
              <div style={{fontSize:9,color:"#4b5563",letterSpacing:3}}>{profile?.name?.toUpperCase()} · TARGET {profile?.targetScore}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:10,color:"#4b5563",textAlign:"right"}}>APR 13, 2026 · <span style={{color:"#f97316"}}>{countdown.days}d left</span></div>
            <div style={{display:"flex",gap:12,padding:"6px 14px",border:"1px solid #1f2937",borderRadius:8,background:"#0a0a0f"}}>
              <CountdownUnit value={countdown.days} label="D"/><span style={{color:"#374151",paddingTop:6}}>:</span>
              <CountdownUnit value={countdown.hours} label="H"/><span style={{color:"#374151",paddingTop:6}}>:</span>
              <CountdownUnit value={countdown.mins} label="M"/><span style={{color:"#374151",paddingTop:6}}>:</span>
              <CountdownUnit value={countdown.secs} label="S"/>
            </div>
            <div style={{fontSize:11,color:"#4b5563",cursor:"pointer"}} onClick={()=>setScreen("login")}>🔒</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:"1px solid #111827",padding:"0 24px",background:"#030712"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"12px 20px",fontSize:11,letterSpacing:1.5,fontWeight:600,background:"none",border:"none",cursor:"pointer",transition:"all 0.2s",
              color:tab===t.id?(t.id==="today"?"#22d3ee":"#f97316"):"#4b5563",
              borderBottom:tab===t.id?`2px solid ${t.id==="today"?"#22d3ee":"#f97316"}`:"2px solid transparent",
            }}>{t.label}</button>
          ))}
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#4b5563"}}>
            <span style={{color:"#4ade80"}}>🔥 {streak.count} day streak</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:24}}>
        {tab==="today"&&<DailyTab profile={profile} mastery={mastery} chapters={chapters} streak={streak} onUpdate={refreshData}/>}
        {tab==="progress"&&<ProgressTab mastery={mastery} mocks={mocks} chapters={chapters}/>}
        {tab==="mentor"&&<MentorTab profile={profile} mastery={mastery} mocks={mocks} setMocks={setMocks} setMastery={setMastery}/>}
        {tab==="zeus"&&<ZeusTab profile={profile} mastery={mastery} mocks={mocks}/>}
      </div>
    </div>
  );
}
