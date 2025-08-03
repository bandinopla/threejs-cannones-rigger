 
import { Mesh, type Scene } from "three";

export function disposeScene(scene: Scene) {
    scene.traverse(obj => {
        if (obj instanceof Mesh) {
            obj.geometry?.dispose();
            if (obj.material?.isMaterial) {
                disposeMaterial(obj.material);
            } else if (Array.isArray(obj.material)) {
                obj.material.forEach(disposeMaterial);
            }
        }
    });

    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
}

function disposeMaterial(mat:any) {
  mat.map?.dispose();
  mat.lightMap?.dispose();
  mat.bumpMap?.dispose();
  mat.normalMap?.dispose();
  mat.specularMap?.dispose();
  mat.envMap?.dispose();
  mat.aoMap?.dispose();
  mat.emissiveMap?.dispose();
  mat.roughnessMap?.dispose();
  mat.metalnessMap?.dispose();
  mat.alphaMap?.dispose();
  mat.dispose();
}