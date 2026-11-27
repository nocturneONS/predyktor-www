"use strict";
function renderDuel(){
 const root=document.getElementById("duel-panel");
 if(!root)return;
 const mode="flat";
 const rows=(window.__predyktorSettled||[]).filter(r=>
  r.status==="settled"&&r.result_type==="regular"&&r.market_analysis&&r.market_analysis.is_value===true
 ).filter(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b);
  return Number.isInteger(a)&&Number.isInteger(b)&&[[2,0],[0,2],[2,1],[1,2]].some(([x,y])=>a===x&&b===y);
 }).sort((a,b)=>new Date(a.kickoff_utc||a.match_date)-new Date(b.kickoff_utc||b.match_date));
 const start=1000;
 const rules={
  hades:{stake:100,odds:2.3,label:"Hades"},
  herkules:{stake:25,odds:null,label:"Herkules"},
  zeus:{stake:100,odds:4.0,label:"Zeus"},
  hera:{stake:50,odds:2,label:"Hera"}
 };
 const fmt=v=>Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2});
 const pct=v=>(v*100).toFixed(1)+"%";
 const signed=v=>(v>0?"+":"")+fmt(v);
 const esc=v=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const bets=rows.map(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b),sets=a+b;
  const side=r.market_favorite_side,modelSide=r.model_favorite_side;
  const gap=Math.abs(Number(r.model_probability_a)-Number(r.market_probability_a));
  return {...r,sets,edgeGap:Number.isFinite(gap)?gap:null,
   hadesWin:sets===3,
   herkulesWin:(modelSide==="A"&&a===2)||(modelSide==="B"&&b===2),
   herkulesOdds:Number(modelSide==="A"?r.odds_a:modelSide==="B"?r.odds_b:NaN),
   zeusWin:(modelSide==="A"&&a===2&&b===0)||(modelSide==="B"&&b===2&&a===0),
   heraWin:(modelSide==="A"&&a===2&&b<=1)||(modelSide==="B"&&b===2&&a<=1),
   heraOdds:Number(modelSide==="A"?r.odds_a:modelSide==="B"?r.odds_b:NaN)
  };
 });
 const winField={hades:"hadesWin",herkules:"herkulesWin",zeus:"zeusWin",hera:"heraWin"};
 function stakeForEdge(base,gap){
  if(!Number.isFinite(gap)||gap<0.05)return 0;
  if(gap<0.10)return base*0.25;
  if(gap<0.15)return base*0.50;
  if(gap<0.20)return base*0.75;
  if(gap<0.25)return base;
  return base*1.25;
 }
 function stakeForReverseEdge(base,gap){
  if(!Number.isFinite(gap)||gap<0)return 0;
  if(gap<0.05)return base*1.25;
  if(gap<0.10)return base;
  if(gap<0.15)return base*0.75;
  if(gap<0.20)return base*0.50;
  if(gap<0.25)return base*0.25;
  return 0;
 }
 function simulate(key,kind){
  const rule=rules[key];let bank=start,wins=0,profit=0,turnover=0,placed=0,lossStreak=0;
  const history=[start],items=[];
  for(const r of bets){
   const betOdds=key==="hera"?r.heraOdds:key==="herkules"?r.herkulesOdds:rule.odds;
   let stake=rule.stake;
   if(key==="hades")stake=r.edgeGap>=.05&&r.edgeGap<.15?100*(lossStreak===0?1:lossStreak*2):0;
   else if(key==="herkules")stake=r.edgeGap>=.10&&r.edgeGap<.15?25:r.edgeGap>=.15&&r.edgeGap<.20?50:r.edgeGap>=.20&&r.edgeGap<.25?75:0;
   else if(kind==="edge")stake=key==="hera"?stakeForReverseEdge(rule.stake,r.edgeGap):stakeForEdge(rule.stake,r.edgeGap);
   else if(kind==="progressive")stake=rule.stake*(lossStreak===0?1:lossStreak*2);
   if((key==="hera"||key==="herkules")&&(!Number.isFinite(betOdds)||betOdds<=1))stake=0;
   if(bank<stake)stake=0;
   const placedBet=stake>0;
   const won=r[winField[key]]===true;
   const delta=placedBet?(won?stake*(betOdds-1):-stake):0;
   if(placedBet){placed++;turnover+=stake;profit+=delta;bank+=delta;if(won)wins++;}
   items.push({...r,stake,odds:betOdds,delta,placedBet,won,lossStreakBefore:lossStreak});
   history.push(bank);
   if((key==="hades"||kind==="progressive")&&placedBet)lossStreak=won?0:lossStreak+1;
  }
  return {bank,wins,profit,turnover,placed,history,items,count:bets.length,accuracy:placed?wins/placed:0,roi:turnover?profit/turnover:null};
 }
 const results={};
 for(const key of Object.keys(rules))results[key]=simulate(key,"flat");
 const strategies=[
  {id:"flat",title:"A · Flat stake",desc:"Zeus i Hera: stała stawka. Hades i Herkules zachowują własne reguły."},
  {id:"edge",title:"B · Edge-based",desc:"Zeus i Hera zmieniają stawkę według Edge. Hades nie jest częścią tej strategii."},
  {id:"progressive",title:"C · Progresja",desc:"Zeus i Hera progresują po przegranej. Hades zawsze ma własną progresję 2×, 4×, 6×…"}
 ];
 const strategyResults=Object.fromEntries(strategies.map(x=>[x.id,Object.fromEntries(Object.keys(rules).map(key=>[key,simulate(key,x.id)]))]));
 const selectedStrategy=window.__duelSelectedStrategy||"flat";
 const selectedResults=strategyResults[selectedStrategy]||strategyResults.flat;
 const h=selectedResults.hades,k=selectedResults.herkules,z=selectedResults.zeus,he=selectedResults.hera;
 const path=(values,allHistory)=>{
  if(values.length<2)return "";
  const min=Math.min(start,...allHistory),max=Math.max(start,...allHistory),range=max-min||1,w=700,hg=145;
  return values.map((v,i)=>(i?"L":"M")+(i/(values.length-1)*w).toFixed(1)+" "+(hg-(v-min)/range*hg).toFixed(1)).join(" ");
 };
 const badge=(item)=>{
  if(!item.placedBet)return '<span class="duel-result no-bet">— BEZ ZAKŁADU</span>';
  return '<span class="duel-result '+(item.won?"won":"lost")+'">'+(item.won?"✓ WYGRANA":"✕ PRZEGRANA")+' <b>'+(item.delta>0?"+":"")+fmt(item.delta)+' j</b></span>';
 };
 const byKey={hades:h,herkules:k,zeus:z,hera:he};
 const latest=bets.map((r,i)=>({r,items:Object.fromEntries(Object.keys(rules).map(key=>[key,byKey[key].items[i]]))})).reverse();
 const score=r=>r.set_score_a+":"+r.set_score_b;
 const sideName=r=>r.market_favorite_side==="A"?r.player_a:r.market_favorite_side==="B"?r.player_b:"—";
 const modelName=r=>r.model_favorite_side==="A"?r.player_a:r.model_favorite_side==="B"?r.player_b:"—";
 const rowsHtml=latest.length?latest.map(({r,items})=>
  '<tr><td><span class="duel-tour">'+esc(r.tour)+'</span></td><td><b>'+esc(r.player_a)+' – '+esc(r.player_b)+'</b></td><td><b>'+score(r)+'</b></td>'+
  '<td>'+badge(items.hades)+'</td>'+
  '<td>'+badge(items.herkules)+'</td>'+
  '<td>'+badge(items.zeus)+'</td>'+
  '<td>'+badge(items.hera)+'</td></tr>'
 ).join(""):'<tr><td colspan="7" class="empty">Brak rozliczonych meczów VALUE.</td></tr>';
 const makeChart=(modeId)=>{
  const group=strategyResults[modeId],all=Object.values(group).flatMap(x=>x.history);
  const p=(key,cls)=>'<path class="'+cls+'" d="'+path(group[key].history,all)+'"/>';
  const hadesLine=modeId==="edge"?"":p("hades","hades-line");
  return '<svg class="duel-chart" viewBox="0 0 700 175" role="img" aria-label="Bankroll: '+modeId+'"><line x1="0" y1="145" x2="700" y2="145"/><line x1="0" y1="72" x2="700" y2="72"/>'+hadesLine+p("herkules","herkules-line")+p("zeus","zeus-line")+p("hera","hera-line")+'</svg>';
 };
 const charts='<div class="duel-charts">'+strategies.map(x=>'<article class="duel-strategy-chart '+(x.id===selectedStrategy?"active":"") +'" data-strategy="'+x.id+'" role="button" tabindex="0" aria-pressed="'+(x.id===selectedStrategy?"true":"false")+'"><h3>'+x.title+'</h3><p>'+x.desc+'</p>'+makeChart(x.id)+'</article>').join("")+'</div>';
 const card=(key,title,tag,ruleText,res,cls,avatar)=>
  '<article class="duel-card '+cls+'"><div class="duel-avatar">'+avatar+'</div><div><div class="duel-name">'+title+'</div><div class="duel-tag">'+tag+'</div><div class="duel-rule">'+ruleText+'</div></div><div class="duel-bank">'+fmt(res.bank)+' <small>j</small></div><div class="duel-profit '+(res.profit>=0?"positive":"negative")+'">'+signed(res.profit)+' j · ROI '+(res.roi===null?"—":pct(res.roi))+'</div></article>';
 const totalPlaced=Object.values(selectedResults).reduce((s,x)=>s+x.placed,0);
 root.innerHTML='<div class="duel-stake-box"><div class="duel-stake-heading"><b>Tabela stawek i kursów</b><span>Założenia symulacji</span></div><div class="table-scroll"><table class="duel-stake-table"><thead><tr><th>Persona</th><th>Strategia</th><th>Kurs</th><th>Stawka bazowa</th><th>Zarządzanie stawką</th></tr></thead><tbody>'+
 '<tr><td><b>Hades</b></td><td>3 sety · EDGE 5–15 pp</td><td>2.30*</td><td>100 j bazowo</td><td><span class="stake-direction rising">Progresja 2×</span></td></tr>'+
 '<tr><td><b>Herkules</b></td><td>Faworyt modelu · EDGE 10–25 pp</td><td>Kurs główny</td><td>25 / 50 / 75 j</td><td><span class="stake-direction rising">Rosnąca</span></td></tr>'+
 '<tr><td><b>Zeus</b></td><td>Model 2:0</td><td>4.00</td><td>100 j</td><td><span class="stake-direction rising">Rosnąca</span></td></tr>'+
 '<tr><td><b>Hera</b></td><td>Model 2:0 / 2:1</td><td>Kurs główny</td><td>50 j</td><td><span class="stake-direction falling">Malejąca</span></td></tr>'+
 '</tbody></table></div><p class="hint">* Hades: kurs 2.30 jest założeniem symulacji, nie historycznym kursem rynku 3 setów. Herkules korzysta z kursu głównego wskazanej strony.</p></div>'+
 '<div class="section-title"><div><p class="eyebrow">SIMULATED VALUE BETTING</p><h2>⚔️ Pojedynek typerów — 4 persony</h2><p class="sub">Wyłącznie kompletne mecze VALUE · start 1000 j na personę</p></div><span class="pill">'+bets.length+' meczów VALUE</span></div>'+
 '<div class="duel-grid">'+
 card("hades","HADES","Łowca trzeciego seta","EDGE 5–15 pp · progresja 2× po każdej porażce.",h,"hades","♛")+
 card("herkules","HERKULES","Faworyt modelu","Zwycięstwo faworyta modelu · EDGE 10–25 pp.",k,"herkules","⚔")+
 card("zeus","ZEUS","Król prostych zwycięstw","Faworyt modelu wygrywa 2:0.",z,"zeus","⚡")+
 card("hera","HERA","Strona modelu","Faworyt modelu wygrywa 2:0 lub 2:1.",he,"hera","👑")+'</div>'+
 '<div class="duel-stats"><div><small>MECZE VALUE</small><b>'+bets.length+'</b></div><div><small>HADES · TRAFIENIA</small><b>'+h.wins+' / '+h.placed+' · '+(h.placed?pct(h.accuracy):"—")+'</b></div><div><small>HERKULES · TRAFIENIA</small><b>'+k.wins+' / '+k.placed+' · '+(k.placed?pct(k.accuracy):"—")+'</b></div><div><small>ZEUS · TRAFIENIA</small><b>'+z.wins+' / '+z.placed+' · '+(z.placed?pct(z.accuracy):"—")+'</b></div><div><small>HERA · TRAFIENIA</small><b>'+he.wins+' / '+he.placed+' · '+(he.placed?pct(he.accuracy):"—")+'</b></div></div>'+
 charts+
 '<div class="table-scroll"><table class="duel-table"><thead><tr><th>Tour</th><th>Mecz</th><th>Wynik</th><th>Hades</th><th>Herkules</th><th>Zeus</th><th>Hera</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div><div class="duel-pagination"></div>';
 const pageSize=10;
 let page=Number(window.__duelResultsPage||0);
 const pageCount=Math.max(1,Math.ceil(latest.length/pageSize));
 page=Math.min(page,pageCount-1);window.__duelResultsPage=page;
 const tbody=root.querySelector(".duel-table tbody");
 if(tbody)tbody.innerHTML=latest.slice(page*pageSize,(page+1)*pageSize).map(({r,items})=>
  '<tr><td><span class="duel-tour">'+esc(r.tour)+'</span></td><td><b>'+esc(r.player_a)+' – '+esc(r.player_b)+'</b></td><td><b>'+score(r)+'</b></td>'+
  '<td>'+badge(items.hades)+'</td>'+
  '<td>'+badge(items.herkules)+'</td>'+
  '<td>'+badge(items.zeus)+'</td>'+
  '<td>'+badge(items.hera)+'</td></tr>'
 ).join("")||'<tr><td colspan="7" class="empty">Brak rozliczonych meczów VALUE.</td></tr>';
 root.querySelectorAll(".duel-strategy-chart").forEach(chart=>{
  const choose=()=>{const next=chart.dataset.strategy;if(next===window.__duelSelectedStrategy)return;window.__duelSelectedStrategy=next;window.__duelResultsPage=0;renderDuel();};
  chart.addEventListener("click",choose);
  chart.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
 });
 const pager=root.querySelector(".duel-pagination");
 if(pager){pager.innerHTML='<button type="button" id="duel-prev" '+(page===0?'disabled':'')+'>← Poprzednie</button><span>Strona '+(page+1)+' / '+pageCount+' · '+latest.length+' wyników</span><button type="button" id="duel-next" '+(page>=pageCount-1?'disabled':'')+'>Następne →</button>';
  pager.querySelector("#duel-prev").addEventListener("click",()=>{window.__duelResultsPage=Math.max(0,page-1);renderDuel()});
  pager.querySelector("#duel-next").addEventListener("click",()=>{window.__duelResultsPage=Math.min(pageCount-1,page+1);renderDuel()});
 }
}
