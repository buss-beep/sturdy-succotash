const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a5f0b);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 40, 60);
camera.lookAt(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50);
scene.add(light);

const fieldGeo = new THREE.PlaneGeometry(200, 100);
const fieldMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
const field = new THREE.Mesh(fieldGeo, fieldMat);
field.rotation.x = -Math.PI / 2;
scene.add(field);

// =====================================
// GAME OBJECTS
// =====================================
let qb, receivers = [], defenders = [];
let throwButtons = [];

// Create QB
qb = new THREE.Mesh(
    new THREE.BoxGeometry(4, 6, 4),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
);
qb.position.set(0, 3, 30);
scene.add(qb);

// Ball
const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1.2),
    new THREE.MeshLambertMaterial({ color: 0xffff00 })
);
ball.visible = false;
scene.add(ball);

// UI
const ui = document.getElementById("ui");

// Scoreboard
let score = 0;
const scoreboard = document.getElementById("scoreboard");

function updateScore() { scoreboard.textContent = `Score: ${score}`; }

// =====================================
// PLAYBOOK
// =====================================

const PLAYS = {
    "Shotgun": [
        {
            name: "Slants",
            formation: {
                qb: { x: 0, z: 30 },
                wr: [
                    { x: -12, z: 15 },
                    { x: 0, z: 15 },
                    { x: 12, z: 15 }
                ]
            },
            routes: [
                [ {x:-10,z:10}, {x:-5,z:-10} ],
                [ {x:0,z:10}, {x:5,z:-15} ],
                [ {x:10,z:10}, {x:15,z:-12} ]
            ],
            defense: "Cover 2"
        },
        {
            name: "Streaks",
            formation: {
                qb: { x: 0, z: 30 },
                wr: [
                    { x: -12, z: 15 },
                    { x: 0, z: 15 },
                    { x: 12, z: 15 }
                ]
            },
            routes: [
                [ {x:-12,z:-40} ],
                [ {x:0,z:-40} ],
                [ {x:12,z:-40} ]
            ],
            defense: "Cover 3"
        }
    ],
    "I-Form": [
        {
            name: "Cross",
            formation: {
                qb: { x: 0, z: 30 },
                wr: [
                    { x: -10, z: 20 },
                    { x: 10, z: 20 },
                    { x: 0, z: 12 }
                ]
            },
            routes: [
                [ {x:-5,z:10}, {x:-15,z:-5} ],
                [ {x:5,z:10}, {x:20,z:-5} ],
                [ {x:0,z:5}, {x:0,z:-15} ]
            ],
            defense: "Man"
        }
    ]
};

const DEFENSES = {
    "Cover 1": [
        {x:-15,z:-5}, {x:0,z:-8}, {x:15,z:-5}
    ],
    "Cover 2": [
        {x:-20,z:-5}, {x:0,z:-18}, {x:20,z:-5}
    ],
    "Cover 3": [
        {x:-20,z:-15}, {x:0,z:-5}, {x:20,z:-15}
    ]
};

// =====================================
// PLAYCALL MENU
// =====================================

const playcallUI = document.getElementById("playcall");
const playList = document.getElementById("play-list");

document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "p") togglePlaycall();
});

function togglePlaycall() {
    const s = playcallUI.style.display;
    playcallUI.style.display = s === "block" ? "none" : "block";
    if (s !== "block") buildPlayMenu();
}

function buildPlayMenu() {
    playList.innerHTML = "";

    Object.keys(PLAYS).forEach(group => {
        let title = document.createElement("h3");
        title.textContent = group;
        playList.appendChild(title);

        PLAYS[group].forEach(play => {
            let btn = document.createElement("button");
            btn.textContent = play.name;
            btn.onclick = () => loadPlay(play);
            playList.appendChild(btn);
        });
    });
}

// =====================================
// LOAD PLAY
// =====================================

function loadPlay(play) {
    playcallUI.style.display = "none";

    // Reset
    receivers.forEach(r => scene.remove(r));
    defenders.forEach(d => scene.remove(d));
    receivers = [];
    defenders = [];

    // Set QB
    qb.position.set(play.formation.qb.x, 3, play.formation.qb.z);

    // Create receivers
    play.formation.wr.forEach((p, i) => {
        let r = new THREE.Mesh(
            new THREE.BoxGeometry(4, 6, 4),
            new THREE.MeshLambertMaterial({ color: 0xff0000 })
        );
        r.position.set(p.x, 3, p.z);
        r.route = play.routes[i];
        r.routeIndex = 0;
        receivers.push(r);
        scene.add(r);
    });

    // Create defenders
    if (play.defense === "Man") {
        receivers.forEach(r => {
            let d = new THREE.Mesh(
                new THREE.BoxGeometry(4, 6, 4),
                new THREE.MeshLambertMaterial({ color: 0x0000ff })
            );
            d.position.set(r.position.x, 3, r.position.z - 20);
            d.manTarget = r;
            defenders.push(d);
            scene.add(d);
        });
    } else {
        DEFENSES[play.defense].forEach(p => {
            let d = new THREE.Mesh(
                new THREE.BoxGeometry(4, 6, 4),
                new THREE.MeshLambertMaterial({ color: 0x0000ff })
            );
            d.position.set(p.x, 3, p.z);
            defenders.push(d);
            scene.add(d);
        });
    }

    buildThrowButtons();
}

// =====================================
// THROW BUTTONS
// =====================================

function buildThrowButtons() {
    ui.innerHTML = "";
    throwButtons = [];

    receivers.forEach((r, i) => {
        let b = document.createElement("div");
        b.className = "throw-btn";
        b.textContent = (i+1).toString();
        ui.appendChild(b);
        throwButtons.push(b);
    });
}

// =====================================
// THROWING LOGIC
// =====================================

let throwing = false;
let targetReceiver = null;

document.addEventListener("keydown", e => {
    if (!receivers.length) return;

    if (e.key === "1") startThrow(0);
    if (e.key === "2") startThrow(1);
    if (e.key === "3") startThrow(2);
});

function startThrow(i) {
    if (throwing) return;
    targetReceiver = receivers[i];
    ball.position.copy(qb.position);
    ball.visible = true;
    throwing = true;
}

// =====================================
// GAME LOOP
// =====================================

function animate() {
    requestAnimationFrame(animate);

    // Move receivers
    receivers.forEach(r => {
        if (r.routeIndex < r.route.length) {
            let target = r.route[r.routeIndex];
            let dx = target.x - r.position.x;
            let dz = target.z - r.position.z;
            let dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 0.5) {
                r.routeIndex++;
            } else {
                r.position.x += dx * 0.02;
                r.position.z += dz * 0.02;
            }
        }
    });

    // Defenders
    defenders.forEach(d => {
        if (d.manTarget) {
            let dx = d.manTarget.position.x - d.position.x;
            let dz = d.manTarget.position.z - d.position.z;
            d.position.x += dx * 0.01;
            d.position.z += dz * 0.01;
        }
    });

    // Throwing
    if (throwing) {
        let dx = targetReceiver.position.x - ball.position.x;
        let dz = targetReceiver.position.z - ball.position.z;

        ball.position.x += dx * 0.07;
        ball.position.z += dz * 0.07;

        if (Math.abs(dx) < 0.6 && Math.abs(dz) < 0.6) {
            score += 7;
            updateScore();
            ball.visible = false;
            throwing = false;
        }
    }

    // UI tracking
    receivers.forEach((r, i) => {
        let vector = r.position.clone().project(camera);
        throwButtons[i].style.left = (vector.x * 0.5 + 0.5) * window.innerWidth + "px";
        throwButtons[i].style.top = (-vector.y * 0.5 + 0.5) * window.innerHeight + "px";
    });

    renderer.render(scene, camera);
}

animate();
