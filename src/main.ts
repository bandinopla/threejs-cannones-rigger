import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import './style.css'
import * as THREE from 'three';

import CannonDebugger from 'cannon-es-debugger';
import { Vec3, World } from 'cannon-es';
import { ThreeJsCannonEsSceneRigger } from './threejs-cannones-rigger'; 
import { onFileDrop } from './onFileDrop';
import { disposeScene } from './disposeScene'; 
//import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

const container = document.querySelector<HTMLDivElement>('#app')!; 
//const gui = new GUI() 

let scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Handle resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const material = new THREE.MeshNormalMaterial();

const world = new World({ gravity: new Vec3(0, -10, 0) });
const clock = new THREE.Clock();
const dt = 1 / 120;

// @ts-ignore
const cannonDebugger = new CannonDebugger(scene, world, {
    color: 0xff00ff,   // wireframe colour
    scale: 1           // overall scale
});


//*/

let physicsRig: ThreeJsCannonEsSceneRigger|undefined ; 

onFileDrop(url => {

    physicsRig?.clear();
    disposeScene(scene); 
 
    new GLTFLoader().load(url, file => { 

        physicsRig = new ThreeJsCannonEsSceneRigger(world);

        scene.add(file.scene)

        file.scene.traverse(o => {
            if (o instanceof THREE.Mesh) {
                o.material = material;
            } 
        })

        camera.position.copy(file.cameras[0].position);
        camera.quaternion.copy(file.cameras[0].quaternion);
        camera.fov = (file.cameras[0] as THREE.PerspectiveCamera).fov;
        camera.updateProjectionMatrix() 

        physicsRig.rigScene( file.scene );

    })  

})  
/*/



//*/

function animate() {
    const delta = clock.getDelta();

    requestAnimationFrame(animate);

    cannonDebugger.update();
    physicsRig?.update(delta);
    world.step(dt, delta);
    renderer.render(scene, camera);
}
animate();
