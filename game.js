const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a5f0b);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 40, 60);
camera.lookAt(0,0,0);

// LIGHT
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50).normalize();
scene.add(light);

// FIELD
const fieldGeo = new THREE.PlaneGeometry(200, 100);
const fieldMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
const field = new THREE.Mesh(fieldGeo, fieldMat);
field.rotation.x = -Math.PI / 2;
scene.add(field);

// PLAYER (QB)
const qb = new THREE.Mesh(
    new THREE.BoxGeometry(4, 6, 4),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
);
qb.position.set(0, 3, 30);
scene.add(qb);

// RECEIVERS
let receivers = [];
const routes = [
    [ {x:-10,z:5}, {x:-20,z:-10} ],
    [ {x:0,z:5}, {x:0,z:-15} ],
    [ {x:10,z:5}, {x:20,z:-10} ]
];

for (let i = 0; i < 3; i++) {
    let r = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 4),
        new THREE.MeshLambertMaterial({ color: 0xff0000 })
    );
    r.position.set((i - 1) * 12, 3, 15);
    r.routeIndex = 0;
    r.route = routes[i];
    receivers.push(r);
    scene.add(r);
}

// DEFENSE (simple chasing AI)
let defenders = [];
for (let i = 0; i < 3; i++) {
    let d = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 4),
        new THREE.MeshLambertMaterial({ color: 0x0000ff })
    );
    d.position.set((i - 1) * 12, 3, -10);
    defenders.push(d);
    scene.add(d);
}

// BALL
const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1.2),
    new THREE.MeshLambertMaterial({ color: 0xffff00 })
);
ball.visible = false;
scene.add(ball);

// UI BUTTONS
const ui = document.getElementById("ui");
const throwButtons = [];

for (let i = 0; i < receivers.length; i++) {
    let b = document.createElement("div");
    b.className = "throw-btn";
    b.innerText = (i+1).toString();
    ui.appendChild(b);
    throwButtons.push(b);
}

let throwing = false;
let targetReceiver = null;

function throwBallTo(index) {
    if (throwing) return;
    throwing = true;
    targetReceiver = receivers[index];
    ball.position.copy(qb.position);
    ball.visible = true;
}

document.addEventListener("keydown", e => {
    if (e.key === "1") throwBallTo(0);
    if (e.key === "2") throwBallTo(1);
    if (e.key === "3") throwBallTo(2);
});

// SCOREBOARD
let score = 0;
const scoreboard = document.getElementById("scoreboard");

function updateScore() {
    scoreboard.textContent = `Score: ${score}`;
}

function animate() {
    requestAnimationFrame(animate);

    // Move receivers along routes
    receivers.forEach(r => {
        if (r.routeIndex < r.route.length) {
            let target = r.route[r.routeIndex];
            let dx = target.x - r.position.x;
            let dz = target.z - r.position.z;
            let dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 0.3) {
                r.routeIndex++;
            } else {
                r.position.x += dx * 0.02;
                r.position.z += dz * 0.02;
            }
        }
    });

    // Defenders chase nearest receiver
    defenders.forEach(d => {
        let nearest = receivers.reduce((a,b) =>
            (d.position.distanceTo(a.position) < d.position.distanceTo(b.position) ? a : b)
        );
        let dx = nearest.position.x - d.position.x;
        let dz = nearest.position.z - d.position.z;
        d.position.x += dx * 0.01;
        d.position.z += dz * 0.01;
    });

    // Throwing logic
    if (throwing && targetReceiver) {
        let dx = targetReceiver.position.x - ball.position.x;
        let dz = targetReceiver.position.z - ball.position.z;
        ball.position.x += dx * 0.07;
        ball.position.z += dz * 0.07;

        if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5) {
            throwing = false;
            ball.visible = false;
            score += 7;
            updateScore();
        }
    }

    // Update throw button positions
    receivers.forEach((r, i) => {
        let vector = r.position.clone().project(camera);
        let x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        let y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        throwButtons[i].style.left = x + "px";
        throwButtons[i].style.top = y + "px";
    });

    renderer.render(scene, camera);
}

animate();
