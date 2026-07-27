"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x:number; y:number; w:number; h:number };
type Fighter = { x:number; y:number; vx:number; vy:number; w:number; h:number; color:string; accent:string; face:number; hp:number; maxHp:number; jumps:number; grounded:boolean; attack:number; cooldown:number; dash:number; invuln:number; dead:number; score:number; name:string };
type Enemy = Fighter & { kind:"badger"|"hare"|"bat"; home:number; active:boolean; defeated:boolean; ai:number };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string;size:number };

const W=1600, H=900, FLOOR=770, WORLD=6100;
const platforms:Rect[]=[
  {x:0,y:FLOOR,w:1050,h:140},{x:1130,y:FLOOR,w:980,h:140},{x:2200,y:FLOOR,w:1080,h:140},{x:3380,y:FLOOR,w:960,h:140},{x:4430,y:FLOOR,w:1670,h:140},
  {x:480,y:590,w:260,h:30},{x:860,y:480,w:220,h:28},{x:1370,y:610,w:300,h:28},{x:1770,y:490,w:250,h:28},{x:2350,y:575,w:270,h:28},{x:2800,y:440,w:230,h:28},{x:3510,y:580,w:310,h:28},{x:3990,y:465,w:240,h:28},{x:4570,y:610,w:280,h:28},{x:5000,y:490,w:250,h:28},{x:5400,y:600,w:240,h:28}
];
const enemySeeds=[
  [760,710,"badger"],[1020,420,"bat"],[1490,550,"hare"],[1890,430,"bat"],[2390,515,"badger"],[2860,380,"hare"],[3150,700,"badger"],[3610,520,"badger"],[4080,400,"bat"],[4590,550,"hare"],[4920,700,"badger"],[5150,430,"bat"],[5480,540,"badger"]
] as const;

function fighter(x:number,color:string,accent:string,name:string):Fighter { return {x,y:670,vx:0,vy:0,w:62,h:82,color,accent,face:1,hp:100,maxHp:100,jumps:2,grounded:false,attack:0,cooldown:0,dash:0,invuln:0,dead:0,score:0,name}; }
function overlaps(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}

export default function Game(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<"title"|"play"|"win"|"lose">("title");
  const [screen,setScreen]=useState<"title"|"play"|"win"|"lose">("title");
  const [hud,setHud]=useState<{p1:number;p2:number;remaining:number;progress:number}>({p1:100,p2:100,remaining:enemySeeds.length,progress:0});
  const [sound,setSound]=useState(true);
  const audio=useRef<AudioContext|null>(null);
  const keys=useRef(new Set<string>());
  const pressed=useRef(new Set<string>());
  const game=useRef<{players:Fighter[];enemies:Enemy[];particles:Particle[];camera:number;last:number;gateOpen:boolean}|null>(null);

  const ping=useCallback((freq:number,dur=.07)=>{ if(!sound)return; const Ctx=window.AudioContext||(window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext; if(!Ctx)return; audio.current??=new Ctx(); const o=audio.current.createOscillator(),g=audio.current.createGain(); o.type="square";o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.current.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.current.currentTime+dur);o.connect(g).connect(audio.current.destination);o.start();o.stop(audio.current.currentTime+dur); },[sound]);

  const reset=useCallback(()=>{
    game.current={players:[fighter(180,"#b8332e","#e6c24c","BRAMBLE"),fighter(270,"#297388","#d8d0b6","THIMBLE")],enemies:enemySeeds.map(([x,y,k],i)=>({...fighter(x,k==="badger"?"#5c4a3d":k==="hare"?"#9a7653":"#4b3a64",k==="badger"?"#d55337":k==="hare"?"#6c9d4c":"#be4b75",k.toUpperCase()),y,w:k==="bat"?58:64,h:k==="bat"?55:76,kind:k,home:x,active:false,defeated:false,ai:i*.7})),particles:[],camera:0,last:performance.now(),gateOpen:false};
    stateRef.current="play";setScreen("play");setHud({p1:100,p2:100,remaining:enemySeeds.length,progress:0});ping(260,.1);
  },[ping]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{ if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault(); if(!keys.current.has(e.code))pressed.current.add(e.code);keys.current.add(e.code);if(e.code==="Escape"&&stateRef.current==="play"){stateRef.current="title";setScreen("title");} };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return; const ctx=canvas.getContext("2d");if(!ctx)return;
    let raf=0;
    const resize=()=>{const d=Math.min(devicePixelRatio,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);};resize();
    function getInput(index:number){
      const k=keys.current,p=pressed.current; const gp=navigator.getGamepads?.()[index];
      if(index===0)return {l:k.has("KeyA")||!!gp&&gp.axes[0]<-.28,r:k.has("KeyD")||!!gp&&gp.axes[0]>.28,d:k.has("KeyS")||!!gp&&gp.axes[1]>.5,j:p.has("KeyW")||p.has("Space")||!!gp?.buttons[0]?.pressed,a:p.has("KeyF")||!!gp?.buttons[2]?.pressed,dash:p.has("KeyG")||!!gp?.buttons[1]?.pressed};
      return {l:k.has("ArrowLeft")||!!gp&&gp.axes[0]<-.28,r:k.has("ArrowRight")||!!gp&&gp.axes[0]>.28,d:k.has("ArrowDown")||!!gp&&gp.axes[1]>.5,j:p.has("ArrowUp")||p.has("Numpad0")||!!gp?.buttons[0]?.pressed,a:p.has("KeyK")||p.has("Slash")||!!gp?.buttons[2]?.pressed,dash:p.has("KeyL")||p.has("Period")||!!gp?.buttons[1]?.pressed};
    }
    function burst(x:number,y:number,color:string,n=8){const g=game.current;if(!g)return;for(let i=0;i<n;i++)g.particles.push({x,y,vx:(Math.random()-.5)*12,vy:(Math.random()-.8)*10,life:1,color,size:3+Math.random()*7});}
    function land(entity:Fighter,prevY:number){entity.grounded=false;for(const p of platforms){if(entity.vy>=0&&entity.x+entity.w>p.x+8&&entity.x<p.x+p.w-8&&prevY+entity.h<=p.y+12&&entity.y+entity.h>=p.y){entity.y=p.y-entity.h;entity.vy=0;entity.grounded=true;entity.jumps=2;}}}
    function hit(target:Fighter,from:Fighter,power:number){if(target.invuln>0||target.dead>0)return;target.hp-=power;target.vx=from.face*(8+power*.22);target.vy=-5-power*.12;target.invuln=.36;burst(target.x+target.w/2,target.y+target.h/2,target.accent,9);ping(100+power*5,.06);if(target.hp<=0){target.dead=1.6;target.vy=-13;target.vx=from.face*13;from.score++;burst(target.x+target.w/2,target.y+target.h/2,"#f5d66d",20);}}
    function updatePlayer(p:Fighter,i:number,dt:number){if(p.dead>0){p.dead-=dt;p.vy+=34*dt;p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;if(p.dead<=0){p.hp=100;p.x=Math.max(120,(game.current?.camera||0)+180+i*90);p.y=560;p.vx=p.vy=0;p.invuln=2;}return;}
      const q=getInput(i),acc=p.grounded?2.2:1.25;if(q.l){p.vx-=acc;p.face=-1;}if(q.r){p.vx+=acc;p.face=1;} if(!q.l&&!q.r)p.vx*=p.grounded?.72:.97;p.vx=clamp(p.vx,-9,9);
      if(q.j&&p.jumps>0){p.vy=p.grounded?-15.4:-13.2;p.grounded=false;p.jumps--;ping(i?460:390,.08);burst(p.x+p.w/2,p.y+p.h,"#e8d59d",5);} if(q.d&&!p.grounded&&p.vy>0)p.vy+=2.2;
      if(q.dash&&p.dash<=0){p.vx=p.face*18;p.vy*=.35;p.dash=.65;p.invuln=.16;burst(p.x+p.w/2,p.y+p.h/2,p.accent,8);ping(180,.05);} if(q.a&&p.cooldown<=0){p.attack=.22;p.cooldown=.42;ping(300+i*70,.04);}
      p.cooldown-=dt;p.attack-=dt;p.dash-=dt;p.invuln-=dt;p.vy+=.82;const prev=p.y;p.x+=p.vx;p.y+=p.vy;land(p,prev);p.x=clamp(p.x,0,WORLD-p.w);if(p.y>980){p.hp-=25;p.dead=.7;}
      if(p.attack>0.08&&p.attack<.2){const blade={x:p.face>0?p.x+p.w:p.x-64,y:p.y+15,w:64,h:58};for(const e of game.current?.enemies||[])if(!e.defeated&&overlaps(blade,e))hit(e,p,18);}
    }
    function updateEnemy(e:Enemy,dt:number){if(e.defeated)return;if(e.dead>0){e.dead-=dt;e.vy+=.7;e.x+=e.vx;e.y+=e.vy;if(e.dead<=0){e.defeated=true;e.active=false;}return;}const g=game.current!;const near=g.players.filter(p=>p.dead<=0).sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(!near)return;e.active=Math.abs(near.x-e.x)<680||e.active;if(!e.active)return;e.ai-=dt;e.invuln-=dt;e.cooldown-=dt;e.attack-=dt;
      const dx=near.x-e.x;e.face=dx>=0?1:-1;if(e.kind==="bat"){e.vx+=Math.sign(dx)*.12;e.vy+=(near.y-70-e.y)*.0018;e.vy+=Math.sin(performance.now()/250+e.home)*.06;e.vx=clamp(e.vx,-3.8,3.8);e.vy=clamp(e.vy,-3.3,3.3);e.x+=e.vx;e.y+=e.vy;}
      else {if(Math.abs(dx)>92)e.vx+=Math.sign(dx)*(e.kind==="hare"?.34:.22);else e.vx*=.72;e.vx=clamp(e.vx,-(e.kind==="hare"?5:3.3),e.kind==="hare"?5:3.3);if(e.kind==="hare"&&e.grounded&&e.ai<=0){e.vy=-12;e.ai=1.7;}const prev=e.y;e.vy+=.82;e.x+=e.vx;e.y+=e.vy;land(e,prev);}
      if(Math.abs(dx)<92&&Math.abs(near.y-e.y)<80&&e.cooldown<=0){e.attack=.25;e.cooldown=1.05;e.ai=.55;}if(e.attack>.08&&e.attack<.2&&overlaps({x:e.x-22,y:e.y,w:e.w+44,h:e.h},{x:near.x,y:near.y,w:near.w,h:near.h}))hit(near,e,e.kind==="badger"?13:9);if(e.y>980){e.defeated=true;}
    }
    function drawMouse(p:Fighter,camera:number){if(p.dead>0&&Math.floor(p.dead*10)%2)return;ctx!.save();ctx!.translate(p.x-camera+p.w/2,p.y+p.h/2);ctx!.scale(p.face,1);if(p.invuln>0&&Math.floor(p.invuln*20)%2)ctx!.globalAlpha=.35;ctx!.rotate(clamp(p.vx*.012,-.1,.1));
      ctx!.fillStyle="#9b8e7b";ctx!.strokeStyle="#231b15";ctx!.lineWidth=5;ctx!.beginPath();ctx!.arc(-19,-33,15,0,7);ctx!.arc(17,-35,16,0,7);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#bda995";ctx!.beginPath();ctx!.ellipse(0,-18,30,27,0,0,7);ctx!.fill();ctx!.stroke();ctx!.fillStyle=p.color;ctx!.beginPath();ctx!.roundRect(-29,3,58,56,12);ctx!.fill();ctx!.stroke();ctx!.fillStyle=p.accent;ctx!.fillRect(-29,18,58,11);ctx!.fillStyle="#c6b38c";ctx!.beginPath();ctx!.moveTo(-24,-3);ctx!.lineTo(0,-18);ctx!.lineTo(25,-3);ctx!.lineTo(18,10);ctx!.lineTo(-18,10);ctx!.closePath();ctx!.fill();ctx!.stroke();ctx!.fillStyle="#181411";ctx!.beginPath();ctx!.arc(-8,-22,3,0,7);ctx!.arc(10,-22,3,0,7);ctx!.fill();ctx!.beginPath();ctx!.moveTo(25,-16);ctx!.lineTo(38,-11);ctx!.lineTo(25,-7);ctx!.fillStyle="#d8b2a0";ctx!.fill();ctx!.stroke();ctx!.strokeStyle="#bfa34b";ctx!.lineWidth=6;ctx!.beginPath();ctx!.moveTo(32,20);const swing=p.attack>0?-45:35;ctx!.lineTo(57,20+swing);ctx!.stroke();ctx!.strokeStyle="#e6e0cb";ctx!.lineWidth=8;ctx!.beginPath();ctx!.moveTo(57,20+swing);ctx!.lineTo(75,10+swing);ctx!.stroke();ctx!.restore();}
    function drawEnemy(e:Enemy,camera:number){if(e.defeated||e.x-camera<-120||e.x-camera>W+120)return;ctx!.save();ctx!.translate(e.x-camera+e.w/2,e.y+e.h/2);ctx!.scale(e.face,1);if(e.invuln>0&&Math.floor(e.invuln*20)%2)ctx!.globalAlpha=.35;ctx!.fillStyle=e.color;ctx!.strokeStyle="#1d1713";ctx!.lineWidth=5;if(e.kind==="bat"){ctx!.beginPath();ctx!.moveTo(-10,0);ctx!.quadraticCurveTo(-52,-38,-45,18);ctx!.quadraticCurveTo(-30,5,-12,20);ctx!.moveTo(10,0);ctx!.quadraticCurveTo(52,-38,45,18);ctx!.quadraticCurveTo(30,5,12,20);ctx!.fill();ctx!.stroke();ctx!.beginPath();ctx!.ellipse(0,0,23,28,0,0,7);ctx!.fill();ctx!.stroke();}
      else {ctx!.beginPath();ctx!.roundRect(-30,-30,60,68,15);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#b49a7c";ctx!.beginPath();if(e.kind==="hare"){ctx!.ellipse(-13,-48,10,31,-.15,0,7);ctx!.ellipse(13,-48,10,31,.15,0,7);}else{ctx!.arc(-20,-30,14,0,7);ctx!.arc(20,-30,14,0,7);}ctx!.fill();ctx!.stroke();ctx!.fillStyle=e.accent;ctx!.fillRect(-30,8,60,12);}
      ctx!.fillStyle="#f1d76b";ctx!.beginPath();ctx!.arc(-8,-8,3,0,7);ctx!.arc(8,-8,3,0,7);ctx!.fill();ctx!.restore();}
    function render(g:NonNullable<typeof game.current>){const cam=g.camera;const sky=ctx!.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#13252b");sky.addColorStop(.58,"#4f725f");sky.addColorStop(1,"#d89a52");ctx!.fillStyle=sky;ctx!.fillRect(0,0,W,H);
      for(let layer=0;layer<3;layer++){const par=.12+layer*.11;ctx!.fillStyle=["#243a37","#2c4a42","#3e5b48"][layer];for(let x=-200;x<W+300;x+=180-layer*20){const xx=x-((cam*par)%(180-layer*20));ctx!.beginPath();ctx!.moveTo(xx,H);ctx!.lineTo(xx+70,210+layer*100);ctx!.lineTo(xx+140,H);ctx!.fill();ctx!.beginPath();ctx!.arc(xx+70,260+layer*100,95-layer*12,0,7);ctx!.fill();}}
      ctx!.fillStyle="#ede1b0";ctx!.globalAlpha=.12;for(let i=0;i<28;i++){const x=(i*193-cam*.2)%W;ctx!.fillRect(x,100+(i*73)%480,3,3);}ctx!.globalAlpha=1;
      for(const p of platforms){if(p.x-cam>W||p.x+p.w-cam<0)continue;ctx!.fillStyle="#6a4c2c";ctx!.fillRect(p.x-cam,p.y,p.w,p.h);ctx!.fillStyle="#447044";ctx!.fillRect(p.x-cam,p.y,p.w,16);ctx!.fillStyle="#78a958";ctx!.fillRect(p.x-cam,p.y,p.w,5);ctx!.fillStyle="#392a20";for(let x=p.x+30;x<p.x+p.w;x+=75)ctx!.fillRect(x-cam,p.y+38,12,p.h-38);}
      const gateX=5860;ctx!.fillStyle=g.gateOpen?"#e2c25a":"#5f5143";ctx!.strokeStyle="#211b17";ctx!.lineWidth=12;ctx!.beginPath();ctx!.roundRect(gateX-cam,470,150,300,70);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#1d2826";ctx!.beginPath();ctx!.roundRect(gateX+27-cam,514,96,256,48);ctx!.fill();if(g.gateOpen){ctx!.fillStyle="#f5d87255";ctx!.beginPath();ctx!.ellipse(gateX+75-cam,635,95+Math.sin(performance.now()/180)*8,150,0,0,7);ctx!.fill();}
      for(const e of g.enemies)drawEnemy(e,cam);for(const p of g.players)drawMouse(p,cam);for(const q of g.particles){ctx!.globalAlpha=clamp(q.life,0,1);ctx!.fillStyle=q.color;ctx!.fillRect(q.x-cam,q.y,q.size,q.size);}ctx!.globalAlpha=1;
    }
    function loop(t:number){
      const g=game.current;
      if(g){
        const dt=Math.min(.033,(t-g.last)/1000);g.last=t;
        if(stateRef.current==="play"){
          for(let i=0;i<g.players.length;i++)updatePlayer(g.players[i],i,dt);
          for(const e of g.enemies)updateEnemy(e,dt);
          for(const q of g.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.35;q.life-=dt*1.8;}
          g.particles=g.particles.filter(q=>q.life>0);
          const alive=g.enemies.filter(e=>!e.defeated).length;
          g.gateOpen=alive===0;
          const lead=Math.max(...g.players.map(p=>p.x));
          const back=Math.min(...g.players.map(p=>p.x));
          g.camera+=(clamp((lead+back)/2-W*.42,0,WORLD-W)-g.camera)*.08;
          if(g.gateOpen&&g.players.every(p=>p.x>5820)){stateRef.current="win";setScreen("win");ping(720,.3);}
          if(g.players.every(p=>p.hp<=0&&p.dead>0)){stateRef.current="lose";setScreen("lose");}
          if(Math.floor(t/120)%4===0)setHud({p1:Math.max(0,g.players[0].hp),p2:Math.max(0,g.players[1].hp),remaining:alive,progress:clamp(lead/(WORLD-240)*100,0,100)});
          pressed.current.clear();
        }
        render(g);
      }else{
        ctx!.fillStyle="#162420";ctx!.fillRect(0,0,W,H);
      }
      raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);
  },[ping]);

  return <main className="game-page">
    <header className="masthead"><div className="brand"><div className="crest">♞</div><div><p className="eyebrow">A Mossguard Tale</p><h1>Mossguard: The Acorn Crown</h1></div></div><div className="chapter">Chapter I<br/>The Briar Road</div></header>
    <section className="cabinet" aria-label="Mossguard two-player game"><div className="screen"><canvas ref={canvasRef} aria-label="Side-scrolling cooperative battle arena"/>
      {screen==="play"&&<div className="hud"><div className="player-card"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P1 · BRAMBLE</span><span>{Math.ceil(hud.p1)}</span></div><div className="health"><i style={{width:`${hud.p1}%`}}/></div></div></div><div className="objective">Briar Gate · {Math.round(hud.progress)}%<b>{hud.remaining?`${hud.remaining} foes remain`:`Gate open — onward!`}</b></div><div className="player-card p2"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P2 · THIMBLE</span><span>{Math.ceil(hud.p2)}</span></div><div className="health"><i style={{width:`${hud.p2}%`}}/></div></div></div></div>}
      {screen!=="play"&&<div className="overlay"><div className="panel">{screen==="title"?<><span className="ribbon">Two mice. One impossible road.</span><h2>MOSSGUARD<span>The Acorn Crown</span></h2><p>Cross the briarwood together, scatter the Thornpaw bandits, and reach the moonlit gate. Double-jump, dash, and strike as a team.</p><button className="start-btn" onClick={reset}>Begin the quest</button><div className="tiny">2 players on one keyboard · gamepads supported</div></>:screen==="win"?<><span className="ribbon">The road is clear</span><h2>VICTORY<span>The crown awaits</span></h2><p>Bramble and Thimble reached the Briar Gate together. The woodland will sing of this night.</p><button className="start-btn" onClick={reset}>Ride again</button></>:<><span className="ribbon">The briars prevail</span><h2>FALLEN<span>But not forgotten</span></h2><p>Even the smallest knights may rise again.</p><button className="start-btn" onClick={reset}>Try again</button></>}</div></div>}
      <div className="vignette"/></div></section>
    <footer className="help"><div className="help-player"><b>P1</b><span><i className="key">A D</i> move <i className="key">W</i> jump <i className="key">F</i> strike <i className="key">G</i> dash</span></div><button className="audio-btn" onClick={()=>setSound(v=>!v)}>{sound?"♪ Sound on":"Sound off"}</button><div className="help-player"><span><i className="key">← →</i> move <i className="key">↑</i> jump <i className="key">K</i> strike <i className="key">L</i> dash</span><b>P2</b></div></footer>
  </main>;
}
