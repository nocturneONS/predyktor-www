"use strict";
function renderDuel(){
 const root=document.getElementById("duel-panel");if(!root)return;
 const hasMedical=r=>[r.mto_a_days_ago,r.mto_b_days_ago].some(v=>v!=null&&Number.isFinite(Number(v)));
 const rows=(window.__predyktorSettled||[]).filter(r=>!hasMedical(r)&&
  r.status==="settled"&&r.result_type==="regular"&&r.market_analysis&&r.market_analysis.is_value===true
 ).filter(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b);
  return Number.isInteger(a)&&Number.isInteger(b)&&[[2,0],[0,2],[2,1],[1,2]].some(([x,y])=>a===x&&b===y);
 }).sort((a,b)=>new Date(a.kickoff_utc||a.match_date)-new Date(b.kickoff_utc||b.match_date));
 const start=1000;
 const rules={
  hades:{stake:100,odds:2.3,label:"Hades",condition:"3 sety",edge:"EDGE 5–15 pp",stakeMode:"Stawka ×2 po porażce",oddsNote:"Kurs 2,30 — założenie symulacyjne"},
  zeus:{stake:50,odds:4.0,label:"Zeus",condition:"Modelowy faworyt 2:0",edge:"EDGE 15–25 pp",stakeMode:"Flat stake",oddsNote:"Kurs 4,00 — założenie symulacyjne"},
  hera:{stake:100,odds:null,label:"Hera",condition:"Modelowy faworyt wygra",edge:"EDGE 5–25 pp",stakeMode:"Stawka ×2 po porażce",oddsNote:"Kurs zwycięzcy"}
 };
 const fmt=v=>Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2});
 const pct=v=>(v*100).toFixed(1)+"%";
 const signed=v=>(v>0?"+":"")+fmt(v);
 const esc=v=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const bets=rows.map(r=>{
  const a=Number(r.set_score_a),b=Number(r.set_score_b),gap=Math.abs(Number(r.model_probability_a)-Number(r.market_probability_a)),side=r.model_favorite_side;
  return {...r,edgeGap:Number.isFinite(gap)?gap:null,
   hadesWin:a+b===3,
   zeusWin:(side==="A"&&a===2&&b===0)||(side==="B"&&b===2&&a===0),
   heraWin:(side==="A"&&a===2&&b<=1)||(side==="B"&&b===2&&a<=1),
   heraOdds:Number(side==="A"?r.odds_a:side==="B"?r.odds_b:NaN)
  };
 });
 function eligible(key,r){
  const g=r.edgeGap;
  if(!Number.isFinite(g))return false;
  if(key==="hades")return g>=.05&&g<.15;
  if(key==="zeus")return g>=.15&&g<.25;
  return g>=.05&&g<.25&&Number.isFinite(r.heraOdds)&&r.heraOdds>1;
 }
 function simulate(key){
  const rule=rules[key];let bank=start,profit=0,turnover=0,wins=0,placed=0,lossStreak=0;
  const history=[0],items=[];
  for(const r of bets){
   if(!eligible(key,r))continue;
   const stake=rule.stake*Math.pow(2, key==="zeus"?0:lossStreak);
   if(bank<stake)continue;
   const odds=key==="hera"?r.heraOdds:rule.odds;
   const won=key==="hades"?r.hadesWin:key==="zeus"?r.zeusWin:r.heraWin;
   const delta=won?stake*(odds-1):-stake;
   bank+=delta;profit+=delta;turnover+=stake;placed++;if(won)wins++;
   items.push({...r,stake,odds,delta,won,lossStreakBefore:lossStreak,bank,profit});
   if(key!=="zeus")lossStreak=won?0:lossStreak+1;
   history.push(profit);
  }
  return {bank,profit,turnover,wins,placed,history,items,accuracy:placed?wins/placed:0,roi:turnover?profit/turnover:null,lossStreak};
 }
 const results={hades:simulate("hades"),zeus:simulate("zeus"),hera:simulate("hera")};
 const chart=(key,res)=>{
  const values=res.history, w=700,h=210,left=62,right=14,top=14,bottom=35,plotW=w-left-right,plotH=h-top-bottom;
  const min=Math.min(0,...values),max=Math.max(0,...values),pad=(max-min)*.12||100,lo=min-pad,hi=max+pad,range=hi-lo||1;
  const x=i=>left+(values.length<=1?0:i/(values.length-1)*plotW),y=v=>top+(hi-v)/range*plotH;
  const path=values.map((v,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(v).toFixed(1)).join(" ");
  const ticks=Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4);
  const yGrid=ticks.map(v=>'<g><line class="duel-gridline" x1="'+left+'" y1="'+y(v)+'" x2="'+(w-right)+'" y2="'+y(v)+'"/><text class="duel-axis-label" x="'+(left-9)+'" y="'+(y(v)+3)+'" text-anchor="end">'+Math.round(v).toLocaleString("pl-PL")+'</text></g>').join("");
  const xMarks=[0,Math.floor((values.length-1)/2),Math.max(0,values.length-1)].filter((v,i,a)=>a.indexOf(v)===i);
  const xLabels=xMarks.map(i=>'<text class="duel-axis-label" x="'+x(i)+'" y="'+(h-10)+'" text-anchor="middle">'+i+'</text>').join("");
  const line=key==="hades"?"hades-line":key==="zeus"?"zeus-line":"hera-line";
  return '<svg class="duel-chart" viewBox="0 0 700 210" role="img" aria-label="'+rules[key].label+' — skumulowany zysk po kolejnych zakładach"><text class="duel-axis-title" x="12" y="12">ZYSK (j)</text>'+yGrid+'<line class="duel-zero" x1="'+left+'" y1="'+y(0)+'" x2="'+(w-right)+'" y2="'+y(0)+'"/><path class="'+line+'" d="'+path+'"/>'+values.map((v,i)=>'<circle class="duel-point '+line+'" cx="'+x(i)+'" cy="'+y(v)+'" r="'+(i===values.length-1?3.5:2)+'"/>').join("")+xLabels+'<text class="duel-axis-title" x="'+(w-right)+'" y="'+(h-1)+'" text-anchor="end">KOLEJNY ZAKŁAD</text></svg>';
 };
 const card=(key,res,cls,avatar)=>{
  const rule=rules[key];
  return '<article class="duel-card '+cls+'"><div class="duel-card-main"><div class="duel-name">'+rule.label.toUpperCase()+'</div><div class="duel-tag">'+rule.condition+'</div><div class="duel-tag">'+rule.edge+'</div><div class="duel-rule">Stawka bazowa '+rule.stake+' j</div><div class="duel-rule">'+rule.stakeMode+'</div><div class="duel-odds-note">'+rule.oddsNote+'</div><div class="duel-bank">'+fmt(res.bank)+' <small>j</small></div></div><div class="duel-avatar"><img src="data/'+key+'.png" alt="'+rule.label+'" loading="lazy"></div></article>';
 };
 const chartCard=(key,res,cls)=>{
  return '<article class="duel-chart-card '+cls+'"><div class="duel-chart-heading"><div><h3>'+rules[key].label+'</h3><p>'+rules[key].condition+'</p></div><strong class="'+(res.profit>=0?"positive":"negative")+'">'+signed(res.profit)+' j</strong></div>'+chart(key,res)+'<div class="duel-chart-footer"><span>Start: 0 j zysku</span><span>'+res.placed+' zakładów</span><span>Końcowy zysk: '+signed(res.profit)+' j</span></div></article>';
 };
 const allItems=Object.fromEntries(Object.keys(rules).map(k=>[k,results[k].items]));
 const latest=bets.map(r=>({r,items:Object.fromEntries(Object.keys(rules).map(k=>[k,allItems[k].find(x=>x.id===r.id)]))})).filter(({items})=>Object.values(items).some(Boolean)).reverse();
 const score=r=>r.set_score_a+":"+r.set_score_b;
 const badge=item=>!item?'<span class="duel-result no-bet">—</span>':'<span class="duel-result '+(item.won?"won":"lost")+'"><b>'+(item.won?"+":"")+fmt(item.delta)+' j</b><small>'+fmt(item.stake)+' j stawki</small></span>';
 const table=latest.length?latest.map(({r,items})=>'<tr><td><span class="duel-tour">'+esc(r.tour)+'</span></td><td><b>'+esc(r.player_a)+' – '+esc(r.player_b)+'</b></td><td><b>'+score(r)+'</b></td><td>'+badge(items.hades)+'</td><td>'+badge(items.zeus)+'</td><td>'+badge(items.hera)+'</td></tr>').join(""):'<tr><td colspan="6" class="empty">Brak meczów z postawionymi zakładami.</td></tr>';
 root.innerHTML='<div class="section-title"><div><p class="eyebrow">SIMULATED VALUE BETTING</p><h2>Symulacje · 3 persony</h2><p class="sub">Chronologiczna symulacja kompletnego zbioru VALUE · start 1000 j na personę</p></div><span class="pill">'+bets.length+' meczów VALUE</span></div>'+
 '<div class="duel-grid">'+card("hades",results.hades,"hades","♛")+card("zeus",results.zeus,"zeus","⚡")+card("hera",results.hera,"hera","👑")+'</div>'+
 
 '<div class="duel-charts">'+chartCard("hades",results.hades,"hades-chart")+chartCard("zeus",results.zeus,"zeus-chart")+chartCard("hera",results.hera,"hera-chart")+'</div>'+
 '<div class="section-title duel-history-title"><div><p class="eyebrow">BET LOG</p><h2>Rozliczone mecze i stawki</h2></div></div><div class="table-scroll"><table class="duel-table"><thead><tr><th>Tour</th><th>Mecz</th><th>Wynik</th><th><span class="duel-th-persona"><img src="data/hades.png" alt="">Hades</span></th><th><span class="duel-th-persona"><img src="data/zeus.png" alt="">Zeus</span></th><th><span class="duel-th-persona"><img src="data/hera.png" alt="">Hera</span></th></tr></thead><tbody>'+table+'</tbody></table></div>';
 const detailRoot=document.getElementById("persona-detail");
 const selected=window.__predyktorPersonaDetail;
 if(detailRoot){
  if(!selected||!results[selected]){detailRoot.hidden=true;detailRoot.innerHTML="";}
  else{
   const rule=rules[selected],res=results[selected],cls=selected;
   const historyRows=res.items.map(item=>{
    const date=new Date(item.kickoff_utc||item.match_date);
    const dateText=Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("pl-PL",{timeZone:"Europe/Warsaw",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
    return '<tr><td>'+dateText+'</td><td><b>'+esc(item.player_a)+' – '+esc(item.player_b)+'</b></td><td>'+score(item)+'</td><td>'+fmt(item.stake)+' j</td><td class="'+(item.won?"positive":"negative")+'">'+(item.won?"+":"")+fmt(item.delta)+' j</td></tr>';
   }).join("");
   detailRoot.hidden=false;
   detailRoot.innerHTML='<div class="persona-detail-heading"><div><p class="eyebrow">SZCZEGÓŁY STRATEGII</p><h2>'+rule.label+'</h2></div><button type="button" class="persona-detail-close" aria-label="Zamknij szczegóły">×</button></div>'+
    '<div class="persona-detail-layout"><div class="persona-detail-chart '+cls+'"><div class="persona-detail-chart-head"><b>Wynik strategii</b><strong>'+signed(res.profit)+' j</strong></div>'+chart(selected,res)+'</div>'+
    '<div class="persona-detail-info"><div class="persona-detail-kpis"><div><small>BANKROLL</small><b>'+fmt(res.bank)+' j</b></div><div><small>ROI</small><b>'+(res.roi===null?"—":pct(res.roi))+'</b></div><div><small>SKUTECZNOŚĆ</small><b>'+(res.placed?pct(res.accuracy):"—")+'</b></div><div><small>ZAKŁADY</small><b>'+res.placed+' · '+res.wins+' trafień</b></div></div>'+
    '<div class="persona-detail-rules"><b>'+rule.condition+'</b><span>'+rule.edge+'</span><span>Stawka bazowa '+rule.stake+' j · '+rule.stakeMode+'</span><span>'+rule.oddsNote+'</span></div>'+
    '<div class="persona-detail-history"><h3>Historia typów</h3><div class="table-scroll"><table class="duel-table"><thead><tr><th>Data</th><th>Mecz</th><th>Wynik</th><th>Stawka</th><th>Rozliczenie</th></tr></thead><tbody>'+(historyRows||'<tr><td colspan="5" class="empty">Brak postawionych zakładów.</td></tr>')+'</tbody></table></div></div></div></div>';
   const close=detailRoot.querySelector(".persona-detail-close");
   if(close)close.addEventListener("click",()=>{
    window.__predyktorPersonaDetail=null;detailRoot.hidden=true;detailRoot.innerHTML="";
    document.querySelectorAll(".edge-persona-card").forEach(card=>{card.classList.remove("selected");card.setAttribute("aria-expanded","false")});
   });
  }
 }
}
