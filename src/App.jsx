import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg:"#0a0d11", panel:"#0f1318", panel2:"#141920", border:"#1c2534",
  border2:"#253144", accent:"#4a9eff", green:"#3ddc84", red:"#ff4d6a",
  yellow:"#ffc947", purple:"#b388ff", text:"#d4e2f0", dim:"#5a7080", muted:"#2d3f52",
};

const fmt = (n, d=2) => Number(n).toFixed(d);

const devig = (o1, o2, method="power") => {
  const r1=1/o1, r2=1/o2;
  if(method==="additive"){const v=(r1+r2-1)/2;return{p1:r1-v,p2:r2-v};}
  if(method==="multiplicative"){const m=r1+r2;return{p1:r1/m,p2:r2/m};}
  if(method==="shin"){const m=r1+r2,z=Math.sqrt(m*m-4*(m-1)*(r1*r2)),s=(2*(m-1)-z+m)/(2*(m-1)),adj=s*(m-1);return{p1:(r1-adj/2)/(1-adj),p2:(r2-adj/2)/(1-adj)};}
  let k=1, iter=0;
  while(iter++<60){const f=Math.pow(r1,k)+Math.pow(r2,k)-1,df=Math.pow(r1,k)*Math.log(r1)+Math.pow(r2,k)*Math.log(r2),dk=-f/df;k+=dk;if(Math.abs(dk)<1e-9)break;}
  return {p1:Math.pow(r1,k), p2:Math.pow(r2,k)};
};
const calcNvp = (o1, o2, method="power") => {const{p1,p2}=devig(o1,o2,method);return{h:+Number(1/p1).toFixed(3),a:+Number(1/p2).toFixed(3),p1,p2};};
const evPct = (myO, nvpO) => ((myO/nvpO-1)*100).toFixed(1);
const toAmerican = dec => dec>=2 ? `+${Math.round((dec-1)*100)}` : `${Math.round(-100/(dec-1))}`;
const fmtOdds = (dec, format="decimal") => format==="american" ? toAmerican(dec) : Number(dec).toFixed(3);
const secsAgo = ts => {const s=Math.floor((Date.now()-ts)/1000);if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;return`${Math.floor(s/3600)}h ago`;};
const fmtKO = mins => {if(mins<1)return"now";if(mins<60)return`${mins}m`;if(mins<1440)return`${Math.floor(mins/60)}h`;return`${Math.floor(mins/1440)}d`;};
const copyText = async text => {try{await navigator.clipboard.writeText(text);return true;}catch{return false;}};

function Countdown({kickoffMs}) {
  const calc = () => Math.max(0, kickoffMs-Date.now());
  const [ms, setMs] = useState(calc);
  useEffect(()=>{const iv=setInterval(()=>setMs(calc()),1000);return()=>clearInterval(iv);},[kickoffMs]);
  const secs=Math.floor(ms/1000), d=Math.floor(secs/86400), h=Math.floor((secs%86400)/3600), m=Math.floor((secs%3600)/60), s=secs%60;
  const pad = n => String(n).padStart(2,"0");
  const isLive = secs<=0, isSoon = !isLive && secs<3600, isToday = !isLive && secs<86400;
  const color = isLive?C.red:isSoon?C.yellow:isToday?C.text:C.dim;
  const label = isLive?"Live now":d>0?`${d}d ${pad(h)}h ${pad(m)}m`:`${pad(h)}:${pad(m)}:${pad(s)}`;
  return (
    <div style={{paddingTop:2,display:"flex",flexDirection:"column",gap:3}}>
      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color,fontWeight:isSoon||isLive?700:400}}>{label}</span>
      {isSoon && !isLive && <span style={{fontSize:9,color:C.yellow,letterSpacing:"0.06em",fontWeight:700}}>SOON</span>}
      {isLive && <span style={{fontSize:9,color:C.red,letterSpacing:"0.06em",fontWeight:700}}>IN PLAY</span>}
    </div>
  );
}

const playBeep = (type="drop") => {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const cfg = {drop:{freqs:[880,660],dur:0.12,type:"sine"},value:{freqs:[523,659,784],dur:0.09,type:"triangle"},live:{freqs:[440,440,880],dur:0.15,type:"square"}}[type];
    cfg.freqs.forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.type=cfg.type;osc.frequency.value=f;const t=ctx.currentTime+i*cfg.dur;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.18,t+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,t+cfg.dur);osc.start(t);osc.stop(t+cfg.dur);});
  } catch {}
};

const PERIODS_BY_SPORT = {
  Soccer:["Match","1st Half","2nd Half"],
  Basketball:["Game","1st Half","2nd Half","1st Quarter","2nd Quarter","3rd Quarter","4th Quarter"],
  Tennis:["Match","1st Set","2nd Set","3rd Set"],
  Baseball:["Game","1st 5 Innings"],
  Hockey:["Game","1st Period","2nd Period","3rd Period"],
  NFL:["Game","1st Half","2nd Half","1st Quarter","4th Quarter"],
  Volleyball:["Match","1st Set","2nd Set","3rd Set"],
  Handball:["Match","1st Half","2nd Half"],
};
const SPORTS = ["Soccer","Basketball","Tennis","Baseball","Hockey","NFL","Volleyball","Handball"];
const SPORT_COLORS = {Soccer:C.green,Basketball:C.yellow,Tennis:C.accent,Baseball:C.purple,Hockey:"#ff9d4a",NFL:C.red,Volleyball:"#4dd0e1",Handball:"#f06292"};
const MARKETS_BY_SPORT = {
  Soccer:["Moneyline (3-way)","Asian Handicap","Over/Under","Draw No Bet","Both Teams Score"],
  Basketball:["Moneyline (2-way)","Asian Handicap","Totals","1st Half ML","1st Half Totals"],
  Tennis:["Moneyline","Set Handicap","Total Sets"],
  Baseball:["Moneyline","Run Line","Totals"],
  Hockey:["Moneyline","Puck Line","Totals"],
  NFL:["Moneyline","Spread","Totals"],
  Volleyball:["Moneyline","Asian Handicap","Total Sets","Set Handicap"],
  Handball:["Moneyline (3-way)","Asian Handicap","Over/Under"],
};
const COMPETITIONS = {
  Soccer:["Italy - Serie A","England - Premier League","Spain - La Liga","Germany - Bundesliga","France - Ligue 1","Belgium - Pro League","Austria - Landesliga","Vietnam - V League"],
  Basketball:["NBA","WNBA","Euroleague","Dominican Republic - LNB"],
  Tennis:["ATP","WTA","Challenger","ITF"],
  Baseball:["MLB","Minor League","KBO"],
  Hockey:["NHL","KHL","AHL","SHL"],
  NFL:["NFL Regular Season","NFL Playoffs"],
  Volleyball:["Italy - SuperLega","CEV Champions League"],
  Handball:["EHF Champions League","Germany - Bundesliga"],
};
const TEAMS_BY_SPORT = {
  Soccer:[["Inter","Milan"],["Man City","Arsenal"],["PSG","Lyon"],["Bayern","Dortmund"],["Real Madrid","Barcelona"],["Dender","Lommel"],["Mattersburg 2020","ASV Neudorf"],["B36 Torshavn II","Vikingur Gota II"]],
  Basketball:[["Lakers","Celtics"],["Heroes de Moca","Metros de Santiago"],["Indiana Fever","Seattle Storm"]],
  Tennis:[["Djokovic","Alcaraz"],["Sinner","Zverev"],["Swiatek","Sabalenka"]],
  Baseball:[["Yankees","Red Sox"],["Dodgers","Giants"]],
  Hockey:[["Bruins","Rangers"],["Maple Leafs","Canadiens"]],
  NFL:[["Chiefs","Eagles"],["49ers","Cowboys"]],
  Volleyball:[["Trentino","Civitanova"],["Perugia","Modena"]],
  Handball:[["Barcelona","THW Kiel"],["Paris SG","Montpellier"]],
};

let _uid = 1;

const mkHistorySeries = (price, nvpV, limitV, n=20) => {
  const now=Date.now();
  return Array.from({length:n},(_,i)=>{const t=now-(n-1-i)*180000,j=()=>+(Math.random()*0.06-0.03).toFixed(3);return{t,price:+(price+j()+(i<n/2?0.1*(1-i/(n/2)):0)).toFixed(3),nvp:+(nvpV+j()).toFixed(3),limit:Math.round(limitV*(0.85+Math.random()*0.3))};});
};

const mkEvent = (alertName="Soccer", devigMethod="power") => {
  const sport = SPORTS.find(s=>alertName.toLowerCase().includes(s.toLowerCase())) || SPORTS[Math.floor(Math.random()*SPORTS.length)];
  const teams = TEAMS_BY_SPORT[sport] || TEAMS_BY_SPORT.Soccer;
  const t = teams[Math.floor(Math.random()*teams.length)];
  const market = MARKETS_BY_SPORT[sport][Math.floor(Math.random()*MARKETS_BY_SPORT[sport].length)];
  const sportPeriods = PERIODS_BY_SPORT[sport] || ["Match"];
  const period = sportPeriods[Math.floor(Math.random()*Math.min(2,sportPeriods.length))];
  const comps = COMPETITIONS[sport] || COMPETITIONS.Soccer;
  const comp = comps[Math.floor(Math.random()*comps.length)];
  const pricePrev = +(1.5+Math.random()*2.5).toFixed(3);
  const drop = +(Math.random()*0.4+0.05).toFixed(3);
  const price = +(pricePrev-drop).toFixed(3);
  const priceAway = +(1.5+Math.random()*2.5).toFixed(3);
  const nv = calcNvp(price, priceAway, devigMethod);
  const limit = Math.floor(Math.random()*900+100);
  return {
    id:_uid++, sport, market, period, competition:comp, home:t[0], away:t[1],
    price, pricePrev, priceAway, nvp:nv, limit,
    drop:+((drop/pricePrev)*100).toFixed(1), ev:evPct(price, nv.h),
    minsToKO:Math.floor(Math.random()*2880+5), alertName,
    ts:Date.now()-Math.floor(Math.random()*600)*1000,
    history:mkHistorySeries(price,nv.h,limit), seen:false,
  };
};

const DEFAULT_CFG = () => ({
  _id:_uid++, nickname:"", sport:"Soccer", markets:[], periods:["Match"],
  competitions:"", competitionsMode:"Exclude",
  minDrop:5, oddsMin:1, oddsMax:10, limitMin:0, limitMax:1000000,
  timeIntervalH:0, timeIntervalM:3, timeIntervalS:0,
  maxTimeD:1, maxTimeH:0, maxTimeM:0, maxTimeS:0, enabled:true,
});

const BOOKMAKERS = [
  {id:"bet365", label:"Bet365", oddsApiKey:"bet365"},
  {id:"betfair_ex_eu", label:"Betfair Exchange", oddsApiKey:"betfair_ex_eu"},
  {id:"betflag", label:"Betflag", oddsApiKey:"betflag"},
];

const sendTelegram = async (token, chatId, message) => {
  try {
    const params = new URLSearchParams({chat_id:chatId, text:message, parse_mode:"HTML", disable_web_page_preview:"true"});
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage?${params}`);
    const data = await res.json();
    return data.ok;
  } catch(e) { console.warn("TG:",e.message); return false; }
};

const formatTelegramMsg = (ev, bookie, bookieOdds, nvp, evPctVal, oddsFormat) => {
  const sign = parseFloat(evPctVal)>0 ? "[+]" : "[-]";
  const f = o => fmtOdds(o, oddsFormat);
  return [
    `${sign} <b>VALUE BET FOUND</b>`,
    ``,
    `<b>${ev.home} vs ${ev.away}</b>`,
    `${ev.competition}`,
    `${ev.period} — ${ev.market}`,
    `Bet on: <b>${ev.home}</b>`,
    ``,
    `Pinnacle: <b>${f(ev.pricePrev)} -> ${f(ev.price)}</b>`,
    `NVP: <b>${f(nvp)}</b>`,
    `${bookie}: <b>${f(bookieOdds)}</b>`,
    `EV: <b>${parseFloat(evPctVal)>0?"+":""}${evPctVal}%</b>`,
    ``,
    `Kickoff: ${fmtKO(ev.minsToKO)}`,
    `Act fast!`
  ].join("\n");
};

function CopyFlash({text, onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,1400);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:C.green,color:"#000",borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,zIndex:300,pointerEvents:"none"}}>Copied: {text}</div>;
}
function Toast({msg, onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:"fixed",bottom:24,right:20,zIndex:200,background:C.panel2,border:`1px solid ${C.green}50`,borderLeft:`3px solid ${C.green}`,borderRadius:6,padding:"10px 16px",color:C.text,fontSize:12,maxWidth:400}}>{msg}</div>;
}

function MultiLineChart({data, w=340, h=130}) {
  if(!data || data.length<2) return null;
  const prices=data.map(d=>d.price), nvps=data.map(d=>d.nvp), limits=data.map(d=>d.limit);
  const all=[...prices,...nvps], mn=Math.min(...all)*0.995, mx=Math.max(...all)*1.005;
  const lMin=Math.min(...limits)*0.9, lMax=Math.max(...limits)*1.1;
  const px = (v,a,b) => h-4-((v-a)/(b-a||1))*(h-8);
  const ln = (vs,a,b) => vs.map((v,i)=>`${(i/(data.length-1))*w},${px(v,a,b)}`).join(" ");
  const pC="#4a9eff", nC="#3ddc84", lC="#ff9d4a";
  return (
    <div style={{position:"relative"}}>
      <svg width={w} height={h} style={{display:"block"}}>
        <polyline points={ln(limits,lMin,lMax)} fill="none" stroke={lC} strokeWidth="1" strokeDasharray="3,2" opacity="0.6"/>
        <polyline points={ln(nvps,mn,mx)} fill="none" stroke={nC} strokeWidth="1.5" opacity="0.9"/>
        <polyline points={ln(prices,mn,mx)} fill="none" stroke={pC} strokeWidth="2"/>
        <circle cx={w} cy={px(prices[prices.length-1],mn,mx)} r={3} fill={pC}/>
      </svg>
      <div style={{display:"flex",gap:10,marginTop:4,fontSize:9,color:C.dim}}>
        <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{color:lC,fontWeight:700}}>-</span>Limit</span>
        <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{color:nC,fontWeight:700}}>-</span>NVP</span>
        <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{color:pC,fontWeight:700}}>-</span>Price</span>
      </div>
    </div>
  );
}

function HistoryTable({data}) {
  const rows = [...data].reverse().slice(0,10);
  return (
    <div style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 60px",gap:4,padding:"4px 0",borderBottom:`1px solid ${C.border}`,color:C.dim,fontSize:9}}>
        <span>Time</span><span style={{textAlign:"right"}}>NVP</span><span style={{textAlign:"right"}}>Price</span><span style={{textAlign:"right"}}>Limit</span>
      </div>
      {rows.map((r,i)=>{
        const dt=new Date(r.t);
        const ds=`${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")} ${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`;
        return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 60px",gap:4,padding:"3px 0",borderBottom:`1px solid ${C.border}`,color:i===0?C.text:C.dim}}>
          <span style={{fontSize:9}}>{ds}</span>
          <span style={{textAlign:"right",color:C.green}}>{r.nvp}</span>
          <span style={{textAlign:"right",color:C.accent}}>{r.price}</span>
          <span style={{textAlign:"right"}}>${r.limit}</span>
        </div>;
      })}
    </div>
  );
}

function SidePanel({ev, onLogBet, onClose, oddsFormat}) {
  const [copied, setCopied] = useState(null);
  const copy = async text => {await copyText(text);setCopied(text);setTimeout(()=>setCopied(null),1400);};
  return (
    <div style={{background:C.panel,borderLeft:`1px solid ${C.border2}`,display:"flex",flexDirection:"column",overflow:"hidden",width:320,flexShrink:0}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,color:C.dim,marginBottom:2}}>H: <span onClick={()=>copy(ev.home)} style={{color:C.accent,cursor:"pointer",textDecoration:"underline dotted"}}>{ev.home}</span></div>
            <div style={{fontSize:11,color:C.dim,marginBottom:2}}>A: <span onClick={()=>copy(ev.away)} style={{color:C.accent,cursor:"pointer",textDecoration:"underline dotted"}}>{ev.away}</span></div>
            <div style={{fontSize:10,color:C.dim,marginTop:3}}>
              [{ev.market}] {ev.home}: {ev.period}
              <span style={{marginLeft:8,fontFamily:"'JetBrains Mono',monospace",color:C.red}}>{fmtOdds(ev.pricePrev,oddsFormat)} -> {fmtOdds(ev.price,oddsFormat)}</span>
              <span style={{marginLeft:6,color:C.green,fontFamily:"'JetBrains Mono',monospace"}}> NVP {fmtOdds(ev.nvp.h,oddsFormat)}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>onLogBet(ev)} style={{background:C.accent,color:"#000",border:"none",borderRadius:4,padding:"5px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>+ Log bet</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16}}>x</button>
          </div>
        </div>
      </div>
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`}}><MultiLineChart data={ev.history} w={288} h={120}/></div>
      <div style={{padding:"8px 14px",overflowY:"auto",flex:1}}><HistoryTable data={ev.history}/></div>
      {copied && <CopyFlash text={copied} onDone={()=>setCopied(null)}/>}
    </div>
  );
}

function LogBetModal({ev, onSave, onClose}) {
  const [period, setPeriod] = useState(ev.period||"Match");
  const [market, setMarket] = useState(ev.market);
  const [team, setTeam] = useState(ev.home);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [bookie, setBookie] = useState("Bet365");
  const nvpVal = ev.nvp?.h;
  const ev_ = parseFloat(odds) && nvpVal ? evPct(parseFloat(odds), nvpVal) : null;
  const inp = {background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:5,padding:"9px 12px",fontSize:13,width:"100%",outline:"none"};
  const sportPeriods = PERIODS_BY_SPORT[ev.sport] || ["Match"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:10,width:440,maxWidth:"96vw",maxHeight:"92vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>Log bet</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:18}}>x</button>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:C.bg,border:`1px solid ${C.border2}`,borderRadius:5,padding:"9px 12px",fontSize:13,color:C.text}}>{ev.home} vs {ev.away}</div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Period (filtered for {ev.sport})</div>
            <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...inp,cursor:"pointer"}}>
              {sportPeriods.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Market</div>
            <select value={market} onChange={e=>setMarket(e.target.value)} style={{...inp,cursor:"pointer"}}>
              {(MARKETS_BY_SPORT[ev.sport]||[]).map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Outcome</div>
            <select value={team} onChange={e=>setTeam(e.target.value)} style={{...inp,cursor:"pointer"}}>
              <option>{ev.home}</option>
              <option>{ev.away}</option>
              {ev.market.includes("3-way") && <option>Draw</option>}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:C.dim,marginBottom:4}}>Bookmaker</div>
            <select value={bookie} onChange={e=>setBookie(e.target.value)} style={{...inp,cursor:"pointer"}}>
              {BOOKMAKERS.map(b=><option key={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>Odds</div><input value={odds} onChange={e=>setOdds(e.target.value)} placeholder="1.00" style={inp} type="number" step="0.01"/></div>
            <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>Stake €</div><input value={stake} onChange={e=>setStake(e.target.value)} placeholder="10" style={inp} type="number"/></div>
            <div><div style={{fontSize:10,color:C.dim,marginBottom:4}}>EV%</div><div style={{...inp,color:ev_===null?C.dim:parseFloat(ev_)>0?C.green:C.red,background:C.muted,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{ev_===null?"N/A":`${parseFloat(ev_)>0?"+":""}${ev_}%`}</div></div>
          </div>
          <div style={{fontSize:11,color:C.dim,background:C.bg,borderRadius:4,padding:"6px 10px"}}>
            NVP Pinnacle: <strong style={{color:C.green}}>{nvpVal}</strong> · Quota mostrata: <strong style={{color:C.yellow}}>{ev.price}</strong>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border2}`,color:C.dim,borderRadius:5,padding:"8px 18px",fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{
              if(!odds||!stake) return;
              onSave({
                id:_uid++, ev, period, market, team, sport:ev.sport,
                odds:parseFloat(odds), stake:parseFloat(stake),
                bestBookie:bookie, nvp:nvpVal, expectedEv:ev_,
                ev_:ev_||"N/A", competition:ev.competition,
                betPlaced:new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})+" "+new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
                startTime:fmtKO(ev.minsToKO), result:null, profit:null,
              });
            }} style={{background:C.accent,color:"#000",border:"none",borderRadius:5,padding:"8px 20px",fontSize:13,fontWeight:800,cursor:"pointer"}}>Log bet</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BetTracker({bets, onResult, onClear}) {
  const [subTab, setSubTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const settled = bets.filter(b=>b.result!==null);
  const profit = settled.reduce((s,b)=>s+b.profit,0);
  const turnover = settled.reduce((s,b)=>s+b.stake,0);
  const allTurnover = bets.reduce((s,b)=>s+b.stake,0);
  const yield_ = turnover>0 ? ((profit/turnover)*100).toFixed(2) : "0.00";
  const roi = allTurnover>0 ? ((profit/allTurnover)*100).toFixed(2) : "0.00";
  const expectedProfit = bets.reduce((s,b)=>s+(parseFloat(b.expectedEv||b.ev_||"0")/100)*b.stake,0);
  const pendingVal = bets.filter(b=>b.result===null).reduce((s,b)=>s+b.stake,0);
  let cum=0;
  const chartPts = settled.map((b,i)=>{cum+=b.profit;return{i,v:cum};});
  const W=560, H=140, vals=chartPts.map(p=>p.v), mn=Math.min(...vals,0), mx=Math.max(...vals,1), range=mx-mn||1;
  const pxC = v => H-8-((v-mn)/range)*(H-16);
  const pathD = chartPts.length>1 ? chartPts.map((p,i)=>`${i===0?"M":"L"}${(p.i/(chartPts.length-1))*W},${pxC(p.v)}`).join(" ") : "";
  const areaD = pathD ? `${pathD} L${W},${H} L0,${H} Z` : "";
  const filtered = bets.filter(b=>{const q=search.toLowerCase();return !q||b.ev?.home?.toLowerCase().includes(q)||b.ev?.away?.toLowerCase().includes(q);});
  
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",gap:2,padding:"8px 16px 0",borderBottom:`1px solid ${C.border}`,flexShrink:0,alignItems:"center"}}>
        {["Overview","Analysis"].map(t=>
          <button key={t} onClick={()=>setSubTab(t)} style={{background:subTab===t?C.bg:"none",border:subTab===t?`1px solid ${C.border2}`:"1px solid transparent",borderBottom:"none",color:subTab===t?C.text:C.dim,borderRadius:"4px 4px 0 0",padding:"6px 14px",fontSize:12,cursor:"pointer"}}>{t}</button>
        )}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,paddingBottom:8}}>
          {pendingVal>0 && <span style={{fontSize:11,color:C.yellow}}>Pending: €{fmt(pendingVal)} · {bets.filter(b=>b.result===null).length} bets</span>}
          {bets.length>0 && <button onClick={onClear} style={{background:"none",border:`1px solid ${C.red}40`,color:C.red,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>Clear all</button>}
        </div>
      </div>
      
      {subTab==="Overview" && (
        <div style={{overflowY:"auto",flex:1,padding:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
            {[
              {label:"Profitto reale", v:`€${fmt(profit)}`, color:profit>=0?C.green:C.red, sub:`${settled.length} settled`},
              {label:"EV atteso", v:`€${fmt(expectedProfit)}`, color:expectedProfit>=0?C.green:C.red, sub:"profitto teorico"},
              {label:"Bets", v:bets.length, color:C.text, sub:`${bets.filter(b=>b.result===null).length} pending`},
              {label:"Yield", v:`${yield_}%`, color:parseFloat(yield_)>=0?C.green:C.red, sub:"su settled"},
              {label:"ROI", v:`${roi}%`, color:parseFloat(roi)>=0?C.green:C.red, sub:"su turnover totale"},
            ].map(({label,v,color,sub})=>
              <div key={label} style={{background:C.panel2,borderRadius:8,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,fontWeight:600,color:C.dim,marginBottom:6}}>{label}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,color,fontWeight:700}}>{v}</div>
                <div style={{fontSize:10,color:C.dim,marginTop:4}}>{sub}</div>
              </div>
            )}
          </div>
          <div style={{background:C.panel2,borderRadius:8,padding:16,border:`1px solid ${C.border}`}}>
            <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:8}}>Profit cumulato</div>
            {chartPts.length>1 ? (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
                <defs><linearGradient id="aG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity="0.35"/><stop offset="100%" stopColor={C.green} stopOpacity="0.03"/></linearGradient></defs>
                <path d={areaD} fill="url(#aG)"/>
                <path d={pathD} fill="none" stroke={C.green} strokeWidth="1.8"/>
                <line x1={0} y1={pxC(0)} x2={W} y2={pxC(0)} stroke={C.border2} strokeDasharray="4,3" strokeWidth="1"/>
              </svg>
            ) : <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",color:C.dim,fontSize:12}}>Aggiungi bets per vedere il grafico</div>}
          </div>
        </div>
      )}
      
      {subTab==="Analysis" && (
        <div style={{overflowY:"auto",flex:1}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:5,padding:"6px 8px",fontSize:11,width:"100%",outline:"none"}}/>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border2}`}}>
                {["Event","Start","Bookie","Odds","NVP","EV atteso","Sport","Market","Result","Profit reale"].map(h=>
                  <th key={h} style={{padding:"7px 10px",textAlign:"left",color:C.dim,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={10} style={{padding:28,textAlign:"center",color:C.dim}}>No bets recorded</td></tr>}
                {filtered.map(b=>
                  <tr key={b.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"7px 10px",color:C.text,whiteSpace:"nowrap",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>{b.ev?.home} vs {b.ev?.away}</td>
                    <td style={{padding:"7px 10px",color:C.dim,fontSize:10}}>{b.startTime}</td>
                    <td style={{padding:"7px 10px",color:C.accent,fontSize:10,fontWeight:600}}>{b.bestBookie||"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",color:C.yellow,fontSize:11}}>{b.odds?.toFixed(3)||"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",color:C.green,fontSize:11}}>{b.nvp?.toFixed?b.nvp.toFixed(3):b.nvp||"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:parseFloat(b.expectedEv||b.ev_||"0")>0?C.green:C.red,fontWeight:700}}>{parseFloat(b.expectedEv||b.ev_||"0")>0?"+":""}{b.expectedEv||b.ev_||"N/A"}{(b.expectedEv||(b.ev_&&b.ev_!=="N/A"))?"%":""}</td>
                    <td style={{padding:"7px 10px"}}><span style={{color:SPORT_COLORS[b.sport]||C.text,fontSize:10}}>{b.sport}</span></td>
                    <td style={{padding:"7px 10px",color:C.dim,fontSize:10,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}}>{b.market}</td>
                    <td style={{padding:"7px 10px"}}>
                      {b.result===null ? (
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>onResult(b.id,"win",(b.odds-1)*b.stake)} style={{background:`${C.green}20`,color:C.green,border:`1px solid ${C.green}40`,borderRadius:3,padding:"2px 7px",fontSize:9,cursor:"pointer",fontWeight:700}}>WIN</button>
                          <button onClick={()=>onResult(b.id,"loss",-b.stake)} style={{background:`${C.red}20`,color:C.red,border:`1px solid ${C.red}40`,borderRadius:3,padding:"2px 7px",fontSize:9,cursor:"pointer",fontWeight:700}}>LOSS</button>
                        </div>
                      ) : <span style={{color:b.result==="win"?C.green:C.red,fontWeight:700,fontSize:10}}>{b.result.toUpperCase()}</span>}
                    </td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",color:b.profit===null?C.dim:b.profit>=0?C.green:C.red,fontSize:11,fontWeight:700}}>{b.profit===null?"-":`${b.profit>=0?"+":""}€${fmt(Math.abs(b.profit))}`}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_COLS = [
  {id:"match",label:"Match",w:240,visible:true},
  {id:"starts",label:"Starts",w:130,visible:true},
  {id:"alert",label:"Alert",w:130,visible:true},
  {id:"outcome",label:"Outcome",w:180,visible:true},
  {id:"nvp",label:"No Vig Price",w:110,visible:true},
  {id:"price",label:"Price",w:150,visible:true},
  {id:"best",label:"Best vs NVP",w:170,visible:true},
];

function AlertsTable({events, selected, onSelect, alertCfgs, activeFilter, onFilterChange, oddsFormat, onLogBet, bets, onAddAllToTracker}) {
  const [cols] = useState(DEFAULT_COLS);
  const [flashIds, setFlashIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());
  const [copied, setCopied] = useState(null);

  useEffect(()=>{
    const incoming = events.filter(e=>!prevIdsRef.current.has(e.id)).map(e=>e.id);
    prevIdsRef.current = new Set(events.map(e=>e.id));
    if(!incoming.length) return;
    setFlashIds(prev=>{const n=new Set(prev);incoming.forEach(id=>n.add(id));return n;});
    const t=setTimeout(()=>{setFlashIds(prev=>{const n=new Set(prev);incoming.forEach(id=>n.delete(id));return n;});},1400);
    return ()=>clearTimeout(t);
  },[events]);

  const handleCopy = (text,e) => {e.stopPropagation();copyText(text);setCopied(text);setTimeout(()=>setCopied(null),1400);};
  const totalW = cols.reduce((s,c)=>s+c.w,0);
  const gridTpl = cols.map(c=>c.w+"px").join(" ");

  const renderCell = (colId, ev) => {
    const sportColor = SPORT_COLORS[ev.sport] || C.text;
    if(colId==="match") {
      const betCount = bets.filter(b=>b.ev?.home===ev.home && b.ev?.away===ev.away).length;
      return (
        <div>
          <div style={{fontSize:10,color:C.dim,marginBottom:1,display:"flex",alignItems:"center",justifyContent:"space-between",gap:4}}>
            <span>{String(new Date(Date.now()+ev.minsToKO*60000).getHours()).padStart(2,"0")}:{String(new Date(Date.now()+ev.minsToKO*60000).getMinutes()).padStart(2,"0")} {String(new Date().getDate()).padStart(2,"0")}/{String(new Date().getMonth()+1).padStart(2,"0")}</span>
            <div style={{display:"flex",gap:3,alignItems:"center"}}>
              {betCount>0 && <span title={`${betCount} bet`} style={{background:C.panel2,border:`1px solid ${C.border2}`,color:C.text,borderRadius:3,padding:"1px 5px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:2}}>&#9633; {betCount}</span>}
              <button onClick={e=>{e.stopPropagation();onLogBet(ev);}} title="Log bet" style={{background:`${C.green}22`,border:`1px solid ${C.green}50`,color:C.green,borderRadius:3,padding:"1px 6px",fontSize:11,cursor:"pointer",fontWeight:700}}>+</button>
            </div>
          </div>
          <div onClick={e=>handleCopy(ev.home,e)} style={{fontSize:12,color:C.accent,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"copy",textDecoration:"underline dotted"}}>H: {ev.home}</div>
          <div onClick={e=>handleCopy(ev.away,e)} style={{fontSize:12,color:C.accent,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"copy",textDecoration:"underline dotted"}}>A: {ev.away}</div>
          <div style={{fontSize:10,color:C.dim,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.competition}</div>
        </div>
      );
    }
    if(colId==="starts") return <Countdown kickoffMs={ev.ts+ev.minsToKO*60000}/>;
    if(colId==="alert") return <div style={{paddingTop:2}}><div style={{fontSize:11,color:sportColor,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.alertName}</div><div style={{fontSize:10,color:C.dim,marginTop:2}}>{secsAgo(ev.ts)}</div></div>;
    if(colId==="outcome") return <div style={{paddingTop:2}}><div style={{fontSize:11,color:C.dim}}>{ev.period}</div><div style={{fontSize:11,color:C.text,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.home}</div><div style={{fontSize:11,color:C.dim,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.market}</div></div>;
    if(colId==="nvp") return <div style={{paddingTop:2}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.green,fontWeight:700}}>{fmtOdds(ev.nvp.h,oddsFormat)}</div><div style={{fontSize:10,color:parseFloat(ev.ev)>0?C.green:C.muted,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{parseFloat(ev.ev)>0?"+":""}{ev.ev}% EV</div></div>;
    if(colId==="price") return <div style={{paddingTop:2}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.red,fontWeight:700,whiteSpace:"nowrap"}}>{fmtOdds(ev.pricePrev,oddsFormat)} -> {fmtOdds(ev.price,oddsFormat)}</div></div>;
    if(colId==="best") {
      const lagPct = 0.015+(ev.id%9)*0.004;
      const bestOdds = +(ev.pricePrev*(1-lagPct)).toFixed(3);
      const nvp = ev.nvp?.h;
      const bestEv = nvp ? evPct(bestOdds, nvp) : "0.00";
      const evNum = parseFloat(bestEv);
      const bkLabel = BOOKMAKERS[ev.id%BOOKMAKERS.length]?.label || "Bet365";
      const hasValue = evNum>0;
      return (
        <div style={{paddingTop:2}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <span style={{fontSize:10,color:C.dim,background:C.bg,borderRadius:3,padding:"1px 5px",border:`1px solid ${C.border2}`,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bkLabel}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.yellow,fontWeight:700}}>{fmtOdds(bestOdds,oddsFormat)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:hasValue?C.green:C.red,background:hasValue?`${C.green}18`:`${C.red}18`,border:`1px solid ${hasValue?C.green:C.red}40`,borderRadius:3,padding:"0 5px"}}>{evNum>0?"+":""}{bestEv}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Filter badges */}
      <div style={{display:"flex",gap:4,padding:"8px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0,overflowX:"auto",alignItems:"center"}}>
        <div onClick={()=>onFilterChange("All")} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0,background:activeFilter==="All"?C.accent:C.panel2,border:`1px solid ${activeFilter==="All"?C.accent:C.border2}`,borderRadius:4,padding:"3px 10px",fontSize:11,color:activeFilter==="All"?"#000":C.dim}}>
          <span style={{fontWeight:700}}>All</span>
          <span style={{background:activeFilter==="All"?"rgba(0,0,0,0.25)":C.border2,borderRadius:3,padding:"0 5px",fontSize:10,color:activeFilter==="All"?"#000":C.text}}>{events.length}</span>
        </div>
        {alertCfgs.filter(c=>c.enabled).length===0 && <span style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>No alerts configured —</span>}
        {alertCfgs.filter(c=>c.enabled).map(cfg=>{
          const count = events.filter(e=>e.alertName===cfg.nickname||e.sport===cfg.sport).length;
          const active = activeFilter===cfg.nickname;
          return <div key={cfg._id} onClick={()=>onFilterChange(active?"All":cfg.nickname)} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0,background:active?C.panel2:"transparent",border:`1px solid ${active?C.border2:C.border}`,borderRadius:4,padding:"3px 10px",fontSize:11,color:active?C.text:C.dim}}>
            <span>{cfg.nickname||cfg.sport}</span>
            <span style={{background:C.border2,borderRadius:3,padding:"0 5px",fontSize:10,color:C.text}}>{count}</span>
          </div>;
        })}
        <button onClick={()=>onFilterChange("__new__")} style={{background:"none",border:`1px dashed ${C.border2}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",flexShrink:0}}>+ Configure alerts</button>
      </div>
      
      {/* Toolbar */}
      <div style={{padding:"6px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={onAddAllToTracker} title="Aggiunge tutte le partite al Bet Tracker per testare il ROI" style={{background:`${C.yellow}22`,border:`1px solid ${C.yellow}50`,color:C.yellow,borderRadius:4,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add all to tracker (ROI test)</button>
        <span style={{fontSize:10,color:C.dim,marginLeft:4}}>{events.length} events</span>
      </div>
      
      {/* Header */}
      <div style={{flexShrink:0,borderBottom:`1px solid ${C.border2}`,overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:gridTpl,minWidth:totalW,fontSize:10,color:C.dim,fontWeight:600}}>
          {cols.map(col=><div key={col.id} style={{padding:"7px 10px",borderRight:`1px solid ${C.border}`}}>{col.label}</div>)}
        </div>
      </div>
      
      {/* Body */}
      <div style={{overflowX:"auto",overflowY:"auto",flex:1}}>
        <div style={{minWidth:totalW}}>
          {events.length===0 && <div style={{padding:40,textAlign:"center",color:C.dim,fontSize:12}}>No alerts. Waiting for odds movements...</div>}
          {events.map(ev=>{
            const isSel = selected?.id===ev.id;
            const isFlash = flashIds.has(ev.id) && !isSel;
            return (
              <div key={ev.id} className={isFlash?"row-flash":undefined} style={{display:"grid",gridTemplateColumns:gridTpl,minWidth:totalW,borderBottom:`1px solid ${C.border}`,background:isSel?`${C.accent}0d`:"transparent",borderLeft:isSel?`3px solid ${C.accent}`:"3px solid transparent"}}>
                {cols.map(col=>
                  <div key={col.id} onClick={col.id==="outcome"?()=>onSelect(ev):undefined} style={{padding:"10px 10px",borderRight:`1px solid ${C.border}`,overflow:"hidden",minWidth:0,cursor:col.id==="outcome"?"pointer":"default"}}>
                    {renderCell(col.id, ev)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {copied && <CopyFlash text={copied} onDone={()=>setCopied(null)}/>}
    </div>
  );
}

function ConfigureAlertsPanel({alertCfgs, onSave, onDelete, onClose, onNew}) {
  const firstCfg = alertCfgs[0] || null;
  const [selected, setSelected] = useState(firstCfg);
  const [editing, setEditing] = useState(firstCfg ? {...firstCfg} : {...DEFAULT_CFG()});
  const isNewMode = !selected || !alertCfgs.find(c=>c._id===selected._id);
  
  const upd = (k,v) => setEditing(p=>({...p,[k]:v}));
  const toggleArr = (k,v) => upd(k, editing[k].includes(v)?editing[k].filter(x=>x!==v):[...editing[k],v]);
  const selectCfg = cfg => {setSelected(cfg);setEditing({...cfg});};
  const mkts = MARKETS_BY_SPORT[editing.sport] || [];
  const sportPeriods = PERIODS_BY_SPORT[editing.sport] || ["Match"];
  
  const handleSave = () => {
    if(isNewMode) {
      const n = {...editing, _id:editing._id||(_uid++)};
      onNew(n);
      setSelected(n);
    } else onSave(editing);
  };
  
  const inp = {background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:5,padding:"7px 10px",fontSize:12,outline:"none"};
  
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:200,display:"flex",alignItems:"stretch",justifyContent:"center"}}>
      <div style={{background:C.panel,border:`1px solid ${C.border2}`,margin:"auto",width:"92vw",maxWidth:1020,maxHeight:"90vh",borderRadius:10,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderBottom:`1px solid ${C.border2}`}}>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>Configure alerts</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:20}}>x</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"220px 1fr",flex:1,overflow:"hidden"}}>
          {/* List */}
          <div style={{borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:11,color:C.dim}}>Saved</span>
              <button onClick={()=>{setSelected(null);setEditing({...DEFAULT_CFG()});}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:16,fontWeight:700}}>+</button>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {alertCfgs.length===0 && <div style={{padding:14,fontSize:11,color:C.dim,fontStyle:"italic"}}>No alerts yet. Press + to create one.</div>}
              {alertCfgs.map(cfg=>
                <div key={cfg._id} onClick={()=>selectCfg(cfg)} style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:selected?._id===cfg._id?`${C.accent}10`:"transparent",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:12,color:selected?._id===cfg._id?C.accent:C.text,fontWeight:600}}>{cfg.nickname||cfg.sport}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:1}}>{cfg.sport}</div>
                  </div>
                  <div style={{width:6,height:6,borderRadius:"50%",background:cfg.enabled?C.green:C.muted}}/>
                </div>
              )}
            </div>
          </div>
          {/* Form */}
          <div style={{overflowY:"auto",padding:18}}>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>Nickname</div>
              <input value={editing.nickname} onChange={e=>upd("nickname",e.target.value)} style={{...inp,width:"100%"}} placeholder="e.g. Soccer Top Leagues"/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>Sport</div>
              <select value={editing.sport} onChange={e=>{const s=e.target.value;setEditing(p=>({...p,sport:s,markets:[],periods:[PERIODS_BY_SPORT[s]?.[0]||"Match"]}));}} style={{...inp,width:"100%",cursor:"pointer"}}>
                {SPORTS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>Markets</div>
              <div style={{background:C.bg,border:`1px solid ${C.border2}`,borderRadius:5,padding:"6px 8px",display:"flex",flexWrap:"wrap",gap:5,alignItems:"center",minHeight:38}}>
                {editing.markets.map(m=>
                  <span key={m} style={{background:C.panel2,color:C.text,border:`1px solid ${C.border2}`,borderRadius:14,padding:"3px 8px",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                    {m}<span onClick={()=>toggleArr("markets",m)} style={{cursor:"pointer",color:C.dim,fontSize:12}}>x</span>
                  </span>
                )}
                <select value="" onChange={e=>{if(e.target.value)toggleArr("markets",e.target.value);}} style={{background:"transparent",border:"none",color:C.dim,fontSize:11,cursor:"pointer",outline:"none"}}>
                  <option value="">+ market</option>
                  {mkts.filter(m=>!editing.markets.includes(m)).map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>Periods <span style={{color:C.muted,fontSize:9}}>(filtered for {editing.sport})</span></div>
              <div style={{background:C.bg,border:`1px solid ${C.border2}`,borderRadius:5,padding:"6px 8px",display:"flex",flexWrap:"wrap",gap:5,alignItems:"center",minHeight:38}}>
                {editing.periods.map(p=>
                  <span key={p} style={{background:C.panel2,color:C.text,border:`1px solid ${C.border2}`,borderRadius:14,padding:"3px 8px",fontSize:11,display:"flex",alignItems:"center",gap:5}}>
                    {p}<span onClick={()=>toggleArr("periods",p)} style={{cursor:"pointer",color:C.dim,fontSize:12}}>x</span>
                  </span>
                )}
                <select value="" onChange={e=>{if(e.target.value)toggleArr("periods",e.target.value);}} style={{background:"transparent",border:"none",color:C.dim,fontSize:11,cursor:"pointer",outline:"none"}}>
                  <option value="">+ period</option>
                  {sportPeriods.filter(p=>!editing.periods.includes(p)).map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:11,color:C.dim,marginBottom:5,fontWeight:600}}>Min drop %</div>
                <input type="number" value={editing.minDrop} min={0} max={50} step={0.5} onChange={e=>upd("minDrop",+e.target.value)} style={{...inp,width:"100%"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:C.dim,marginBottom:5,fontWeight:600}}>Odds range</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input type="number" value={editing.oddsMin} min={1} step={0.1} onChange={e=>upd("oddsMin",+e.target.value)} style={{...inp,width:"100%"}}/>
                  <span style={{color:C.dim}}>-</span>
                  <input type="number" value={editing.oddsMax} min={1} step={0.1} onChange={e=>upd("oddsMax",+e.target.value)} style={{...inp,width:"100%"}}/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:C.text}}>Enable?</span>
                <div onClick={()=>upd("enabled",!editing.enabled)} style={{width:42,height:22,borderRadius:11,cursor:"pointer",position:"relative",background:editing.enabled?C.green:C.border2}}>
                  <div style={{position:"absolute",top:2,left:editing.enabled?22:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {!isNewMode && selected && <button onClick={()=>{onDelete(editing);setSelected(null);setEditing({...DEFAULT_CFG()});}} style={{background:"none",border:`1px solid ${C.red}40`,color:C.red,borderRadius:5,padding:"6px 12px",fontSize:11,cursor:"pointer"}}>Delete</button>}
                <button onClick={handleSave} style={{background:C.accent,color:"#000",border:"none",borderRadius:5,padding:"6px 16px",fontSize:12,fontWeight:800,cursor:"pointer"}}>{isNewMode?"Create alert":"Update alert"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelegramSettingsModal({settings, onSave, onClose}) {
  const [cfg, setCfg] = useState({...settings});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const upd = (k,v) => setCfg(p=>({...p,[k]:v}));
  const toggleBookie = id => {const cur=cfg.bookmakers||[];upd("bookmakers",cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);};
  
  const testTelegram = async () => {
    if(!cfg.token||!cfg.chatId){setTestResult("Enter token and chat ID");return;}
    setTesting(true);setTestResult(null);
    try {
      const params = new URLSearchParams({chat_id:cfg.chatId, text:"POD Notifications active! You will receive alerts when bookmaker odds exceed Pinnacle NVP.", parse_mode:"HTML"});
      const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage?${params}`);
      const data = await res.json();
      setTestResult(data.ok?"Message sent! Check Telegram.":"Error: "+(data.description||"Unknown"));
    } catch(e) { setTestResult("Network error: "+e.message); }
    setTesting(false);
  };
  
  const inp = {background:C.bg,border:`1px solid ${C.border2}`,color:C.text,borderRadius:5,padding:"8px 10px",fontSize:12,width:"100%",outline:"none"};
  
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:10,width:460,maxWidth:"96vw",maxHeight:"92vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>Telegram Notifications</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:18}}>x</button>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.panel2,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:12,letterSpacing:"0.06em"}}>BOT CONFIG</div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>BOT TOKEN</label>
              <input value={cfg.token||""} onChange={e=>upd("token",e.target.value)} placeholder="bot token" style={inp} type="password"/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>CHAT ID</label>
              <input value={cfg.chatId||""} onChange={e=>upd("chatId",e.target.value)} placeholder="chat id" style={inp}/>
            </div>
            <button onClick={testTelegram} disabled={testing} style={{background:`${C.accent}22`,border:`1px solid ${C.accent}50`,color:C.accent,borderRadius:5,padding:"7px 14px",fontSize:11,cursor:"pointer",fontWeight:700}}>{testing?"Sending...":"Send test message"}</button>
            {testResult && <div style={{marginTop:8,fontSize:11,color:testResult.includes("sent")?C.green:C.red}}>{testResult}</div>}
          </div>
          <div style={{background:C.panel2,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:12,letterSpacing:"0.06em"}}>THE ODDS API</div>
            <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>API KEY</label>
            <input value={cfg.oddsApiKey||""} onChange={e=>upd("oddsApiKey",e.target.value)} placeholder="API key" style={inp} type="password"/>
            <div style={{fontSize:10,color:C.dim,marginTop:4}}>Free key at the-odds-api.com</div>
            {cfg.oddsApiKey && <div style={{fontSize:10,color:C.green,marginTop:6,display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>Real data active</div>}
          </div>
          <div style={{background:C.panel2,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:12,letterSpacing:"0.06em"}}>MY BOOKMAKERS</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {BOOKMAKERS.map(bk=>{
                const on = (cfg.bookmakers||[]).includes(bk.id);
                return (
                  <div key={bk.id} onClick={()=>toggleBookie(bk.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:6,cursor:"pointer",background:on?`${C.green}12`:C.bg,border:`1px solid ${on?C.green+"40":C.border2}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:on?C.green:C.muted}}/>
                      <span style={{fontSize:13,color:on?C.text:C.dim,fontWeight:on?600:400}}>{bk.label}</span>
                    </div>
                    <div style={{width:36,height:20,borderRadius:10,position:"relative",background:on?C.green:C.border2}}>
                      <div style={{position:"absolute",top:2,left:on?18:2,width:16,height:16,borderRadius:"50%",background:"#fff"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{background:C.panel2,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:12,letterSpacing:"0.06em"}}>THRESHOLDS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>MIN EV%</label>
                <input type="number" value={cfg.minEv||2} min={0} max={20} step={0.5} onChange={e=>upd("minEv",+e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>COOLDOWN min</label>
                <input type="number" value={cfg.cooldownMins||5} min={1} max={60} onChange={e=>upd("cooldownMins",+e.target.value)} style={inp}/>
              </div>
            </div>
          </div>
          <div style={{background:C.panel2,borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,marginBottom:12,letterSpacing:"0.06em"}}>ACTIVE HOURS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>FROM</label>
                <input type="time" value={cfg.activeFrom||"08:00"} onChange={e=>upd("activeFrom",e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={{fontSize:10,color:C.dim,display:"block",marginBottom:4}}>TO</label>
                <input type="time" value={cfg.activeTo||"23:00"} onChange={e=>upd("activeTo",e.target.value)} style={inp}/>
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.panel2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div>
              <div style={{fontSize:13,color:C.text,fontWeight:600}}>Notifications active</div>
              <div style={{fontSize:10,color:C.dim,marginTop:2}}>Send automatic alerts</div>
            </div>
            <div onClick={()=>upd("enabled",!cfg.enabled)} style={{width:44,height:24,borderRadius:12,cursor:"pointer",position:"relative",background:cfg.enabled?C.green:C.border2}}>
              <div style={{position:"absolute",top:3,left:cfg.enabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff"}}/>
            </div>
          </div>
          <button onClick={()=>onSave(cfg)} style={{background:C.accent,color:"#000",border:"none",borderRadius:6,padding:"11px",fontWeight:800,fontSize:13,cursor:"pointer"}}>Save settings</button>
        </div>
      </div>
    </div>
  );
}

function Header({tab, setTab, eventsCount, oddsFormat, setOddsFormat, devigMethod, setDevigMethod, onConfigureAlerts, onTelegram, telegramEnabled, soundEnabled, onToggleSound}) {
  const [time, setTime] = useState(new Date());
  useEffect(()=>{const iv=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(iv);},[]);
  const ts = `${String(time.getHours()).padStart(2,"0")}:${String(time.getMinutes()).padStart(2,"0")}:${String(time.getSeconds()).padStart(2,"0")}`;
  const tabs = ["Alerts [Dropping odds]","Alerts [Limit change]","Alerts [Opening line]","Bet Tracker"];
  return (
    <div style={{background:C.panel,borderBottom:`1px solid ${C.border2}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 14px",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:10,color:C.dim,fontFamily:"'JetBrains Mono',monospace"}}>
            <span style={{color:C.accent,fontWeight:700}}>POD</span>
            <span style={{marginLeft:6}}>{ts}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
            <span style={{fontSize:10,color:C.green}}>Live · {eventsCount} events</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={()=>setOddsFormat(oddsFormat==="decimal"?"american":"decimal")} style={{background:C.panel2,border:`1px solid ${C.border2}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>{oddsFormat==="decimal"?"DEC":"AM"}</button>
          <select value={devigMethod} onChange={e=>setDevigMethod(e.target.value)} style={{background:C.panel2,border:`1px solid ${C.border2}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>
            <option value="power">Power</option>
            <option value="additive">Additive</option>
            <option value="multiplicative">Multiplicative</option>
            <option value="shin">Shin</option>
          </select>
          <button onClick={onConfigureAlerts} style={{background:C.panel2,border:`1px solid ${C.border2}`,color:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer"}}>Config alerts</button>
          <button onClick={onTelegram} style={{background:telegramEnabled?`${C.green}22`:C.panel2,border:`1px solid ${telegramEnabled?C.green+"50":C.border2}`,color:telegramEnabled?C.green:C.dim,borderRadius:4,padding:"3px 10px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <span>TG</span><span>{telegramEnabled?"ON":"OFF"}</span>
          </button>
          <button onClick={onToggleSound} style={{background:soundEnabled?`${C.accent}18`:C.panel2,border:`1px solid ${soundEnabled?C.accent+"50":C.border2}`,color:soundEnabled?C.accent:C.dim,borderRadius:4,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>{soundEnabled?"SND ON":"SND OFF"}</button>
        </div>
      </div>
      <div style={{display:"flex",padding:"0 10px",gap:1,overflowX:"auto"}}>
        {tabs.map(t=>
          <div key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.bg:"transparent",border:tab===t?`1px solid ${C.border2}`:"1px solid transparent",borderBottom:"none",borderRadius:"4px 4px 0 0",padding:"7px 12px",cursor:"pointer",fontSize:11,color:tab===t?C.text:C.dim,fontWeight:tab===t?600:400,whiteSpace:"nowrap"}}>
            {t}
          </div>
        )}
      </div>
    </div>
  );
}

const FLASH_STYLE = `@keyframes rowFlash{0%{background:#00e97630;border-left-color:#00e976;}35%{background:#00e97618;border-left-color:#00e976;}100%{background:transparent;border-left-color:transparent;}}.row-flash{animation:rowFlash 1.4s ease forwards;}`;
if(typeof document!=="undefined" && !document.getElementById("pod-flash")){
  const s=document.createElement("style");s.id="pod-flash";s.textContent=FLASH_STYLE;document.head.appendChild(s);
}

export default function App() {
  // ===== STORAGE HELPERS =====
  const STORAGE_KEY = "pod-config-v1";
  
  const loadStoredConfig = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { console.warn("[POD] Storage load error:", e.message); }
    return null;
  };

  const saveToStorage = (cfg) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
    catch (e) { console.warn("[POD] Storage save error:", e.message); }
  };

  // Load config FIRST
  const storedCfg = loadStoredConfig();

  // ===== STATE - init from storage =====
  const [tab, setTab] = useState(storedCfg?.tab || "Alerts [Dropping odds]");
  const [oddsFormat, setOddsFormat] = useState(storedCfg?.oddsFormat || "decimal");
  const [devigMethod, setDevigMethod] = useState(storedCfg?.devigMethod || "power");
  const [showConfigAlerts, setShowConfigAlerts] = useState(false);
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(storedCfg?.soundEnabled !== false);
  const [telegramCfg, setTelegramCfg] = useState(storedCfg?.telegramCfg || {
    token:"", chatId:"", bookmakers:["bet365","betfair_ex_eu"],
    oddsApiKey:"", minEv:2, cooldownMins:5,
    activeFrom:"08:00", activeTo:"23:00", enabled:false,
  });
  
  const isRealMode = telegramCfg.token && telegramCfg.chatId && telegramCfg.oddsApiKey;
  
  const notifiedRef = useRef({});
  const prevPinnacleRef = useRef({});
  
  const [events, setEvents] = useState(()=>isRealMode ? [] : Array.from({length:35},(_,i)=>mkEvent(["Soccer","Basketball","Basketball","Baseball","Soccer","Tennis","Hockey","Volleyball"][i%8],"power")));
  const [limitEvs, setLimitEvs] = useState(()=>isRealMode ? [] : Array.from({length:18},(_,i)=>mkEvent(["Soccer","Basketball","Baseball","Tennis"][i%4],"power")));
  const [openEvs, setOpenEvs] = useState(()=>isRealMode ? [] : Array.from({length:17},(_,i)=>mkEvent(["Basketball","Soccer","Hockey","Handball"][i%4],"power")));
  
  const [selected, setSelected] = useState(null);
  const [logBetEv, setLogBetEv] = useState(null);
  const [bets, setBets] = useState(storedCfg?.bets || []);
  const [alertCfgs, setAlertCfgs] = useState(storedCfg?.alertCfgs || []);
  const [activeFilter, setActiveFilter] = useState("All");
  const [toast, setToast] = useState(null);

  // ===== AUTO-SAVE TO LOCALSTORAGE =====
  useEffect(() => {
    saveToStorage({ tab, oddsFormat, devigMethod, soundEnabled, telegramCfg, bets, alertCfgs });
  }, [tab, oddsFormat, devigMethod, soundEnabled, telegramCfg, bets, alertCfgs]);

  // ===== CLEAR DEMO EVENTS WHEN REAL MODE =====
  useEffect(() => {
    if (isRealMode && events.length > 0) {
      setEvents([]); setLimitEvs([]); setOpenEvs([]);
      setToast("Demo events cleared - Real mode active");
    }
  }, [isRealMode]);

  // ===== SERVICE WORKER REGISTRATION =====
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    
    const setup = async () => {
      try {
        await navigator.serviceWorker.register("/service-worker.js", {scope:"/"});
        const ctrl = navigator.serviceWorker.controller;
        if (!ctrl) return;
        
        if (isRealMode && telegramCfg.enabled) {
          ctrl.postMessage({
            type:"UPDATE_CONFIG",
            payload:{
              token:telegramCfg.token, chatId:telegramCfg.chatId,
              bookmakers:telegramCfg.bookmakers||[], minEv:telegramCfg.minEv||2,
              cooldownMins:telegramCfg.cooldownMins||5,
              activeFrom:telegramCfg.activeFrom||"08:00",
              activeTo:telegramCfg.activeTo||"23:00",
              oddsApiKey:telegramCfg.oddsApiKey,
            }
          });
        } else {
          ctrl.postMessage({type:"STOP_POLLING"});
        }
      } catch (e) { console.warn("SW error:", e); }
    };
    setup();
  }, [isRealMode, telegramCfg]);


  // Recompute NVP on devig change
  const recomputeEvents = useCallback(evs=>evs.map(e=>{const nv=calcNvp(e.price,e.priceAway,devigMethod);return{...e,nvp:nv,ev:evPct(e.price,nv.h)};}),[devigMethod]);
  useEffect(()=>{setEvents(prev=>recomputeEvents(prev));setLimitEvs(prev=>recomputeEvents(prev));setOpenEvs(prev=>recomputeEvents(prev));},[devigMethod,recomputeEvents]);

  // Simulate new drops every 8s
  useEffect(()=>{
    if(isRealMode) return;
    const iv = setInterval(()=>{
      const cfg = alertCfgs.filter(c=>c.enabled);
      if(!cfg.length) return;
      const c = cfg[Math.floor(Math.random()*cfg.length)];
      const ev = mkEvent(c.nickname||c.sport, devigMethod);
      setEvents(prev=>[ev,...prev.slice(0,59)]);
      if(soundEnabled) playBeep(parseFloat(ev.ev)>5?"value":"drop");
      setToast(`${ev.home} vs ${ev.away}  ${ev.pricePrev}->${ev.price} (${ev.alertName})`);
    }, 8000);
    return ()=>clearInterval(iv);
  },[alertCfgs, devigMethod, soundEnabled, isRealMode]);

  // Telegram simulated (when no real API key)
  useEffect(()=>{
    if(!telegramCfg.enabled||!telegramCfg.token||!telegramCfg.chatId||!(telegramCfg.bookmakers||[]).length||telegramCfg.oddsApiKey) return;
    const iv = setInterval(()=>{
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      if(hhmm<(telegramCfg.activeFrom||"08:00")||hhmm>(telegramCfg.activeTo||"23:00")) return;
      events.forEach(ev=>{
        const lastN = notifiedRef.current[String(ev.id)];
        if(lastN && Date.now()-lastN<(telegramCfg.cooldownMins||5)*60*1000) return;
        (telegramCfg.bookmakers||[]).forEach(bookieId=>{
          const bk = BOOKMAKERS.find(b=>b.id===bookieId);
          if(!bk) return;
          const lag = 0.02+Math.random()*0.08;
          const bookieOdds = +(ev.pricePrev*(1-lag/2)).toFixed(3);
          const nvp = ev.nvp?.h;
          if(!nvp) return;
          const ev_ = evPct(bookieOdds, nvp);
          if(parseFloat(ev_)<(telegramCfg.minEv||2)) return;
          notifiedRef.current[String(ev.id)] = Date.now();
          sendTelegram(telegramCfg.token, telegramCfg.chatId, formatTelegramMsg(ev, bk.label, bookieOdds, nvp, ev_, oddsFormat));
          setToast(`TG -> ${bk.label}: ${ev.home} vs ${ev.away} (+${ev_}% EV)`);
        });
      });
    }, 15000);
    return ()=>clearInterval(iv);
  },[telegramCfg, events, oddsFormat]);

  // Real Odds API engine
  const fetchRealOdds = useCallback(async ()=>{
    if(!telegramCfg.oddsApiKey) return null;
    const sportKeys = ["soccer_italy_serie_a","soccer_epl","basketball_nba","tennis_atp_french_open","baseball_mlb","icehockey_nhl","soccer_spain_la_liga","soccer_germany_bundesliga"];
    const bookmakers = ["pinnacle",...(telegramCfg.bookmakers||[]).map(b=>BOOKMAKERS.find(bk=>bk.id===b)?.oddsApiKey||b)].join(",");
    const results = [];
    for(const sport of sportKeys.slice(0,3)){
      try {
        const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${telegramCfg.oddsApiKey}&regions=eu&markets=h2h&bookmakers=${bookmakers}&oddsFormat=decimal`;
        const res = await fetch(url);
        if(!res.ok) continue;
        const data = await res.json();
        if(Array.isArray(data)) results.push(...data);
      } catch(e) { console.warn("Odds API:",e.message); }
    }
    return results;
  },[telegramCfg.oddsApiKey, telegramCfg.bookmakers]);

  const processOddsAndNotify = useCallback(async oddsData=>{
    if(!oddsData?.length||!telegramCfg.enabled||!telegramCfg.token||!telegramCfg.chatId) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    if(hhmm<(telegramCfg.activeFrom||"08:00")||hhmm>(telegramCfg.activeTo||"23:00")) return;
    for(const game of oddsData){
      const pinnBk = game.bookmakers?.find(b=>b.key==="pinnacle");
      if(!pinnBk) continue;
      const h2h = pinnBk.markets?.find(m=>m.key==="h2h");
      if(!h2h?.outcomes||h2h.outcomes.length<2) continue;
      const homeOdds = h2h.outcomes.find(o=>o.name===game.home_team)?.price;
      const awayOdds = h2h.outcomes.find(o=>o.name===game.away_team)?.price;
      if(!homeOdds||!awayOdds) continue;
      const prevKey = `${game.id}_home`;
      const prevOdds = prevPinnacleRef.current[prevKey];
      if(!prevOdds){prevPinnacleRef.current[prevKey]=homeOdds;prevPinnacleRef.current[`${game.id}_away`]=awayOdds;continue;}
      const dropPct = prevOdds>homeOdds ? ((prevOdds-homeOdds)/prevOdds*100) : 0;
      prevPinnacleRef.current[prevKey] = homeOdds;
      prevPinnacleRef.current[`${game.id}_away`] = awayOdds;
      if(dropPct<1) continue;
      const nv = calcNvp(homeOdds, awayOdds, devigMethod);
      for(const bookieId of telegramCfg.bookmakers||[]){
        const bkInfo = BOOKMAKERS.find(b=>b.id===bookieId);
        if(!bkInfo) continue;
        const cooldownKey = `${game.id}_${bookieId}`;
        const lastN = notifiedRef.current[cooldownKey];
        if(lastN && Date.now()-lastN<(telegramCfg.cooldownMins||5)*60*1000) continue;
        const bookieBk = game.bookmakers?.find(b=>b.key===bkInfo.oddsApiKey);
        if(!bookieBk) continue;
        const bookieH2h = bookieBk.markets?.find(m=>m.key==="h2h");
        if(!bookieH2h) continue;
        for(const outcome of bookieH2h.outcomes){
          const bookieOdds = outcome.price;
          const nvpForSide = outcome.name===game.home_team ? nv.h : nv.a;
          const ev_ = evPct(bookieOdds, nvpForSide);
          if(parseFloat(ev_)<(telegramCfg.minEv||2)) continue;
          const syntheticEv = {home:game.home_team, away:game.away_team, competition:game.sport_title||game.sport_key, period:"Match", market:"Moneyline", price:homeOdds, pricePrev:prevOdds, nvp:nv, minsToKO:Math.round((new Date(game.commence_time).getTime()-now.getTime())/60000)};
          notifiedRef.current[cooldownKey] = Date.now();
          if(soundEnabled) playBeep("value");
          await sendTelegram(telegramCfg.token, telegramCfg.chatId, formatTelegramMsg(syntheticEv, bkInfo.label, bookieOdds, nvpForSide, ev_, oddsFormat));
          setToast(`TG -> ${bkInfo.label}: ${game.home_team} vs ${game.away_team} (+${ev_}% EV)`);
          setEvents(prev=>[{...syntheticEv, id:_uid++, sport:"Soccer", alertName:bkInfo.label, priceAway:awayOdds, drop:dropPct.toFixed(1), ev:ev_, history:mkHistorySeries(homeOdds,nv.h,500), limit:500, ts:Date.now(), seen:false},...prev.slice(0,59)]);
        }
      }
    }
  },[telegramCfg, devigMethod, oddsFormat, soundEnabled]);

  useEffect(()=>{
    if(!telegramCfg.oddsApiKey) return;
    const poll = async ()=>{const data=await fetchRealOdds();if(data&&telegramCfg.enabled) await processOddsAndNotify(data);};
    poll();
    const iv = setInterval(poll, 60000);
    return ()=>clearInterval(iv);
  },[telegramCfg.oddsApiKey, telegramCfg.enabled, fetchRealOdds, processOddsAndNotify]);

  const handleFilterChange = f => {if(f==="__new__"){setShowConfigAlerts(true);return;}setActiveFilter(f);};
  
  const displayedEvents = activeFilter==="All"
    ? (tab==="Alerts [Dropping odds]"?events:tab==="Alerts [Limit change]"?limitEvs:openEvs)
    : (tab==="Alerts [Dropping odds]"?events:limitEvs).filter(e=>e.alertName===activeFilter||e.sport===alertCfgs.find(c=>c.nickname===activeFilter)?.sport);

  const handleSaveCfg = cfg => {
    if(!cfg._id) cfg._id = _uid++;
    setAlertCfgs(prev=>{const ex=prev.find(c=>c._id===cfg._id);return ex?prev.map(c=>c._id===cfg._id?cfg:c):[...prev,cfg];});
    setToast(`Alert "${cfg.nickname||cfg.sport}" saved`);
  };
  const handleDeleteCfg = cfg => {setAlertCfgs(prev=>prev.filter(c=>c._id!==cfg._id));setToast(`Alert deleted`);};
  const handleResult = (id, result, profit) => setBets(prev=>prev.map(b=>b.id===id?{...b,result,profit}:b));

  // Add all to tracker — uses best bookmaker odds for ROI testing
  const handleAddAllToTracker = () => {
    const STAKE = 10;
    const newBets = displayedEvents
      .filter(ev=>!bets.find(b=>b.ev?.home===ev.home && b.ev?.away===ev.away))
      .map(ev=>{
        // Simulate the 3 bookmakers' odds (different lag each)
        const bookieQuotes = BOOKMAKERS.map(bk=>{
          const lag = 0.01 + (bk.id==="betfair_ex_eu"?1:bk.id==="bet365"?2:3) * 0.005;
          return {bk:bk.label, odds:+(ev.pricePrev*(1-lag)).toFixed(3)};
        });
        const best = bookieQuotes.reduce((a,b)=>a.odds>b.odds?a:b);
        const nvp = ev.nvp?.h || ev.price;
        const expectedEv = evPct(best.odds, nvp);
        return {
          id:_uid++, ev, period:ev.period, market:ev.market, team:ev.home, sport:ev.sport,
          odds:best.odds, bestBookie:best.bk, nvp, expectedEv,
          stake:STAKE, ev_:expectedEv, competition:ev.competition,
          betPlaced:new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})+" "+new Date().toLocaleDateString("it-IT",{day:"2-digit",month:"2-digit"}),
          startTime:fmtKO(ev.minsToKO), result:null, profit:null,
        };
      });
    if(!newBets.length){setToast("All events already in tracker");return;}
    setBets(prev=>[...newBets,...prev]);
    setToast(`Added ${newBets.length} bets (best of Bet365/Betfair/Betflag, €${STAKE} stake)`);
    setTab("Bet Tracker");
  };

  const handleClearBets = () => {
    if(window.confirm("Eliminare tutte le bet?")) {setBets([]);setToast("Bet tracker cleared");}
  };

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:C.bg,color:C.text,fontFamily:"sans-serif",overflow:"hidden"}}>
      <Header tab={tab} setTab={setTab} eventsCount={events.length+limitEvs.length+openEvs.length} oddsFormat={oddsFormat} setOddsFormat={setOddsFormat} devigMethod={devigMethod} setDevigMethod={setDevigMethod} onConfigureAlerts={()=>setShowConfigAlerts(true)} onTelegram={()=>setShowTelegramSettings(true)} telegramEnabled={telegramCfg.enabled} soundEnabled={soundEnabled} onToggleSound={()=>setSoundEnabled(p=>!p)}/>
      <div style={{flex:1,display:"grid",gridTemplateColumns:selected&&tab!=="Bet Tracker"?"1fr 320px":"1fr",overflow:"hidden"}}>
        <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {(tab==="Alerts [Dropping odds]"||tab==="Alerts [Limit change]"||tab==="Alerts [Opening line]") && 
            <AlertsTable events={displayedEvents} selected={selected} onSelect={ev=>setSelected(ev===selected?null:ev)} alertCfgs={alertCfgs} activeFilter={activeFilter} onFilterChange={handleFilterChange} oddsFormat={oddsFormat} onLogBet={ev=>setLogBetEv(ev)} bets={bets} onAddAllToTracker={handleAddAllToTracker}/>
          }
          {tab==="Bet Tracker" && <BetTracker bets={bets} onResult={handleResult} onClear={handleClearBets}/>}
        </div>
        {selected && tab!=="Bet Tracker" && <SidePanel ev={selected} onLogBet={ev=>setLogBetEv(ev)} onClose={()=>setSelected(null)} oddsFormat={oddsFormat}/>}
      </div>
      {showConfigAlerts && <ConfigureAlertsPanel alertCfgs={alertCfgs} onSave={handleSaveCfg} onDelete={handleDeleteCfg} onClose={()=>setShowConfigAlerts(false)} onNew={cfg=>{handleSaveCfg(cfg);}}/>}
      {showTelegramSettings && <TelegramSettingsModal settings={telegramCfg} onSave={cfg=>{setTelegramCfg(cfg);setShowTelegramSettings(false);setToast(cfg.enabled?"Telegram notifications active":"Telegram notifications off");}} onClose={()=>setShowTelegramSettings(false)}/>}
      {logBetEv && <LogBetModal ev={logBetEv} onSave={bet=>{setBets(prev=>[bet,...prev]);setLogBetEv(null);setTab("Bet Tracker");setToast("Bet logged in tracker");}} onClose={()=>setLogBetEv(null)}/>}
      {toast && <Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
