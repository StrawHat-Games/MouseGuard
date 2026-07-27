"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x:number; y:number; w:number; h:number };
type Fighter = { x:number; y:number; vx:number; vy:number; w:number; h:number; color:string; accent:string; face:number; hp:number; maxHp:number; jumps:number; grounded:boolean; attack:number; cooldown:number; dash:number; dashBurst:number; fireCooldown:number; invuln:number; dead:number; score:number; name:string; defending:boolean; guardCancel:number };
type Enemy = Fighter & { kind:"badger"|"hare"|"bat"; home:number; active:boolean; defeated:boolean; ai:number };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string;size:number };
type Projectile = { x:number;y:number;vx:number;life:number;color:string;owner:Fighter };

const W=1600, H=900, FLOOR=770, WORLD=6100;
const ground:Rect={x:0,y:FLOOR,w:WORLD,h:140};
const platforms:Rect[]=[
  ground,
  {x:480,y:590,w:260,h:30},{x:860,y:480,w:220,h:28},{x:1370,y:610,w:300,h:28},{x:1770,y:490,w:250,h:28},{x:2350,y:575,w:270,h:28},{x:2800,y:440,w:230,h:28},{x:3510,y:580,w:310,h:28},{x:3990,y:465,w:240,h:28},{x:4570,y:610,w:280,h:28},{x:5000,y:490,w:250,h:28},{x:5400,y:600,w:240,h:28}
];
const enemySeeds=[
  [760,710,"badger"],[1020,420,"bat"],[1490,550,"hare"],[1890,430,"bat"],[2390,515,"badger"],[2860,380,"hare"],[3150,700,"badger"],[3610,520,"badger"],[4080,400,"bat"],[4590,550,"hare"],[4920,700,"badger"],[5150,430,"bat"],[5480,540,"badger"]
] as const;

function fighter(x:number,color:string,accent:string,name:string):Fighter { return {x,y:670,vx:0,vy:0,w:62,h:82,color,accent,face:1,hp:100,maxHp:100,jumps:2,grounded:false,attack:0,cooldown:0,dash:0,dashBurst:0,fireCooldown:0,invuln:0,dead:0,score:0,name,defending:false,guardCancel:0}; }
function overlaps(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}

export default function Game(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<"title"|"play"|"win"|"lose">("title");
  const [screen,setScreen]=useState<"title"|"play"|"win"|"lose">("title");
  const [hud,setHud]=useState<{p1:number;p2:number;remaining:number;progress:number}>({p1:100,p2:100,remaining:enemySeeds.length,progress:0});
  const [sound,setSound]=useState(true);
  const [controllers,setControllers]=useState<string[]>([]);
  const soundRef=useRef(true);
  const music=useRef<HTMLAudioElement|null>(null);
  const sfx=useRef<Record<string,HTMLAudioElement>>({});
  const keys=useRef(new Set<string>());
  const pressed=useRef(new Set<string>());
  const lastPadButtons=useRef<Record<number,boolean[]>>({});
  const menuPadButtons=useRef<Record<number,boolean[]>>({});
  const game=useRef<{players:Fighter[];enemies:Enemy[];particles:Particle[];projectiles:Projectile[];camera:number;last:number;gateOpen:boolean}|null>(null);

  const playSfx=useCallback((name:"jump"|"hit"|"take_damage"|"death"|"fireball_shoot"|"fireball_hit",volume=.55,pitchRange=.06)=>{if(!soundRef.current)return;const source=sfx.current[name]??=new Audio(`/sounds/${name}.wav`);source.preload="auto";const clip=source.cloneNode(true) as HTMLAudioElement;clip.volume=volume;clip.playbackRate=1+(Math.random()*2-1)*pitchRange;void clip.play().catch(()=>{});},[]);

  const startMusic=useCallback(()=>{if(!soundRef.current||stateRef.current!=="play")return;const track=music.current??=new Audio("/sounds/background.mp3");track.loop=true;track.volume=.34;track.playbackRate=1;if(track.paused)void track.play().catch(()=>{});},[]);

  const reset=useCallback(()=>{
    game.current={players:[fighter(180,"#b8332e","#e6c24c","BRAMBLE"),fighter(270,"#297388","#d8d0b6","THIMBLE")],enemies:enemySeeds.map(([x,y,k],i)=>({...fighter(x,k==="badger"?"#5c4a3d":k==="hare"?"#9a7653":"#4b3a64",k==="badger"?"#d55337":k==="hare"?"#6c9d4c":"#be4b75",k.toUpperCase()),y,w:k==="bat"?58:64,h:k==="bat"?55:76,kind:k,home:x,active:false,defeated:false,ai:i*.7})),particles:[],projectiles:[],camera:0,last:performance.now(),gateOpen:false};
    stateRef.current="play";setScreen("play");setHud({p1:100,p2:100,remaining:enemySeeds.length,progress:0});startMusic();
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
    const spriteImages={bramble:new Image(),thimble:new Image(),enemies:new Image(),sword:new Image(),shield:new Image(),forest:new Image(),foreground:new Image()};
    spriteImages.bramble.src="/sprites/bramble-sheet.png";
    spriteImages.thimble.src="/sprites/thimble-sheet.png";
    spriteImages.enemies.src="/sprites/enemies-sheet.png";
    spriteImages.sword.src="/sprites/sword.png";
    spriteImages.shield.src="/sprites/shield.png";
    spriteImages.forest.src="/backgrounds/briarwood-seamless.png";
    spriteImages.foreground.src="/backgrounds/foreground.png";
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
    function swordBounds(p:Fighter):Rect{const progress=clamp((.22-p.attack)/.14,0,1),ease=1-Math.pow(1-progress,3),angle=-1.12+ease*1.58;const pivotX=p.x+p.w/2+p.face*16,pivotY=p.y+p.h-69,start=5,end=106,pad=13;const startX=pivotX+p.face*Math.cos(angle)*start,startY=pivotY+Math.sin(angle)*start,endX=pivotX+p.face*Math.cos(angle)*end,endY=pivotY+Math.sin(angle)*end;return{x:Math.min(startX,endX)-pad,y:Math.min(startY,endY)-pad,w:Math.abs(endX-startX)+pad*2,h:Math.abs(endY-startY)+pad*2};}
    function hit(target:Fighter,from:Fighter,power:number,sourceX?:number){if(target.invuln>0||target.dead>0)return;const attackX=sourceX??from.x+from.w/2;if(target.defending&&(attackX-(target.x+target.w/2))*target.face>0){target.invuln=.12;target.vx-=target.face*1.5;burst(target.x+target.w/2+target.face*34,target.y+35,"#f3cf67",6);playSfx("hit",.3,.09);return;}target.hp-=power;target.vx=from.face*(8+power*.22);target.vy=-5-power*.12;target.invuln=.36;burst(target.x+target.w/2,target.y+target.h/2,target.accent,9);playSfx("take_damage",.5,.08);if(target.hp<=0){target.dead=1.6;target.defending=false;target.vy=-13;target.vx=from.face*13;from.score++;burst(target.x+target.w/2,target.y+target.h/2,"#f5d66d",20);playSfx("death",.72,.035);}}
    function updatePlayer(p:Fighter,i:number,dt:number){if(p.dead>0){p.defending=false;p.dead-=dt;p.vy+=34*dt;p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;if(p.dead<=0){p.hp=100;p.x=Math.max(120,(game.current?.camera||0)+180+i*90);p.y=560;p.vx=p.vy=0;p.invuln=2;p.guardCancel=0;}return;}
      const q=getInput(i),acc=p.grounded?2.2:1.25,cancelGuard=(q.j&&p.jumps>0)||(q.a&&p.cooldown<=0)||(q.fire&&p.fireCooldown<=0);p.defending=q.block&&p.guardCancel<=0&&!cancelGuard&&p.attack<=0&&p.dashBurst<=0&&p.fireCooldown<.48;
      if(p.defending){if(p.grounded)p.vx=0;}else if(p.dashBurst<=0){if(q.l){p.vx-=acc;p.face=-1;}if(q.r){p.vx+=acc;p.face=1;}if(!q.l&&!q.r)p.vx*=p.grounded?.72:.97;p.vx=clamp(p.vx,-9,9);}else{p.vx=p.face*25;p.vy*=.82;}
      if(q.j&&p.jumps>0){p.defending=false;p.guardCancel=.26;p.vy=p.grounded?-15.4:-13.2;p.grounded=false;p.jumps--;playSfx("jump",.45,.07);burst(p.x+p.w/2,p.y+p.h,"#e8d59d",5);} if(!p.defending&&q.d&&!p.grounded&&p.vy>0)p.vy+=2.2;
      if(!p.defending&&q.dash&&p.dash<=0){p.vx=p.face*25;p.vy*=.18;p.dash=.82;p.dashBurst=.2;p.invuln=.28;burst(p.x+p.w/2,p.y+p.h/2,p.accent,15);}if(q.a&&p.cooldown<=0){p.defending=false;p.guardCancel=.24;p.attack=.22;p.cooldown=.42;playSfx("hit",.48,.075);}if(q.fire&&p.fireCooldown<=0){p.defending=false;p.guardCancel=.3;game.current?.projectiles.push({x:p.x+p.w/2+p.face*38,y:p.y+4,vx:p.face*15,life:1.5,color:i?"#69d8ef":"#ff9f3f",owner:p});p.fireCooldown=.72;burst(p.x+p.w/2+p.face*35,p.y+4,i?"#69d8ef":"#ff9f3f",7);playSfx("fireball_shoot",.52,.06);}
      p.cooldown-=dt;p.attack-=dt;p.dash-=dt;p.dashBurst-=dt;p.fireCooldown-=dt;p.invuln-=dt;p.guardCancel-=dt;p.vy+=p.dashBurst>0?.18:.82;const prev=p.y;p.x+=p.vx;p.y+=p.vy;land(p,prev);p.x=clamp(p.x,0,WORLD-p.w);if(p.y>980){p.hp-=25;p.dead=.7;}
      if(p.attack>0.08&&p.attack<.2){const blade=swordBounds(p);for(const e of game.current?.enemies||[])if(!e.defeated&&overlaps(blade,e))hit(e,p,18);for(const other of game.current?.players||[])if(other!==p&&other.dead<=0&&overlaps(blade,other))hit(other,p,18);}
      if(p.dashBurst>0){for(const e of game.current?.enemies||[])if(!e.defeated&&overlaps(p,e))hit(e,p,25);for(const other of game.current?.players||[])if(other!==p&&other.dead<=0&&overlaps(p,other))hit(other,p,25);}
    }
    function updateEnemy(e:Enemy,dt:number){if(e.defeated)return;if(e.dead>0){e.dead-=dt;e.vy+=.7;e.x+=e.vx;e.y+=e.vy;if(e.dead<=0){e.defeated=true;e.active=false;}return;}const g=game.current!;const near=g.players.filter(p=>p.dead<=0).sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(!near)return;e.active=Math.abs(near.x-e.x)<680||e.active;if(!e.active)return;e.ai-=dt;e.invuln-=dt;e.cooldown-=dt;e.attack-=dt;
      const dx=near.x-e.x;e.face=dx>=0?1:-1;if(e.kind==="bat"){e.vx+=Math.sign(dx)*.12;e.vy+=(near.y-70-e.y)*.0018;e.vy+=Math.sin(performance.now()/250+e.home)*.06;e.vx=clamp(e.vx,-3.8,3.8);e.vy=clamp(e.vy,-3.3,3.3);e.x+=e.vx;e.y+=e.vy;}
      else {if(Math.abs(dx)>92)e.vx+=Math.sign(dx)*(e.kind==="hare"?.34:.22);else e.vx*=.72;e.vx=clamp(e.vx,-(e.kind==="hare"?5:3.3),e.kind==="hare"?5:3.3);if(e.kind==="hare"&&e.grounded&&e.ai<=0){e.vy=-12;e.ai=1.7;}const prev=e.y;e.vy+=.82;e.x+=e.vx;e.y+=e.vy;land(e,prev);}
      if(Math.abs(dx)<92&&Math.abs(near.y-e.y)<80&&e.cooldown<=0){e.attack=.25;e.cooldown=1.05;e.ai=.55;}if(e.attack>.08&&e.attack<.2&&overlaps({x:e.x-22,y:e.y,w:e.w+44,h:e.h},{x:near.x,y:near.y,w:near.w,h:near.h}))hit(near,e,e.kind==="badger"?13:9);if(e.y>980){e.defeated=true;}
    }
    function drawMouse(p:Fighter,camera:number){
      if(p.dead>0&&Math.floor(p.dead*10)%2)return;
      const sprite=p.name==="BRAMBLE"?spriteImages.bramble:spriteImages.thimble;
      if(!sprite.complete||!sprite.naturalWidth)return;
      const runFrame=1+(Math.floor(performance.now()/105)%2);
      const frame=p.fireCooldown>.48?4:p.attack>0?3:!p.grounded?1:Math.abs(p.vx)>1.4?runFrame:0;
      const sw=sprite.naturalWidth/5,sh=sprite.naturalHeight;
      const bob=p.grounded&&frame===0?Math.sin(performance.now()/180)*2:0;
      const dh=p.name==="BRAMBLE"?142:150,dw=dh*(sw/sh);
      ctx!.save();
      ctx!.fillStyle="#100c0840";ctx!.beginPath();ctx!.ellipse(p.x-camera+p.w/2,p.y+p.h+5,52,11,0,0,Math.PI*2);ctx!.fill();
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
      const sprite=spriteImages.enemies;if(!sprite.complete||!sprite.naturalWidth)return;
      const frame=e.kind==="badger"?0:e.kind==="hare"?1:2;
      const sw=sprite.naturalWidth/3,sh=sprite.naturalHeight;
      const dh=e.kind==="badger"?156:e.kind==="hare"?166:154,dw=dh*(sw/sh);
      const bob=e.kind==="bat"?Math.sin(performance.now()/150+e.home)*7:0;
      ctx!.save();
      if(e.kind!=="bat"){ctx!.fillStyle="#100c083c";ctx!.beginPath();ctx!.ellipse(e.x-camera+e.w/2,e.y+e.h+5,48,10,0,0,Math.PI*2);ctx!.fill();}
      ctx!.translate(e.x-camera+e.w/2,e.y+e.h+bob);ctx!.scale(-e.face,1);
      if(e.invuln>0&&Math.floor(e.invuln*20)%2)ctx!.globalAlpha=.35;
      if(e.attack>0)ctx!.rotate(-e.face*.08);
      ctx!.drawImage(sprite,frame*sw,0,sw,sh,-dw/2,-dh,dw,dh);
      ctx!.restore();
    }
    function render(g:NonNullable<typeof game.current>){const cam=g.camera,forest=spriteImages.forest;
      if(forest.complete&&forest.naturalWidth){
        const scale=H/forest.naturalHeight,tileW=forest.naturalWidth*scale,smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
        const drawLayer=(speed:number,opacity:(y:number)=>number)=>{const offset=((cam*speed)%tileW+tileW)%tileW,row=12;ctx!.save();for(let y=0;y<H;y+=row){const h=Math.min(row,H-y),alpha=opacity(y+h/2);if(alpha<.01)continue;ctx!.globalAlpha=alpha;const sy=y/scale,sh=h/scale;for(let x=-offset-tileW;x<W+tileW;x+=tileW)ctx!.drawImage(forest,0,sy,forest.naturalWidth,sh,x,y,tileW,h);}ctx!.restore();};
        drawLayer(.045,()=>1);
        drawLayer(.13,y=>smooth(245,380,y)*(1-smooth(650,755,y))*.88);
        drawLayer(.28,y=>smooth(535,760,y));
      }else{const sky=ctx!.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#13252b");sky.addColorStop(.58,"#4f725f");sky.addColorStop(1,"#d89a52");ctx!.fillStyle=sky;ctx!.fillRect(0,0,W,H);}
      for(const p of platforms){if(p===ground||p.x-cam>W||p.x+p.w-cam<0)continue;ctx!.fillStyle="#6a4c2c";ctx!.fillRect(p.x-cam,p.y,p.w,p.h);ctx!.fillStyle="#447044";ctx!.fillRect(p.x-cam,p.y,p.w,16);ctx!.fillStyle="#78a958";ctx!.fillRect(p.x-cam,p.y,p.w,5);ctx!.fillStyle="#392a20";for(let x=p.x+30;x<p.x+p.w;x+=75)ctx!.fillRect(x-cam,p.y+38,12,p.h-38);}
      const gateX=5860;ctx!.fillStyle=g.gateOpen?"#e2c25a":"#5f5143";ctx!.strokeStyle="#211b17";ctx!.lineWidth=12;ctx!.beginPath();ctx!.roundRect(gateX-cam,470,150,300,70);ctx!.fill();ctx!.stroke();ctx!.fillStyle="#1d2826";ctx!.beginPath();ctx!.roundRect(gateX+27-cam,514,96,256,48);ctx!.fill();if(g.gateOpen){ctx!.fillStyle="#f5d87255";ctx!.beginPath();ctx!.ellipse(gateX+75-cam,635,95+Math.sin(performance.now()/180)*8,150,0,0,7);ctx!.fill();}
      for(const e of g.enemies)drawEnemy(e,cam);for(const f of g.projectiles){ctx!.save();ctx!.shadowColor=f.color;ctx!.shadowBlur=24;ctx!.fillStyle=f.color;ctx!.beginPath();ctx!.arc(f.x-cam,f.y,15+Math.sin(performance.now()/45)*2,0,7);ctx!.fill();ctx!.fillStyle="#fff3bc";ctx!.beginPath();ctx!.arc(f.x-cam+Math.sign(f.vx)*3,f.y-3,6,0,7);ctx!.fill();ctx!.restore();}for(const p of g.players)drawMouse(p,cam);for(const q of g.particles){ctx!.globalAlpha=clamp(q.life,0,1);ctx!.fillStyle=q.color;ctx!.fillRect(q.x-cam,q.y,q.size,q.size);}ctx!.globalAlpha=1;
      const foreground=spriteImages.foreground;if(foreground.complete&&foreground.naturalWidth){const frontH=155,frontW=frontH*(foreground.naturalWidth/foreground.naturalHeight),scroll=cam*.52,firstTile=Math.floor(scroll/frontW),offset=scroll-firstTile*frontW;for(let i=0,x=-offset;x<W+frontW;i++,x+=frontW){ctx!.save();if((firstTile+i)%2){ctx!.translate(x+frontW,0);ctx!.scale(-1,1);ctx!.drawImage(foreground,0,H-frontH+2,frontW,frontH);}else ctx!.drawImage(foreground,x,H-frontH+2,frontW,frontH);ctx!.restore();}}
    }
    function loop(t:number){
      const g=game.current;
      if(g){
        const dt=Math.min(.033,(t-g.last)/1000);g.last=t;
        if(stateRef.current==="play"){
          for(let i=0;i<g.players.length;i++)updatePlayer(g.players[i],i,dt);
          for(const e of g.enemies)updateEnemy(e,dt);
          for(const f of g.projectiles){f.x+=f.vx;f.life-=dt;const fireball={x:f.x-16,y:f.y-16,w:32,h:32};for(const e of g.enemies){if(!e.defeated&&f.life>0&&overlaps(fireball,e)){hit(e,f.owner,20,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}for(const player of g.players){if(player!==f.owner&&player.dead<=0&&f.life>0&&overlaps(fireball,player)){hit(player,f.owner,20,f.x);burst(f.x,f.y,f.color,14);playSfx("fireball_hit",.58,.07);f.life=0;}}}
          g.projectiles=g.projectiles.filter(f=>f.life>0&&f.x>0&&f.x<WORLD);
          for(const q of g.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.35;q.life-=dt*1.8;}
          g.particles=g.particles.filter(q=>q.life>0);
          const alive=g.enemies.filter(e=>!e.defeated).length;
          g.gateOpen=alive===0;
          const lead=Math.max(...g.players.map(p=>p.x));
          const back=Math.min(...g.players.map(p=>p.x));
          g.camera+=(clamp((lead+back)/2-W*.42,0,WORLD-W)-g.camera)*.08;
          if(g.gateOpen&&g.players.every(p=>p.x>5820)){stateRef.current="win";setScreen("win");}
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
  },[playSfx]);

  return <main className="game-page">
    <header className="masthead"><div className="brand"><div className="crest">♞</div><div><p className="eyebrow">A Mossguard Tale</p><h1>Mossguard: The Acorn Crown</h1></div></div><div className="chapter">Chapter I<br/>The Briar Road</div></header>
    <section className="cabinet" aria-label="Mossguard two-player game"><div className="screen"><canvas ref={canvasRef} aria-label="Side-scrolling cooperative battle arena"/>
      {screen==="play"&&<div className="hud"><div className="player-card"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P1 · BRAMBLE</span><span>{Math.ceil(hud.p1)}</span></div><div className="health"><i style={{width:`${hud.p1}%`}}/></div></div></div><div className="objective">Briar Gate · {Math.round(hud.progress)}%<b>{hud.remaining?`${hud.remaining} foes remain`:`Gate open — onward!`}</b></div><div className="player-card p2"><div className="portrait">🐭</div><div className="player-info"><div className="name"><span>P2 · THIMBLE</span><span>{Math.ceil(hud.p2)}</span></div><div className="health"><i style={{width:`${hud.p2}%`}}/></div></div></div></div>}
      {screen!=="play"&&<div className="overlay"><div className="panel">{screen==="title"?<><span className="ribbon">Two mice. One impossible road.</span><h2>MOSSGUARD<span>The Acorn Crown</span></h2><p>Cross the briarwood together, scatter the Thornpaw bandits, and reach the moonlit gate. Double-jump, dash, and strike as a team.</p><button className="start-btn" onClick={reset}>Begin the quest</button><div className="tiny">{controllers.length===2?"✓ Two controllers ready · A / Start to begin · Y sound":controllers.length===1?"1 controller ready · A / Start to begin":"Connect a controller, then press A or Start"}</div></>:screen==="win"?<><span className="ribbon">The road is clear</span><h2>VICTORY<span>The crown awaits</span></h2><p>Bramble and Thimble reached the Briar Gate together. The woodland will sing of this night.</p><button className="start-btn" onClick={reset}>Ride again</button><div className="tiny">A / Start to ride again · Y sound</div></>:<><span className="ribbon">The briars prevail</span><h2>FALLEN<span>But not forgotten</span></h2><p>Even the smallest knights may rise again.</p><button className="start-btn" onClick={reset}>Try again</button><div className="tiny">A / Start to try again · Y sound</div></>}</div></div>}
      <div className="vignette"/></div></section>
    <footer className="help"><div className="help-player"><b>P1</b><span><i className="key">A</i> jump <i className="key">X</i> strike <i className="key">B</i> dash <i className="key">Y</i> fire <i className="key">LB</i> guard</span></div><div className="center-controls"><span className={`pad-status ${controllers.length===2?"ready":""}`}>{controllers.length===2?"● 2 controllers ready":controllers.length===1?"● P1 connected":"○ Wake controllers"}</span><button className="audio-btn" onClick={()=>setSound(v=>!v)}>{sound?"♫ Sound on":"Sound off"}</button></div><div className="help-player"><span><i className="key">A</i> jump <i className="key">X</i> strike <i className="key">B</i> dash <i className="key">Y</i> fire <i className="key">LB</i> guard</span><b>P2</b></div></footer>
  </main>;
}
