// main.js - Web Football Prototype (3D, lightweight)
// Requires three.js (loaded in index.html)

(() => {
  // -------------------------
  // CONFIG
  // -------------------------
  const CONFIG = {
    field: { length: 160, width: 53.3 }, // yards scale (we'll scale down)
    scale: 4, // visual scale factor (1 yard = scale units)
    gravity: -30,
    passSpeed: 85, // yards/sec (visual units will be scaled)
    passHeight: 8, // max arc height in yards
    routeSpeed: 8, // yards/sec receiver speed
    defenderSpeed: 9,
    interceptionChanceBase: 0.35, // base chance if defender is nearby
  };

  // -------------------------
  // THREE.JS SCENE SETUP
  // -------------------------
  const container = document.getElementById("canvasContainer");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky-ish

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(0, 90, 110); // angled down
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });

  // lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(50, 100, 50);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  // -------------------------
  // FIELD
  // -------------------------
  const yard = CONFIG.scale;
  const fieldLen = CONFIG.field.length * yard;
  const fieldWid = CONFIG.field.width * yard;

  const fieldGeometry = new THREE.PlaneGeometry(fieldWid, fieldLen);
  const fieldMaterial = new THREE.MeshLambertMaterial({ color: 0x057a2a });
  const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
  field.rotation.x = -Math.PI / 2;
  scene.add(field);

  // yard lines
  const linesGroup = new THREE.Group();
  for (let i = -CONFIG.field.length / 2 + 10; i <= CONFIG.field.length / 2 - 10; i += 10) {
    const lineGeom = new THREE.PlaneGeometry(fieldWid * 0.98, 0.2 * yard);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const line = new THREE.Mesh(lineGeom, mat);
    line.rotation.x = -Math.PI / 2;
    line.position.z = i * yard;
    line.position.y = 0.01;
    linesGroup.add(line);
  }
  scene.add(linesGroup);

  // endzones
  const endzoneGeom = new THREE.PlaneGeometry(fieldWid, 10 * yard);
  const homeEZ = new THREE.Mesh(endzoneGeom, new THREE.MeshLambertMaterial({ color: 0x0a4fff }));
  homeEZ.rotation.x = -Math.PI / 2;
  homeEZ.position.z = -fieldLen / 2 + (5 * yard);
  homeEZ.position.y = 0.02;
  scene.add(homeEZ);

  const awayEZ = new THREE.Mesh(endzoneGeom, new THREE.MeshLambertMaterial({ color: 0xff1000 }));
  awayEZ.rotation.x = -Math.PI / 2;
  awayEZ.position.z = fieldLen / 2 - (5 * yard);
  awayEZ.position.y = 0.02;
  scene.add(awayEZ);

  // -------------------------
  // GAME OBJECTS
  // -------------------------
  const objects = [];
  const teamColors = {
    home: 0x0a4fff,
    away: 0xff1000
  };

  // helper to make player box
  function makePlayerMesh(color = 0x0a4fff, size = 2) {
    const geom = new THREE.BoxGeometry(size, size * 1.6, size);
    const mat = new THREE.MeshLambertMaterial({ color });
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = true;
    return m;
  }

  // QB
  const qb = {
    mesh: makePlayerMesh(0xffff00, 3),
    pos: new THREE.Vector3(0, 1.2, -40 * yard),
    team: 'home',
    speed: 10, // yards/sec
  };
  qb.mesh.position.copy(qb.pos);
  scene.add(qb.mesh);

  // Ball
  const ballGeom = new THREE.SphereGeometry(0.9, 12, 8);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0x7a3b1a });
  const ball = new THREE.Mesh(ballGeom, ballMat);
  ball.position.set(qb.pos.x, 1.4, qb.pos.z - 3);
  scene.add(ball);
  let ballState = { heldBy: 'qb', thrown: false, velocity: new THREE.Vector3(), startTime: 0, target: null };

  // receivers & defenders positions (4 receivers + 4 defenders)
  const receivers = [];
  const defenders = [];

  function spawnTeam(side = 'home') {
    // side: 'home' left-to-right orientation default is QB near -z
    const sideSign = side === 'home' ? -1 : 1;
    const baseZ = side === 'home' ? -40 * yard : 40 * yard;
    const color = teamColors[side];

    // receivers - placed near the line of scrimmage
    const rOffsets = [-12, -4, 4, 12]; // x positions in yards
    for (let i = 0; i < rOffsets.length; i++) {
      const r = {
        id: `${side}_R${i+1}`,
        mesh: makePlayerMesh(color, 2),
        route: null, // we'll assign routes
        routeProgress: 0,
        speed: CONFIG.routeSpeed * yard,
        team: side
      };
      r.pos = new THREE.Vector3(rOffsets[i] * yard, 1.2, baseZ + 6 * yard); // slight forward offset
      r.mesh.position.copy(r.pos);
      receivers.push(r);
      scene.add(r.mesh);
    }

    // defenders - shadowing
    const dOffsets = [-10, -3, 3, 10];
    for (let i = 0; i < dOffsets.length; i++) {
      const d = {
        id: `${side}_D${i+1}`,
        mesh: makePlayerMesh(0x0a0a0a, 2),
        pos: new THREE.Vector3(dOffsets[i] * yard, 1.2, baseZ + 10 * yard),
        speed: CONFIG.defenderSpeed * yard,
        team: side === 'home' ? 'away' : 'home' // defenders on opposite team
      };
      d.mesh.position.copy(d.pos);
      defenders.push(d);
      scene.add(d.mesh);
    }
  }

  spawnTeam('home');
  spawnTeam('away');

  // Assign sample routes for home receivers (simple patterns)
  // Each route is an array of Vector3 waypoints in world coords
  function makeRoute(origin, pattern = "go") {
    const waypoints = [];
    const zForward = origin.z + 40 * yard; // forward direction
    if (pattern === "go") {
      waypoints.push(new THREE.Vector3(origin.x, origin.y, origin.z + 20 * yard));
      waypoints.push(new THREE.Vector3(origin.x, origin.y, origin.z + 60 * yard));
    } else if (pattern === "slant") {
      waypoints.push(new THREE.Vector3(origin.x + 8 * yard, origin.y, origin.z + 30 * yard));
      waypoints.push(new THREE.Vector3(origin.x + 20 * yard, origin.y, origin.z + 50 * yard));
    } else if (pattern === "out") {
      waypoints.push(new THREE.Vector3(origin.x + 25 * yard, origin.y, origin.z + 20 * yard));
      waypoints.push(new THREE.Vector3(origin.x + 35 * yard, origin.y, origin.z + 20 * yard));
    } else if (pattern === "post") {
      waypoints.push(new THREE.Vector3(origin.x, origin.y, origin.z + 30 * yard));
      waypoints.push(new THREE.Vector3(origin.x + 10 * yard, origin.y, origin.z + 60 * yard));
    } else {
      // default short
      waypoints.push(new THREE.Vector3(origin.x, origin.y, origin.z + 15 * yard));
      waypoints.push(new THREE.Vector3(origin.x, origin.y, origin.z + 35 * yard));
    }
    return waypoints;
  }

  // choose patterns for first 4 home receivers
  const patterns = ["go", "slant", "out", "post"];
  for (let i = 0; i < receivers.length/2; i++) {
    const r = receivers[i];
    r.route = makeRoute(r.pos, patterns[i]);
  }
  // away team's receivers run mirrored routes toward other end
  for (let i = receivers.length/2; i < receivers.length; i++) {
    const r = receivers[i];
    r.route = makeRoute(r.pos, patterns[i - receivers.length/2]);
    // flip route direction for away so they go toward negative z
    r.route = r.route.map(wp => new THREE.Vector3(wp.x, wp.y, -wp.z));
  }

  // -------------------------
  // UI & interaction bindings
  // -------------------------
  const messages = document.getElementById("messages");
  function showMessage(txt, time=2000) {
    messages.textContent = txt;
    if (time) setTimeout(()=>{ if (messages.textContent===txt) messages.textContent = ""; }, time);
  }

  const homeScoreEl = document.getElementById("homeScore");
  const awayScoreEl = document.getElementById("awayScore");
  const homeNameEl = document.getElementById("homeName");
  const awayNameEl = document.getElementById("awayName");

  let score = { home: 0, away: 0 };

  document.getElementById("startBtn").addEventListener("click", () => {
    resetPlay();
    startPlay();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    resetAll();
  });

  const teamSelect = document.getElementById("teamSelect");
  teamSelect.addEventListener("change", () => {
    const sel = teamSelect.value;
    showMessage("Selected team: " + sel.toUpperCase(), 1400);
    qb.team = sel;
    // change QB color to indicate team
    qb.mesh.material.color.setHex(qb.team === 'home' ? teamColors.home : teamColors.away);
  });

  // receiver selection (1-4)
  let selectedReceiverIndex = 0; // 0..3 for offense
  window.addEventListener("keydown", (e) => {
    if (e.key >= '1' && e.key <= '4') {
      selectedReceiverIndex = parseInt(e.key) - 1;
      showMessage("Selected receiver " + (selectedReceiverIndex + 1), 800);
    }
    // movement
    if (e.key === 'w' || e.key === 'a' || e.key === 's' || e.key === 'd') {
      // handled in update loop by keys map
    }
    if (e.key.toLowerCase() === 'p') {
      attemptPass();
    }
  });

  // movement keys
  const keys = {};
  window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
  window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

  // -------------------------
  // GAME LOGIC
  // -------------------------
  let playing = false;
  let lastTime = performance.now();

  function startPlay() {
    // reset positions and start receivers moving
    playing = true;
    receivers.forEach(r => { r.routeProgress = 0; });
    defenders.forEach(d => { /* they will start chasing in update */ });
    ballState = { heldBy: 'qb', thrown: false, velocity: new THREE.Vector3(), startTime: performance.now(), target: null };
    showMessage("Play started", 1000);
  }

  function resetPlay() {
    // reset positions (place QB back, receivers near LOS)
    qb.pos.set(0, 1.2, -40 * yard);
    qb.mesh.position.copy(qb.pos);
    ball.position.set(qb.pos.x, 1.4, qb.pos.z - 3);
    ballState.heldBy = 'qb';
    ballState.thrown = false;

    // reposition receivers and defenders
    receivers.forEach((r, idx) => {
      const offsetX = (idx % 4 === 0 ? -12 : idx % 4 === 1 ? -4 : idx % 4 === 2 ? 4 : 12) * yard;
      r.pos.set(offsetX, 1.2, -34 * yard);
      r.mesh.position.copy(r.pos);
      r.routeProgress = 0;
    });
    // defenders opposite
    defenders.forEach((d, idx) => {
      const offsetX = (idx%4===0? -10: idx%4===1? -3: idx%4===2? 3:10) * yard;
      d.pos.set(offsetX, 1.2, -30 * yard);
      d.mesh.position.copy(d.pos);
    });
  }

  function resetAll() {
    resetPlay();
    score.home = 0; score.away = 0;
    updateScoreboard();
    showMessage("Game reset");
  }

  function updateScoreboard() {
    homeScoreEl.textContent = score.home;
    awayScoreEl.textContent = score.away;
    homeNameEl.textContent = "HOME";
    awayNameEl.textContent = "AWAY";
  }

  // Pass logic: compute a ballistic arc to receiver waypoint
  function attemptPass() {
    if (ballState.thrown || ballState.heldBy !== 'qb') return;
    // choose target receiver from offense side near QB (assume first 4 receivers are offense for simplicity)
    const offenseReceivers = receivers.slice(0,4);
    const target = offenseReceivers[selectedReceiverIndex];
    if (!target) { showMessage("No receiver"); return; }
    ballState.heldBy = null;
    ballState.thrown = true;
    ballState.target = target;

    // compute a simple parametric arc: we'll set initial velocity to reach target in t seconds
    // distance on horizontal plane
    const pos0 = new THREE.Vector3().copy(ball.position);
    const posT = new THREE.Vector3().copy(target.mesh.position);
    // estimate travel time by distance / passSpeed
    const dx = new THREE.Vector3(posT.x - pos0.x, 0, posT.z - pos0.z);
    const dist = dx.length() / yard; // in yards
    const travelTime = Math.max(0.5, dist / CONFIG.passSpeed); // seconds
    const velXZ = dx.clone().divideScalar(travelTime); // world units per sec
    // vertical component for arc (parabolic peak)
    const peak = CONFIG.passHeight * yard;
    const vy = (2 * (peak - pos0.y)) / travelTime;
    ballState.velocity = new THREE.Vector3(velXZ.x, vy, velXZ.z);
    ballState.startTime = performance.now();
    ballState.travelTime = travelTime * 1000;
    ballState.pos0 = pos0;
    ballState.catchable = false;
    showMessage("PASS to R" + (selectedReceiverIndex + 1), 900);
  }

  function checkCatchOrIntercept() {
    if (!ballState.thrown) return;
    const t = (performance.now() - ballState.startTime) / 1000;
    // check collision with defenders
    for (let d of defenders) {
      const dpos = d.mesh.position;
      const dist = dpos.distanceTo(ball.position);
      if (dist < 3.0 * yard) {
        // defender close enough to attempt interception
        const chance = CONFIG.interceptionChanceBase + Math.random()*0.2;
        if (Math.random() < chance) {
          // intercepted
          ballState.thrown = false;
          ballState.heldBy = 'defender';
          ballState.velocity.set(0,0,0);
          ball.position.copy(dpos).add(new THREE.Vector3(0,3,0));
          showMessage("INTERCEPTION!", 2000);
          // award possession and maybe a return to touchdown (simple: turn play over)
          endPlay('interception', d);
          return;
        } else {
          // defender bumped but failed
          showMessage("Defender close, but failed to intercept", 800);
        }
      }
    }

    // check if target can catch: if within small radius near target and ball near target height
    const target = ballState.target;
    if (target) {
      const distToTarget = target.mesh.position.distanceTo(ball.position);
      if (distToTarget < 3.0 * yard) {
        // successful catch if no nearby defender
        const nearbyDef = defenders.some(d => d.mesh.position.distanceTo(target.mesh.position) < 4 * yard);
        if (!nearbyDef || Math.random() > CONFIG.interceptionChanceBase) {
          // caught
          ballState.thrown = false;
          ballState.heldBy = 'receiver';
          ballState.velocity.set(0,0,0);
          ball.position.copy(target.mesh.position).add(new THREE.Vector3(0,3,0));
          showMessage("CATCH! R" + (selectedReceiverIndex+1), 1400);
          // give receiver ball and let them run until tackled or TD
          endPlay('catch', target);
          return;
        } else {
          // defender steals at catch moment
          ballState.thrown = false;
          ballState.heldBy = 'defender';
          showMessage("INTERCEPTION at catch!", 1400);
          endPlay('interception', defenders[ Math.floor(Math.random()*defenders.length) ]);
          return;
        }
      }
    }
  }

  function endPlay(result, actor) {
    playing = false;
    // handle scoring
    if (result === 'catch') {
      // check if receiver in endzone
      const rz = actor.mesh.position.z;
      if (rz > fieldLen / 2 - (10 * yard)) {
        // away endzone (assuming offense goes positive z)
        score.home += 7;
        updateScoreboard();
        showMessage("TOUCHDOWN! HOME scores 7", 3000);
      } else {
        showMessage("First down / tackle - play over", 1800);
      }
    } else if (result === 'interception') {
      // award to opposite team, maybe return for TD randomly
      const returnYards = Math.random() * 30 * yard;
      actor.mesh.position.z += returnYards;
      if (actor.mesh.position.z > fieldLen / 2 - (10 * yard)) {
        // pick team of actor as scoring
        const team = actor.team === 'home' ? 'home' : 'away';
        score[team] += 7;
        updateScoreboard();
        showMessage("INTERCEPTION RETURN TD! " + team.toUpperCase() + " gets 7", 3000);
      } else {
        showMessage("Interception - play over", 2000);
      }
    }
    // schedule automatic reset after a moment
    setTimeout(() => {
      resetPlay();
      playing = false;
    }, 1500);
  }

  // -------------------------
  // AI: Move receivers along routes and defenders chase
  // -------------------------
  function updateAI(dt) {
    // receivers move along their route only during play
    receivers.forEach((r, idx) => {
      if (!r.route) return;
      if (!playing) return;
      // route progress based on speed
      r.routeProgress += (r.speed * dt);
      // compute position along polyline route
      let remaining = r.routeProgress;
      let pos = r.route[0].clone();
      for (let i = 0; i < r.route.length - 1; i++) {
        const a = r.route[i], b = r.route[i+1];
        const segLen = a.distanceTo(b);
        if (remaining <= segLen) {
          // position lies inside this segment
          const p = a.clone().lerp(b, remaining / segLen);
          pos = p;
          break;
        } else {
          remaining -= segLen;
          pos = b.clone();
        }
      }
      // simple smoothing: lerp from current to target pos
      r.mesh.position.lerp(pos, 0.12);
    });

    // defenders: chase nearest receiver
    defenders.forEach(d => {
      if (!playing) return;
      // find nearest receiver
      let nearest = null;
      let ndist = Infinity;
      receivers.forEach(r => {
        const dist = r.mesh.position.distanceTo(d.mesh.position);
        if (dist < ndist) { ndist = dist; nearest = r; }
      });
      if (nearest) {
        // move towards predicted point on nearest's route (lead)
        const lead = nearest.mesh.position.clone().add(new THREE.Vector3(0,0, 12 * yard));
        const dir = lead.clone().sub(d.mesh.position).normalize();
        const move = dir.multiplyScalar(d.speed * dt * 0.8);
        d.mesh.position.add(move);
      }
    });
  }

  // -------------------------
  // PHYSICS & UPDATE LOOP
  // -------------------------
  function updateBall(dt) {
    if (!ballState.thrown) {
      // if held by qb, stick to qb
      if (ballState.heldBy === 'qb') {
        ball.position.lerp(new THREE.Vector3(qb.mesh.position.x, qb.mesh.position.y + 1.8, qb.mesh.position.z - 3), 0.6);
      }
      return;
    }
    // simple ballistic update
    // position += velocity * dt (note velocity Y affected by gravity)
    ball.position.add(ballState.velocity.clone().multiplyScalar(dt));
    ballState.velocity.y += CONFIG.gravity * dt;

    // small rotation for visual
    ball.rotation.x += dt * 6;

    // if ball hits ground (y < 0) - incomplete pass
    if (ball.position.y < 0.8) {
      ballState.thrown = false;
      ballState.heldBy = null;
      showMessage("Incomplete pass", 900);
      setTimeout(() => resetPlay(), 800);
    }
    // touchdown check (ball crossing plane into endzone)
    if (ball.position.z > fieldLen / 2 - (10 * yard) && ball.position.y < 6) {
      // ball in away endzone = touchdown for offense
      score.home += 7;
      updateScoreboard();
      showMessage("TOUCHDOWN! HOME gets 7", 2200);
      ballState.thrown = false;
      playing = false;
      setTimeout(() => resetPlay(), 1400);
    }
    // check catches & interceptions
    checkCatchOrIntercept();
  }

  // QB movement
  function updateQB(dt) {
    const move = new THREE.Vector3();
    const sp = qb.speed * yard;
    if (keys['w']) move.z -= sp * dt;
    if (keys['s']) move.z += sp * dt;
    if (keys['a']) move.x -= sp * dt;
    if (keys['d']) move.x += sp * dt;
    qb.mesh.position.add(move);
    // clamp inside field boundaries
    qb.mesh.position.x = THREE.MathUtils.clamp(qb.mesh.position.x, -fieldWid/2 + 3, fieldWid/2 - 3);
    qb.mesh.position.z = THREE.MathUtils.clamp(qb.mesh.position.z, -fieldLen/2 + 8*yard, fieldLen/2 - 8*yard);
  }

  // -------------------------
  // MAIN LOOP
  // -------------------------
  function animate(now = 0) {
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    // update
    updateQB(dt);
    updateAI(dt);
    updateBall(dt);

    // camera follow QB with smoothing
    const camTarget = new THREE.Vector3(qb.mesh.position.x, qb.mesh.position.y + 40, qb.mesh.position.z + 70);
    camera.position.lerp(camTarget, 0.06);
    camera.lookAt(qb.mesh.position.x, 0, qb.mesh.position.z);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // initialize positions
  resetPlay();
  updateScoreboard();

  // initial UI hint
  showMessage("Press Start Play, then use WASD + 1-4 + P to play", 6000);
})();
