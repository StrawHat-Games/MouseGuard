"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x:number; y:number; w:number; h:number };
type MouseKind = "bramble"|"thimble";
type GameMode = "single"|"coop";
type Screen = "title"|"mode"|"select"|"map"|"play"|"win"|"lose";
type Traits = { strength:number; agility:number; magic:number };
type Fighter = { x:number; y:number; vx:number; vy:number; w:number; h:number; color:string; accent:string; face:number; hp:number; maxHp:number; mana:number; maxMana:number; lives:number; eliminated:boolean; jumps:number; grounded:boolean; attack:number; attackMax:number; attackQueue:number; attackConnected:boolean; combo:number; comboWindow:number; cooldown:number; dash:number; dashBurst:number; fireCooldown:number; invuln:number; dead:number; score:number; name:string; defending:boolean; guardCancel:number; strength:number; agility:number; magic:number };
type Enemy = Fighter & { kind:"badger"|"hare"|"bat"; home:number; active:boolean; defeated:boolean; ai:number };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string;size:number };
type Projectile = { x:number;y:number;vx:number;life:number;color:string;owner:Fighter };
type ManaPickup = { x:number;y:number;phase:number;collected:boolean;respawn:number };

const W=1600, H=900, FLOOR=770, WORLD=6100;
const ground:Rect={x:0,y:FLOOR,w:WORLD,h:140};
const platforms:Rect[]=[
  ground,
  {x:480,y:590,w:260,h:30},{x:860,y:480,w:220,h:28},{x:1370,y:610,w:300,h:28},{x:1770,y:490,w:250,h:28},{x:2350,y:575,w:270,h:28},{x:2800,y:440,w:230,h:28},{x:3510,y:580,w:310,h:28},{x:3990,y:465,w:240,h:28},{x:4570,y:610,w:280,h:28},{x:5000,y:490,w:250,h:28},{x:5400,y:600,w:240,h:28}
];
const enemySeeds=[
  [760,710,"badger"],[1020,420,"bat"],[1490,550,"hare"],[1890,430,"bat"],[2390,515,"badger"],[2860,380,"hare"],[3150,700,"badger"],[3610,520,"badger"],[4080,400,"bat"],[4590,550,"hare"],[4920,700,"badger"],[5150,430,"bat"],[5480,540,"badger"]
] as const;
const manaSeeds=[[560,535],[1240,705],[1515,555],[2450,520],[2920,385],[3650,525],[4100,410],[4700,555],[5480,545]] as const;
const mice:Record<MouseKind,{name:string;color:string;accent:string;title:string;description:string;traits:Traits}>={
  bramble:{name:"BRAMBLE",color:"#b8332e",accent:"#e6c24c",title:"The Oakblade",description:"A stout frontline knight whose sword strikes land with extra force.",traits:{strength:5,agility:2,magic:2}},
  thimble:{name:"THIMBLE",color:"#297388",accent:"#d8d0b6",title:"The Briarstep",description:"A nimble spell-knight with higher jumps, stronger fire, and a deeper mana pool.",traits:{strength:2,agility:5,magic:5}}
};
const mapLevels=[
  {name:"The Briar Road",region:"Thornpaw Wood",x:18,y:73,icon:"Ⅰ",available:true},
  {name:"Mossmere Crossing",region:"The Old River",x:45,y:53,icon:"Ⅱ",available:false},
  {name:"Moonroot Hollow",region:"The Whispering Deep",x:50,y:25,icon:"Ⅲ",available:false},
  {name:"Emberkeep",region:"The Redwall Vale",x:67,y:32,icon:"Ⅳ",available:false},
  {name:"Crownspire",region:"The Pale Mountains",x:87,y:15,icon:"Ⅴ",available:false}
] as const;

function fighter(x:number,color:string,accent:string,name:string,traits:Traits={strength:3,agility:3,magic:3}):Fighter { const maxMana=2+traits.magic;return {x,y:670,vx:0,vy:0,w:62,h:82,color,accent,face:1,hp:100,maxHp:100,mana:maxMana,maxMana,lives:5,eliminated:false,jumps:2,grounded:false,attack:0,attackMax:0,attackQueue:0,attackConnected:false,combo:0,comboWindow:0,cooldown:0,dash:0,dashBurst:0,fireCooldown:0,invuln:0,dead:0,score:0,name,defending:false,guardCancel:0,...traits}; }
function mouseFighter(x:number,kind:MouseKind){const mouse=mice[kind];return fighter(x,mouse.color,mouse.accent,mouse.name,mouse.traits);}
function overlaps(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}
function TraitMeter({label,value}:{label:string;value:number}){return <div className="trait-row"><span>{label}</span><div>{[1,2,3,4,5].map(level=><i key={level} className={level<=value?"full":""}/>)}</div><b>{value}</b></div>;}
function MouseCard({kind,selected,badge,onChoose}:{kind:MouseKind;selected:boolean;badge?:string;onChoose:()=>void}){const mouse=mice[kind];return <button className={`mouse-card ${selected?"selected":""}`} onClick={onChoose} aria-pressed={selected}>{badge&&<span className="pick-badge">{badge}</span>}<div className={`mouse-card-sprite ${kind}`} aria-hidden="true"/><div className="mouse-card-copy"><span className="mouse-role">{mouse.title}</span><h3>{mouse.name}</h3><p>{mouse.description}</p><div className="trait-list"><TraitMeter label="Strength" value={mouse.traits.strength}/><TraitMeter label="Agility" value={mouse.traits.agility}/><TraitMeter label="Magic" value={mouse.traits.magic}/></div></div></button>;}
function AdventureMap({completed,onStart}:{completed:number;onStart:()=>void}){return <div className="map-panel"><div className="map-heading"><div><span className="ribbon">The Acorn Crown · Adventure Map</span><h2>The Briarwood Marches</h2></div><p>Follow the old king's road. Each seal opens only when the chapter before it has been conquered.</p></div><div className="adventure-map"><div className="map-route route-one"/><div className="map-route route-two"/><div className="map-route route-three"/><div className="map-route route-four"/>{mapLevels.map((level,index)=><button key={level.name} className={`map-node node-${index+1} ${level.available?"available":"locked"} ${completed>index?"completed":""}`} style={{left:`${level.x}%`,top:`${level.y}%`}} disabled={!level.available} onClick={level.available?onStart:undefined} aria-label={level.available?`${level.name}, available level`:`${level.name}, locked level`}><span className="map-seal">{completed>index?"✓":level.available?"♞":"⌁"}</span><span className="map-label"><b>{level.name}</b><i>{level.region}</i>{level.available?<em>{completed>index?"Cleared · Play again":"Chapter I · Begin here"}</em>:<em>Locked</em>}</span></button>)}<div className="map-key"><span><i className="key-open"/>Available</span><span><i className="key-locked"/>Locked</span></div></div><div className="map-footer"><span>Selected: <b>The Briar Road</b></span><button className="start-btn" onClick={onStart}>{completed?"Replay The Briar Road":"Ride to The Briar Road"}</button><span>A / Start or Enter to embark · B / Esc back</span></div></div>;}

export default function Game(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<Screen>("title");
  const [screen,setScreen]=useState<Screen>("title");
  const [mode,setModeState]=useState<GameMode>("single");
  const modeRef=useRef<GameMode>("single");
  const [picks,setPicks]=useState<[MouseKind,MouseKind]>(["bramble","thimble"]);
  const picksRef=useRef<[MouseKind,MouseKind]>(["bramble","thimble"]);
  const [activePicker,setActivePicker]=useState(0);
  const activePickerRef=useRef(0);
  const [completedLevels,setCompletedLevels]=useState(0);
  const [hud,setHud]=useState<{p1:number;p2:number;p1Mana:number;p2Mana:number;p1MaxMana:number;p2MaxMana:number;p1Lives:number;p2Lives:number;remaining:number;progress:number}>({p1:100,p2:100,p1Mana:7,p2Mana:7,p1MaxMana:7,p2MaxMana:7,p1Lives:5,p2Lives:5,remaining:enemySeeds.length,progress:0});
  const [sound,setSound]=useState(true);
  const [controllers,setControllers]=useState<string[]>([]);
  const soundRef=useRef(true);
  const music=useRef<HTMLAudioElement|null>(null);
  const sfx=useRef<Record<string,HTMLAudioElement>>({});
  const keys=useRef(new Set<string>());
  const pressed=useRef(new Set<string>());
  const lastPadButtons=useRef<Record<number,boolean[]>>({});
  const menuPadButtons=useRef<Record<number,boolean[]>>({});
  const menuPadDirections=useRef<Record<number,{left:boolean;right:boolean}>>({});
  const game=useRef<{players:Fighter[];enemies:Enemy[];pickups:ManaPickup[];particles:Particle[];projectiles:Projectile[];camera:number;last:number;gateOpen:boolean;shake:number}|null>(null);

  const playSfx=useCallback((name:"jump"|"hit"|"take_damage"|"death"|"fireball_shoot"|"fireball_hit",volume=.55,pitchRange=.06)=>{if(!soundRef.current)return;const source=sfx.current[name]??=new Audio(`/sounds/${name}.wav`);source.preload="auto";const clip=source.cloneNode(true) as HTMLAudioElement;clip.volume=volume;clip.playbackRate=1+(Math.random()*2-1)*pitchRange;void clip.play().catch(()=>{});},[]);

  const startMusic=useCallback(()=>{if(!soundRef.current||stateRef.current!=="play")return;const track=music.current??=new Audio("/sounds/background.mp3");track.loop=true;track.volume=.34;track.playbackRate=1;if(track.paused)void track.play().catch(()=>{});},[]);

  const setMode=useCallback((next:GameMode)=>{modeRef.current=next;setModeState(next);},[]);
  const showMode=useCallback(()=>{stateRef.current="mode";setScreen("mode");},[]);
  const showSelect=useCallback(()=>{activePickerRef.current=0;setActivePicker(0);stateRef.current="select";setScreen("select");},[]);
  const showMap=useCallback(()=>{stateRef.current="map";setScreen("map");},[]);
  const pickMouse=useCallback((kind:MouseKind)=>{const player=activePickerRef.current;const next:[MouseKind,MouseKind]=[...picksRef.current];next[player]=kind;picksRef.current=next;setPicks(next);},[]);
  const changePick=useCallback((_direction:number)=>{pickMouse(picksRef.current[activePickerRef.current]==="bramble"?"thimble":"bramble");},[pickMouse]);

  const reset=useCallback(()=>{
    const players=[mouseFighter(180,picksRef.current[0]),mouseFighter(270,picksRef.current[1])];if(modeRef.current==="single"){players[1].eliminated=true;players[1].lives=0;}
    game.current={players,enemies:enemySeeds.map(([x,y,k],i)=>({...fighter(x,k==="badger"?"#5c4a3d":k==="hare"?"#9a7653":"#4b3a64",k==="badger"?"#d55337":k==="hare"?"#6c9d4c":"#be4b75",k.toUpperCase()),y,w:k==="bat"?58:64,h:k==="bat"?55:76,kind:k,home:x,active:false,defeated:false,ai:i*.7})),pickups:manaSeeds.map(([x,y],i)=>({x,y,phase:i*1.73,collected:false,respawn:0})),particles:[],projectiles:[],camera:0,last:performance.now(),gateOpen:false,shake:0};
    stateRef.current="play";setScreen("play");setHud({p1:100,p2:100,p1Mana:players[0].mana,p2Mana:players[1].mana,p1MaxMana:players[0].maxMana,p2MaxMana:players[1].maxMana,p1Lives:5,p2Lives:players[1].lives,remaining:enemySeeds.length,progress:0});requestAnimationFrame(()=>canvasRef.current?.focus());startMusic();
  },[startMusic]);

  const confirmCharacter=useCallback(()=>{if(modeRef.current==="coop"&&activePickerRef.current===0){activePickerRef.current=1;setActivePicker(1);return;}showMap();},[showMap]);

  useEffect(()=>{let raf=0;const pollMenuPads=()=>{const pads=Array.from(navigator.getGamepads?.()||[]).filter((pad):pad is Gamepad=>!!pad&&pad.connected).sort((a,b)=>a.index-b.index).slice(0,2);let handled=false;for(const pad of pads){const now=pad.buttons.map(button=>button.pressed),before=menuPadButtons.current[pad.index]||[],beforeDirection=menuPadDirections.current[pad.index]||{left:false,right:false},left=pad.axes[0]<-.35||!!pad.buttons[14]?.pressed,right=pad.axes[0]>.35||!!pad.buttons[15]?.pressed;if(!handled&&stateRef.current!=="play"){const confirm=(now[0]&&!before[0])||(now[9]&&!before[9]),back=now[1]&&!before[1],toggleSound=now[3]&&!before[3],move=(left&&!beforeDirection.left)?-1:(right&&!beforeDirection.right)?1:0;if(toggleSound){handled=true;setSound(value=>!value);}else if(back){handled=true;if(stateRef.current==="map")showSelect();else if(stateRef.current==="select")showMode();else if(stateRef.current==="mode"){stateRef.current="title";setScreen("title");}}else if(stateRef.current==="title"&&confirm){handled=true;showMode();}else if(stateRef.current==="mode"){if(move){handled=true;setMode(modeRef.current==="single"?"coop":"single");}else if(confirm){handled=true;showSelect();}}else if(stateRef.current==="select"){if(move){handled=true;changePick(move);}else if(confirm){handled=true;confirmCharacter();}}else if(stateRef.current==="map"&&confirm){handled=true;reset();}else if(stateRef.current==="win"&&confirm){handled=true;showMap();}else if(stateRef.current==="lose"&&confirm){handled=true;reset();}}menuPadButtons.current[pad.index]=now;menuPadDirections.current[pad.index]={left,right};}raf=requestAnimationFrame(pollMenuPads);};raf=requestAnimationFrame(pollMenuPads);return()=>cancelAnimationFrame(raf);},[changePick,confirmCharacter,reset,setMode,showMap,showMode,showSelect]);

  useEffect(()=>{soundRef.current=sound;if(!sound)music.current?.pause();else if(stateRef.current==="play")startMusic();},[sound,startMusic]);
  useEffect(()=>()=>{music.current?.pause();},[]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(stateRef.current!=="play"){if(e.repeat)return;if(e.code==="Escape"){if(stateRef.current==="map")showSelect();else if(stateRef.current==="select")showMode();else if(stateRef.current==="mode"){stateRef.current="title";setScreen("title");}return;}if(stateRef.current==="title"&&(e.code==="Enter"||e.code==="Space")){showMode();return;}if(stateRef.current==="mode"){if(["ArrowLeft","ArrowRight","KeyA","KeyD"].includes(e.code))setMode(modeRef.current==="single"?"coop":"single");else if(e.code==="Enter"||e.code==="Space")showSelect();return;}if(stateRef.current==="select"){if(["ArrowLeft","ArrowRight","KeyA","KeyD"].includes(e.code))changePick(e.code==="ArrowLeft"||e.code==="KeyA"?-1:1);else if(["Enter","Space","KeyF","KeyK"].includes(e.code))confirmCharacter();return;}if(stateRef.current==="map"&&["Enter","Space","KeyF","KeyK"].includes(e.code)){reset();return;}if(stateRef.current==="win"&&(e.code==="Enter"||e.code==="Space")){showMap();return;}if(stateRef.current==="lose"&&(e.code==="Enter"||e.code==="Space")){reset();return;}}if(!keys.current.has(e.code))pressed.current.add(e.code);keys.current.add(e.code);if(e.code==="Escape"){stateRef.current="title";setScreen("title");music.current?.pause();}};
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    const blur=()=>{keys.current.clear();pressed.current.clear();};
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);addEventListener("blur",blur);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);removeEventListener("blur",blur);};
  },[changePick,confirmCharacter,reset,setMode,showMap,showMode,showSelect]);

  useEffect(()=>{
    const refresh=()=>setControllers(Array.from(navigator.getGamepads?.()||[]).filter((p):p is Gamepad=>!!p&&p.connected).sort((a,b)=>a.index-b.index).slice(0,2).map(p=>p.id.replace(/\s*\([^)]*\)\s*/g," ").trim()));
    refresh();
    addEventListener("gamepadconnected",refresh);addEventListener("gamepaddisconnected",refresh);
    const timer=setInterval(refresh,800);
    return()=>{removeEventListener("gamepadconnected",refresh);removeEventListener("gamepaddisconnected",refresh);clearInterval(timer);};
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return; const ctx=canvas.getContext("2d");if(!ctx)return;
    let raf=0;
    const spriteImages={bramble:new Image(),thimble:new Image(),enemies:new Image(),hare:new Image(),sword:new Image(),shield:new Image(),combo:new Image(),birds:new Image(),background:new Image(),midground:new Image(),foreground:new Image()};
    spriteImages.bramble.src="/sprites/bramble-sheet.png";
    spriteImages.thimble.src="/sprites/thimble-sheet.png";
    spriteImages.enemies.src="/sprites/enemies-sheet.png";
    spriteImages.hare.src="/sprites/hare.png";
    spriteImages.sword.src="/sprites/sword.png";
    spriteImages.shield.src="/sprites/shield.png";
    spriteImages.combo.src="/sprites/combo-effects.png";
    spriteImages.birds.src="/sprites/distant-bird-sheet.png";
    spriteImages.background.src="/backgrounds/briarwood-background.png";
    spriteImages.midground.src="/backgrounds/briarwood-midground-path.png";
    spriteImages.foreground.src="/backgrounds/foreground-v2.png";
    const resize=()=>{const d=Math.min(devicePixelRatio,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);};resize();
    function getInput(index:number){
      const k=keys.current,p=pressed.current;
      const gp=Array.from(navigator.getGamepads?.()||[]).filter((pad):pad is Gamepad=>!!pad&&pad.connected).sort((a,b)=>a.index-b.index)[index];
      const now=gp?.buttons.map(b=>b.pressed)||[];
      const before=gp?lastPadButtons.current[gp.index]||[]:[];
      const edge=(...buttons:number[])=>buttons.some(n=>now[n]&&!before[n]);
      const left=!!gp&&(gp.axes[0]<-.28||gp.buttons[14]?.pressed),right=!!gp&&(gp.axes[0]>.28||gp.buttons[15]?.pressed),down=!!gp&&(gp.axes[1]>.5||gp.buttons[13]?.pressed);
      const padJump=edge(0),padAttack=edge(2),padDash=edge(1,5),padFire=edge(3,7),padBlock=!!gp?.buttons[4]?.pressed;
      if(gp)lastPadButtons.current[gp.index]=now;
      if(index===0)return {l:k.has("KeyA")||left,r:k.has("KeyD")||right,d:k.has("KeyS")||down,j:p.has("KeyW")||p.has("Space")||padJump,a:p.has("KeyF")||p.has("KeyX")||padAttack,dash:p.has("KeyG")||p.has("KeyB")||padDash,fire:p.has("KeyR")||p.has("KeyY")||padFire,block:k.has("ShiftLeft")||padBlock};
      return {l:k.has("ArrowLeft")||left,r:k.has("ArrowRight")||right,d:k.has("ArrowDown")||down,j:p.has("ArrowUp")||p.has("Numpad0")||padJump,a:p.has("KeyK")||p.has("Slash")||p.has("Numpad1")||padAttack,dash:p.has("KeyL")||p.has("Period")||p.has("Numpad2")||padDash,fire:p.has("KeyO")||p.has("Numpad3")||padFire,block:k.has("ShiftRight")||padBlock};
    }
    function burst(x:number,y:number,color:string,n=8){const g=game.current;if(!g)return;for(let i=0;i<n;i++)g.particles.push({x,y,vx:(Math.random()-.5)*12,vy:(Math.random()-.8)*10,life:1,color,size:3+Math.random()*7});}
    function land(entity:Fighter,prevY:number){entity.grounded=false;for(const p of platforms){if(entity.vy>=0&&entity.x+entity.w>p.x+8&&entity.x<p.x+p.w-8&&prevY+entity.h<=p.y+12&&entity.y+entity.h>=p.y){entity.y=p.y-entity.h;entity.vy=0;entity.grounded=true;entity.jumps=2;}}}
    function playerBounds(p:Fighter):Rect{return{x:p.x,y:p.y-34,w:p.w,h:p.h+34};}
    const comboDurations=[0,.24,.27,.36];
    function attackProgress(p:Fighter){return p.attackMax>0?clamp(1-p.attack/p.attackMax,0,1):0;}
    function attackActive(p:Fighter){if(p.attack<=0)return false;const progress=attackProgress(p);return progress>(p.combo===3?.11:.16)&&progress<(p.combo===1?.8:.88);}
    function swordPose(p:Fighter){const progress=attackProgress(p),ease=1-Math.pow(1-progress,3);if(p.combo===2)return{angle:.62-ease*1.3,reach:116,pivotY:p.y+p.h-66};if(p.combo===3)return{angle:-1.7+ease*2.48,reach:128,pivotY:p.y+p.h-70};return{angle:-1.16+ease*1.62,reach:108,pivotY:p.y+p.h-69};}
    function swordBounds(p:Fighter):Rect{const pose=swordPose(p),pivotX=p.x+p.w/2+p.face*16,start=4,pad=p.combo===3?18:14;const startX=pivotX+p.face*Math.cos(pose.angle)*start,startY=pose.pivotY+Math.sin(pose.angle)*start,endX=pivotX+p.face*Math.cos(pose.angle)*pose.reach,endY=pose.pivotY+Math.sin(pose.angle)*pose.reach;return{x:Math.min(startX,endX)-pad,y:Math.min(startY,endY)-pad,w:Math.abs(endX-startX)+pad*2,h:Math.abs(endY-startY)+pad*2};}
    function beginAttack(p:Fighter,step:number,preserveQueue=false){p.defending=false;p.guardCancel=.24;p.combo=step;p.comboWindow=.5;p.attackMax=comboDurations[step];p.attack=p.attackMax;if(!preserveQueue)p.attackQueue=0;p.attackConnected=false;p.cooldown=.06;if(p.grounded)p.vx+=p.face*(step===1?1.4:step===2?2.2:3.8);playSfx("hit",step===3?.62:.46,step===3?.035:.075);}
    function swordPower(p:Fighter){return p.combo===3?15+p.strength*2.5:p.combo===2?11+p.strength*2.15:9+p.strength*1.9;}
    function hit(target:Fighter,from:Fighter,power:number,sourceX?:number,knockback=1,lift=0){if(target.invuln>0||target.dead>0||target.eliminated)return;const attackX=sourceX??from.x+from.w/2;if(target.defending&&(attackX-(target.x+target.w/2))*target.face>0){target.invuln=.12;target.vx-=target.face*1.5;burst(target.x+target.w/2+target.face*34,target.y+35,"#f3cf67",6);playSfx("hit",.3,.09);return;}target.hp-=power;const g=game.current,isPlayer=!!g?.players.includes(target);if(isPlayer&&g)g.shake=Math.max(g.shake,Math.min(6,2.7+power*.14));target.vx=from.face*(8+power*.22)*knockback;target.vy=-5-power*.12-lift;target.invuln=.36;burst(target.x+target.w/2,target.y+target.h/2,target.accent,9);playSfx("take_damage",.5,.08);if(target.hp<=0){if(isPlayer)target.lives=Math.max(0,target.lives-1);target.dead=1.6;target.defending=false;target.attack=target.attackMax=target.combo=target.comboWindow=target.attackQueue=0;target.vy=-13;target.vx=from.face*13;from.score++;burst(target.x+target.w/2,target.y+target.h/2,"#f5d66d",20);playSfx("death",.72,.035);}}
    function updatePlayer(p:Fighter,i:number,dt:number){if(p.eliminated)return;if(p.dead>0){p.defending=false;p.dead-=dt;p.vy+=34*dt;p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;if(p.dead<=0){if(p.lives<=0){p.eliminated=true;p.y=1100;p.vx=p.vy=0;return;}p.hp=100;p.mana=p.maxMana;p.x=Math.max(120,(game.current?.camera||0)+180+i*90);p.y=560;p.vx=p.vy=0;p.attack=p.attackMax=p.combo=p.comboWindow=p.attackQueue=0;p.invuln=2;p.guardCancel=0;}return;}
      const q=getInput(i),agilityBoost=1+(p.agility-3)*.055,acc=(p.grounded?2.2:1.25)*agilityBoost,maxRun=8+p.agility*.35,cancelGuard=(q.j&&p.jumps>0)||q.a||(q.fire&&p.fireCooldown<=0&&p.mana>0);p.defending=q.block&&p.guardCancel<=0&&!cancelGuard&&p.attack<=0&&p.dashBurst<=0&&p.fireCooldown<.48;
      if(p.defending){if(p.grounded)p.vx=0;}else if(p.dashBurst<=0){if(q.l){p.vx-=acc;p.face=-1;}if(q.r){p.vx+=acc;p.face=1;}if(!q.l&&!q.r)p.vx*=p.grounded?.72:.97;p.vx=clamp(p.vx,-maxRun,maxRun);}else{p.vx=p.face*25;p.vy*=.82;}
      if(q.j&&p.jumps>0){p.defending=false;p.guardCancel=.26;p.vy=p.grounded?-(14.4+p.agility*.42):-(12.2+p.agility*.34);p.grounded=false;p.jumps--;playSfx("jump",.45,.07);burst(p.x+p.w/2,p.y+p.h,"#e8d59d",5);} if(!p.defending&&q.d&&!p.grounded&&p.vy>0)p.vy+=2.2;
      if(!p.defending&&q.dash&&p.dash<=0){p.vx=p.face*25;p.vy*=.18;p.dash=.82;p.dashBurst=.2;p.invuln=.28;burst(p.x+p.w/2,p.y+p.h/2,p.accent,15);}if(q.a){if(p.attack>0){p.attackQueue=Math.min(3-p.combo,p.attackQueue+1);}else if(p.cooldown<=0)beginAttack(p,p.comboWindow>0&&p.combo>0?p.combo%3+1:1);}if(q.fire&&p.fireCooldown<=0&&p.mana>0){p.defending=false;p.guardCancel=.3;p.attack=p.attackMax=p.combo=p.comboWindow=p.attackQueue=0;p.mana--;game.current?.projectiles.push({x:p.x+p.w/2+p.face*38,y:p.y+4,vx:p.face*15,life:1.5,color:i?"#69d8ef":"#ff9f3f",owner:p});p.fireCooldown=.72;burst(p.x+p.w/2+p.face*35,p.y+4,i?"#69d8ef":"#ff9f3f",7);playSfx("fireball_shoot",.52,.06);}
      const wasAttacking=p.attack>0;p.cooldown-=dt;p.attack=Math.max(0,p.attack-dt);p.dash-=dt;p.dashBurst-=dt;p.fireCooldown-=dt;p.invuln-=dt;p.guardCancel-=dt;if(p.attack<=0&&wasAttacking&&p.attackQueue>0){p.attackQueue--;beginAttack(p,p.combo>=3?1:p.combo+1,true);}else if(p.attack<=0){p.comboWindow=Math.max(0,p.comboWindow-dt);if(p.comboWindow<=0)p.combo=0;}p.vy+=p.dashBurst>0?.18:.82;const prev=p.y;p.x+=p.vx;p.y+=p.vy;land(p,prev);p.x=clamp(p.x,0,WORLD-p.w);if(p.y>980){p.hp=0;p.lives=Math.max(0,p.lives-1);p.dead=.7;}
      if(attackActive(p)){const blade=swordBounds(p),power=swordPower(p);let struckEnemy=false;for(const e of game.current?.enemies||[])if(!e.defeated&&e.invuln<=0&&overlaps(blade,e)){hit(e,p,power,undefined,p.combo===3?1.45:p.combo===2?1.15:1,p.combo===3?4:0);struckEnemy=true;}if(struckEnemy&&!p.attackConnected){p.attackConnected=true;p.vx=-p.face*(p.combo===3?7.2:p.combo===2?5.4:4.1);p.vy=Math.min(p.vy,p.combo===3?-2.8:-1.4);burst(p.x+p.w/2+p.face*70,p.y+28,p.combo===3?"#fff7d2":"#fff1a8",p.combo===3?12:6);if(p.combo===3&&game.current)game.current.shake=Math.max(game.current.shake,3.4);}}
    }
    function resolvePlayerSwords(){const g=game.current;if(!g)return;const [a,b]=g.players;if(a.eliminated||b.eliminated||a.dead>0||b.dead>0)return;const aBlade=attackActive(a)?swordBounds(a):null,bBlade=attackActive(b)?swordBounds(b):null;if(aBlade&&bBlade&&overlaps(aBlade,bBlade)){const direction=Math.sign((a.x+a.w/2)-(b.x+b.w/2))||-a.face,force=12+Math.max(a.combo,b.combo)*1.5;a.vx=direction*force;b.vx=-direction*force;a.vy=Math.min(a.vy,-2.6);b.vy=Math.min(b.vy,-2.6);a.attack=b.attack=.04;a.attackQueue=b.attackQueue=0;a.invuln=b.invuln=.14;burst((a.x+b.x+a.w)/2,Math.min(a.y,b.y)+28,"#fff4bd",22);playSfx("hit",.7,.065);g.shake=Math.max(g.shake,3);return;}if(aBlade&&overlaps(aBlade,playerBounds(b)))hit(b,a,swordPower(a),undefined,a.combo===3?1.45:a.combo===2?1.15:1,a.combo===3?4:0);if(bBlade&&overlaps(bBlade,playerBounds(a)))hit(a,b,swordPower(b),undefined,b.combo===3?1.45:b.combo===2?1.15:1,b.combo===3?4:0);}
    function updateEnemy(e:Enemy,dt:number){if(e.defeated)return;if(e.dead>0){e.dead-=dt;e.vy+=.7;e.x+=e.vx;e.y+=e.vy;if(e.dead<=0){e.defeated=true;e.active=false;}return;}const g=game.current!;const near=g.players.filter(p=>!p.eliminated&&p.dead<=0).sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(!near)return;e.active=Math.abs(near.x-e.x)<680||e.active;if(!e.active)return;e.ai-=dt;e.invuln-=dt;e.cooldown-=dt;e.attack-=dt;
      const dx=near.x-e.x;e.face=dx>=0?1:-1;if(e.kind==="bat"){e.vx+=Math.sign(dx)*.12;e.vy+=(near.y-70-e.y)*.0018;e.vy+=Math.sin(performance.now()/250+e.home)*.06;e.vx=clamp(e.vx,-3.8,3.8);e.vy=clamp(e.vy,-3.3,3.3);e.x+=e.vx;e.y+=e.vy;}
      else {if(Math.abs(dx)>92)e.vx+=Math.sign(dx)*(e.kind==="hare"?.34:.22);else e.vx*=.72;e.vx=clamp(e.vx,-(e.kind==="hare"?5:3.3),e.kind==="hare"?5:3.3);if(e.kind==="hare"&&e.grounded&&e.ai<=0){e.vy=-12;e.ai=1.7;}const prev=e.y;e.vy+=.82;e.x+=e.vx;e.y+=e.vy;land(e,prev);}
      if(Math.abs(dx)<92&&Math.abs(near.y-e.y)<110&&e.cooldown<=0){e.attack=.25;e.cooldown=1.05;e.ai=.55;}if(e.attack>.08&&e.attack<.2&&overlaps({x:e.x-22,y:e.y,w:e.w+44,h:e.h},playerBounds(near)))hit(near,e,e.kind==="badger"?13:9);if(e.y>980){e.defeated=true;}
    }
    function drawMouse(p:Fighter,camera:number){
      if(p.eliminated||p.dead>0&&Math.floor(p.dead*10)%2)return;
      const sprite=p.name==="BRAMBLE"?spriteImages.bramble:spriteImages.thimble;
      if(!sprite.complete||!sprite.naturalWidth)return;
      const runFrame=1+(Math.floor(performance.now()/105)%2);
      const frame=p.fireCooldown>.48?4:p.attack>0?(p.combo===2?1:3):!p.grounded?1:Math.abs(p.vx)>1.4?runFrame:0;
      const sw=sprite.naturalWidth/5,sh=sprite.naturalHeight;
      const bob=p.grounded&&frame===0?Math.sin(performance.now()/180)*2:0;
      const dh=p.name==="BRAMBLE"?142:150,dw=dh*(sw/sh);
      ctx!.save();
      const feet=p.y+p.h,center=p.x+p.w/2,surface=platforms.filter(platform=>center>=platform.x&&center<=platform.x+platform.w&&platform.y>=feet-4).reduce((nearest,platform)=>Math.min(nearest,platform.y),FLOOR),airHeight=Math.max(0,surface-feet),shadowScale=clamp(1-airHeight/440,.38,1);
      ctx!.fillStyle=`rgba(16,12,8,${.25*shadowScale})`;ctx!.beginPath();ctx!.ellipse(center-camera,surface+5,52*shadowScale,11*shadowScale,0,0,Math.PI*2);ctx!.fill();
      ctx!.translate(p.x-camera+p.w/2,p.y+p.h+bob);ctx!.scale(p.face*(p.dashBurst>0?1.16:1),p.dashBurst>0?.88:1);
      if(p.invuln>0&&Math.floor(p.invuln*20)%2)ctx!.globalAlpha=.35;
      if(p.attack<=0&&spriteImages.sword.complete&&spriteImages.sword.naturalWidth){
        const swordW=76,swordH=swordW*(spriteImages.sword.naturalHeight/spriteImages.sword.naturalWidth);
        ctx!.save();ctx!.translate(-13,-62);ctx!.rotate(.94);ctx!.drawImage(spriteImages.sword,-9,-swordH/2,swordW,swordH);ctx!.restore();
      }
      ctx!.drawImage(sprite,frame*sw,0,sw,sh,-dw/2,-dh,dw,dh);
      if(p.attack>0&&spriteImages.combo.complete&&spriteImages.combo.naturalWidth){const effect=spriteImages.combo,cellW=effect.naturalWidth/3,cellH=effect.naturalHeight/2,col=clamp(p.combo-1,0,2),row=p.name==="BRAMBLE"?0:1,progress=attackProgress(p),size=p.combo===3?208:p.combo===2?188:166;ctx!.save();ctx!.globalCompositeOperation="screen";ctx!.globalAlpha=Math.sin(progress*Math.PI)*.88;ctx!.drawImage(effect,col*cellW,row*cellH,cellW,cellH,-size*.42,-size*.83,size,size);ctx!.restore();}
      if(p.attack>0&&spriteImages.sword.complete&&spriteImages.sword.naturalWidth){
        const pose=swordPose(p),swordW=pose.reach,swordH=swordW*(spriteImages.sword.naturalHeight/spriteImages.sword.naturalWidth);
        ctx!.save();ctx!.translate(16,pose.pivotY-(p.y+p.h));ctx!.rotate(pose.angle);ctx!.drawImage(spriteImages.sword,-10,-swordH/2,swordW,swordH);ctx!.restore();
      }
      if(p.defending&&spriteImages.shield.complete&&spriteImages.shield.naturalWidth){const shieldH=52.5,shieldW=shieldH*(spriteImages.shield.naturalWidth/spriteImages.shield.naturalHeight);ctx!.save();ctx!.translate(72,0);ctx!.scale(-1,1);ctx!.drawImage(spriteImages.shield,0,-88,shieldW,shieldH);ctx!.restore();}
      ctx!.restore();
    }
    function drawEnemy(e:Enemy,camera:number){
      if(e.defeated||e.x-camera<-160||e.x-camera>W+160)return;
      const sprite=e.kind==="hare"?spriteImages.hare:spriteImages.enemies;if(!sprite.complete||!sprite.naturalWidth)return;
      const frame=e.kind==="badger"?0:e.kind==="bat"?2:0;
      const sw=e.kind==="hare"?sprite.naturalWidth:sprite.naturalWidth/3,sh=sprite.naturalHeight;
      const dh=e.kind==="badger"?156:e.kind==="hare"?166:154,dw=dh*(sw/sh);
      const bob=e.kind==="bat"?Math.sin(performance.now()/150+e.home)*7:0;
      ctx!.save();
      if(e.kind!=="bat"){ctx!.fillStyle="#100c083c";ctx!.beginPath();ctx!.ellipse(e.x-camera+e.w/2,e.y+e.h+5,48,10,0,0,Math.PI*2);ctx!.fill();}
      ctx!.translate(e.x-camera+e.w/2,e.y+e.h+bob);ctx!.scale(e.kind==="hare"?e.face:-e.face,1);
      if(e.invuln>0&&Math.floor(e.invuln*20)%2)ctx!.globalAlpha=.35;
      if(e.attack>0)ctx!.rotate(-e.face*.08);
      ctx!.drawImage(sprite,frame*sw,0,sw,sh,-dw/2,-dh,dw,dh);
      ctx!.restore();
    }
    function manaY(p:ManaPickup){return p.y+Math.sin(performance.now()/310+p.phase)*9;}
    function drawMana(p:ManaPickup,camera:number){if(p.collected||p.x-camera<-60||p.x-camera>W+60)return;const y=manaY(p);ctx!.save();ctx!.translate(p.x-camera,y);ctx!.shadowColor="#5cecff";ctx!.shadowBlur=24;ctx!.fillStyle="#745233";ctx!.fillRect(-7,-29,14,8);ctx!.fillStyle="#c9f8ffcc";ctx!.strokeStyle="#ddffff";ctx!.lineWidth=3;ctx!.beginPath();ctx!.roundRect(-16,-21,32,38,9);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#38bfe8";ctx!.beginPath();ctx!.roundRect(-12,-5,24,18,6);ctx!.fill();ctx!.fillStyle="#bfffff";ctx!.beginPath();ctx!.arc(-5,-1,4,0,7);ctx!.fill();ctx!.restore();}
    function drawClouds(camera:number,now:number){const wrap=(n:number,size:number)=>((n%size)+size)%size;ctx!.save();ctx!.globalAlpha=.14;ctx!.filter="blur(2px)";for(let i=0;i<6;i++){const scale=.72+(i%3)*.2,x=wrap(i*347+now*(.006+i*.001)-camera*.018,W+520)-260,y=95+(i%3)*86;ctx!.save();ctx!.translate(x,y);ctx!.scale(scale,scale);ctx!.fillStyle=i%2?"#dbe7d7":"#edf0dc";ctx!.beginPath();ctx!.ellipse(-66,10,72,25,0,0,Math.PI*2);ctx!.ellipse(-18,-8,58,36,0,0,Math.PI*2);ctx!.ellipse(39,3,70,29,0,0,Math.PI*2);ctx!.ellipse(88,15,51,20,0,0,Math.PI*2);ctx!.fill();ctx!.restore();}ctx!.restore();}
    function drawBackgroundBirds(camera:number,now:number){const sprite=spriteImages.birds;if(!sprite.complete||!sprite.naturalWidth)return;const wrap=(n:number,size:number)=>((n%size)+size)%size,sw=sprite.naturalWidth/2,sh=sprite.naturalHeight,frame=Math.floor(now/185)%2,baseX=wrap(now*.045-camera*.025,W+980)-490,baseY=205+Math.sin(now/1200)*20;ctx!.save();ctx!.globalAlpha=.5;for(let bird=0;bird<4;bird++){const size=50-bird*5,x=baseX-bird*68,y=baseY+bird*18+Math.sin(now/260+bird)*5;ctx!.drawImage(sprite,frame*sw,0,sw,sh,x,y,size*(sw/sh),size);}ctx!.restore();}
    function drawLeaves(camera:number,now:number){const wrap=(n:number,size:number)=>((n%size)+size)%size;ctx!.save();for(let i=0;i<22;i++){const depth=.2+(i%5)*.12,x=wrap(i*179+now*(.018+i%4*.005)-camera*depth,W+180)-90,y=wrap(i*131+now*(.025+i%3*.007),H+170)-100,size=4+(i%4)*2,angle=now*.0016+i*1.7+Math.sin(now/310+i);ctx!.save();ctx!.translate(x+Math.sin(now/420+i)*22,y);ctx!.rotate(angle);ctx!.globalAlpha=.3+depth*.42;ctx!.fillStyle=i%3===0?"#b56a32":i%3===1?"#d49a3e":"#6f843d";ctx!.beginPath();ctx!.ellipse(0,0,size,size*.45,0,0,Math.PI*2);ctx!.fill();ctx!.restore();}ctx!.restore();}
    function render(g:NonNullable<typeof game.current>){const cam=g.camera,background=spriteImages.background,midground=spriteImages.midground;
      ctx!.fillStyle="#13252b";ctx!.fillRect(0,0,W,H);ctx!.save();if(g.shake>0)ctx!.translate((Math.random()*2-1)*g.shake,(Math.random()*2-1)*g.shake*.65);
      const drawTiled=(image:HTMLImageElement,y:number,h:number,speed:number)=>{const tileW=h*(image.naturalWidth/image.naturalHeight),scroll=cam*speed,firstTile=Math.floor(scroll/tileW),offset=scroll-firstTile*tileW;for(let i=0,x=-offset;x<W+tileW;i++,x+=tileW){ctx!.save();if((firstTile+i)%2){ctx!.translate(x+tileW,0);ctx!.scale(-1,1);ctx!.drawImage(image,0,y,tileW,h);}else ctx!.drawImage(image,x,y,tileW,h);ctx!.restore();}};
      if(background.complete&&background.naturalWidth)drawTiled(background,0,H,.035);else{const sky=ctx!.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#13252b");sky.addColorStop(.58,"#4f725f");sky.addColorStop(1,"#d89a52");ctx!.fillStyle=sky;ctx!.fillRect(0,0,W,H);}
      const now=performance.now();drawClouds(cam,now);drawBackgroundBirds(cam,now);
      if(midground.complete&&midground.naturalWidth)drawTiled(midground,150,H,1);
      drawLeaves(cam,now);
      for(const p of platforms){if(p===ground||p.x-cam>W||p.x+p.w-cam<0)continue;ctx!.fillStyle="#6a4c2c";ctx!.fillRect(p.x-cam,p.y,p.w,p.h);ctx!.fillStyle="#447044";ctx!.fillRect(p.x-cam,p.y,p.w,16);ctx!.fillStyle="#78a958";ctx!.fillRect(p.x-cam,p.y,p.w,5);ctx!.fillStyle="#392a20";for(let x=p.x+30;x<p.x+p.w;x+=75)ctx!.fillRect(x-cam,p.y+38,12,p.h-38);}
      const gateX=5860;ctx!.fillStyle=g.gateOpen?"#e2c25a":"#5f5143";ctx!.strokeStyle="#211b17";ctx!.lineWidth=12;ctx!.beginPath();ctx!.roundRect(gateX-cam,470,150,300,70);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#1d2826";ctx!.beginPath();ctx!.roundRect(gateX+27-cam,514,96,256,48);ctx!.fill();if(g.gateOpen){ctx!.fillStyle="#f5d87255";ctx!.beginPath();ctx!.ellipse(gateX+75-cam,635,95+Math.sin(performance.now()/180)*8,150,0,0,7);ctx!.fill();}
      for(const pickup of g.pickups)drawMana(pickup,cam);for(const e of g.enemies)drawEnemy(e,cam);for(const f of g.projectiles){ctx!.save();ctx!.shadowColor=f.color;ctx!.shadowBlur=24;ctx!.fillStyle=f.color;ctx!.beginPath();ctx!.arc(f.x-cam,f.y,15+Math.sin(performance.now()/45)*2,0,7);ctx!.fill();ctx!.fillStyle="#fff3bc";ctx!.beginPath();ctx!.arc(f.x-cam+Math.sign(f.vx)*3,f.y-3,6,0,7);ctx!.fill();ctx!.restore();}for(const p of g.players)drawMouse(p,cam);for(const q of g.particles){ctx!.globalAlpha=clamp(q.life,0,1);ctx!.fillStyle=q.color;ctx!.fillRect(q.x-cam,q.y,q.size,q.size);}ctx!.globalAlpha=1;
      const foreground=spriteImages.foreground;if(foreground.complete&&foreground.naturalWidth){ctx!.save();ctx!.globalAlpha=.93;ctx!.globalCompositeOperation="multiply";drawTiled(foreground,H-228,230,1.32);ctx!.restore();}
      ctx!.restore();
    }
    function loop(t:number){
      const g=game.current;
      if(g){
        const dt=Math.min(.033,(t-g.last)/1000);g.last=t;g.shake=Math.max(0,g.shake-dt*30);
        if(stateRef.current==="play"){
          for(let i=0;i<g.players.length;i++)updatePlayer(g.players[i],i,dt);resolvePlayerSwords();
          for(const pickup of g.pickups){if(pickup.collected){pickup.respawn-=dt;if(pickup.respawn<=0){pickup.collected=false;pickup.respawn=0;}continue;}const bottle={x:pickup.x-20,y:manaY(pickup)-32,w:40,h:54};for(const player of g.players){if(!player.eliminated&&player.dead<=0&&player.mana<player.maxMana&&overlaps(bottle,playerBounds(player))){pickup.collected=true;pickup.respawn=10;player.mana=Math.min(player.maxMana,player.mana+3);burst(pickup.x,manaY(pickup),"#5cecff",16);break;}}}
          for(const e of g.enemies)updateEnemy(e,dt);
          for(const f of g.projectiles){f.x+=f.vx;f.life-=dt;const firePower=12+f.owner.magic*2,fireball={x:f.x-16,y:f.y-16,w:32,h:32};for(const e of g.enemies){if(!e.defeated&&f.life>0&&overlaps(fireball,e)){hit(e,f.owner,firePower,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}for(const player of g.players){if(player!==f.owner&&!player.eliminated&&player.dead<=0&&f.life>0&&overlaps(fireball,playerBounds(player))){hit(player,f.owner,firePower,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}}
          g.projectiles=g.projectiles.filter(f=>f.life>0&&f.x>0&&f.x<WORLD);
          for(const q of g.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.35;q.life-=dt*1.8;}
          g.particles=g.particles.filter(q=>q.life>0);
          const alive=g.enemies.filter(e=>!e.defeated).length;
          g.gateOpen=alive===0;
          const activePlayers=g.players.filter(p=>!p.eliminated),lead=activePlayers.length?Math.max(...activePlayers.map(p=>p.x)):g.camera+W*.42;
          const back=activePlayers.length?Math.min(...activePlayers.map(p=>p.x)):lead;
          g.camera+=(clamp((lead+back)/2-W*.42,0,WORLD-W)-g.camera)*.08;
          if(g.gateOpen&&g.players.every(p=>p.eliminated||p.x>5820)){setCompletedLevels(level=>Math.max(level,1));stateRef.current="win";setScreen("win");}
          if(g.players.every(p=>p.eliminated)){stateRef.current="lose";setScreen("lose");}
          if(Math.floor(t/120)%4===0)setHud({p1:Math.max(0,g.players[0].hp),p2:Math.max(0,g.players[1].hp),p1Mana:g.players[0].mana,p2Mana:g.players[1].mana,p1MaxMana:g.players[0].maxMana,p2MaxMana:g.players[1].maxMana,p1Lives:g.players[0].lives,p2Lives:g.players[1].lives,remaining:alive,progress:clamp(lead/(WORLD-240)*100,0,100)});
          pressed.current.clear();
        }
        render(g);
      }else{
        ctx!.fillStyle="#162420";ctx!.fillRect(0,0,W,H);
      }
      raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf);
  },[playSfx]);

  return <main className="game-page">
    <header className="masthead"><div className="brand"><div className="crest">♞</div><div><p className="eyebrow">A Mossguard Tale</p><h1>Mossguard: The Acorn Crown</h1></div></div><div className="chapter">Chapter I<br/>The Briar Road</div></header>
    <section className="cabinet" aria-label="Mossguard two-player game"><div className="screen"><canvas ref={canvasRef} tabIndex={0} onPointerDown={()=>canvasRef.current?.focus()} aria-label="Side-scrolling cooperative battle arena"/>
      {screen==="play"&&<div className={`hud ${mode==="single"?"single":""}`}><div className="player-card"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P1 · {mice[picks[0]].name}</span><span className="lives" aria-label={`${hud.p1Lives} lives`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p1Lives?"full":""}>♥</i>)}</span></div><div className="health"><i style={{width:`${hud.p1}%`}}/></div><div className="mana" aria-label={`${hud.p1Mana} of ${hud.p1MaxMana} mana`}>{Array.from({length:hud.p1MaxMana},(_,n)=><i key={n} className={n<hud.p1Mana?"full":""}/>)}</div></div></div><div className="objective">Briar Gate · {Math.round(hud.progress)}%<b>{hud.remaining?`${hud.remaining} foes remain`:`Gate open — onward!`}</b></div>{mode==="coop"?<div className="player-card p2"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P2 · {mice[picks[1]].name}</span><span className="lives" aria-label={`${hud.p2Lives} lives`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p2Lives?"full":""}>♥</i>)}</span></div><div className="health"><i style={{width:`${hud.p2}%`}}/></div><div className="mana" aria-label={`${hud.p2Mana} of ${hud.p2MaxMana} mana`}>{Array.from({length:hud.p2MaxMana},(_,n)=><i key={n} className={n<hud.p2Mana?"full":""}/>)}</div></div></div>:<div className="hud-spacer"/>}</div>}
      {screen!=="play"&&<div className={`overlay ${["title","mode","select"].includes(screen)?"title-screen":screen==="map"?"map-screen":""}`}>{screen==="title"?<div className="title-panel"><div className="title-heroes" aria-hidden="true"><div className="title-hero bramble"/><div className="title-crown">♛</div><div className="title-hero thimble"/></div><div className="title-copy"><span className="ribbon">A solo or couch co-op woodland brawler</span><h2>MOSSGUARD<span>The Acorn Crown</span></h2><p>Two tiny knights. One briar-choked road. Choose your adventure, choose your mouse, and fight through Thornpaw territory.</p><div className="title-features" aria-label="Game features"><span>Single adventure</span><span>2-player couch co-op</span><span>Distinct mouse traits</span></div><button className="start-btn" onClick={showMode}>Choose adventure</button><div className={`controller-callout ${controllers.length===2?"ready":""}`}><b>{controllers.length===2?"Both controllers are ready":controllers.length===1?"One controller connected":"Wake or connect your controllers"}</b><span>Press A / Start or Enter to continue</span></div></div></div>:screen==="mode"?<div className="menu-panel mode-panel"><span className="ribbon">Choose your road</span><h2>Adventure Mode</h2><p>Play alone as one Mossguard knight, or share the road in two-player couch co-op.</p><div className="mode-grid"><button className={`mode-card ${mode==="single"?"selected":""}`} onClick={()=>setMode("single")}><b>Single Adventure</b><span>One player · One chosen mouse</span><i>Face the Briar Road at your own pace.</i></button><button className={`mode-card ${mode==="coop"?"selected":""}`} onClick={()=>setMode("coop")}><b>Couch Co-op</b><span>Two players · Two controllers or one keyboard</span><i>Fight, clash, and reach the gate together.</i></button></div><button className="start-btn" onClick={showSelect}>Choose {mode==="single"?"your knight":"your knights"}</button><div className="tiny">Left / Right to choose · A / Start or Enter to confirm · B / Esc back</div></div>:screen==="select"?<div className="menu-panel select-panel"><span className="ribbon">{mode==="single"?"Choose your knight":`Player ${activePicker+1}, choose your knight`}</span><h2>Mouse Select</h2><p>Traits already affect play. Strength raises sword damage, agility improves running and jumping, and magic increases fireball power and maximum mana.</p><div className="mouse-grid">{(["bramble","thimble"] as MouseKind[]).map(kind=><MouseCard key={kind} kind={kind} selected={picks[activePicker]===kind} badge={mode==="coop"?[0,1].filter(player=>picks[player]===kind).map(player=>`P${player+1}`).join(" + ")||undefined:picks[0]===kind?"Selected":undefined} onChoose={()=>pickMouse(kind)}/>)}</div><button className="start-btn" onClick={confirmCharacter}>{mode==="single"?"Choose your level":activePicker===0?"Lock Player 1":"Choose your level"}</button><div className="tiny">Left / Right to choose · A / Start or Enter to confirm · B / Esc back</div></div>:screen==="map"?<AdventureMap completed={completedLevels} onStart={reset}/>:<div className="panel">{screen==="win"?<><span className="ribbon">The road is clear</span><h2>VICTORY<span>The crown awaits</span></h2><p>{mode==="coop"?"The two Mossguard knights reached the Briar Gate together.":`${mice[picks[0]].name} reached the Briar Gate. The woodland will sing of this night.`}</p><button className="start-btn" onClick={showMap}>Return to the map</button><div className="tiny">A / Start to return · Esc returns to title</div></>:<><span className="ribbon">The briars prevail</span><h2>FALLEN<span>But not forgotten</span></h2><p>Even the smallest knights may rise again.</p><button className="start-btn" onClick={reset}>Try again</button><div className="tiny">A / Start to try again · Esc returns to title</div></>}</div>}</div>}
      <div className="vignette"/></div></section>
    <footer className="help"><div className="help-player"><b>P1 keyboard</b><span><i className="key">A/D</i> move <i className="key">W</i> jump <i className="key">F/X</i> strike ×3 <i className="key">G/B</i> dash <i className="key">R/Y</i> fire <i className="key">L⇧</i> guard</span></div><div className="center-controls"><span className={`pad-status ${controllers.length===2?"ready":""}`}>{controllers.length===2?"● 2 controllers ready":controllers.length===1?"● P1 connected":"○ Wake controllers"}</span><button className="audio-btn" onClick={()=>setSound(v=>!v)}>{sound?"♫ Sound on":"Sound off"}</button></div><div className="help-player"><span><i className="key">←/→</i> move <i className="key">↑</i> jump <i className="key">K</i> strike ×3 <i className="key">L</i> dash <i className="key">O</i> fire <i className="key">R⇧</i> guard</span><b>P2 keyboard</b></div></footer>
  </main>;
}
