"use strict";
function renderDuel(){
 const root=document.getElementById("duel-panel");
 if(!root)return;
 const mode=window.__duelMode||"flat";
 const rows=(window.__predyktorSettled||[]).filter(r=>
  r.status==="settled"&&r.result_type==="regular"&&r.market_analysis&&r.market_analysis.is_value===true
 ).filter(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b);
  return Number.isInteger(a)&&Number.isInteger(b)&&[[2,0],[0,2],[2,1],[1,2]].some(([x,y])=>a===x&&b===y);
 }).sort((a,b)=>new Date(a.kickoff_utc||a.match_date)-new Date(b.kickoff_utc||b.match_date));
 const start=1000;
 const rules={
  hades:{stake:100,odds:2.25,label:"Hades"},
  herkules:{stake:50,odds:3.5,label:"Herkules"},
  zeus:{stake:100,odds:1.6,label:"Zeus"},
  hera:{stake:100,odds:2,label:"Hera"}
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
   herkulesWin:(side==="A"&&a===2&&b===1)||(side==="B"&&b===2&&a===1),
   zeusWin:(side==="A"&&a===2&&b===0)||(side==="B"&&b===2&&a===0),
   heraWin:(modelSide==="A"&&a===2&&b<=1)||(modelSide==="B"&&b===2&&a<=1)
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
 function simulate(key,kind){
  const rule=rules[key];let bank=start,wins=0,profit=0,turnover=0,placed=0;
  const history=[start],items=[];
  let alpha=20/rule.odds,beta=20-alpha;
  for(const r of bets){
   let stake=rule.stake;
   if(kind==="edge")stake=stakeForEdge(rule.stake,r.edgeGap);
   if(kind==="kelly"){
    const p=alpha/(alpha+beta);
    const fullKelly=Math.max(0,(rule.odds*p-1)/(rule.odds-1));
    stake=Math.min(bank*fullKelly*0.25,rule.stake*2);
   }
   if(kind==="kelly")stake=Math.max(0,Math.min(stake,Math.max(0,bank)));
   else if(bank<stake)stake=0;
   const placedBet=stake>0;
   const won=r[winField[key]]===true;
   const delta=placedBet?(won?stake*(rule.odds-1):-stake):0;
   if(placedBet){placed++;turnover+=stake;profit+=delta;bank+=delta;if(won)wins++;}
   items.push({...r,stake,delta,placedBet,won});
   history.push(bank);
   if(kind==="kelly"){
    if(won)alpha+=1;else beta+=1;
   }
  }
  return {bank,wins,profit,turnover,placed,history,items,count:bets.length,accuracy:placed?wins/placed:0,roi:turnover?profit/turnover:null};
 }
 const modes={flat:"Stała stawka",edge:"Stawka zależna od Edge",kelly:"¼ Kelly — kroczący"};
 const results={};
 for(const key of Object.keys(rules))results[key]=simulate(key,mode);
 const h=results.hades,k=results.herkules,z=results.zeus,he=results.hera;
 const allHistory=Object.values(results).flatMap(x=>x.history);
 const path=values=>{
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
  '<tr><td>'+esc(r.match_date||r.kickoff_utc?.slice(0,10))+'</td><td><span class="duel-tour">'+esc(r.tour)+'</span></td><td><b>'+esc(r.player_a)+' – '+esc(r.player_b)+'</b><small>'+esc(r.tourney_name||r.league||"")+'</small></td><td><b>'+score(r)+'</b><small>'+r.sets+' sety</small></td>'+
  '<td>'+badge(items.hades)+'<small>'+(items.hades.placedBet?fmt(items.hades.stake)+' j stawki':'')+'</small></td>'+
  '<td>'+badge(items.herkules)+'<small>'+(items.herkules.placedBet?fmt(items.herkules.stake)+' j stawki':'')+'</small></td>'+
  '<td>'+badge(items.zeus)+'<small>'+(items.zeus.placedBet?fmt(items.zeus.stake)+' j stawki':'')+' · '+esc(sideName(r))+' 2:0</small></td>'+
  '<td>'+badge(items.hera)+'<small>'+(items.hera.placedBet?fmt(items.hera.stake)+' j stawki':'')+' · '+esc(modelName(r))+' 2:0 / 2:1</small></td></tr>'
 ).join(""):'<tr><td colspan="8" class="empty">Brak rozliczonych meczów VALUE.</td></tr>';
 const chart='<svg class="duel-chart" viewBox="0 0 700 175" role="img" aria-label="Przebieg bankrolla czterech person"><line x1="0" y1="145" x2="700" y2="145"/><line x1="0" y1="72" x2="700" y2="72"/><path class="hades-line" d="'+path(h.history)+'"/><path class="herkules-line" d="'+path(k.history)+'"/><path class="zeus-line" d="'+path(z.history)+'"/><path class="hera-line" d="'+path(he.history)+'"/></svg>';
 const card=(key,title,tag,ruleText,res,cls,avatar)=>
  '<article class="duel-card '+cls+'"><div class="duel-avatar">'+avatar+'</div><div><div class="duel-name">'+title+'</div><div class="duel-tag">'+tag+'</div><div class="duel-rule">'+ruleText+'</div></div><div class="duel-bank">'+fmt(res.bank)+' <small>j</small></div><div class="duel-profit '+(res.profit>=0?"positive":"negative")+'">'+signed(res.profit)+' j · ROI '+(res.roi===null?"—":pct(res.roi))+'</div><small>'+res.wins+'/'+res.placed+' trafień · '+(res.placed?pct(res.accuracy):"—")+' · '+res.placed+'/'+bets.length+' zakładów</small></article>';
 const totalPlaced=Object.values(results).reduce((s,x)=>s+x.placed,0);
 root.innerHTML='<div class="section-title"><div><p class="eyebrow">SIMULATED VALUE BETTING</p><h2>⚔️ Pojedynek typerów — 4 persony</h2><p class="sub">Wyłącznie kompletne mecze VALUE · start 1000 j na personę</p></div><span class="pill">'+bets.length+' meczów VALUE</span></div>'+
 '<div class="duel-rules"><span>HADES · 3 sety · kurs 2.25 · baza 100 j</span><span>HERKULES · rynek 2:1 · kurs 3.50 · baza 50 j</span><span>ZEUS · rynek 2:0 · kurs 1.60 · baza 100 j</span><span>HERA · model 2:0/2:1 · kurs 2.00 · baza 100 j</span></div>'+
 '<div class="duel-grid">'+
 card("hades","HADES","Łowca trzeciego seta","Wygrywa przy 2:1 lub 1:2.",h,"hades","♛")+
 card("herkules","HERKULES","Obrońca faworyta rynku","Wygrywa, gdy faworyt rynku zwycięża 2:1.",k,"herkules","⚔")+
 card("zeus","ZEUS","Król prostych zwycięstw","Faworyt rynku wygrywa 2:0.",z,"zeus","⚡")+
 card("hera","HERA","Strona modelu","Faworyt modelu wygrywa 2:0 lub 2:1.",he,"hera","👑")+'</div>'+
 '<div class="duel-stats"><div><small>MECZE VALUE</small><b>'+bets.length+'</b></div><div><small>HADES · TRAFIENIA</small><b>'+h.wins+' / '+h.placed+' · '+(h.placed?pct(h.accuracy):"—")+'</b></div><div><small>HERKULES · TRAFIENIA</small><b>'+k.wins+' / '+k.placed+' · '+(k.placed?pct(k.accuracy):"—")+'</b></div><div><small>ZEUS · TRAFIENIA</small><b>'+z.wins+' / '+z.placed+' · '+(z.placed?pct(z.accuracy):"—")+'</b></div><div><small>HERA · TRAFIENIA</small><b>'+he.wins+' / '+he.placed+' · '+(he.placed?pct(he.accuracy):"—")+'</b></div></div>'+
 '<div class="duel-chart-wrap"><div class="duel-chart-head"><div><b>Przebieg bankrolla</b><label class="duel-mode-label" for="duel-mode">Sposób rozliczania stawek</label></div><select id="duel-mode" class="duel-mode-select"><option value="flat" '+(mode==="flat"?"selected":"")+'>A · Flat stake</option><option value="edge" '+(mode==="edge"?"selected":"")+'>B · Edge-based stake</option><option value="kelly" '+(mode==="kelly"?"selected":"")+'>C · Fractional Kelly (¼)</option></select></div>'+
 '<div class="duel-mode-description">'+(mode==="flat"?"Stała stawka bazowa w każdym meczu VALUE. Punkt odniesienia do porównań.":mode==="edge"?"Stawka zależy od różnicy prawdopodobieństwa modelu i rynku: poniżej 5 pp = brak zakładu; następnie ¼, ½, ¾, 1× lub 1,25× stawki bazowej.":"¼ Kelly liczony krocząco z wcześniejszych trafień danej persony. Estymacja startuje od 20 obserwacji-priorów na poziomie progu rentowności; stawka ograniczona do 2× bazy. Bez używania wyniku bieżącego meczu do wyliczenia jego stawki.")+'</div>'+
 '<div class="duel-chart-head"><span><i class="legend-h"></i> Hades <i class="legend-k"></i> Herkules <i class="legend-z"></i> Zeus <i class="legend-he"></i> Hera</span><span>'+totalPlaced+' zakładów łącznie</span></div>'+chart+'</div>'+
 '<div class="table-scroll"><table class="duel-table"><thead><tr><th>Data</th><th>Tour</th><th>Mecz</th><th>Wynik</th><th>Hades</th><th>Herkules</th><th>Zeus</th><th>Hera</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'+
 '<p class="hint">ROI = zysk netto / suma faktycznie postawionych stawek. W Edge-based stake próg i mnożniki są eksperymentalne. Kelly korzysta z kroczącej estymacji skuteczności konkretnej persony, a nie z prawdopodobieństwa wygrania meczu przez faworyta — dostępne dane nie zawierają jeszcze prawdopodobieństw dokładnych wyników setowych. Wartości kursów są założeniami symulacji. Zakłady bez stawki nie wchodzą do mianownika ROI. Nie ma prowizji.</p>';
 const select=root.querySelector("#duel-mode");
 if(select)select.addEventListener("change",()=>{window.__duelMode=select.value;renderDuel();});
}
