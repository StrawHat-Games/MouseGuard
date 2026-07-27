"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x:number; y:number; w:number; h:number };
type Fighter = { x:number; y:number; vx:number; vy:number; w:number; h:number; color:string; accent:string; face:number; hp:number; maxHp:number; mana:number; maxMana:number; lives:number; eliminated:boolean; jumps:number; grounded:boolean; attack:number; cooldown:number; dash:number; dashBurst:number; fireCooldown:number; invuln:number; dead:number; score:number; name:string; defending:boolean; guardCancel:number };
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

function fighter(x:number,color:string,accent:string,name:string):Fighter { return {x,y:670,vx:0,vy:0,w:62,h:82,color,accent,face:1,hp:100,maxHp:100,mana:5,maxMana:5,lives:5,eliminated:false,jumps:2,grounded:false,attack:0,cooldown:0,dash:0,dashBurst:0,fireCooldown:0,invuln:0,dead:0,score:0,name,defending:false,guardCancel:0}; }
function overlaps(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}

export default function Game(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<"title"|"play"|"win"|"lose">("title");
  const [screen,setScreen]=useState<"title"|"play"|"win"|"lose">("title");
  const [hud,setHud]=useState<{p1:number;p2:number;p1Mana:number;p2Mana:number;p1Lives:number;p2Lives:number;remaining:number;progress:number}>({p1:100,p2:100,p1Mana:5,p2Mana:5,p1Lives:5,p2Lives:5,remaining:enemySeeds.length,progress:0});
  const [sound,setSound]=useState(true);
  const [controllers,setControllers]=useState<string[]>([]);
  const soundRef=useRef(true);
  const music=useRef<HTMLAudioElement|null>(null);
  const sfx=useRef<Record<string,HTMLAudioElement>>({});
  const keys=useRef(new Set<string>());
  const pressed=useRef(new Set<string>());
  const lastPadButtons=useRef<Record<number,boolean[]>>({});
  const menuPadButtons=useRef<Record<number,boolean[]>>({});
  const game=useRef<{players:Fighter[];enemies:Enemy[];pickups:ManaPickup[];particles:Particle[];projectiles:Projectile[];camera:number;last:number;gateOpen:boolean;shake:number}|null>(null);

  const playSfx=useCallback((name:"jump"|"hit"|"take_damage"|"death"|"fireball_shoot"|"fireball_hit",volume=.55,pitchRange=.06)=>{if(!soundRef.current)return;const source=sfx.current[name]??=new Audio(`/sounds/${name}.wav`);source.preload="auto";const clip=source.cloneNode(true) as HTMLAudioElement;clip.volume=volume;clip.playbackRate=1+(Math.random()*2-1)*pitchRange;void clip.play().catch(()=>{});},[]);

  const startMusic=useCallback(()=>{if(!soundRef.current||stateRef.current!=="play")return;const track=music.current??=new Audio("/sounds/background.mp3");track.loop=true;track.volume=.34;track.playbackRate=1;if(track.paused)void track.play().catch(()=>{});},[]);

  const reset=useCallback(()=>{
    game.current={players:[fighter(180,"#b8332e","#e6c24c","BRAMBLE"),fighter(270,"#297388","#d8d0b6","THIMBLE")],enemies:enemySeeds.map(([x,y,k],i)=>({...fighter(x,k==="badger"?"#5c4a3d":k==="hare"?"#9a7653":"#4b3a64",k==="badger"?"#d55337":k==="hare"?"#6c9d4c":"#be4b75",k.toUpperCase()),y,w:k==="bat"?58:64,h:k==="bat"?55:76,kind:k,home:x,active:false,defeated:false,ai:i*.7})),pickups:manaSeeds.map(([x,y],i)=>({x,y,phase:i*1.73,collected:false,respawn:0})),particles:[],projectiles:[],camera:0,last:performance.now(),gateOpen:false,shake:0};
    stateRef.current="play";setScreen("play");setHud({p1:100,p2:100,p1Mana:5,p2Mana:5,p1Lives:5,p2Lives:5,remaining:enemySeeds.length,progress:0});startMusic();
  },[startMusic]);

  useEffect(()=>{let raf=0;const pollMenuPads=()=>{const pads=Array.from(navigator.getGamepads?.()||[]).filter((pad):pad is Gamepad=>!!pad&&pad.connected).sort((a,b)=>a.index-b.index).slice(0,2);let handled=false;for(const pad of pads){const now=pad.buttons.map(button=>button.pressed),before=menuPadButtons.current[pad.index]||[];if(!handled&&stateRef.current!=="play"){const confirm=(now[0]&&!before[0])||(now[9]&&!before[9]),toggleSound=now[3]&&!before[3];if(confirm){handled=true;reset();}else if(toggleSound){handled=true;setSound(value=>!value);}}menuPadButtons.current[pad.index]=now;}raf=requestAnimationFrame(pollMenuPads);};raf=requestAnimationFrame(pollMenuPads);return()=>cancelAnimationFrame(raf);},[reset]);

  useEffect(()=>{soundRef.current=sound;if(!sound)music.current?.pause();else if(stateRef.current==="play")startMusic();},[sound,startMusic]);
  useEffect(()=>()=>{music.current?.pause();},[]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{ if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault(); if(!keys.current.has(e.code))pressed.current.add(e.code);keys.current.add(e.code);if(e.code==="Escape"&&stateRef.current==="play"){stateRef.current="title";setScreen("title");} };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};
  },[]);

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
    const spriteImages={bramble:new Image(),thimble:new Image(),enemies:new Image(),hare:new Image(),sword:new Image(),shield:new Image(),birds:new Image(),background:new Image(),midground:new Image(),foreground:new Image()};
    spriteImages.bramble.src="/sprites/bramble-sheet.png";
    spriteImages.thimble.src="/sprites/thimble-sheet.png";
    spriteImages.enemies.src="/sprites/enemies-sheet.png";
    spriteImages.hare.src="/sprites/hare.png";
    spriteImages.sword.src="/sprites/sword.png";
    spriteImages.shield.src="/sprites/shield.png";
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
      if(index===0)return {l:k.has("KeyA")||left,r:k.has("KeyD")||right,d:k.has("KeyS")||down,j:p.has("KeyW")||p.has("Space")||padJump,a:p.has("KeyF")||padAttack,dash:p.has("KeyG")||padDash,fire:p.has("KeyR")||padFire,block:k.has("ShiftLeft")||padBlock};
      return {l:k.has("ArrowLeft")||left,r:k.has("ArrowRight")||right,d:k.has("ArrowDown")||down,j:p.has("ArrowUp")||p.has("Numpad0")||padJump,a:p.has("KeyK")||p.has("Slash")||padAttack,dash:p.has("KeyL")||p.has("Period")||padDash,fire:p.has("KeyO")||padFire,block:k.has("ShiftRight")||padBlock};
    }
    function burst(x:number,y:number,color:string,n=8){const g=game.current;if(!g)return;for(let i=0;i<n;i++)g.particles.push({x,y,vx:(Math.random()-.5)*12,vy:(Math.random()-.8)*10,life:1,color,size:3+Math.random()*7});}
    function land(entity:Fighter,prevY:number){entity.grounded=false;for(const p of platforms){if(entity.vy>=0&&entity.x+entity.w>p.x+8&&entity.x<p.x+p.w-8&&prevY+entity.h<=p.y+12&&entity.y+entity.h>=p.y){entity.y=p.y-entity.h;entity.vy=0;entity.grounded=true;entity.jumps=2;}}}
    function playerBounds(p:Fighter):Rect{return{x:p.x,y:p.y-34,w:p.w,h:p.h+34};}
    function swordBounds(p:Fighter):Rect{const progress=clamp((.22-p.attack)/.14,0,1),ease=1-Math.pow(1-progress,3),angle=-1.12+ease*1.58;const pivotX=p.x+p.w/2+p.face*16,pivotY=p.y+p.h-69,start=5,end=106,pad=13;const startX=pivotX+p.face*Math.cos(angle)*start,startY=pivotY+Math.sin(angle)*start,endX=pivotX+p.face*Math.cos(angle)*end,endY=pivotY+Math.sin(angle)*end;return{x:Math.min(startX,endX)-pad,y:Math.min(startY,endY)-pad,w:Math.abs(endX-startX)+pad*2,h:Math.abs(endY-startY)+pad*2};}
    function hit(target:Fighter,from:Fighter,power:number,sourceX?:number){if(target.invuln>0||target.dead>0||target.eliminated)return;const attackX=sourceX??from.x+from.w/2;if(target.defending&&(attackX-(target.x+target.w/2))*target.face>0){target.invuln=.12;target.vx-=target.face*1.5;burst(target.x+target.w/2+target.face*34,target.y+35,"#f3cf67",6);playSfx("hit",.3,.09);return;}target.hp-=power;const g=game.current,isPlayer=!!g?.players.includes(target);if(isPlayer&&g)g.shake=Math.max(g.shake,Math.min(6,2.7+power*.14));target.vx=from.face*(8+power*.22);target.vy=-5-power*.12;target.invuln=.36;burst(target.x+target.w/2,target.y+target.h/2,target.accent,9);playSfx("take_damage",.5,.08);if(target.hp<=0){if(isPlayer)target.lives=Math.max(0,target.lives-1);target.dead=1.6;target.defending=false;target.vy=-13;target.vx=from.face*13;from.score++;burst(target.x+target.w/2,target.y+target.h/2,"#f5d66d",20);playSfx("death",.72,.035);}}
    function updatePlayer(p:Fighter,i:number,dt:number){if(p.eliminated)return;if(p.dead>0){p.defending=false;p.dead-=dt;p.vy+=34*dt;p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;if(p.dead<=0){if(p.lives<=0){p.eliminated=true;p.y=1100;p.vx=p.vy=0;return;}p.hp=100;p.mana=p.maxMana;p.x=Math.max(120,(game.current?.camera||0)+180+i*90);p.y=560;p.vx=p.vy=0;p.invuln=2;p.guardCancel=0;}return;}
      const q=getInput(i),acc=p.grounded?2.2:1.25,cancelGuard=(q.j&&p.jumps>0)||(q.a&&p.cooldown<=0)||(q.fire&&p.fireCooldown<=0&&p.mana>0);p.defending=q.block&&p.guardCancel<=0&&!cancelGuard&&p.attack<=0&&p.dashBurst<=0&&p.fireCooldown<.48;
      if(p.defending){if(p.grounded)p.vx=0;}else if(p.dashBurst<=0){if(q.l){p.vx-=acc;p.face=-1;}if(q.r){p.vx+=acc;p.face=1;}if(!q.l&&!q.r)p.vx*=p.grounded?.72:.97;p.vx=clamp(p.vx,-9,9);}else{p.vx=p.face*25;p.vy*=.82;}
      if(q.j&&p.jumps>0){p.defending=false;p.guardCancel=.26;p.vy=p.grounded?-15.4:-13.2;p.grounded=false;p.jumps--;playSfx("jump",.45,.07);burst(p.x+p.w/2,p.y+p.h,"#e8d59d",5);} if(!p.defending&&q.d&&!p.grounded&&p.vy>0)p.vy+=2.2;
      if(!p.defending&&q.dash&&p.dash<=0){p.vx=p.face*25;p.vy*=.18;p.dash=.82;p.dashBurst=.2;p.invuln=.28;burst(p.x+p.w/2,p.y+p.h/2,p.accent,15);}if(q.a&&p.cooldown<=0){p.defending=false;p.guardCancel=.24;p.attack=.22;p.cooldown=.42;playSfx("hit",.48,.075);}if(q.fire&&p.fireCooldown<=0&&p.mana>0){p.defending=false;p.guardCancel=.3;p.mana--;game.current?.projectiles.push({x:p.x+p.w/2+p.face*38,y:p.y+4,vx:p.face*15,life:1.5,color:i?"#69d8ef":"#ff9f3f",owner:p});p.fireCooldown=.72;burst(p.x+p.w/2+p.face*35,p.y+4,i?"#69d8ef":"#ff9f3f",7);playSfx("fireball_shoot",.52,.06);}
      p.cooldown-=dt;p.attack-=dt;p.dash-=dt;p.dashBurst-=dt;p.fireCooldown-=dt;p.invuln-=dt;p.guardCancel-=dt;p.vy+=p.dashBurst>0?.18:.82;const prev=p.y;p.x+=p.vx;p.y+=p.vy;land(p,prev);p.x=clamp(p.x,0,WORLD-p.w);if(p.y>980){p.hp=0;p.lives=Math.max(0,p.lives-1);p.dead=.7;}
      if(p.attack>0.08&&p.attack<.2){const blade=swordBounds(p);let struckEnemy=false;for(const e of game.current?.enemies||[])if(!e.defeated&&e.invuln<=0&&overlaps(blade,e)){hit(e,p,18);struckEnemy=true;}if(struckEnemy){p.vx=-p.face*4.4;p.vy=Math.min(p.vy,-1.4);burst(p.x+p.w/2+p.face*70,p.y+28,"#fff1a8",5);}}
    }
    function resolvePlayerSwords(){const g=game.current;if(!g)return;const [a,b]=g.players;if(a.eliminated||b.eliminated||a.dead>0||b.dead>0)return;const aSwing=a.attack>0.08&&a.attack<.2,bSwing=b.attack>0.08&&b.attack<.2,aBlade=aSwing?swordBounds(a):null,bBlade=bSwing?swordBounds(b):null;if(aBlade&&bBlade&&overlaps(aBlade,bBlade)){const direction=Math.sign((a.x+a.w/2)-(b.x+b.w/2))||-a.face;a.vx=direction*11;b.vx=-direction*11;a.vy=Math.min(a.vy,-2.2);b.vy=Math.min(b.vy,-2.2);a.attack=b.attack=.06;a.invuln=b.invuln=.14;burst((a.x+b.x+a.w)/2,Math.min(a.y,b.y)+28,"#fff4bd",18);playSfx("hit",.66,.08);g.shake=Math.max(g.shake,2.5);return;}if(aBlade&&overlaps(aBlade,playerBounds(b)))hit(b,a,18);if(bBlade&&overlaps(bBlade,playerBounds(a)))hit(a,b,18);}
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
      const frame=p.fireCooldown>.48?4:p.attack>0?3:!p.grounded?1:Math.abs(p.vx)>1.4?runFrame:0;
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
      if(p.attack>0&&spriteImages.sword.complete&&spriteImages.sword.naturalWidth){
        const progress=clamp((.22-p.attack)/.14,0,1),ease=1-Math.pow(1-progress,3);
        const angle=-1.12+ease*1.58,swordW=108,swordH=swordW*(spriteImages.sword.naturalHeight/spriteImages.sword.naturalWidth);
        ctx!.save();ctx!.translate(16,-69);ctx!.rotate(angle);ctx!.drawImage(spriteImages.sword,-10,-swordH/2,swordW,swordH);ctx!.restore();
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
          for(const f of g.projectiles){f.x+=f.vx;f.life-=dt;const fireball={x:f.x-16,y:f.y-16,w:32,h:32};for(const e of g.enemies){if(!e.defeated&&f.life>0&&overlaps(fireball,e)){hit(e,f.owner,20,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}for(const player of g.players){if(player!==f.owner&&!player.eliminated&&player.dead<=0&&f.life>0&&overlaps(fireball,playerBounds(player))){hit(player,f.owner,20,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}}
          g.projectiles=g.projectiles.filter(f=>f.life>0&&f.x>0&&f.x<WORLD);
          for(const q of g.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.35;q.life-=dt*1.8;}
          g.particles=g.particles.filter(q=>q.life>0);
          const alive=g.enemies.filter(e=>!e.defeated).length;
          g.gateOpen=alive===0;
          const activePlayers=g.players.filter(p=>!p.eliminated),lead=activePlayers.length?Math.max(...activePlayers.map(p=>p.x)):g.camera+W*.42;
          const back=activePlayers.length?Math.min(...activePlayers.map(p=>p.x)):lead;
          g.camera+=(clamp((lead+back)/2-W*.42,0,WORLD-W)-g.camera)*.08;
          if(g.gateOpen&&g.players.every(p=>p.eliminated||p.x>5820)){stateRef.current="win";setScreen("win");}
          if(g.players.every(p=>p.eliminated)){stateRef.current="lose";setScreen("lose");}
          if(Math.floor(t/120)%4===0)setHud({p1:Math.max(0,g.players[0].hp),p2:Math.max(0,g.players[1].hp),p1Mana:g.players[0].mana,p2Mana:g.players[1].mana,p1Lives:g.players[0].lives,p2Lives:g.players[1].lives,remaining:alive,progress:clamp(lead/(WORLD-240)*100,0,100)});
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
    <section className="cabinet" aria-label="Mossguard two-player game"><div className="screen"><canvas ref={canvasRef} aria-label="Side-scrolling cooperative battle arena"/>
      {screen==="play"&&<div className="hud"><div className="player-card"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P1 · BRAMBLE</span><span className="lives" aria-label={`${hud.p1Lives} lives`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p1Lives?"full":""}>♥</i>)}</span></div><div className="health"><i style={{width:`${hud.p1}%`}}/></div><div className="mana" aria-label={`${hud.p1Mana} of 5 mana`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p1Mana?"full":""}/>)}</div></div></div><div className="objective">Briar Gate · {Math.round(hud.progress)}%<b>{hud.remaining?`${hud.remaining} foes remain`:`Gate open — onward!`}</b></div><div className="player-card p2"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P2 · THIMBLE</span><span className="lives" aria-label={`${hud.p2Lives} lives`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p2Lives?"full":""}>♥</i>)}</span></div><div className="health"><i style={{width:`${hud.p2}%`}}/></div><div className="mana" aria-label={`${hud.p2Mana} of 5 mana`}>{[0,1,2,3,4].map(n=><i key={n} className={n<hud.p2Mana?"full":""}/>)}</div></div></div></div>}
      {screen!=="play"&&<div className="overlay"><div className="panel">{screen==="title"?<><span className="ribbon">Two mice. One impossible road.</span><h2>MOSSGUARD<span>The Acorn Crown</span></h2><p>Cross the briarwood together, scatter the Thornpaw bandits, and reach the moonlit gate. Double-jump, dash, and strike as a team.</p><button className="start-btn" onClick={reset}>Begin the quest</button><div className="tiny">{controllers.length===2?"✓ Two controllers ready · A / Start to begin · Y sound":controllers.length===1?"1 controller ready · A / Start to begin":"Connect a controller, then press A or Start"}</div></>:screen==="win"?<><span className="ribbon">The road is clear</span><h2>VICTORY<span>The crown awaits</span></h2><p>Bramble and Thimble reached the Briar Gate together. The woodland will sing of this night.</p><button className="start-btn" onClick={reset}>Ride again</button><div className="tiny">A / Start to ride again · Y sound</div></>:<><span className="ribbon">The briars prevail</span><h2>FALLEN<span>But not forgotten</span></h2><p>Even the smallest knights may rise again.</p><button className="start-btn" onClick={reset}>Try again</button><div className="tiny">A / Start to try again · Y sound</div></>}</div></div>}
      <div className="vignette"/></div></section>
    <footer className="help"><div className="help-player"><b>P1</b><span><i className="key">A</i> jump <i className="key">X</i> strike <i className="key">B</i> dash <i className="key">Y</i> fire <i className="key">LB</i> guard</span></div><div className="center-controls"><span className={`pad-status ${controllers.length===2?"ready":""}`}>{controllers.length===2?"● 2 controllers ready":controllers.length===1?"● P1 connected":"○ Wake controllers"}</span><button className="audio-btn" onClick={()=>setSound(v=>!v)}>{sound?"♫ Sound on":"Sound off"}</button></div><div className="help-player"><span><i className="key">A</i> jump <i className="key">X</i> strike <i className="key">B</i> dash <i className="key">Y</i> fire <i className="key">LB</i> guard</span><b>P2</b></div></footer>
  </main>;
}
