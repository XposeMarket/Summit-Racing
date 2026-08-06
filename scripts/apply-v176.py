from pathlib import Path
import json
import re

root = Path('.')
game_path = root / 'game.js'
index_path = root / 'index.html'
package_path = root / 'package.json'
readme_path = root / 'README.md'

game = game_path.read_text()

old_difficulties = """const DIFFICULTIES = {
  easy: { id:'easy', name:'Easy', description:'Same top speed, earlier braking and more forgiving corner exits.', cornering:.88, aggression:.72, curvePenalty:3.05, maxSlowdown:.44, acceleration:21.5, braking:31 },
  medium: { id:'medium', name:'Medium', description:'Same top speed, stronger exits and later braking.', cornering:.95, aggression:.86, curvePenalty:2.68, maxSlowdown:.38, acceleration:24, braking:35 },
  hard: { id:'hard', name:'Hard', description:'Same top speed, committed corner pace and aggressive recovery.', cornering:1, aggression:1, curvePenalty:2.35, maxSlowdown:.32, acceleration:26.5, braking:39 }
};"""
new_difficulties = """const DIFFICULTIES = {
  easy: { id:'easy', name:'Easy', description:'Same top speed, earlier braking and more forgiving corner exits.', cornering:.88, aggression:.72, lateralGrip:19.5, lineChange:5.2, acceleration:22.5, braking:31 },
  medium: { id:'medium', name:'Medium', description:'Same top speed, stronger exits and later braking.', cornering:.95, aggression:.86, lateralGrip:21, lineChange:5.8, acceleration:25, braking:35 },
  hard: { id:'hard', name:'Hard', description:'Same top speed, committed corner pace and aggressive recovery.', cornering:1, aggression:1, lateralGrip:22.5, lineChange:6.4, acceleration:27.5, braking:39 }
};"""
if old_difficulties not in game:
    raise SystemExit('difficulty block did not match')
game = game.replace(old_difficulties, new_difficulties, 1)

old_constructor = """    this.aiSpeed=this.raceTopSpeed;this.aiTargetSpeed=this.raceTopSpeed;this.skill=difficulty.cornering;this.aggression=difficulty.aggression;
    this.aiCurvePenalty=difficulty.curvePenalty;this.aiMaxSlowdown=difficulty.maxSlowdown;this.aiAcceleration=difficulty.acceleration;this.aiBraking=difficulty.braking;
    this.placeOnTrack(this.trackT);"""
new_constructor = """    this.aiSpeed=this.raceTopSpeed;this.aiTargetSpeed=this.raceTopSpeed;this.skill=difficulty.cornering;this.aggression=difficulty.aggression;
    this.aiLateralGrip=difficulty.lateralGrip||20;this.aiLineChange=difficulty.lineChange||5.6;this.aiAcceleration=difficulty.acceleration;this.aiBraking=difficulty.braking;
    this.aiLineOffset=lane;this.aiLineTarget=lane;this.aiLineVelocity=0;this.aiLineTimer=.55+Math.random()*1.1;this.aiRecoveryTimer=0;this.aiYawOffset=0;this.aiYawVelocity=0;
    this.aiDecisionRng=new RNG((0x9e3779b9^Math.imul(aiIndex+1,2654435761)^Math.floor(startOffset*1000))>>>0);
    this.placeOnTrack(this.trackT);"""
if old_constructor not in game:
    raise SystemExit('constructor block did not match')
game = game.replace(old_constructor, new_constructor, 1)

new_update_ai = r'''  updateAI(dt,raceActive){
    if(!raceActive||this.finished){this.animateVehicle(dt,0,0);return;}
    const t=this.trackT,trackLength=this.game.track.length,tan=this.game.track.sampleTangent(t,this.tmpTangent);
    const nearMeters=clamp(14+this.speed*.22,18,30),farMeters=clamp(30+this.speed*.46,38,62);
    const tanNear=this.game.track.sampleTangent(t+nearMeters/trackLength,this.tmpAhead),tanFar=this.game.track.sampleTangent(t+farMeters/trackLength,this.tmpForward);
    const nearAngle=Math.acos(clamp(tan.dot(tanNear),-1,1)),farAngle=Math.acos(clamp(tan.dot(tanFar),-1,1));
    const curvature=Math.max(nearAngle/nearMeters,(farAngle/farMeters)*.84),turnSign=Math.sign(tan.x*tanNear.z-tan.z*tanNear.x);

    // Corner speed now comes from estimated turn radius instead of a raw tangent
    // difference. Broad sweepers therefore stay near 200+ km/h while genuine
    // hairpins still require braking.
    const confidence=1.015+this.aggression*.065;
    let target=curvature<.00035?this.aiSpeed:Math.sqrt(this.aiLateralGrip/Math.max(curvature,.000001))*confidence;
    target=clamp(target,this.aiSpeed*.26,this.aiSpeed);

    this.aiRecoveryTimer=Math.max(0,this.aiRecoveryTimer-dt);this.aiLineTimer-=dt;
    const roadLimit=this.game.track.def.roadWidth*.36;
    if(this.aiLineTimer<=0&&this.aiRecoveryTimer<=0){
      const randomLine=this.aiDecisionRng.range(-1,1),cornerBias=turnSign?-turnSign*roadLimit*this.aiDecisionRng.range(.08,.28):0;
      const randomWeight=curvature>.0045?.46:.82;
      this.aiLineTarget=clamp(cornerBias+randomLine*roadLimit*randomWeight,-roadLimit,roadLimit);
      this.aiLineTimer=this.aiDecisionRng.range(.75,2.15);
    }

    // A hit produces a real recovery phase. The AI keeps the displaced line,
    // carries lateral momentum and uses reduced acceleration instead of snapping
    // straight back to its preferred lane on the next frame.
    const unsettled=this.aiRecoveryTimer>0;
    if(unsettled){const recoveryProgress=clamp(1-this.aiRecoveryTimer/2.7,0,1);target*=lerp(.82,.96,recoveryProgress);}
    const delta=target-this.speed,rate=delta>=0?this.aiAcceleration*(unsettled?.58:1):this.aiBraking;
    this.speed+=clamp(delta,-rate*dt,rate*dt);this.speed=clamp(this.speed,0,this.aiSpeed);this.trackT+=this.speed*dt/trackLength;
    if(this.trackT>=1){this.trackT-=1;this.lap++;if(this.lap>=LAPS_TO_WIN){this.finished=true;this.finishTime=this.game.raceTime;this.game.registerFinish(this);}}

    const lineError=this.aiLineTarget-this.aiLineOffset,lineAccel=clamp(lineError*(unsettled?.62:1.45+this.aggression*.55)-this.aiLineVelocity*(unsettled?.72:1.55),-this.aiLineChange,this.aiLineChange);
    this.aiLineVelocity=clamp(this.aiLineVelocity+lineAccel*dt,-7.4,7.4);this.aiLineOffset=clamp(this.aiLineOffset+this.aiLineVelocity*dt,-roadLimit,roadLimit);

    const p=this.game.track.samplePoint(this.trackT,this.tmpPoint),tng=this.game.track.sampleTangent(this.trackT,this.tmpTangent),n=this.tmpNormal.set(-tng.z,0,tng.x).normalize();
    this.collisionOffset.addScaledVector(this.collisionVelocity,dt);
    this.collisionVelocity.multiplyScalar(Math.exp(-(unsettled?.52:1.65)*dt));
    this.collisionOffset.multiplyScalar(Math.exp(-(unsettled?.08:.72)*dt));
    const residualLateral=this.collisionOffset.dot(n),totalLateral=this.aiLineOffset+residualLateral,maxLateral=this.game.track.def.roadWidth*.43;
    if(Math.abs(totalLateral)>maxLateral){const excess=Math.abs(totalLateral)-maxLateral;this.collisionOffset.addScaledVector(n,-Math.sign(totalLateral)*excess*.78);this.aiLineVelocity*=-.18;this.speed*=.96;}

    this.aiYawOffset+=this.aiYawVelocity*dt;this.aiYawVelocity*=Math.exp(-(unsettled?.62:1.9)*dt);this.aiYawOffset*=Math.exp(-(unsettled?.13:.92)*dt);
    this.position.copy(p).addScaledVector(n,this.aiLineOffset).add(this.collisionOffset);this.position.y=p.y+this.rideHeight;
    this.yaw=Math.atan2(tng.x,tng.z)+this.aiYawOffset;this.velocity.copy(tng).multiplyScalar(this.speed).addScaledVector(n,this.aiLineVelocity).add(this.collisionVelocity);this.mesh.position.copy(this.position);
    const index=Math.floor(this.trackT*this.game.track.sampleCount),visualSteer=clamp(-this.aiLineVelocity/6.5,-1,1);
    this.applyRoadPose(index,visualSteer,0,-visualSteer*.045,dt);this.animateVehicle(dt,this.speed,visualSteer);this.lastIndex=index;
  }'''
pattern = re.compile(r"  updateAI\(dt,raceActive\)\{.*?\n  \}\n  animateVehicle", re.S)
match = pattern.search(game)
if not match:
    raise SystemExit('updateAI method did not match')
game = game[:match.start()] + new_update_ai + "\n  animateVehicle" + game[match.end():]

new_collision_methods = r'''  moveRacer(racer,delta){
    if(racer.player)racer.position.add(delta);
    else if(racer.network){racer.position.add(delta);racer.targetPosition.addScaledVector(delta,.45);}
    else{
      const tangent=this.track.sampleTangent(racer.trackT,racer.tmpTangent),normal=racer.tmpNormal.set(-tangent.z,0,tangent.x).normalize(),roadLimit=this.track.def.roadWidth*.4;
      racer.aiLineOffset=clamp(racer.aiLineOffset+delta.dot(normal),-roadLimit,roadLimit);racer.aiLineTarget=racer.aiLineOffset;
      racer.trackT=(racer.trackT+delta.dot(tangent)/this.track.length+1)%1;racer.aiRecoveryTimer=Math.max(racer.aiRecoveryTimer,1.05);racer.aiLineTimer=Math.max(racer.aiLineTimer,racer.aiRecoveryTimer+.2);racer.position.add(delta);
    }
    racer.mesh.position.copy(racer.position);
  }
  applyRacerImpulse(racer,impulse){
    if(racer.player){racer.velocity.addScaledVector(impulse,1/racer.mass);racer.yaw+=clamp((impulse.x*Math.cos(racer.yaw)-impulse.z*Math.sin(racer.yaw))*.004,-.045,.045);return;}
    if(racer.network){racer.position.addScaledVector(impulse,.012/racer.mass);racer.targetPosition.addScaledVector(impulse,.008/racer.mass);this.multiplayer?.sendCollision(racer.networkId,impulse);return;}
    const tangent=this.track.sampleTangent(racer.trackT,racer.tmpTangent),normal=racer.tmpNormal.set(-tangent.z,0,tangent.x).normalize(),forwardKick=impulse.dot(tangent)/racer.mass,lateralKick=impulse.dot(normal)/racer.mass;
    racer.collisionVelocity.addScaledVector(impulse,.46/racer.mass);racer.speed=clamp(racer.speed+forwardKick,0,racer.aiSpeed);
    racer.aiLineVelocity=clamp(racer.aiLineVelocity+lateralKick*.11,-10,10);racer.aiYawVelocity=clamp(racer.aiYawVelocity-lateralKick*.018,-1.25,1.25);
    const severity=Math.abs(lateralKick)+Math.max(0,-forwardKick)*.35;if(severity>.65){
      const roadLimit=this.track.def.roadWidth*.36;racer.aiRecoveryTimer=Math.max(racer.aiRecoveryTimer,1.15+Math.min(1.65,severity*.045));
      racer.aiLineTarget=clamp(racer.aiLineOffset+clamp(lateralKick*.16,-roadLimit*.42,roadLimit*.42),-roadLimit,roadLimit);racer.aiLineTimer=racer.aiRecoveryTimer+.35;
    }
  }'''
pattern = re.compile(r"  moveRacer\(racer,delta\)\{.*?\n  \}\n  resolveCarCollisions", re.S)
match = pattern.search(game)
if not match:
    raise SystemExit('collision methods did not match')
game = game[:match.start()] + new_collision_methods + "\n  resolveCarCollisions" + game[match.end():]

game_path.write_text(game)

index = index_path.read_text().replace('1.7.5', '1.7.6')
index_path.write_text(index)

package = json.loads(package_path.read_text())
package['version'] = '1.7.6'
package['description'] = 'Landscape-first Three.js racing game with 12-car grids, persistent randomized AI racing lines, collision recovery, radius-based corner speed, eight circuits, customization, hosted single-player deployment detection, and same-Wi-Fi room multiplayer.'
package_path.write_text(json.dumps(package, indent=2) + '\n')

readme = readme_path.read_text()
readme = readme.replace('# Summit Rush v1.7.5', '# Summit Rush v1.7.6', 1)
section = """
## v1.7.6 — Dynamic AI racing lines

- AI racers no longer snap directly back to a fixed centerline after contact.
- Every AI driver chooses persistent randomized track positions and changes lines at different intervals.
- Collision impulses now create lateral momentum, heading disturbance, displaced line targets, and a 1–3 second recovery phase.
- AI acceleration is temporarily reduced while recovering, so a car that gets knocked wide does not instantly regain its former pace.
- Corner speed now uses estimated turn radius from near and far look-ahead samples.
- Broad sweepers can be taken around 200–240 km/h depending on radius and difficulty, while true hairpins still require braking.
- Difficulty changes corner grip, braking confidence, recovery, and aggression without changing the shared top-speed cap.

"""
anchor = '\nThree.js racing game'
pos = readme.find(anchor)
if pos >= 0:
    paragraph_end = readme.find('\n\n', pos + 1)
    if paragraph_end >= 0:
        readme = readme[:paragraph_end+2] + section + readme[paragraph_end+2:]
readme_path.write_text(readme)
