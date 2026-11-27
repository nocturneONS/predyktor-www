"use strict";
function renderDuel(){
 const root=document.getElementById("duel-panel");
 if(!root)return;
 const rows=(window.__predyktorSettled||[]).filter(r=>
   r.status==="settled" && r.result_type==="regular" &&
   r.market_analysis&&r.market_analysis.is_value===true
 ).filter(r=>{
   const a=Number(r.set_score_a),b=Number(r.set_score_b);
   return Number.isInteger(a)&&Number.isInteger(b)&&[[2,0],[0,2],[2,1],[1,2]].some(([x,y])=>a===x&&b===y);
  })
  .sort((a,b)=>new Date(a.kickoff_utc||a.match_date)-new Date(b.kickoff_utc||b.match_date));
 const start=1000, rules={hades:{stake:100,odds:2.25},herkules:{stake:50,odds:3.5},zeus:{stake:100,odds:1.6},hera:{stake:100,odds:2.0}};
 const bets=rows.map(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b),sets=a+b,side=r.market_favorite_side;
  const modelSide=r.model_favorite_side;
  const hadesWin=sets===3;
  const herkulesWin=(side==="A"&&a===2&&b===1)||(side==="B"&&b===2&&a===1);
  const zeusWin=(side==="A"&&a===2&&b===0)||(side==="B"&&b===2&&a===0);
  const heraWin=(modelSide==="A"&&a===2&&b<=1)||(modelSide==="B"&&b===2&&a<=1);
  return {...r,sets,hadesWin,herkulesWin,zeusWin,heraWin};
 });
 const calc=(key)=>{
  let bank=start,wins=0,profit=0;
  const history=[start];
  for(const r of bets){const won=r[key];const delta=won?rules[key].stake*(rules[key].odds-1):-rules[key].stake;bank+=delta;profit+=delta;if(won)wins++;history.push(bank)}
  return {bank,wins,profit,history,count:bets.length,accuracy:bets.length?wins/bets.length:0,roi:profit/(bets.length*rules[key].stake||1)};
 };
 const h=calc("hades"),k=calc("herkules"),z=calc("zeus"),he=calc("hera"),fmt=v=>Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2}),pct=v=>(v*100).toFixed(1)+"%",signed=v=>(v>0?"+":"")+fmt(v),esc=v=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const path=(values)=>{
  if(values.length<2)return "";
  const min=Math.min(start,...values),max=Math.max(start,...values),range=max-min||1,w=700,hg=145;
  return values.map((v,i)=>(i?"L":"M")+(i/(values.length-1)*w).toFixed(1)+" "+(hg-(v-min)/range*hg).toFixed(1)).join(" ");
 };
 const latest=bets.slice().reverse();
 const score=(r)=>r.set_score_a+":"+r.set_score_b;
 const sideName=(r)=>r.market_favorite_side==="A"?r.player_a:r.market_favorite_side==="B"?r.player_b:"—";
 const badge=(win,delta)=>'<span class="duel-result '+(win?"won":"lost")+'">'+(win?"✓ WYGRANA":"✕ PRZEGRANA")+' <b>'+(delta>0?"+":"")+fmt(delta)+' j</b></span>';
 const rowsHtml=latest.length?latest.map(r=>{
  const hd=r.hadesWin?rules.hades.stake*(rules.hades.odds-1):-rules.hades.stake;
  const hw=r.herkulesWin?rules.herkules.stake*(rules.herkules.odds-1):-rules.herkules.stake;
  const zd=r.zeusWin?rules.zeus.stake*(rules.zeus.odds-1):-rules.zeus.stake;
  const hed=r.heraWin?rules.hera.stake*(rules.hera.odds-1):-rules.hera.stake;
  const modelName=r.model_favorite_side==="A"?r.player_a:r.model_favorite_side==="B"?r.player_b:"—";
  return '<tr><td>'+esc(r.match_date||r.kickoff_utc?.slice(0,10))+'</td><td><span class="duel-tour">'+esc(r.tour)+'</span></td><td><b>'+esc(r.player_a)+' – '+esc(r.player_b)+'</b><small>'+esc(r.tourney_name||r.league||"")+'</small></td><td><b>'+score(r)+'</b><small>'+r.sets+' sety</small></td><td>'+badge(r.hadesWin,hd)+'</td><td>'+badge(r.herkulesWin,hw)+'</td><td>'+badge(r.zeusWin,zd)+'<small>Typ: '+esc(sideName(r))+' 2:0</small></td><td>'+badge(r.heraWin,hed)+'<small>Typ: '+esc(modelName)+' 2:0 / 2:1</small></td></tr>';
 }).join(""):'<tr><td colspan="6" class="empty">Brak rozliczonych meczów VALUE. Symulacja ruszy po pierwszych wynikach.</td></tr>';
 const chart='<svg class="duel-chart" viewBox="0 0 700 175" role="img" aria-label="Przebieg bankrolla czterech person"><line x1="0" y1="145" x2="700" y2="145"/><line x1="0" y1="72" x2="700" y2="72"/><path class="hades-line" d="'+path(h.history)+'"/><path class="herkules-line" d="'+path(k.history)+'"/><path class="zeus-line" d="'+path(z.history)+'"/><path class="hera-line" d="'+path(he.history)+'"/></svg>';
 root.innerHTML='<div class="section-title"><div><p class="eyebrow">SIMULATED VALUE BETTING</p><h2>⚔️ Pojedynek typerów — 4 persony</h2><p class="sub">Fikcyjny bankroll · wyłącznie kompletne mecze VALUE</p></div><span class="pill">'+bets.length+' zakładów na osobę</span></div>'+
 '<div class="duel-rules"><span>HADES · dowolny wynik 3-setowy · kurs 2.25 · 100 j</span><span>HERKULES · faworyt rynku 2:1 · kurs 3.50 · 50 j</span><span>ZEUS · faworyt rynku 2:0 · kurs 1.60 · 100 j</span><span>HERA · faworyt modelu 2:0 lub 2:1 · kurs 2.00 · 100 j</span></div>'+
 '<div class="duel-grid"><article class="duel-card hades"><div class="duel-avatar">♛</div><div><div class="duel-name">HADES</div><div class="duel-tag">Łowca trzeciego seta</div><div class="duel-rule">Wygrywa, gdy mecz kończy się wynikiem 2:1 lub 1:2.</div></div><div class="duel-bank">'+fmt(h.bank)+' <small>j</small></div><div class="duel-profit '+(h.profit>=0?"positive":"negative")+'">'+signed(h.profit)+' j · ROI '+pct(h.roi)+'</div><small>'+h.wins+'/'+h.count+' trafień · '+pct(h.accuracy)+'</small></article>'+
 '<article class="duel-card herkules"><div class="duel-avatar">⚔</div><div><div class="duel-name">HERKULES</div><div class="duel-tag">Obrońca faworyta rynku</div><div class="duel-rule">Wygrywa tylko, gdy faworyt rynku zwycięża 2:1.</div></div><div class="duel-bank">'+fmt(k.bank)+' <small>j</small></div><div class="duel-profit '+(k.profit>=0?"positive":"negative")+'">'+signed(k.profit)+' j · ROI '+pct(k.roi)+'</div><small>'+k.wins+'/'+k.count+' trafień · '+pct(k.accuracy)+'</small></article>'+
 '<article class="duel-card zeus"><div class="duel-avatar">⚡</div><div><div class="duel-name">ZEUS</div><div class="duel-tag">Król prostych zwycięstw</div><div class="duel-rule">Stawia na faworyta rynku 2:0. Kurs 1.60, stawka 100 j.</div></div><div class="duel-bank">'+fmt(z.bank)+' <small>j</small></div><div class="duel-profit '+(z.profit>=0?"positive":"negative")+'">'+signed(z.profit)+' j · ROI '+pct(z.roi)+'</div><small>'+z.wins+'/'+z.count+' trafień · '+pct(z.accuracy)+'</small></article>'+
 '<article class="duel-card hera"><div class="duel-avatar">👑</div><div><div class="duel-name">HERA</div><div class="duel-tag">Strona modelu</div><div class="duel-rule">Stawia na faworyta modelu. Wygrywa przy 2:0 lub 2:1. Kurs 2.00, stawka 100 j.</div></div><div class="duel-bank">'+fmt(he.bank)+' <small>j</small></div><div class="duel-profit '+(he.profit>=0?"positive":"negative")+'">'+signed(he.profit)+' j · ROI '+pct(he.roi)+'</div><small>'+he.wins+'/'+he.count+' trafień · '+pct(he.accuracy)+'</small></article></div>'+
 '<div class="duel-stats"><div><small>ROZLICZONE VALUE</small><b>'+bets.length+'</b></div><div><small>HADES · TRAFIENIA</small><b>'+h.wins+' / '+h.count+' · '+pct(h.accuracy)+'</b></div><div><small>HERKULES · TRAFIENIA</small><b>'+k.wins+' / '+k.count+' · '+pct(k.accuracy)+'</b></div><div><small>ZEUS · TRAFIENIA</small><b>'+z.wins+' / '+z.count+' · '+pct(z.accuracy)+'</b></div><div><small>HERA · TRAFIENIA</small><b>'+he.wins+' / '+he.count+' · '+pct(he.accuracy)+'</b></div></div>'+
 '<div class="duel-chart-wrap"><div class="duel-chart-head"><b>Przebieg bankrolla</b><span><i class="legend-h"></i> Hades <i class="legend-k"></i> Herkules <i class="legend-z"></i> Zeus <i class="legend-he"></i> Hera</span></div>'+chart+'</div>'+
 '<div class="table-scroll"><table class="duel-table"><thead><tr><th>Data</th><th>Tour</th><th>Mecz</th><th>Wynik</th><th>Hades · 3 sety</th><th>Herkules · rynek 2:1</th><th>Zeus · rynek 2:0</th><th>Hera · model 2:0 / 2:1</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'+
 '<p class="hint">Start: 1000 j każdy. Hades: +125/−100 j (kurs 2.25, stawka 100 j). Herkules: +125/−50 j (kurs 3.50, stawka 50 j). Zeus: +60/−100 j (kurs 1.60, stawka 100 j). Hera: +100/−100 j (kurs 2.00, stawka 100 j). Każda persona zawiera zakład na każdy kompletny mecz VALUE. Bez prowizji i zmiany stawek. Walkowery, krecz i niepełne wyniki są pomijane.</p>';
}