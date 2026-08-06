from pathlib import Path
import re, json

game=Path('game.js')
s=game.read_text()

spa_points='''      [225,21,207],[189,22,190.8],[153,23,171],[117,24,148.5],[81,25,121.5],[45,26,90],
      [18,27,63],[0,28,45],[-19.8,29,37.8],[-40.5,30,43.2],[-63,31,56.7],[-85.5,31,67.5],[-108,31,72],[-135,31,76.5],
      [-155.7,30,72],[-169.2,30,81],[-162,29,97.2],[-175.5,29,112.5],[-193.5,29,121.5],[-218,28.5,137],[-246,28,153],[-278,28,169],
      [-309,27.5,181],[-336,26,176],[-352,24,158],[-359,21,132],[-355,18,103],[-342,15,74],[-322,13,48],[-296,13,27],
      [-266,16,10],[-232,21,-4],[-194,29,-23],[-139.5,37,-36],[-94.5,49,-64.8],[-36,56,-99],[27,59,-135],[90,61,-171],
      [144,62,-202.5],[162,62,-211.5],[180,61,-189],[198,60,-181.8],[220.5,60,-202.5],[243,60,-208.8],[263.7,58,-190.8],[288,55,-166.5],
      [310.5,52,-139.5],[315,49,-117],[304.2,47,-104.4],[288,46,-103.5],[270,44,-121.5],[252,42,-144],[229.5,40,-160.2],[207,38,-153],
      [180,36,-139.5],[148.5,34,-121.5],[117,32,-103.5],[94.5,30,-81],[82.8,28,-55.8],[85.5,27,-31.5],[99,26,-9],[126,25,2.7],
      [162,24,8.1],[202.5,23,13.5],[227.7,22,27],[243,21,49.5],[244.8,20,72],[238.5,19,91.8],[256.5,19,100.8],[288,18,105.3],
      [319.5,18,112.5],[331.2,17,130.5],[324,17,157.5],[310.5,18,184.5],[288,19,202.5],[256.5,20,211.5]'''
pattern=re.compile(r"(id: 'spa'.*?points:\s*\[\n)(.*?)(\n\s*\]\n\s*}\n\];)",re.S)
match=pattern.search(s)
if not match: raise SystemExit('Spa block not found')
s=s[:match.start(2)]+spa_points+s[match.end(2):]

replacements=[
("pit.position.copy(start).addScaledVector(normal,-(this.def.roadWidth*.5+8));pit.position.y=this.groundHeight(pit.position.x,pit.position.z);pit.rotation.y=Math.atan2(tan.x,tan.z);this.group.add(pit);",
 "pit.position.copy(start).addScaledVector(normal,-(this.def.roadWidth*.5+18)).addScaledVector(tan,-5);pit.position.y=this.groundHeight(pit.position.x,pit.position.z);pit.rotation.y=Math.atan2(-tan.z,tan.x);this.group.add(pit);"),
("this.mass=spec.style==='rally'?1.12:spec.style==='formula'?.96:1.05;this.raceTopSpeed=RACE_TOP_SPEED;",
 "this.mass=spec.style==='rally'?1.12:spec.style==='formula'?.96:1.05;this.raceTopSpeed=spec.topSpeed||RACE_TOP_SPEED;"),
("this.aiSpeed=RACE_TOP_SPEED;this.aiTargetSpeed=RACE_TOP_SPEED;",
 "this.aiSpeed=this.raceTopSpeed;this.aiTargetSpeed=this.raceTopSpeed;"),
("""    const rolling=offroad?.085:(.038+.00062*speedAbs);this.velocity.multiplyScalar(Math.exp(-rolling*dt));if(offroad)this.velocity.multiplyScalar(Math.exp(-.18*dt));
    if(this.velocity.length()>maxSpeed)this.velocity.setLength(lerp(this.velocity.length(),maxSpeed,clamp(dt*2.4,0,1)));
    this.position.addScaledVector(this.velocity,dt);""",
 """    const rolling=offroad?.085:(.038+.00062*speedAbs);this.velocity.multiplyScalar(Math.exp(-rolling*dt));if(offroad)this.velocity.multiplyScalar(Math.exp(-.18*dt));
    // Clamp the forward component itself so all human cars share the exact cap.
    const cappedForward=this.velocity.dot(forward);
    if(cappedForward>maxSpeed)this.velocity.addScaledVector(forward,maxSpeed-cappedForward);
    if(cappedForward<-this.raceTopSpeed*.34)this.velocity.addScaledVector(forward,-this.raceTopSpeed*.34-cappedForward);
    this.position.addScaledVector(this.velocity,dt);"""),
("this.animateVehicle(dt,forwardSpeed,steer);this.updateProgress(snap.index);this.speed=Math.max(0,forwardSpeed);this.gear=this.game.audio.update(clamp(speedAbs/this.raceTopSpeed,0,1.35),throttle,this.boosting,raceActive);",
 "const resolvedForwardSpeed=this.velocity.dot(forward);this.animateVehicle(dt,resolvedForwardSpeed,steer);this.updateProgress(snap.index);this.speed=Math.max(0,resolvedForwardSpeed);this.gear=this.game.audio.update(clamp(Math.abs(resolvedForwardSpeed)/this.raceTopSpeed,0,1.35),throttle,this.boosting,raceActive);"),
("""    const cornerLoss=clamp(curve*(this.aiCurvePenalty/Math.max(this.skill,.75)),0,this.aiMaxSlowdown);
    const target=this.aiSpeed*(1-cornerLoss),delta=target-this.speed,rate=delta>=0?this.aiAcceleration:this.aiBraking;""",
 """    const effectiveCurve=Math.max(0,curve-.032);
    const cornerLoss=clamp(effectiveCurve*(this.aiCurvePenalty/Math.max(this.skill,.75)),0,this.aiMaxSlowdown);
    const target=curve<.05?this.aiSpeed:this.aiSpeed*(1-cornerLoss),delta=target-this.speed,rate=delta>=0?this.aiAcceleration:this.aiBraking;"""),
("this.position=new THREE.Vector3();this.targetPosition=new THREE.Vector3();this.velocity=new THREE.Vector3();this.targetVelocity=new THREE.Vector3();",
 "this.position=new THREE.Vector3();this.targetPosition=new THREE.Vector3();this.velocity=new THREE.Vector3();this.targetVelocity=new THREE.Vector3();this.snapshotVelocity=new THREE.Vector3();"),
("""  applySnapshot(data){
    this.targetPosition.set(data.x,data.y,data.z);this.targetYaw=data.yaw;this.targetPitch=data.pitch||0;this.targetRoll=data.roll||0;this.speed=data.speed||0;this.lap=data.lap||0;this.networkProgress=Number.isFinite(data.progress)?data.progress:this.networkProgress;this.boosting=!!data.boosting;this.lastSnapshotAt=performance.now();
  }
  updateNetwork(dt){
    const alpha=1-Math.exp(-dt*11);this.position.lerp(this.targetPosition,alpha);this.mesh.position.copy(this.position);
    let dy=this.targetYaw-this.yaw;while(dy>Math.PI)dy-=TAU;while(dy<-Math.PI)dy+=TAU;this.yaw+=dy*alpha;
    this.applyRoadPose(dt);
    this.velocity.set(Math.sin(this.yaw)*this.speed,0,Math.cos(this.yaw)*this.speed);
    const spin=this.speed*dt/.4;this.mesh.userData.wheels.forEach(w=>w.rotation.x-=spin);
  }""",
 """  applySnapshot(data){
    const now=performance.now(),elapsed=clamp((now-this.lastSnapshotAt)/1000,.025,.22),nextX=Number(data.x)||0,nextY=Number(data.y)||0,nextZ=Number(data.z)||0;
    this.snapshotVelocity.set((nextX-this.targetPosition.x)/elapsed,(nextY-this.targetPosition.y)/elapsed,(nextZ-this.targetPosition.z)/elapsed);
    const reportedSpeed=clamp(Math.max(0,Number(data.speed)||0),0,RACE_TOP_SPEED+(data.boosting?this.spec.boostPower:0));
    const planar=Math.hypot(this.snapshotVelocity.x,this.snapshotVelocity.z),predictionCap=reportedSpeed>0?reportedSpeed*1.12:RACE_TOP_SPEED;
    if(planar>predictionCap&&planar>0)this.snapshotVelocity.multiplyScalar(predictionCap/planar);
    if(planar<reportedSpeed*.55)this.snapshotVelocity.set(Math.sin(data.yaw)*reportedSpeed,0,Math.cos(data.yaw)*reportedSpeed);
    this.targetVelocity.lerp(this.snapshotVelocity,.72);this.targetPosition.set(nextX,nextY,nextZ);this.targetYaw=data.yaw;this.targetPitch=data.pitch||0;this.targetRoll=data.roll||0;this.speed=reportedSpeed;this.lap=data.lap||0;this.networkProgress=Number.isFinite(data.progress)?data.progress:this.networkProgress;this.boosting=!!data.boosting;this.lastSnapshotAt=now;
  }
  updateNetwork(dt){
    this.targetPosition.addScaledVector(this.targetVelocity,dt);
    const alpha=1-Math.exp(-dt*16);this.position.lerp(this.targetPosition,alpha);this.mesh.position.copy(this.position);
    let dy=this.targetYaw-this.yaw;while(dy>Math.PI)dy-=TAU;while(dy<-Math.PI)dy+=TAU;this.yaw+=dy*alpha;
    this.applyRoadPose(dt);
    this.velocity.copy(this.targetVelocity);if(this.velocity.lengthSq()<.01)this.velocity.set(Math.sin(this.yaw)*this.speed,0,Math.cos(this.yaw)*this.speed);
    const spin=this.speed*dt/.4;this.mesh.userData.wheels.forEach(w=>w.rotation.x-=spin);
  }""")]

for old,new in replacements:
    if old not in s: raise SystemExit('Expected source block not found: '+old[:80])
    s=s.replace(old,new,1)
game.write_text(s)

css=Path('style.css')
c=css.read_text()
old='.track-panel .track-grid { max-height: 610px; overflow-y: auto; padding-right: 4px; }'
if old not in c: raise SystemExit('Track selector CSS not found')
c=c.replace(old,'.track-panel { align-self: start; }\n.track-panel .track-grid { max-height: 360px; overflow-y: auto; padding-right: 4px; }',1)
css.write_text(c)

html=Path('index.html')
h=html.read_text().replace('style.css?v=1.7.4','style.css?v=1.7.5').replace('game.js?v=1.7.4','game.js?v=1.7.5')
h=h.replace('Seven complete road courses, including four long-form Grand Prix layouts.','Eight complete road courses, including Spa and four long-form Grand Prix layouts.')
html.write_text(h)

package=Path('package.json')
pkg=json.loads(package.read_text())
pkg['version']='1.7.5'
pkg['description']='Landscape-first Three.js racing game with 12-car grids, eight circuits, a corrected Spa start sector, exact shared race-speed caps, smoother network racers, customization, hosted single-player deployment detection, and same-Wi-Fi room multiplayer.'
package.write_text(json.dumps(pkg,indent=2)+'\n')

readme=Path('README.md')
r=readme.read_text()
release='''# Summit Rush v1.7.5

## v1.7.5 circuit, UI, and race-pace fixes

- Rebuilt the Spa start sector so the grid begins on a long straight instead of at the apex of the opening corner.
- Widened the La Source-style hairpin and smoothed its approach and exit.
- Realigned and moved the Spa pit building completely outside the racing surface.
- Limited the desktop circuit selector to three visible cards with vertical scrolling.
- Hard-clamped every human car to the same normal forward-speed cap when boost is inactive.
- AI reaches the full shared cap on genuine straights; difficulty still changes corner pace, braking, recovery, and aggression.
- Added short network dead-reckoning so remote cars visually maintain their real speed between snapshots.

'''
r=re.sub(r'^# Summit Rush v1\.7\.4\n\n','',r)
readme.write_text(release+r)
