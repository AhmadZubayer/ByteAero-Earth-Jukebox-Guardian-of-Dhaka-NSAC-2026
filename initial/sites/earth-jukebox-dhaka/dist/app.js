const $ = id => document.getElementById(id);
const screens = ['home','story','frames','lab','quiz','atlas','round','song','ticket'];
const state = {screen:'home',name:'Earth Explorer',frame:0,round:0,highest:0,choices:{},future:{energy:null,land:null},quizIndex:0,quizScore:0,quizTried:false,revealed:false,transitioning:false};
const announce = text => { $('announcer').textContent=text; };
const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
let scanRun=null, scanGeneration=0, recordRun=0;

function stopScan(){
  scanGeneration++;
  if(!scanRun)return;
  cancelAnimationFrame(scanRun.raf);
  scanRun.resolve(false);
  scanRun=null;
}
function show(id){
  if(!screens.includes(id)||state.transitioning)return;
  stopScan();recordRun++;
  state.transitioning=true;
  $('sceneWipe').classList.remove('go');void $('sceneWipe').offsetWidth;$('sceneWipe').classList.add('go');
  const change=()=>{
    screens.forEach(name=>$(name).classList.toggle('active',name===id));
    state.screen=id;
    $('progressLine').style.width=`${Math.round(screens.indexOf(id)/(screens.length-1)*100)}%`;
    window.scrollTo({top:0,behavior:'instant'});
    const heading=$(id).querySelector('h1,h2');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    document.title=`${heading?.innerText.trim().replace(/\s+/g,' ')||'Earth Jukebox'} — Guardian of Dhaka`;
    announce(`${heading?.innerText.trim().replace(/\s+/g,' ')||id} page`);
  };
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){change();state.transitioning=false;}
  else setTimeout(()=>{change();setTimeout(()=>state.transitioning=false,320);},230);
}

// NASA's examples sweep through an image and give different data layers different
// frequency ranges. These original, non-melodic textures are generated here from
// image color, brightness, and position. They are not NASA recordings or °C values.
const audio={ctx:null,on:false,master:null,noise:null};
function initAudio(){
  if(audio.ctx)return true;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return false;
  const ctx=audio.ctx=new Ctx();
  const compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-24;compressor.knee.value=18;compressor.ratio.value=5;
  const master=audio.master=ctx.createGain();master.gain.value=.65;
  master.connect(compressor).connect(ctx.destination);
  const length=Math.round(ctx.sampleRate*2),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=714271,slow=0;
  for(let i=0;i<length;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const white=(seed/4294967296)*2-1;
    slow=(slow+white*.035)/1.035;
    data[i]=clamp(white*.5+slow*.9,-1,1);
  }
  audio.noise=buffer;
  return true;
}
async function setSound(on){
  if(on&&!initAudio()){announce('Sound is unavailable. All sound clues also have words.');return;}
  audio.on=on;
  if(on)await audio.ctx.resume();
  $('soundBtn').textContent=on?'SOUND ON':'SOUND OFF';
  $('soundBtn').setAttribute('aria-pressed',String(on));
  announce(on?'Sound on':'Sound off. Written descriptions remain available.');
}
function grain({freq=500,volume=.08,pan=0,duration=.13,q=.8,at}={}){
  if(!audio.on||!audio.ctx||audio.ctx.state!=='running')return;
  const ctx=audio.ctx,t=at??ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  source.buffer=audio.noise;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=q;
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter).connect(gain);
  if(ctx.createStereoPanner){const stereo=ctx.createStereoPanner();stereo.pan.value=pan;gain.connect(stereo).connect(audio.master);}
  else gain.connect(audio.master);
  const offset=Math.random()*(audio.noise.duration-duration-.02);
  source.start(t,offset,duration+.01);source.stop(t+duration+.025);
}
function texture(kind,strength=.6){
  if(!audio.on)return;
  const t=audio.ctx.currentTime,n=kind==='rain'?8:kind==='heat'?5:4;
  for(let i=0;i<n;i++){
    const f=kind==='rain'?900+i*180:kind==='heat'?1200+i*340:180+i*80;
    grain({freq:f,volume:(.035+strength*.035)*(kind==='green'?.8:1),pan:-.75+i*1.5/(n-1),duration:kind==='green'?.25:.08+strength*.07,q:kind==='heat'?1.3:.7,at:t+i*(kind==='rain'?.07:.09)});
  }
}
const imageCache=new Map();
async function imageColumns(src){
  if(imageCache.has(src))return imageCache.get(src);
  const promise=new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');canvas.width=64;canvas.height=28;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,64,28);
        const pixels=ctx.getImageData(0,0,64,28).data,columns=[];
        let lo=255,hi=0;
        for(let x=0;x<64;x++){
          const cells=[];
          for(const y of [3,8,13,18,23]){
            const k=(y*64+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2],a=pixels[k+3];
            const brightness=(r+g+b)/3;
            if(a<100||brightness<14)continue;
            const warm=clamp((r-b+30)/170);
            cells.push({brightness,warm,y:y/28});
            lo=Math.min(lo,brightness);hi=Math.max(hi,brightness);
          }
          columns.push(cells);
        }
        for(const cells of columns)for(const c of cells)c.energy=clamp(.18+(c.brightness-lo)/Math.max(25,hi-lo)*.82);
        resolve(columns);
      }catch(error){reject(error);}
    };
    img.onerror=()=>reject(new Error('Image could not be loaded'));
    img.src=src;
  });
  imageCache.set(src,promise);
  return promise;
}
function soundColumn(cells,x,total,band){
  if(!audio.on||!cells?.length)return;
  const pan=clamp(x/(total-1)*2-1,-.95,.95);
  for(const c of cells){
    if(band&&!(c.y>=band[0]&&c.y<band[1]))continue;
    if(c.energy<.2)continue;
    const warm=c.warm>.54;
    // Higher image position raises the center frequency, brightness raises level.
    // Cool and warm image layers occupy different frequency bands.
    const freq=warm?(1250+(1-c.y)*2350):(150+(1-c.y)*620);
    grain({freq,volume:(warm?.045:.065)*c.energy,pan,duration:warm?.09:.16,q:warm?1.3:.7});
    if(warm&&c.energy>.65)grain({freq:freq*1.3,volume:.018*c.energy,pan,duration:.055,q:.55});
  }
}
async function playScan(src,line,track,status,duration=5100,band=null){
  stopScan();
  const generation=scanGeneration;
  if(line){line.style.opacity='1';line.style.left='0%';}
  if(track)track.style.width='0%';
  if(status)status.textContent='Reading the real image from left to right. The low, airy and sharp, grainy layers follow the pixels.';
  let columns;
  try{columns=await imageColumns(src);}
  catch{if(status)status.textContent='This image could not be read. Please try again.';if(line)line.style.opacity='0';return false;}
  if(generation!==scanGeneration)return false;
  return new Promise(resolve=>{
    let start=0,last=-1;
    const run={raf:0,resolve};scanRun=run;
    const tick=now=>{
      if(scanRun!==run)return;
      if(!start)start=now;
      const progress=clamp((now-start)/duration),index=Math.min(columns.length-1,Math.floor(progress*columns.length));
      if(line)line.style.left=`${progress*100}%`;
      if(track)track.style.width=`${progress*100}%`;
      for(let x=last+1;x<=index;x++)soundColumn(columns[x],x,columns.length,band);
      last=index;
      if(progress<1)run.raf=requestAnimationFrame(tick);
      else{if(line)line.style.opacity='0';if(status)status.textContent='Scan complete. The sound came from this image, not from a preset song.';scanRun=null;resolve(true);}
    };
    run.raf=requestAnimationFrame(tick);
  });
}

const frames=[
  {year:'1884',src:'assets/nasa-gistemp-1884.jpg',alt:'NASA global temperature anomaly frame for 1884.'},
  {year:'2022',src:'assets/nasa-gistemp-2022.jpg',alt:'NASA global temperature anomaly frame for 2022.'}
];
function selectFrame(index){
  stopScan();state.frame=index;const frame=frames[index];
  $('eicFrame').src=frame.src;$('eicFrame').alt=frame.alt;$('frameYear').textContent=frame.year;
  $('frameScanline').style.opacity='0';$('frameTrack').style.width='0%';
  $('frameSound').textContent=`Ready to scan the ${frame.year} image. Low airy texture and sharp grainy texture will follow the image from left to right.`;
  document.querySelectorAll('[data-frame]').forEach(b=>{const selected=+b.dataset.frame===index;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}

const touched=new Set();
function updateLab(changed){
  const heat=+$('heatSlider').value,rain=+$('rainSlider').value,green=+$('greenSlider').value;
  $('heatValue').textContent=heat;$('rainValue').textContent=rain;$('greenValue').textContent=green;
  $('labWorld').style.filter=`sepia(${heat*.004}) saturate(${1+heat*.006}) hue-rotate(${-heat*.16}deg)`;
  $('labWorld').querySelector('.lab-rain').style.opacity=String(rain/160);
  $('labWorld').querySelectorAll('.lab-tree').forEach(tree=>tree.style.opacity=String(.25+green/135));
  $('labWorld').querySelector('.lab-sun').style.transform=`scale(${.8+heat/250})`;
  if(changed){touched.add(changed);texture(changed==='greenSlider'?'green':changed==='rainSlider'?'rain':'heat',changed==='greenSlider'?green/100:changed==='rainSlider'?rain/100:heat/100);}
  const main=heat>65?'The heat sound becomes sharper and busier.':rain>65?'More rain makes many short droplet sounds.':green<30?'With less green space, the soft airy layer becomes thin.':'A quieter scene with room to listen.';
  $('labDescription').textContent=main;
  $('labDone').textContent=touched.size===3?'You tried all three. Echo is ready.':`Try each control once: ${touched.size} of 3 tried.`;
  $('labNext').disabled=touched.size<3;
}

const quiz=[
  {kind:'heat',clue:'A sharp, busy hiss grows brighter. What changed?'},
  {kind:'rain',clue:'Many quick little drops arrive close together. What changed?'},
  {kind:'green',clue:'A low, airy wash becomes softer and fuller. What changed?'},
  {kind:'rain',clue:'Short taps scatter across the space. What changed?'},
  {kind:'heat',clue:'The grainy layer rises above the quiet background. What changed?'}
];
function renderQuiz(){
  const q=quiz[state.quizIndex];
  $('quizCount').textContent=`CLUE ${state.quizIndex+1} / 5`;
  $('quizScore').textContent=`${state.quizScore} RIGHT`;
  $('quizClue').textContent=q.clue;
  $('quizFeedback').textContent='Choose the sound you hear or read.';
  document.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=false;b.classList.remove('selected');});
  $('quizContinue').classList.add('hidden');
}
function answerQuiz(value,button){
  const q=quiz[state.quizIndex],correct=value===q.kind;
  if(correct)state.quizScore++;
  button.classList.add('selected');
  document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
  $('quizFeedback').textContent=correct?'Yes. That matches the sound.':`Good try. The answer is ${q.kind}. Read the clue and hear it again.`;
  $('quizScore').textContent=`${state.quizScore} RIGHT`;
  setTimeout(()=>{
    if(state.screen!=='quiz')return;
    if(state.quizIndex<4){state.quizIndex++;renderQuiz();}
    else{
      state.quizTried=true;
      $('quizCount').textContent='PRACTICE COMPLETE';
      $('quizClue').textContent=state.quizScore>=3?'You heard the clues. Dhaka is ready.':'You can still follow the story with written clues.';
      $('quizContinue').textContent=state.quizScore>=3?'OPEN DHAKA MAP →':'CONTINUE WITH WORDS →';
      $('quizContinue').classList.remove('hidden');
    }
  },900);
}

const maps={
  2000:'assets/nasa-modis-dhaka-lst-2000.png',
  2010:'assets/nasa-modis-dhaka-lst-2010.png',
  2020:'assets/nasa-modis-dhaka-lst-2020.png',
  2024:'assets/nasa-modis-dhaka-lst-2024.png'
};
const rounds=[
  {year:2000,title:'The first note',intro:'Start with a real NASA image. Scan it and choose one part to hear again.',prompt:'“Where should we listen more closely?”',caption:'A fictional family sends a postcard from Dhaka.',fragment:'Every place has a story.',groups:[{name:'Listen again',key:'area',options:[['north','Upper part of the image'],['middle','Middle of the image'],['south','Lower part of the image']]}]},
  {year:2010,title:'Two pictures, one question',intro:'Look at 2000 and 2010 side by side. Hear their image scans and notice one thing.',prompt:'“What can two snapshots tell us?”',caption:'The family keeps a second postcard. Their street story is imagined.',fragment:'We learn by looking closely.',compare:2000,groups:[{name:'What did you notice?',key:'notice',options:[['different','The two pictures look different'],['question','I want to ask why they differ'],['trend','I want more years before claiming a trend']]}]},
  {year:2020,title:'What the picture cannot say',intro:'A NASA map sits beside a made-up walk to school. One tells us about land; the other asks about people.',prompt:'“What would you ask someone on this street?”',caption:'A child walks to school on an imagined Dhaka street.',fragment:'A map cannot speak for everyone.',groups:[{name:'Ask a person',key:'question',options:[['shade','Where can you find shade?'],['water','Where can you get water?'],['journey','How does the walk feel today?']]}]},
  {year:2024,title:'Make a plan',intro:'Scan the latest observed map in this story, then make one choice for the imagined street.',prompt:'“How will you help people here?”',caption:'This street is fictional. Your choice changes this illustration, not the NASA image.',fragment:'Small choices can help people.',groups:[{name:'Choose one action',key:'action',options:[['shade','Plant shade trees','Shade can help people along a route.'],['roof','Try a reflective roof','A lighter roof may absorb less heat.'],['center','Open a cooling center','It gives people a safer place during heat.']]}]},
  {year:2035,title:'Choose a path',intro:'This is an imagined future. The NASA map is still the observed 2024 reference.',prompt:'“What future would you like to explore?”',caption:'Possible future scene. It is not a NASA forecast.',fragment:'The future depends on choices.',future:true,groups:[{name:'Energy path',key:'energy',options:[['clean','Cleaner energy'],['coal','More coal']]},{name:'Land path',key:'land',options:[['parks','More parks'],['concrete','More concrete']]}]},
  {year:2050,title:'The message is whole',intro:'See the imagined future shaped by your choices. Send one lesson back to today.',prompt:'“What should we tell people now?”',caption:'This scene is an imagined ending, not a prediction.',fragment:'Keep listening. Keep asking. Care for each other.',future:true,groups:[{name:'Send one message',key:'lesson',options:[['data','Listen to the data'],['people','Protect people'],['shade','Make room for shade']]}]}
];
const fragments=rounds.map(r=>r.fragment);
function mapUrl(year){
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=MODIS_Terra_L3_Land_Surface_Temp_8Day_Day&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=TRUE&SRS=EPSG%3A4326&BBOX=89.95%2C23.5%2C90.85%2C24.15&WIDTH=1000&HEIGHT=800&TIME=${year}-04-15`;
}
function renderAtlas(){
  $('yearList').innerHTML='';
  rounds.forEach((r,i)=>{
    const b=document.createElement('button');b.type='button';
    b.className=`${i<=state.highest?'unlocked':''} ${state.choices[i]?'done':''}`;
    b.disabled=i>state.highest;
    b.innerHTML=`${r.year}<small>${i<4?'REAL NASA IMAGE':'IMAGINED FUTURE'}</small>`;
    b.addEventListener('click',()=>{renderRound(i);show('round');});
    $('yearList').append(b);
  });
  $('atlasNext').textContent=state.highest===0?'START IN 2000 →':`CONTINUE IN ${rounds[Math.min(state.highest,5)].year} →`;
}
function renderRound(index){
  stopScan();state.round=index;state.revealed=false;
  const r=rounds[index],observed=r.future?2024:r.year;
  $('roundStep').textContent=`06 / YEAR ${r.year}`;
  $('roundIndex').textContent=`CLUE ${index+1} OF 6`;
  $('roundKind').textContent=r.future?'IMAGINED FUTURE · REAL 2024 REFERENCE':'REAL NASA IMAGE · IMAGINED STREET';
  $('roundTitle').textContent=r.title;$('roundIntro').textContent=r.intro;$('roundYear').textContent=r.year;
  $('roundPrompt').textContent=r.prompt;$('streetCaption').textContent=r.caption;
  $('mapLabel').textContent=r.future?'NASA 2024 OBSERVATION · FUTURE SCENE IS IMAGINED':'NASA TERRA / MODIS · REAL OBSERVATION';
  $('mapDate').textContent=`APRIL ${observed}`;
  $('roundMap').src=maps[observed];
  $('roundMap').alt=`NASA Terra MODIS eight-day daytime land surface temperature around Dhaka, April ${observed}.`;
  $('mapNote').textContent=r.future?'This real 2024 image is context, not a future prediction.':'Real eight-day land surface temperature image. Gray may mean missing observations.';
  $('mapSource').href=mapUrl(observed);
  $('comparePicture').classList.toggle('hidden',!r.compare);
  if(r.compare){$('compareMap').src=maps[r.compare];$('compareMap').alt=`NASA Terra MODIS land surface temperature around Dhaka, April ${r.compare}.`;}
  $('roundScanline').style.opacity='0';$('roundTrack').style.width='0%';
  $('roundSound').textContent=r.future?'Scan the real 2024 reference. The future scene is an illustration.':'Scan this real image to hear its textures from left to right.';
  $('streetScene').className='street-scene';
  if(r.future&&state.future.land)$('streetScene').classList.add(state.future.land==='parks'?'future-soft':'future-hard');
  if(r.future&&state.future.energy)$('streetScene').classList.add(state.future.energy==='clean'?'energy-clean':'energy-coal');
  $('roundReveal').classList.add('hidden');
  $('roundAction').disabled=true;$('roundAction').textContent='CHOOSE TO CONTINUE →';
  const container=$('roundChoices');container.innerHTML='';
  const selected=state.choices[index]||{};
  for(const group of r.groups){
    const title=document.createElement('p');title.textContent=group.name;container.append(title);
    for(const [value,label,detail] of group.options){
      const b=document.createElement('button');b.type='button';b.dataset.group=group.key;b.dataset.value=value;
      b.textContent=label;
      if(detail){const small=document.createElement('small');small.textContent=detail;b.append(small);}
      b.classList.toggle('selected',selected[group.key]===value);
      b.addEventListener('click',()=>chooseRound(group.key,value,b));
      container.append(b);
    }
  }
  if(Object.keys(selected).length===r.groups.length)$('roundAction').disabled=false;
}
function chooseRound(key,value,button){
  const index=state.round,r=rounds[index];
  state.choices[index]??={};
  state.choices[index][key]=value;
  if(index===0){
    const bands={north:[0,.34],middle:[.34,.67],south:[.67,1]};
    playScan(maps[2000],$('roundScanline'),$('roundTrack'),$('roundSound'),2200,bands[value]);
  }
  document.querySelectorAll(`#roundChoices [data-group="${key}"]`).forEach(b=>b.classList.toggle('selected',b===button));
  if(index===3){$('streetScene').classList.remove('choice-shade','choice-roof','choice-center');$('streetScene').classList.add(`choice-${value}`);}
  if(index===4){
    state.future[key]=value;
    $('streetScene').classList.toggle('future-soft',state.future.land==='parks');
    $('streetScene').classList.toggle('future-hard',state.future.land==='concrete');
    $('streetScene').classList.toggle('energy-clean',state.future.energy==='clean');
    $('streetScene').classList.toggle('energy-coal',state.future.energy==='coal');
  }
  if(index===1)$('roundSound').textContent='Good observation. Two dated snapshots alone cannot prove a long-term trend.';
  if(index===2)$('roundSound').textContent='Good question. The NASA map shows land surface heat; a person can tell us about their day.';
  if(index===3&&value==='center')$('roundSound').textContent='A cooling center helps people during heat. It does not cool the whole city.';
  if(index===4)$('roundSound').textContent='Your choices shape the imagined story scene, not a NASA prediction.';
  $('roundAction').disabled=r.groups.some(g=>!state.choices[index][g.key]);
  announce(`${button.firstChild.textContent} selected`);
}
function nextRoundStep(){
  if($('roundAction').disabled)return;
  const i=state.round;
  if(!state.revealed){
    state.revealed=true;
    $('fragmentText').textContent=fragments[i];
    $('roundReveal').classList.remove('hidden');
    $('roundAction').textContent=i===5?'HEAR YOUR EARTH RECORD →':`NEXT: ${rounds[i+1].year} →`;
    state.highest=Math.max(state.highest,Math.min(i+1,5));
    announce(`Message piece found: ${fragments[i]}`);
    return;
  }
  if(i===5){renderSong();show('song');}
  else{
    renderRound(i+1);
    $('round').classList.remove('round-enter');void $('round').offsetWidth;$('round').classList.add('round-enter');
    const heading=$('roundTitle');heading.tabIndex=-1;heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
    document.title=`${heading.textContent.trim()} — Guardian of Dhaka`;
  }
}
function renderSong(){
  const chosen=state.choices[5]?.lesson;
  const lessons={data:'Listen to the data.',people:'Protect people.',shade:'Make room for shade.'};
  $('fullMessage').textContent=`“Every place has a story. We learn by looking closely. A map cannot speak for everyone. Small choices can help people. The future depends on choices. ${lessons[chosen]||'Keep listening.'}”`;
  const tracks=[...frames.map(f=>({year:f.year,src:f.src})),...[2000,2010,2020,2024].map(year=>({year:String(year),src:maps[year]}))];
  const container=$('recordTracks');container.innerHTML='';
  tracks.forEach((track,i)=>{
    const b=document.createElement('button');b.type='button';b.textContent=`${String(i+1).padStart(2,'0')} / NASA IMAGE ${track.year}`;
    b.addEventListener('click',async()=>{
      recordRun++;container.querySelectorAll('button').forEach(x=>x.classList.toggle('playing',x===b));
      $('recordStatus').textContent=`Scanning the ${track.year} NASA image…`;
      await playScan(track.src,null,null,$('recordStatus'),3600);
      b.classList.remove('playing');
    });
    container.append(b);
  });
}
async function playRecord(){
  const run=++recordRun;
  const tracks=[...frames.map(f=>({year:f.year,src:f.src})),...[2000,2010,2020,2024].map(year=>({year:String(year),src:maps[year]}))];
  const buttons=[...$('recordTracks').querySelectorAll('button')];
  for(let i=0;i<tracks.length&&run===recordRun&&state.screen==='song';i++){
    buttons.forEach((b,n)=>b.classList.toggle('playing',n===i));
    $('recordStatus').textContent=`Scanning NASA image ${tracks[i].year} · ${i+1} of 6`;
    const complete=await playScan(tracks[i].src,null,null,$('recordStatus'),2500);
    if(!complete)break;
  }
  buttons.forEach(b=>b.classList.remove('playing'));
  if(run===recordRun&&state.screen==='song')$('recordStatus').textContent='Earth record complete. Each sound followed an image scan.';
}
function renderTicket(){
  const action={shade:'SHADE TREES',roof:'REFLECTIVE ROOF',center:'COOLING CENTER'};
  const lesson={data:'LISTEN TO THE DATA',people:'PROTECT PEOPLE',shade:'MAKE ROOM FOR SHADE'};
  $('ticketName').textContent=state.name.toUpperCase();
  $('ticketAction').textContent=action[state.choices[3]?.action]||'—';
  $('ticketFuture').textContent=`${state.future.energy==='clean'?'CLEANER ENERGY':'MORE COAL'} + ${state.future.land==='parks'?'MORE PARKS':'MORE CONCRETE'}`;
  $('ticketLesson').textContent=lesson[state.choices[5]?.lesson]||'KEEP LISTENING';
}

$('homeLink').addEventListener('click',()=>show('home'));
$('soundBtn').addEventListener('click',()=>setSound(!audio.on));
$('startBtn').addEventListener('click',()=>show('story'));
$('storyNext').addEventListener('click',()=>{state.name=$('playerName').value.trim().slice(0,20)||'Earth Explorer';show('frames');});
document.querySelectorAll('[data-frame]').forEach(b=>b.addEventListener('click',()=>selectFrame(+b.dataset.frame)));
$('frameScanBtn').addEventListener('click',()=>playScan(frames[state.frame].src,$('frameScanline'),$('frameTrack'),$('frameSound')));
$('framesNext').addEventListener('click',()=>show('lab'));
['heatSlider','rainSlider','greenSlider'].forEach(id=>$(id).addEventListener('input',()=>updateLab(id)));
$('labNext').addEventListener('click',()=>{state.quizIndex=0;state.quizScore=0;renderQuiz();show('quiz');});
$('replaySound').addEventListener('click',()=>texture(quiz[state.quizIndex].kind,.7));
document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>answerQuiz(b.dataset.answer,b)));
$('quizContinue').addEventListener('click',()=>{renderAtlas();show('atlas');});
$('atlasNext').addEventListener('click',()=>{renderRound(state.highest);show('round');});
$('roundScanBtn').addEventListener('click',async()=>{
  const r=rounds[state.round],line=$('roundScanline'),track=$('roundTrack'),status=$('roundSound');
  if(state.round===1){
    status.textContent='First: April 2000. Then: April 2010.';
    const first=await playScan(maps[2000],line,track,status,2600);
    if(first&&state.round===1){status.textContent='Now scanning April 2010.';await playScan(maps[2010],line,track,status,2600);}
  }else playScan(maps[r.future?2024:r.year],line,track,status);
});
$('roundAction').addEventListener('click',nextRoundStep);
$('recordPlay').addEventListener('click',playRecord);
$('songNext').addEventListener('click',()=>{renderTicket();show('ticket');});
$('printTicket').addEventListener('click',()=>window.print());
$('playAgain').addEventListener('click',()=>{stopScan();recordRun++;state.round=0;state.highest=0;state.choices={};state.future={energy:null,land:null};state.quizIndex=0;state.quizScore=0;touched.clear();$('playerName').value='';renderAtlas();show('home');});
updateLab();renderAtlas();
requestAnimationFrame(()=>setTimeout(()=>$('loader').classList.add('loaded'),matchMedia('(prefers-reduced-motion: reduce)').matches?0:650));
