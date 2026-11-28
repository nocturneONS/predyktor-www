"use strict";
const S={predictions:[],settled:[],stats:null,unsettled:null,tour:"ALL",analyticsTour:"overall",q:"",valueOnly:false,edgePlayer:"hades"};
const $=id=>document.getElementById(id);
const n=v=>v==null||v===""?null:Number(v);
const pct=v=>v==null||!Number.isFinite(Number(v))?"—":(Number(v)*100).toFixed(1)+"%";
const count=v=>Number(v||0).toLocaleString("pl-PL");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dt=v=>{if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat("pl-PL",{dateStyle:"medium",timeStyle:"short"}).format(d)};
const day=v=>{if(!v)return"—";const d=new Date(String(v).slice(0,10)+"T12:00:00Z");return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat("pl-PL",{dateStyle:"medium"}).format(d)};
const reasons={awaiting_result:"Oczekiwanie na wynik",nonstandard_or_incomplete_result:"Wynik niepełny / walkower / krecz",player_pair_not_found:"Nie znaleziono pary",date_mismatch:"Niezgodna data",ambiguous_match:"Niejednoznaczne dopasowanie",score_missing:"Brak wyniku",score_unparseable:"Nieczytelny wynik",winner_identity_mismatch:"Niezgodność zwycięzcy",archive_not_available:"Brak archiwum"};
const relations={both_correct:"Obaj trafili",model_only_correct:"Tylko model",market_only_correct:"Tylko rynek",both_wrong:"Obaj nietrafieni"};
async function json(file,fallback){try{const r=await fetch("data/"+file+"?v="+Date.now(),{cache:"no-store"});if(!r.ok)return fallback;return await r.json()}catch{return fallback}}
async function load(){const [p,s,u,h]=await Promise.all([json("predictions.json",{predictions:[]}),json("stats.json",null),json("unsettled.json",{count:0,by_reason:{},predictions:[]}),json("settled.json",{count:0,matches:[]})]);S.predictions=Array.isArray(p.predictions)?p.predictions:[];S.stats=s;S.unsettled=u;S.settled=Array.isArray(h.matches)?h.matches:[];window.__predyktorSettled=S.settled;$("updated").textContent=(s&&s.generated_at||p.generated_at)?"Aktualizacja: "+dt(s&&s.generated_at||p.generated_at):"Brak danych z pipeline";render()}
function value(r){return !!r.model_favorite_side&&!!r.market_favorite_side&&r.model_favorite_side!==r.market_favorite_side}
function renderSummary(){const o=S.stats&&S.stats.overall||{};$("total").textContent=count(S.stats&&S.stats.total_predictions!=null?S.stats.total_predictions:S.predictions.length+Number(o.settled||0));$("settled").textContent=count(o.settled||0);$("model-acc").textContent=pct(o.model_accuracy);$("market-acc").textContent=pct(o.market_accuracy);$("model-correct").textContent=count(o.model_correct||0)+" trafnych wskazań";$("unsettled").textContent=count(S.unsettled&&S.unsettled.count||0);$("pending-count").textContent=count(S.predictions.length)+" spotkań";$("unsettled-pill").textContent=count(S.unsettled&&S.unsettled.count||0);$("history-count").textContent=count(S.settled.length)}
function playerLabel(name,days){const safe=esc(name);if(days==null||!Number.isFinite(Number(days)))return safe;const d=Number(days),when=d===0?"dzisiaj":d===1?"1 dzień temu":d+" dni temu";return '<span class="mto-flag" title="MTO: '+when+'" aria-label="MTO: '+when+'">✚</span> '+safe}

const edgeRules={
 hades:{label:"Hades",base:100,odds:2.3},
 zeus:{label:"Zeus",base:50,odds:4.0},
 hera:{label:"Hera",base:100,odds:null}
};
function hasMedical(r){return [r.mto_a_days_ago,r.mto_b_days_ago].some(v=>v!=null&&Number.isFinite(Number(v)));}
function simulationRows(){
 return S.settled.filter(r=>!hasMedical(r)&&r.status==="settled"&&r.result_type==="regular"&&r.market_analysis&&r.market_analysis.is_value===true)
  .filter(r=>[[2,0],[0,2],[2,1],[1,2]].some(([a,b])=>Number(r.set_score_a)===a&&Number(r.set_score_b)===b))
  .sort((a,b)=>new Date(a.kickoff_utc||a.match_date)-new Date(b.kickoff_utc||b.match_date));
}
function strategyBet(key,r,streak){
 if(hasMedical(r))return {stake:0,won:false,odds:NaN};
 const gap=Math.abs(Number(r.model_probability_a)-Number(r.market_probability_a)),model=r.model_favorite_side;
 let eligible=false,won=false,odds=NaN;
 if(key==="hades"){eligible=gap>=.05&&gap<.15;won=Number(r.set_score_a)+Number(r.set_score_b)===3;odds=2.3;}
 else if(key==="zeus"){eligible=gap>=.15&&gap<.25;won=(model==="A"&&Number(r.set_score_a)===2&&Number(r.set_score_b)===0)||(model==="B"&&Number(r.set_score_b)===2&&Number(r.set_score_a)===0);odds=4;}
 else {eligible=gap>=.05&&gap<.25;won=(model==="A"&&Number(r.set_score_a)===2&&Number(r.set_score_b)<=1)||(model==="B"&&Number(r.set_score_b)===2&&Number(r.set_score_a)<=1);odds=Number(model==="A"?r.odds_a:model==="B"?r.odds_b:NaN);}
 if(!eligible||!Number.isFinite(odds)||odds<=1)return {stake:0,won:false,odds};
 return {stake:edgeRules[key].base*(key==="zeus"?1:Math.pow(2,streak)),won,odds};
}
function currentLossStreak(key){
 if(key==="zeus")return 0;
 let streak=0,bank=1000;
 simulationRows().forEach(r=>{
  const bet=strategyBet(key,r,streak);if(!bet.stake||bank<bet.stake)return;
  bank+=bet.won?bet.stake*(bet.odds-1):-bet.stake;
  streak=bet.won?0:streak+1;
 });
 return streak;
}
function edgePick(r,key){
 if(hasMedical(r))return {stake:0,line:"",odds:NaN};
 const gap=Math.abs(Number(r.model_probability_a)-Number(r.market_probability_a));
 const modelFull=r.model_favorite_side==="A"?r.player_a:r.model_favorite_side==="B"?r.player_b:null;
 const shortName=name=>name?String(name).trim().split(/\\s+/).filter(Boolean).at(-1):null;
 const model=shortName(modelFull);let stake=0,line="",odds=NaN;
 if(key==="hades"){if(gap>=.05&&gap<.15)stake=100*Math.pow(2,currentLossStreak("hades"));line="3 sety · progresja 2× po porażce";odds=2.3;}
 else if(key==="zeus"){if(gap>=.15&&gap<.25)stake=50;line=(model||"Faworyt modelu")+" 2:0 · EDGE 15–25 pp";odds=4;}
 else if(key==="hera"){if(gap>=.05&&gap<.25)stake=100*Math.pow(2,currentLossStreak("hera"));line=(model||"Faworyt modelu")+" · Model wygra · progresja 2× po porażce";odds=r.model_favorite_side==="A"?Number(r.odds_a):r.model_favorite_side==="B"?Number(r.odds_b):NaN;}
 if(!value(r)||(key==="hera"&&(!Number.isFinite(odds)||odds<=1)))stake=0;
 return {stake,line,odds};
}
function renderEdgeOverview(){
 const root=$("edge-persona-stats");if(!root)return;
 const keys=["hades","zeus","hera"];
 const results=Object.fromEntries(keys.map(key=>{
  let bank=1000,profit=0,turnover=0,wins=0,placed=0,streak=0;
  simulationRows().forEach(r=>{
   const bet=strategyBet(key,r,streak);if(!bet.stake||bank<bet.stake)return;
   const delta=bet.won?bet.stake*(bet.odds-1):-bet.stake;bank+=delta;profit+=delta;turnover+=bet.stake;placed++;if(bet.won)wins++;
   if(key!=="zeus")streak=bet.won?0:streak+1;
  });
  return [key,{bank,profit,turnover,wins,placed,roi:turnover?profit/turnover:0,accuracy:placed?wins/placed:0}];
 }));
 root.innerHTML=keys.map(key=>{
  const r=results[key],label=edgeRules[key].label;
  return '<div class="edge-persona-card edge-persona-'+key+'"><b>'+label+'</b><span class="edge-best-strategy">'+(key==="zeus"?"Flat stake":"Progresja 2× po porażce")+'</span><strong class="'+(r.profit>=0?"positive":"negative")+'">'+(r.profit>0?"+":"")+r.profit.toLocaleString("pl-PL",{maximumFractionDigits:2})+" j</strong><small>Bankroll "+r.bank.toLocaleString("pl-PL",{maximumFractionDigits:2})+" j · ROI "+(r.roi*100).toFixed(1)+"%</small><div class=\"edge-result\">"+r.wins+"/"+r.placed+" trafień · "+(r.accuracy*100).toFixed(1)+"% · "+r.placed+" zakładów</div></div>";
 }).join("");
}

function renderPredictions(){
 let rows=S.predictions.filter(r=>(S.tour==="ALL"||r.tour===S.tour)&&(!S.valueOnly||value(r))&&(!S.q||[r.player_a,r.player_b,r.league,r.tourney_name].join(" ").toLocaleLowerCase("pl-PL").includes(S.q)));
 rows.sort((a,b)=>new Date(a.kickoff_utc)-new Date(b.kickoff_utc));
 if(!rows.length){$("predictions").innerHTML='<div class="empty">Brak spotkań spełniających wybrane kryteria.</div>';return}
 const width=v=>Math.max(0,Math.min(100,Number(v||0)*100)),odds=v=>{const x=Number(v);return Number.isFinite(x)&&x>0?x.toFixed(2):"—"};
 const split=(a,b,muted=false)=>'<div class="prob-pair'+(muted?' market-muted':'')+'"><span class="prob-a">'+pct(a)+'</span><span class="prob-b">'+pct(b)+'</span></div><div class="split-bar'+(muted?' market-muted':'')+'" role="img" aria-label="A '+pct(a)+', B '+pct(b)+'"><i class="split-a" style="width:'+width(a)+'%"></i><i class="split-b" style="width:'+width(b)+'%"></i></div>';
 const personas=["hades","zeus","hera"];
 const proposal=(key,pick,r)=>{if(!(pick.stake>0))return "";const full=r.model_favorite_side==="A"?r.player_a:r.model_favorite_side==="B"?r.player_b:"",name=full?String(full).trim().split(/\\s+/).filter(Boolean).at(-1):"Faworyt";const type=key==="hades"?"3 sety":key==="zeus"?name+" 2:0":name;return '<div class="edge-pick-row edge-pick-'+key+'"><b>'+edgeRules[key].label+':</b> <span><strong>'+esc(type)+' '+pick.stake.toLocaleString("pl-PL",{maximumFractionDigits:2})+' j</strong></span></div>'};
 $("predictions").innerHTML=rows.map(r=>{const a=Number(r.edge_a||0),b=Number(r.edge_b||0),best=Math.max(a,b);
 const picks=personas.map(key=>proposal(key,edgePick(r,key),r)).filter(Boolean).join("");
 const proposals='<div class="strategy-proposals">'+picks+'</div>';
 const kickoff=new Date(r.kickoff_utc),validKickoff=!Number.isNaN(kickoff.getTime()),warsaw={timeZone:"Europe/Warsaw"},dateParts=validKickoff?new Intl.DateTimeFormat("en-CA",{...warsaw,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(kickoff):[],datePart=k=>dateParts.find(p=>p.type===k)?.value,currentParts=new Intl.DateTimeFormat("en-CA",{...warsaw,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),currentPart=k=>currentParts.find(p=>p.type===k)?.value,matchDay=validKickoff?Date.UTC(Number(datePart("year")),Number(datePart("month"))-1,Number(datePart("day"))):NaN,today=Date.UTC(Number(currentPart("year")),Number(currentPart("month"))-1,Number(currentPart("day"))),dayDiff=Math.round((matchDay-today)/86400000),dateLabel=!validKickoff?"—":dayDiff===-1?"Wczoraj":dayDiff===0?"Dzisiaj":dayDiff===1?"Jutro":new Intl.DateTimeFormat("pl-PL",{...warsaw,day:"numeric",month:"short",year:"numeric"}).format(kickoff),timeLabel=validKickoff?new Intl.DateTimeFormat("pl-PL",{...warsaw,hour:"2-digit",minute:"2-digit"}).format(kickoff):"—",rawTournament=r.tourney_name||r.league||"—",tournamentLabel=String(rawTournament).replace(/^(?:(?:ATP|WTA)\s+|Challenger\s+)/i,"").trim()||rawTournament;
 return '<article class="match"><div class="match-info"><b>'+esc(r.tour==="CHALLENGER"?"CHALLENGER":r.tour)+'</b><span>'+esc(tournamentLabel)+'</span><span>'+esc(dateLabel)+'</span><span>'+esc(timeLabel)+'</span></div><div class="matchup"><div class="player-line player-a"><span class="odds odds-a">'+odds(r.odds_a)+'</span><span class="player-name">'+playerLabel(r.player_a,r.mto_a_days_ago)+'</span></div><div class="player-line player-b"><span class="odds odds-b">'+odds(r.odds_b)+'</span><span class="player-name">'+playerLabel(r.player_b,r.mto_b_days_ago)+'</span></div></div><div class="prob-group"><div class="prob-column">'+split(r.market_probability_a,r.market_probability_b,true)+'</div><div class="prob-column">'+split(r.model_probability_a,r.model_probability_b)+'</div></div><div class="edge-column"><div class="edge '+(best<0?"negative":"")+'">'+(best>=0?"+":"")+(best*100).toFixed(1)+' pp</div><div class="edge-caption">EDGE'+(value(r)?' · VALUE':'')+'</div></div>'+proposals+'</article>'}).join("");
}
function renderOutcomes(){
 const v=S.stats&&S.stats.match_intelligence&&S.stats.match_intelligence.overall||{};
 $("both").textContent=count(v.value_count?Math.max(0,v.value_count-v.value_model_only-v.value_market_only-v.value_both_wrong):0);
 $("model-only").textContent=count(v.value_model_only||0);
 $("market-only").textContent=count(v.value_market_only||0);
 $("both-wrong").textContent=count(v.value_both_wrong||0);
 $("disagreements").textContent=count(v.value_count||0);
 $("model-disagree-acc").textContent=pct(v.value_model_accuracy);
 $("market-disagree-acc").textContent=pct(v.value_market_accuracy);
}
function renderSets(){
 const root=$("intel-content"),all=S.stats&&S.stats.match_intelligence;
 if(!all){root.innerHTML='<div class="empty">Brak analityki. Dane pojawią się po kolejnym eksporcie pipeline.</div>';return}
 const key=S.analyticsTour||"overall",data=key==="overall"?all.overall:(all.by_tour||{})[key];
 if(!data||!data.sample_size){$("intel-sample").textContent="0 meczów";root.innerHTML='<div class="empty">Brak rozliczonych spotkań dla wybranego touru.</div>';return}
 const pct=v=>v==null?"—":(Number(v)*100).toFixed(1)+"%";
 const num=v=>Number(v||0).toLocaleString("pl-PL");
 const topScore=obj=>{const entries=Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]);return entries.length?entries[0][0]+" · "+num(entries[0][1]):"—"};
 const outcomes=data.outcomes||{},configs=data.configurations||{};
 $("intel-sample").textContent=num(data.sample_size)+" meczów";
 const cards=[["VALUE · MECZE",num(data.value_count),pct(data.value_rate)+" wszystkich rozliczonych","#4de0ad"],["VALUE · 3 SETY",num(data.value_three_set_count),pct(data.value_three_set_rate)+" spotkań VALUE","#61b6ff"],["MODEL TRAFIA",num(data.value_model_correct),pct(data.value_model_accuracy)+" w VALUE","#61b6ff"],["RYNEK TRAFIA",num(data.value_market_correct),pct(data.value_market_accuracy)+" w VALUE","#f0b66c"]];
 let out='<div class="intel-kpis">'+cards.map(c=>'<article><small>'+c[0]+'</small><strong style="color:'+c[3]+'">'+c[1]+'</strong><span>'+c[2]+'</span></article>').join("")+'</div>';
 out+='<div class="intel-block"><div class="intel-heading"><div><b>Gdy pojawia się VALUE</b><small>Rozbieżne wskazania · A/B oznacza stronę faworyta</small></div><span>3-setowe / próba</span></div><div class="table-scroll"><table class="intel-table"><thead><tr><th>Model / rynek</th><th>Mecze</th><th>3 sety</th><th>Model fav. 2:0</th><th>Model fav. 2:1</th><th>Rynek fav. 2:0</th><th>Rynek fav. 2:1</th><th>Trafił model</th><th>Trafił rynek</th><th>Obaj błędnie</th></tr></thead><tbody>'+["A/A","B/B","A/B","B/A"].map(k=>{const x=configs[k]||{};return '<tr><td><b class="config-chip">'+k+'</b></td><td>'+num(x.count)+'</td><td>'+num(x.three_set_count)+' <span class="muted">('+pct(x.three_set_rate)+')</span></td><td>'+num((x.model_favorite_scores||{})["2:0"])+'</td><td>'+num((x.model_favorite_scores||{})["2:1"])+'</td><td>'+num((x.market_favorite_scores||{})["2:0"])+'</td><td>'+num((x.market_favorite_scores||{})["2:1"])+'</td><td class="good">'+num(x.model_correct)+'</td><td class="market-cell">'+num(x.market_correct)+'</td><td class="bad">'+num(x.both_wrong_count)+'</td></tr>'}).join("")+'</tbody></table></div><p class="hint">A/A i B/B oznaczają zgodnych faworytów. A/B i B/A to VALUE — model i rynek wskazują różne strony. Procenty liczone są w obrębie konfiguracji.</p></div>';
 out+='<div class="intel-columns"><div class="intel-block"><div class="intel-heading"><div><b>Co dzieje się, gdy wskazania…</b><small>Wyniki w czterech scenariuszach</small></div></div><div class="outcome-list">'+[["both_correct","Obaj trafili"],["model_only_correct","Tylko model"],["market_only_correct","Tylko rynek"],["both_wrong","Obaj się pomylili"]].map(([k,label])=>{const x=outcomes[k]||{};return '<div class="outcome-row"><div><b>'+label+'</b><small>'+num(x.count)+' meczów · '+num(x.three_set_count)+' trzysetowych ('+pct(x.three_set_rate)+')</small></div><strong>'+topScore(x.scores)+'</strong></div>'}).join("")+'</div></div>';
 out+='<div class="intel-block"><div class="intel-heading"><div><b>Wynik zwycięzcy</b><small>Bez względu na to, czy wygrał A czy B</small></div></div><div class="score-tiles">'+["2:0","2:1"].map(k=>'<div><strong>'+num((data.winner_score_distribution||{})[k])+'</strong><small>Wygrana '+k+'</small></div>').join("")+'</div><div class="score-tiles secondary">'+["upset_0:2","upset_1:2"].map(k=>'<div><strong>'+num((data.model_favorite_score_distribution||{})[k])+'</strong><small>'+(k==="upset_0:2"?"Faworyt modelu przegrywa 0:2":"Faworyt modelu przegrywa 1:2")+'</small></div>').join("")+'</div></div></div>';
 out+='<div class="intel-block"><div class="intel-heading"><div><b>Najczęstsze wyniki w pomyłkach</b><small>Porównanie błędnych wskazań z rezultatem</small></div></div><div class="mistake-grid">'+[["model_only_correct","Model miał rację"],["market_only_correct","Rynek miał rację"],["both_wrong","Obaj się mylili"]].map(([k,label])=>{const x=outcomes[k]||{};return '<div><small>'+label+'</small><strong>'+topScore(x.scores)+'</strong><span>'+num(x.count)+' spotkań</span></div>'}).join("")+'</div></div>';
 root.innerHTML=out;
}
function renderTours(){const tours=S.stats&&S.stats.by_tour||{};$("tour-stats").innerHTML=["ATP","WTA","CHALLENGER"].map(t=>{const x=tours[t]||{};return '<tr><td><b>'+t+'</b></td><td>'+count(x.settled||0)+'</td><td>'+pct(x.model_accuracy)+'</td><td>'+pct(x.market_accuracy)+'</td><td>'+count(x.disagreements||0)+'</td><td>'+(x.model_brier_score==null?"—":Number(x.model_brier_score).toFixed(3))+'</td><td>'+(x.market_brier_score==null?"—":Number(x.market_brier_score).toFixed(3))+'</td></tr>'}).join("")}
function renderUnsettled(){const u=S.unsettled||{},entries=Object.entries(u.by_reason||{}).sort((a,b)=>b[1]-a[1]);$("reasons").innerHTML=entries.length?entries.map(([k,v])=>'<div class="reason"><span>'+esc(reasons[k]||k.replaceAll("_"," "))+'</span><b>'+count(v)+'</b></div>').join(""):'<div class="empty">Brak nierozliczonych spotkań.</div>';const rows=u.predictions||[];$("unsettled-rows").innerHTML=rows.length?rows.map(r=>'<tr><td><b>'+esc(r.player_a)+' vs '+esc(r.player_b)+'</b></td><td>'+esc(r.tour)+' · '+esc(r.league||"—")+'</td><td class="bad">'+esc(reasons[r.settlement_reason]||r.settlement_reason||"—")+'</td><td>'+count(r.settlement_attempts)+'</td><td>'+dt(r.last_checked_at)+'</td><td>'+Number(r.hours_since_kickoff||0).toFixed(1)+' h</td></tr>').join(""):'<tr><td colspan="6" class="empty">Brak nierozliczonych meczów.</td></tr>'}
function renderHistory(){const rows=S.settled;if(!rows.length){$("history-rows").innerHTML='<tr><td colspan="7" class="empty">Brak historii.</td></tr>';return}$("history-rows").innerHTML=rows.slice(0,200).map(r=>'<tr><td><b>'+esc(r.player_a)+' vs '+esc(r.player_b)+'</b><br><span class="sub">'+day(r.match_date)+'</span></td><td>'+esc(r.tour)+'</td><td>'+esc(r.set_score_a)+':'+esc(r.set_score_b)+'</td><td>'+esc(r.winner_name||"—")+'</td><td class="'+(r.model_correct?"good":"bad")+'">'+(r.model_correct?"TRAFIONY":"BŁĘDNY")+'</td><td class="'+(r.market_correct?"good":"bad")+'">'+(r.market_correct?"TRAFIONY":"BŁĘDNY")+'</td><td>'+esc(relations[r.model_market_relation]||"—")+'</td></tr>').join("")}
function render(){renderSummary();renderEdgeOverview();renderPredictions();renderTours();renderUnsettled();renderHistory();if(typeof renderDuel==="function")renderDuel()}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab-content").forEach(x=>x.classList.toggle("active",x.id==="tab-"+b.dataset.tab));}));
function parseCSV(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){cell+='"';i++}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){row.push(cell);cell=""}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&next==="\n")i++;row.push(cell);cell="";if(row.some(x=>x.trim()))rows.push(row);row=[]}else cell+=c}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)return[];const h=rows[0].map(x=>x.trim().replace(/^\uFEFF/,""));return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??""])))}
async function importFile(file){const raw=await file.text();let rows=file.name.toLowerCase().endsWith(".json")?JSON.parse(raw):parseCSV(raw);if(!Array.isArray(rows))rows=rows.predictions||rows.matches||[];S.predictions=rows.map(r=>({...r,tour:String(r.tour||"").toUpperCase(),model_probability_a:n(r.model_probability_a),model_probability_b:n(r.model_probability_b),market_probability_a:n(r.market_probability_a),market_probability_b:n(r.market_probability_b)}));renderPredictions();$("pending-count").textContent=count(S.predictions.length)+" zaimportowanych"}
document.querySelectorAll("[data-intel-tour]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-intel-tour]").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.analyticsTour=b.dataset.intelTour;renderSets()}));
document.querySelectorAll("[data-tour]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-tour]").forEach(x=>x.classList.remove("active"));b.classList.add("active");S.tour=b.dataset.tour;renderPredictions()}));
$("search").addEventListener("input",e=>{S.q=e.target.value.toLocaleLowerCase("pl-PL");renderPredictions()});$("value-only").addEventListener("change",e=>{S.valueOnly=e.target.checked;renderPredictions()});const refreshButton=$("refresh");if(refreshButton)refreshButton.addEventListener("click",load);
const fileInput=$("file-input");if(fileInput)fileInput.addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{await importFile(f);$("updated").textContent="Import: "+f.name}catch(err){alert("Błąd importu: "+err.message)}finally{e.target.value=""}});
load();
