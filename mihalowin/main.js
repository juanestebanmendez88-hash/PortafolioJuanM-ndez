import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. CONFIGURACIÓN BASE Y ATMÓSFERA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 20, 26); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 20, -15); 
controls.maxPolarAngle = Math.PI / 2 + 0.1; 
controls.update(); 

// 2. ILUMINACIÓN Y SUELO
const ambientLight = new THREE.AmbientLight(0x1a1a3a, 20); 
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x88bbff, 10); 
moonLight.position.set(10, 30, -50);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 3048;
moonLight.shadow.mapSize.height = 3048;
scene.add(moonLight);

const pumpkinLight = new THREE.PointLight(0xff5500, 50, 60); 
pumpkinLight.position.set(10, 5, 0);
pumpkinLight.castShadow = true;
scene.add(pumpkinLight);

// Luz de Relámpago (Inicia apagada, se activa con clic)
const flashLight = new THREE.DirectionalLight(0xffffff, 0);
flashLight.position.set(0, 50, 20);
scene.add(flashLight);

// Plano base para recibir sombras y anclar la escena
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 3. SISTEMA DE PARTÍCULAS (Fondo dinámico)
const particleGeo = new THREE.BufferGeometry();
const particleCount = 600;
const posArray = new Float32Array(particleCount * 3);
for(let i = 0; i < particleCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 150; // Dispersión en el espacio
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particleMat = new THREE.PointsMaterial({ 
    size: 0.3, 
    color: 0xffaa00, 
    transparent: true, 
    opacity: 0.6,
    blending: THREE.AdditiveBlending 
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// 4. CARGA DE MODELOS
const gltfLoader = new GLTFLoader();

gltfLoader.load('house.glb', (gltf) => {
    const house = gltf.scene;
    house.scale.set(20, 20, 20);
    house.position.set(0, 0, 0);
    house.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    scene.add(house);
}, undefined, (error) => console.error('Error al cargar house.glb:', error));

const ghosts = []; 
gltfLoader.load('ghost.glb', (gltf) => {
    const ghostBase = gltf.scene;
    ghostBase.scale.set(0.01, 0.01, 0.01);
    ghostBase.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.material.emissive = new THREE.Color(0x333333); 
        }
    });

    const createGhost = (x, y, z, rotY) => {
        const ghost = ghostBase.clone();
        ghost.position.set(x, y, z);
        ghost.rotation.set(0, rotY, -0.3);
        ghost.userData = { initialY: y, isGhost: true, spinSpeed: 0 }; 
        scene.add(ghost);
        ghosts.push(ghost);
    };

    createGhost(2, 25, 0, -Math.PI / 3);
    createGhost(20, 25, 5, -Math.PI / 2 - 1);

}, undefined, (error) => console.error('Error al cargar ghost.glb:', error));

// 5. ELEMENTOS DE ENTORNO
const moonGeo = new THREE.SphereGeometry(15, 64, 64);
const moonTex = new THREE.TextureLoader().load('texture/luna.jpeg');
const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    emissive: 0xffaa00, 
    emissiveIntensity: 3,
    emissiveMap: moonTex
});
const moon = new THREE.Mesh(moonGeo, moonMat);
moon.position.set(10, 60, -80);
moon.userData = { isMoon: true }; // Etiqueta para el Raycaster
scene.add(moon);

const bats = [];
const batMap = new THREE.TextureLoader().load('texture/murcielago.png');
const batMat = new THREE.SpriteMaterial({ map: batMap, color: 0xffffff });

const createBat = (scale, pos) => {
    const bat = new THREE.Sprite(batMat);
    bat.scale.set(...scale);
    bat.position.set(...pos);
    bat.userData = { initialY: pos[1], offset: Math.random() * Math.PI * 2 };
    scene.add(bat);
    bats.push(bat);
};
createBat([5, 5, 5], [8, 25, 0]);
createBat([3, 3, 3], [15, 27, -5]);
createBat([2, 2, 2], [13, 26, 2]);

// 6. INTERACTIVIDAD AVANZADA (Raycaster)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredGhost = null;

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Evento de Clic para interacciones
window.addEventListener('click', () => {
    raycaster.setFromCamera(mouse, camera);
    
    // 1. Comprobar clic en la Luna (Relámpago)
    const moonIntersect = raycaster.intersectObject(moon);
    if (moonIntersect.length > 0) {
        flashLight.intensity = 10;
        setTimeout(() => flashLight.intensity = 0.5, 50);
        setTimeout(() => flashLight.intensity = 5, 100);
        setTimeout(() => flashLight.intensity = 0, 150);
    }

    // 2. Comprobar clic en los Fantasmas (Giro rápido)
    const ghostMeshes = [];
    ghosts.forEach(g => g.traverse(child => { if(child.isMesh) ghostMeshes.push(child); }));
    const ghostIntersects = raycaster.intersectObjects(ghostMeshes);
    
    if (ghostIntersects.length > 0) {
        const clickedGhost = ghostIntersects[0].object.parent;
        clickedGhost.userData.spinSpeed = 0.5; // Inicia el giro rápido
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 7. BUCLE DE ANIMACIÓN
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Animar sistema de partículas
    particles.rotation.y = elapsedTime * 0.02;
    particles.position.y = Math.sin(elapsedTime * 0.5) * 2;

    // Animación e interacción de fantasmas
    ghosts.forEach((ghost, index) => {
        ghost.position.y = ghost.userData.initialY + 2 * Math.sin(elapsedTime * 2 + index);
        
        // Lógica de giro rápido por clic (desaceleración progresiva)
        if (ghost.userData.spinSpeed > 0) {
            ghost.rotation.y += ghost.userData.spinSpeed;
            ghost.userData.spinSpeed *= 0.95; // Fricción
        }

        ghost.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), 0.1); 
    });

    bats.forEach((bat) => {
        bat.position.y = bat.userData.initialY + 0.5 * Math.sin(elapsedTime * 10 + bat.userData.offset);
    });

    // Detectar Hover para cursor interactivo
    raycaster.setFromCamera(mouse, camera);
    const ghostMeshes = [];
    ghosts.forEach(g => g.traverse(child => { if(child.isMesh) ghostMeshes.push(child); }));
    
    const intersects = raycaster.intersectObjects([...ghostMeshes, moon]);
    
    if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
        if (intersects[0].object !== moon) {
            hoveredGhost = intersects[0].object.parent;
            hoveredGhost.scale.lerp(new THREE.Vector3(0.015, 0.015, 0.015), 0.2);
        }
    } else {
        document.body.style.cursor = 'default';
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();