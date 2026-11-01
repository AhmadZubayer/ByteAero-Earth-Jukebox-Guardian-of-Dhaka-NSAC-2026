const $ = id => document.getElementById(id);
const screens = ['home','story','frames','lab','quiz','game','future','pass'];
const announce = message => { $('announcer').textContent = message; };
let currentScreen = 'home';
function show(id){
  screens.forEach(name => $(name).classList.toggle('active',name===id));
  currentScreen=id;
  if(id==='frames'&&audio.on)resetFrameScan();
  window.scrollTo({top:0,behavior:'instant'});
  document.title = `${id==='home'?'Earth Jukebox':id[0].toUpperCase()+id.slice(1)} — Guardian of Dhaka`;
  const heading=$(id).querySelector('h1,h2'); if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  announce(`${id} section`);
  updateAmbient();
}

const audio={ctx:null,on:false,osc:[],gain:[],pulse:null,nextBeat:0,master:null,echo:null};
function initAudio(){
  if(audio.ctx)return;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return;
  audio.ctx=new Ctx();
  const compressor=audio.ctx.createDynamicsCompressor();
  compressor.threshold.value=-20;compressor.knee.value=18;compressor.ratio.value=4;
  audio.master=audio.ctx.createGain();audio.master.gain.value=.62;
  audio.master.connect(compressor).connect(audio.ctx.destination);
  audio.echo=audio.ctx.createDelay(.5);audio.echo.delayTime.value=.24;
  const feedback=audio.ctx.createGain();feedback.gain.value=.17;
  const echoWet=audio.ctx.createGain();echoWet.gain.value=.2;
  audio.echo.connect(feedback).connect(audio.echo);
  audio.echo.connect(echoWet).connect(audio.master);
  for(let i=0;i<3;i++){let o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type=i===2?'triangle':'sine';g.gain.value=0;o.connect(g).connect(audio.master);o.start();audio.osc.push(o);audio.gain.push(g);}
  audio.pulse=setInterval(()=>{
    if(!audio.on||audio.ctx.state!=='running'||!['frames','lab','game'].includes(currentScreen))return;
    const now=audio.ctx.currentTime;
    if(currentScreen==='frames'){advanceFrameScan(now);return;}
    const params=getSoundParams();
    if(now<audio.nextBeat)return;
    audio.nextBeat=now+params.beatInterval;
    if(currentScreen==='lab')playRainTick(params.beatPitch,now);
    else playVoice(params.beatPitch,.07,0,'cool',.18,now);
  },45);
}
function playVoice(freq,volume,pan,timbre,duration=.4,at){
  if(!audio.on||!audio.ctx||volume<=0)return;
  const ctx=audio.ctx,t=at??ctx.currentTime;
  const mix=ctx.createGain(),envelope=ctx.createGain();
  const stereo=ctx.createStereoPanner?ctx.createStereoPanner():null;
  if(stereo){stereo.pan.value=pan;envelope.connect(stereo);stereo.connect(audio.master);stereo.connect(audio.echo);}
  else envelope.connect(audio.master);
  mix.connect(envelope);
  const attack=timbre==='warm'?.012:.045,release=timbre==='warm'?.62:.48;
  envelope.gain.setValueAtTime(.0001,t);
  envelope.gain.linearRampToValueAtTime(Math.min(volume,.22),t+attack);
  envelope.gain.exponentialRampToValueAtTime(.0001,t+duration+release);
  const partials=timbre==='warm'?
    [{ratio:1,type:'sine',level:1},{ratio:2.01,type:'sine',level:.3},{ratio:3.8,type:'sine',level:.08}]:
    [{ratio:1,type:'triangle',level:1},{ratio:1.5,type:'sine',level:.16}];
  for(const part of partials){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=part.type;osc.frequency.value=freq*part.ratio;gain.gain.value=part.level;
    osc.connect(gain).connect(mix);osc.start(t);osc.stop(t+duration+release+.04);
  }
}
function playRainTick(freq,at){
  const ctx=audio.ctx;
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='triangle';osc.frequency.setValueAtTime(freq,at);osc.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.52),at+.09);
  gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.065,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
  osc.connect(gain).connect(audio.master);osc.start(at);osc.stop(at+.13);
}
function getSoundParams(){
  if(currentScreen==='frames'){
    const warmth=frameStats[frameIndex]??(frameIndex===0?.3:.8);
    return {pitch:180+warmth*390,beatPitch:95+warmth*100,beatInterval:.94-warmth*.52,volume:.055+warmth*.04,chord:1.25+warmth*.25};
  }
  if(currentScreen==='lab'){
    const h=+$('heatSlider').value,r=+$('rainSlider').value,g=+$('greenSlider').value;
    return {pitch:185+h*3,beatPitch:80+r*1.6,beatInterval:1.1-r*.0085,volume:.05+(h/100)*.04,chord:g<30?1.414:1.5};
  }
  if(currentScreen==='game')return {pitch:240+getRoundDanger()*45,beatPitch:115+getRoundDanger()*12,beatInterval:.78-getRoundDanger()*.035,volume:.06,chord:1.5};
  return {pitch:220,beatPitch:110,beatInterval:.8,volume:0,chord:1.5};
}
function updateAmbient(){
  if(!audio.ctx)return;
  const p=getSoundParams(),now=audio.ctx.currentTime,active=audio.on&&['lab','game'].includes(currentScreen);
  [p.pitch,p.pitch*p.chord,p.pitch/2].forEach((f,i)=>{
    audio.osc[i].frequency.setTargetAtTime(f,now,.12);
    audio.gain[i].gain.setTargetAtTime(active?p.volume*(i===0?.3:.12):0,now,.1);
  });
}
async function setSound(on){
  initAudio(); if(!audio.ctx){announce('Sound is unavailable in this browser. Written sound descriptions remain available.');return;}
  audio.on=on; if(on)await audio.ctx.resume();
  audio.nextBeat=0;
  frameScan.active=on;
  if(on&&currentScreen==='frames')resetFrameScan();
  if(!on)$('scanline').style.opacity='0';
  $('soundBtn').textContent=on?'♪ SOUND ON':'♪ SOUND OFF';$('soundBtn').setAttribute('aria-pressed',String(on));
  updateAmbient();announce(on?'Sound on':'Sound off');
}
function chirp(kind){
  if(!audio.on||!audio.ctx)return;
  const now=audio.ctx.currentTime;
  if(kind==='rain'){for(let i=0;i<5;i++)playRainTick(150,now+i*.13);return;}
  if(kind==='rainQuiet'){playRainTick(95,now);return;}
  const notes=kind==='heat'?[392,523,659]:kind==='greenLoss'?[262,277,370]:[262,330,392];
  notes.forEach((freq,i)=>playVoice(freq,kind==='heat'?.13:kind==='greenLoss'?.055:.09,(i-1)*.35,kind==='heat'?'warm':'cool',kind==='heat'?.13:.5,now+i*.2));
}
$('soundBtn').addEventListener('click',()=>setSound(!audio.on));
$('startBtn').addEventListener('click',()=>show('story'));
$('storyNext').addEventListener('click',()=>{playerName=$('playerName').value.trim().slice(0,20)||'Earth Explorer';show('frames');});
let playerName='Earth Explorer',frameIndex=0;
const frameStats=[null,null];
const frameBins=[null,null];
const frameScan={active:false,step:0,nextTime:0};
const frames=[
  {year:'1884',src:'assets/nasa-gistemp-1884.jpg',alt:'NASA global temperature anomaly frame for 1884, showing cooler and warmer areas relative to the 1951–1980 average.'},
  {year:'2022',src:'assets/nasa-gistemp-2022.jpg',alt:'NASA global temperature anomaly frame for 2022, with extensive red areas indicating warmth relative to the 1951–1980 average.'}
];
function resetFrameScan(){
  frameScan.step=0;frameScan.nextTime=0;
  $('scanline').style.left='0%';
  $('scanline').style.opacity=audio.on?'1':'0';
  $('scanProgress').textContent='SCAN 00%';
}
function advanceFrameScan(now){
  const bins=frameBins[frameIndex];
  if(!frameScan.active||!bins||now<frameScan.nextTime)return;
  const index=frameScan.step%bins.length,bin=bins[index];
  frameScan.nextTime=now+.14;
  const notes=[];
  for(let band=0;band<4;band++){
    const slot=bin[band],denom=slot.total||1,pan=-.85+1.7*index/(bins.length-1);
    const warm=slot.warm/denom,cool=slot.cool/denom;
    if(warm>.08)notes.push({freq:[784,659,523,392][band],volume:Math.min(.14,.02+warm*(slot.warmLight/(slot.warm||1))*.16),pan,timbre:'warm',duration:.16,density:warm});
    if(cool>.08)notes.push({freq:[392,330,262,196][band],volume:Math.min(.11,.02+cool*(slot.coolLight/(slot.cool||1))*.12),pan,timbre:'cool',duration:.3,density:cool});
  }
  notes.sort((a,b)=>b.density-a.density).slice(0,3).forEach(n=>playVoice(n.freq,n.volume,n.pan,n.timbre,n.duration,now));
  const progress=Math.round(index/(bins.length-1)*100);
  $('scanline').style.left=`${progress}%`;
  $('scanProgress').textContent=`SCAN ${String(progress).padStart(2,'0')}%`;
  frameScan.step++;
}
function analyzeFrame(){
  const img=$('eicFrame');if(!img.naturalWidth)return;
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(img,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  let warm=0,cool=0;
  const bins=Array.from({length:48},()=>Array.from({length:4},()=>({total:0,warm:0,cool:0,warmLight:0,coolLight:0})));
  for(let y=10;y<canvas.height-10;y+=7)for(let x=10;x<canvas.width-10;x+=7){
    const p=(y*canvas.width+x)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];
    if(r<65&&g<65&&b<65)continue;
    const column=Math.min(47,Math.floor(x/canvas.width*48)),band=Math.min(3,Math.floor(y/canvas.height*4));
    const slot=bins[column][band],light=(r+g+b)/765;
    slot.total++;
    if(r>b*1.22&&g>b*1.08){warm++;slot.warm++;slot.warmLight+=light;}
    else if(b>r*1.12&&b>g*.95){cool++;slot.cool++;slot.coolLight+=light;}
  }
  const ratio=warm/(warm+cool||1);
  frameStats[frameIndex]=ratio;frameBins[frameIndex]=bins;
  $('frameSound').textContent=`This frame has ${Math.round(ratio*100)}% warm-color pixels among the warm/cool pixels sampled. The scan moves left to right: warm colors ring like bright bells; cool colors sound like low, soft strings. Higher parts of the map make higher notes, and brighter pixels sound louder. This is an image-color share, not a temperature value.`;
  resetFrameScan();
  updateAmbient();
  announce(`${frames[frameIndex].year} frame analyzed. ${$('frameSound').textContent}`);
}
$('eicFrame').addEventListener('load',analyzeFrame);
if($('eicFrame').complete&&$('eicFrame').naturalWidth)analyzeFrame();
document.querySelectorAll('.frame-tab').forEach(btn=>btn.addEventListener('click',()=>{
  frameIndex=+btn.dataset.frame;
  const frame=frames[frameIndex];$('eicFrame').src=frame.src;$('eicFrame').alt=frame.alt;$('frameYear').textContent=frame.year;$('frameSound').textContent='Reading warm and cool colors in this NASA frame…';
  document.querySelectorAll('.frame-tab').forEach(b=>{const chosen=b===btn;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});
  resetFrameScan();updateAmbient();announce(`${frame.year} frame selected. Reading its colors.`);
}));
$('eicFrame').addEventListener('error',()=>{ $('eicFrame').style.display='none';$('frameSound').textContent='NASA frame could not load. Open the source link below to view it. The sound description remains available.';});
$('replayScan').addEventListener('click',async()=>{if(!audio.on)await setSound(true);resetFrameScan();announce('Replaying the frame from left to right.');});
$('frameNext').addEventListener('click',()=>show('lab'));

const labDone={heat:false,rain:false,calm:false};
let lastLabPreview=-1;
function updateLab(changed){
  const h=+$('heatSlider').value,r=+$('rainSlider').value,g=+$('greenSlider').value;
  ['heat','rain','green'].forEach(name=>$(name+'Value').textContent=$(name+'Slider').value);
  if(h>=75)labDone.heat=true;
  if(r>=75)labDone.rain=true;
  if(labDone.heat&&labDone.rain&&h>=25&&h<=45&&r>=25&&r<=45&&g>=55&&g<=75)labDone.calm=true;
  Object.keys(labDone).forEach(name=>document.querySelector(`[data-mission="${name}"]`).classList.toggle('done',labDone[name]));
  $('labNext').disabled=!Object.values(labDone).every(Boolean);
  let state='CALM CONDITIONS',desc='Middle notes, an even beat, and gentle chords.';
  if(h>=70){state='HEAT SIGNAL';desc='The melody rises and sounds sharper.';}
  else if(r>=70){state='HEAVY RAIN SIGNAL';desc='The drum beat speeds up.';}
  else if(g<=30){state='LOW GREEN SPACE';desc='The soft chord becomes thin and uneasy.';}
  $('labStatus').textContent=state;$('labDescription').textContent=desc;
  $('labPlanet').style.filter=`hue-rotate(${Math.round((h-35)*-.65)}deg) saturate(${1+Math.max(0,h-40)/90})`;
  $('labPlanet').style.boxShadow=`inset -75px -30px 100px #020817,0 0 60px ${h>70?'#ff665588':r>70?'#75dcfa88':'#6fdba755'}`;
  updateAmbient();announce(`${state}. ${desc}`);
  if(changed&&audio.on&&audio.ctx&&audio.ctx.currentTime-lastLabPreview>.18){
    lastLabPreview=audio.ctx.currentTime;
    if(changed==='heat')playVoice(220+h*4,.1,.15,'warm',.18);
    if(changed==='rain')playRainTick(85+r*1.2,audio.ctx.currentTime);
    if(changed==='green')chirp(g<30?'greenLoss':'green');
  }
}
['heat','rain','green'].forEach(name=>$(name+'Slider').addEventListener('input',()=>updateLab(name)));
$('labNext').addEventListener('click',()=>{quizIndex=0;quizScore=0;renderQuiz();show('quiz');});

const quizQuestions=[
  {kind:'heat',clue:'The melody climbs into high, sharp notes.'},
  {kind:'rain',clue:'The drum beats suddenly become very fast.'},
  {kind:'green',sound:'greenLoss',clue:'The gentle chord loses its fullness and sounds uneasy.'},
  {kind:'rain',sound:'rainQuiet',clue:'The steady drum becomes quiet: a rain signal has changed.'},
  {kind:'heat',clue:'A calm middle note rises to a brighter pitch.'}
];
let quizIndex=0,quizScore=0,quizTimeout;
function renderQuiz(){
  const q=quizQuestions[quizIndex];$('quizCount').textContent=`SOUND ${quizIndex+1} / 5`;$('quizScore').textContent=`${quizScore} CORRECT`;
  $('quizClue').textContent=q.clue;$('quizFeedback').textContent='Choose the Earth signal you hear or read.';
  document.querySelectorAll('.answers button').forEach(b=>b.disabled=false);
  $('quizContinue').classList.add('hidden');
  chirp(q.sound||q.kind);
}
$('replaySound').addEventListener('click',()=>{const q=quizQuestions[quizIndex];chirp(q.sound||q.kind);});
document.querySelectorAll('.answers button').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.disabled)return;
  const q=quizQuestions[quizIndex],correct=btn.dataset.answer===q.kind;
  if(correct)quizScore++;
  $('quizFeedback').textContent=correct?'Yes! You heard the signal.':`Good try. Hint: ${q.clue} The answer is ${q.kind==='green'?'green space':q.kind}.`;
  document.querySelectorAll('.answers button').forEach(b=>b.disabled=true);
  clearTimeout(quizTimeout);
  quizTimeout=setTimeout(()=>{
    if(quizIndex<4){quizIndex++;renderQuiz();return;}
    $('quizCount').textContent='PRACTICE COMPLETE';$('quizScore').textContent=`${quizScore} / 5 CORRECT`;
    $('quizClue').textContent=quizScore>=3?'The city is ready for you.':'Let’s listen again. You need three correct to unlock the city.';
    $('quizFeedback').textContent='';$('quizContinue').textContent=quizScore>=3?'GO TO DHAKA →':'TRY QUICK EARS AGAIN ↺';$('quizContinue').classList.remove('hidden');
  },1700);
}));
$('quizContinue').addEventListener('click',()=>{
  if(quizScore<3){quizIndex=0;quizScore=0;renderQuiz();return;}
  roundIndex=0;roundScores=[];startRound();show('game');
});

const rounds=[
  {year:2000,danger:2,budget:8,hot:1}, {year:2010,danger:3,budget:8,hot:4},
  {year:2020,danger:3,budget:9,hot:2}, {year:2024,danger:4,budget:9,hot:5},
  {year:2035,danger:4,budget:9,hot:0}, {year:2050,danger:5,budget:10,hot:3}
];
const heatMaps={
  2000:{date:'2000-04-15',src:'assets/nasa-modis-dhaka-lst-2000.png'},
  2010:{date:'2010-04-15',src:'assets/nasa-modis-dhaka-lst-2010.png'},
  2020:{date:'2020-04-15',src:'assets/nasa-modis-dhaka-lst-2020.png'},
  2024:{date:'2024-04-15',src:'assets/nasa-modis-dhaka-lst-2024.png'}
};
function updateHeatEvidence(year){
  const observedYear=year>2024?2024:year,map=heatMaps[observedYear],future=year>2024;
  $('heatMap').src=map.src;
  $('heatMap').alt=`NASA Terra MODIS eight-day daytime land surface temperature map covering Dhaka and nearby land, requested for April 15, ${observedYear}.${future?' This is an observed reference, not a future prediction.':''}`;
  $('heatMapDate').textContent=future?`APRIL 2024 REFERENCE FOR ${year}`:`APRIL ${year} OBSERVATION`;
  $('heatMapNote').textContent=future?'Observed 2024 reference for this imagined future round.':'Observed NASA image for this story year.';
  $('heatMapSource').href=`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=MODIS_Terra_L3_Land_Surface_Temp_8Day_Day&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=TRUE&SRS=EPSG%3A4326&BBOX=89.95%2C23.5%2C90.85%2C24.15&WIDTH=1000&HEIGHT=800&TIME=${map.date}`;
}
function getRoundDanger(){
  if(roundIndex!==5)return rounds[roundIndex].danger;
  return Math.max(2,rounds[5].danger+(energy==='coal'?1:-1)+(land==='concrete'?1:-1));
}
const districts=['Old Town','Riverside','North Gate','Market','Garden Ward','East Station'];
let roundIndex=0,roundScores=[],coins=0,selected=-1,protectedSet=new Set(),roundTimer=null,timeLeft=20,phase='find',fixes={},energy='clean',land='parks';
function startRound(){
  clearInterval(roundTimer);const round=rounds[roundIndex];
  updateHeatEvidence(round.year);
  coins=round.budget+(roundIndex===5?(energy==='clean'?1:-1)+(land==='parks'?1:-1):0);timeLeft=20;selected=-1;protectedSet=new Set();fixes={};phase='find';
  $('roundTag').textContent=`ROUND ${roundIndex+1} OF 6`;$('yearDisplay').textContent=round.year;$('coinDisplay').textContent=coins;$('timerDisplay').textContent='20s';
  $('phaseLabel').textContent='FIND';$('cityHint').textContent='Move across the imagined districts to find the game hotspot.';
  $('roundIntro').textContent=round.year>=2035?'A future scenario with a real 2024 NASA map for context. The district challenge is imagined.':'Explore a real NASA surface temperature map, then play an imagined district challenge.';
  $('echoTip').textContent='“Follow the brighter, higher game note. Tap the district you think needs help.”';
  $('choicesPanel').classList.add('hidden');$('roundResult').classList.add('hidden');$('roundAction').classList.add('hidden');
  $('city').innerHTML='';
  $('city').classList.toggle('future-hot',roundIndex===5&&getRoundDanger()>=6);
  $('city').classList.toggle('future-calm',roundIndex===5&&getRoundDanger()<=4);
  districts.forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className='district';b.dataset.index=i;b.setAttribute('aria-label',`${name} district`);b.innerHTML=`<span class="name">${name}</span><span class="badge">◇ GAME DISTRICT</span>`;const signal=()=>{if(phase!=='find')return;const warm=i===round.hot;$('cityHint').textContent=warm?`${name}: the imagined heat melody rises here.`:`${name}: the game sound is calmer here.`;announce($('cityHint').textContent);if(audio.on)chirp(warm?'heat':'green');};b.addEventListener('pointerenter',signal);b.addEventListener('focus',signal);b.addEventListener('click',()=>selectDistrict(i));$('city').append(b);});
  updateAmbient();
}
function selectDistrict(i){
  if(phase==='result')return;
  selected=i;
  document.querySelectorAll('.district').forEach((b,n)=>b.classList.toggle('selected',n===i));
  const round=rounds[roundIndex];
  if(phase==='find'){
    if(i!==round.hot){$('echoTip').textContent='“That sounds calmer. Try the district with the brighter, higher heat note.”';chirp('green');announce('This district is calmer. Try another.');return;}
    phase='protect';$('phaseLabel').textContent='PROTECT';$('cityHint').textContent='You found the warmer signal! Protect at least 4 of 6 districts.';
    const hotDistrict=$('city').querySelector(`[data-index="${i}"]`);hotDistrict.classList.add('hot');hotDistrict.querySelector('.badge').textContent='▲ WARMER';
    $('echoTip').textContent='“You found it! Choose fixes before the 20-second timer runs out.”';$('choicesPanel').classList.remove('hidden');$('selectedDistrict').textContent=`SELECTED: ${districts[i]}`;
    $('roundAction').textContent='SEE IMPACT →';$('roundAction').classList.remove('hidden');
    chirp('heat');roundTimer=setInterval(()=>{timeLeft--;$('timerDisplay').textContent=`${timeLeft}s`;if(timeLeft<=0)finishRound();},1000);
    announce('Hotspot found. Twenty seconds to protect the city.');return;
  }
  $('selectedDistrict').textContent=`SELECTED: ${districts[i]}`;announce(`${districts[i]} selected. Choose a fix.`);
}
const costs={tree:1,roof:2,water:3,center:4};
const fixNames={tree:'TREE',roof:'REFLECTIVE ROOF',water:'WATER',center:'COOLING CENTER'};
function placeFix(type){
  if(phase!=='protect'||selected<0)return;
  if(protectedSet.has(selected)){announce('This district already has a fix. Select another district.');return;}
  if(coins<costs[type]){announce('Not enough coins for this fix.');return;}
  coins-=costs[type];protectedSet.add(selected);fixes[selected]=type;$('coinDisplay').textContent=coins;
  const district=$(`city`).querySelector(`[data-index="${selected}"]`);district.classList.add('protected');district.querySelector('.badge').textContent=`◆ ${fixNames[type]}`;
  $('echoTip').textContent=type==='center'?'“A cooling center protects people during dangerous heat. It does not cool the whole city.”':`“${fixNames[type]} placed. ${protectedSet.size} of 6 districts protected.”`;
  document.querySelectorAll('.fixes button').forEach(b=>b.disabled=costs[b.dataset.fix]>coins);
  chirp('green');announce(`${fixNames[type]} placed in ${districts[selected]}. ${coins} coins left.`);
  if(protectedSet.size===6||coins===0)finishRound();
}
document.querySelectorAll('.fixes button').forEach(b=>b.addEventListener('click',()=>placeFix(b.dataset.fix)));
function finishRound(){
  if(phase==='result')return;clearInterval(roundTimer);phase='result';$('phaseLabel').textContent='REPORT';$('choicesPanel').classList.add('hidden');
  const count=protectedSet.size,score=Math.round(count/6*100),passed=count>=4;
  if(passed)roundScores[roundIndex]=score;
  $('roundResult').classList.remove('hidden');
  $('roundResult').innerHTML=`<h3>${passed?'CITY HELD STRONG':'TRY THIS ROUND AGAIN'}</h3><p>${count} of 6 districts protected · ${score}% this round. ${passed?'Your choices helped this imagined city prepare.':'More than half the city was left unprotected. Try cheaper fixes and spread them across districts.'}</p><p class="smallnote">Illustrative game result, not a measured NASA outcome.</p>`;
  $('echoTip').textContent=passed?'“Well done! Ask what data we would need to test these ideas in the real city.”':'“Try again. A tree costs one coin, so you can reach more districts.”';
  $('roundAction').textContent=passed?(roundIndex===5?'GET BOARDING PASS →':roundIndex===4?'CHOOSE THE FUTURE →':'NEXT ROUND →'):'RETRY ROUND ↺';
  $('roundAction').classList.remove('hidden');announce(`${passed?'Round complete':'Round retry required'}. ${score} percent of districts protected.`);
}
$('roundAction').addEventListener('click',()=>{
  if(phase==='protect'){finishRound();return;}
  if(!roundScores[roundIndex]){startRound();return;}
  if(roundIndex===5){renderPass();show('pass');return;}
  if(roundIndex===4){show('future');return;}
  roundIndex++;startRound();
});
document.querySelectorAll('.option').forEach(b=>b.addEventListener('click',()=>{const group=b.dataset.group;document.querySelectorAll(`[data-group="${group}"]`).forEach(x=>x.classList.toggle('selected',x===b));if(group==='energy')energy=b.dataset.choice;else land=b.dataset.choice;announce(`${b.textContent.trim()} selected`);}));
$('futureNext').addEventListener('click',()=>{roundIndex=5;startRound();show('game');$('roundIntro').textContent=`Future scenario: ${energy==='clean'?'clean energy':'coal'} and ${land==='parks'?'more parks':'more concrete'}. These choices change the story, not NASA forecast values.`;});
function renderPass(){
  const average=Math.round(roundScores.reduce((a,b)=>a+b,0)/roundScores.length);
  $('passName').textContent=playerName.toUpperCase();$('passScore').textContent=`${average}%`;
  $('passFuture').textContent=`${energy==='clean'?'CLEAN ENERGY':'COAL'} + ${land==='parks'?'PARKS':'CONCRETE'}`;
  $('passBadge').textContent=average>=80?'CITY COOLER':'EARTH LISTENER';
}
$('playAgain').addEventListener('click',()=>show('home'));
$('printPass').addEventListener('click',()=>window.print());
$('gameSources').addEventListener('click',e=>{e.preventDefault();$('sources').scrollIntoView({behavior:'smooth'});});
updateLab();
