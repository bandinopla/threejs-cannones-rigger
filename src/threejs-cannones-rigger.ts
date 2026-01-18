/**
    MIT License

    Copyright (c) 2025 Pablo Bandinopla (https://x.com/bandinopla) 

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
 */
import { Body, Box, type Constraint, Quaternion as QuaternionCannon, DistanceConstraint, HingeConstraint, LockConstraint, PointToPointConstraint, type Shape, Sphere, Vec3, type World } from "cannon-es";
import { Matrix4, Mesh, MeshNormalMaterial, Object3D, Quaternion, Vector3 } from "three";
import { CannonTubeRig } from "threejs-cannones-tube";

enum Type {
    Nothing,
    BoxCollider,
    SphereCollider,
    CompoundCollider,
    LockConstraint,
    HingeConstraint,
    PointConstraint,
    DistanceConstraint,
    SyncLocRot,
    Cable,
    Custom
} 

const TypeAsString = {
  // in blender 5+ enum properties are no longer exported as int
  "x" : Type.Nothing,
  "box" : Type.BoxCollider,
  "sphere" : Type.SphereCollider,
  "compound" : Type.CompoundCollider,
  "lock" : Type.LockConstraint,
  "hinge" : Type.HingeConstraint,
  "point" : Type.PointConstraint,
  "dist" : Type.DistanceConstraint,
  "sync" : Type.SyncLocRot,
  "tube" : Type.Cable,
  "custom" : Type.Custom,
};

function arrayToBitmask(flags: number[], flagsArray?: number[]): number {
	if( typeof flags=="number" )
	{
		flags = flagsArray ?? [];
	}

	if( flags.length==0 )
	{
		return 0;
	}

    return flags.reduce((mask, bit, idx) => mask | (bit << idx), 0);
}

// for re-use
const vec: Vector3 = new Vector3();
const vec2: Vector3 = new Vector3();
const rot: Quaternion = new Quaternion();
const rot2: Quaternion = new Quaternion();

 
export type CustomContraintConfig = {

    /**
     * The object that defined this custom constraint
     */
    obj:Object3D

    /**
     * If set or useful, this is the group mask assosiated with this obj...
     */
    collisionGroup?:number

    /**
     * If set or useful, this is the collision mask assosiated with this obj...
     */
    collisionMask?:number 

    /**
     * If set or useful, this is referencing a Body
     */
    A?:Body

    /**
     * If set or useful, this is referencing a Body
     */
    B?:Body
}

export type ConstraintFactory = (config:CustomContraintConfig)=>IConstraint;


export class ThreeJsCannonEsSceneRigger {

    /**
     * Keeps a relation between the object3D that defined the collider and the collider itself.
     */
    private obj2bod: Map<Object3D, Body> = new Map(); 
    private constraints: ThreeJsCannonEsConstraint[] = []; 
    private customId2ConstraintFactory:Map<string, ConstraintFactory> = new Map();
    private customConstraints:Map<string, IConstraint> = new Map();


    /**
     * Creates a new ThreeJsCannonEsSceneRigger.
     * @param world The Cannon-es physics world.
     * @param scene (Optional) The Three.js scene or root object to rig immediately.
     */
    constructor(readonly world: World, scene?: Object3D) {
        if (scene)
            this.rigScene(scene);
    }
 
    /** 
     * You can create a custom constrain using this method. So when you select "Custom Constrain" in blender, this function
     * will be called when parsing that constraint allowing you to extend the functionality to suit your needs.
     * 
     * @param id what you type in "custom ID" on blender side...
     * @param creator the function that creates your custom constraint
     */
    registerCustomConstraint( id:string, creator:ConstraintFactory )
    {
        this.customId2ConstraintFactory.set(id, creator);
    }

    /**
     * Returns a constraint by its name.
     * @param name The name of the constraint.
     * @returns The constraint instance, or undefined if not found.
     */
    private getConstraintByName<T=ThreeJsCannonEsConstraint>( name:string )
    {
        return this.constraints.find(c=>c.name==name) as T;
    }

    getCustomConstraint( name:string ) {
        return this.customConstraints.get(name);
    }

    /**
     * Returns a CableConstraint by name.
     * @param name The name of the constraint.
     */
    getCableConstraint(name: string): CableConstraint | undefined {
        return this.getConstraintByName<CableConstraint>(name);
    }

    /**
     * Returns a SyncConstraint by name.
     * @param name The name of the constraint.
     */
    getSyncConstraint(name: string): SyncConstraint | undefined {
        return this.getConstraintByName<SyncConstraint>(name);
    }

    /**
     * Returns a LockConstraint (Cannon-es) by name.
     * @param name The name of the constraint.
     */
    getLockConstraint(name: string): LockConstraint | undefined {
        const c = this.getConstraintByName(name);
        return c?.cannonConstraint as LockConstraint | undefined;
    }

    /**
     * Returns a HingeConstraint (Cannon-es) by name.
     * @param name The name of the constraint.
     */
    getHingeConstraint(name: string): HingeConstraint | undefined {
        const c = this.getConstraintByName(name);
        return c?.cannonConstraint as HingeConstraint | undefined;
    }

    /**
     * Returns a PointToPointConstraint (Cannon-es) by name.
     * @param name The name of the constraint.
     */
    getPointConstraint(name: string): PointToPointConstraint | undefined {
        const c = this.getConstraintByName(name);
        return c?.cannonConstraint as PointToPointConstraint | undefined;
    }

    /**
     * Returns a DistanceConstraint (Cannon-es) by name.
     * @param name The name of the constraint.
     */
    getDistanceConstraint(name: string): DistanceConstraint | undefined {
        const c = this.getConstraintByName(name);
        return c?.cannonConstraint as DistanceConstraint | undefined;
    }


    /**
     * Returns a Cannon body by the name of its associated Three.js object.
     * @param name The name to search for (from userData.name).
     * @returns The Cannon body, or undefined if not found.
     */
    getBodyByName(name: string) {
        for (const [obj, body] of this.obj2bod.entries()) {
            if (obj.userData.name === name) return body;
        }
        return undefined;
    }

    /**
     * Scans the scene and creates physics bodies and constraints based on object userData.
     * @param scene The Three.js scene or root object to rig.
     */
    rigScene(scene: Object3D) {
        // create all bodies
        scene.traverse(o => {

            let bod: Body | undefined;

			if( typeof o.userData.threejscannones_type == "string" )
			{
				o.userData.threejscannones_type = TypeAsString[o.userData.threejscannones_type as keyof typeof TypeAsString];
			}

            if (o.userData.threejscannones_cgroup) {
                o.userData.threejscannones_cgroup = arrayToBitmask(o.userData.threejscannones_cgroup, o.userData.threejscannones_cgroup_array);
            }

            if (o.userData.threejscannones_cwith) {
                o.userData.threejscannones_cwith = arrayToBitmask(o.userData.threejscannones_cwith, o.userData.threejscannones_cwith_array);
            }


            if (o.userData.threejscannones_type == Type.BoxCollider) {
                bod = this.createCollider(new Box(new Vec3(o.scale.x, o.scale.y, o.scale.z)), o);
            }
            else if (o.userData.threejscannones_type == Type.SphereCollider) {
                bod = this.createCollider(new Sphere(o.scale.x), o);
            }
            else if (o.userData.threejscannones_type== Type.CompoundCollider) {
                bod = this.createCollider( undefined, o);
                this.addCompoundShapes(bod,o);
            }
        });

        // now that all objects are created we can create the constrains
        scene.traverse(o => {

            const A = this.getBodyByName(o.userData.threejscannones_A?.name);
            const B = this.getBodyByName(o.userData.threejscannones_B?.name);
            let constaint:Constraint|undefined;

            switch (o.userData.threejscannones_type) {
                case Type.DistanceConstraint:  
                    constaint = this.createDistanceConstraint(A!, B!); 
                    break;
                case Type.PointConstraint:
                    constaint = this.createPointConstraint(A!, B!, o);
                    break;
                case Type.HingeConstraint:
                    constaint = this.createHingeConstraint(A!, B!, o);
                    break;
                case Type.LockConstraint:
                    constaint = this.createLockConstraint(A!, B!);
                    break;
                case Type.SyncLocRot:
                    const source = this.getBodyByName(o.userData.threejscannones_syncSource?.name);
                    this.createSyncBetween(o, source);
                    break;
                case Type.Cable:
                    this.createCable(o, A, B );
                    break;
                case Type.Custom:
                    this.createCustomConstraint(o, A, B);
            }

            if( constaint )
            {
                this.constraints.push(new ThreeJsCannonEsConstraint(o, constaint));
            }

        });
    }


    /**
     * Removes all (known) created bodies and constraints from the world and clears internal state.
     */
    clear() {

        vec.set(0,0,0);
        vec2.set(0,0,0);
        rot.set(0,0,0,0);
        rot2.set(0,0,0,0);

        while( this.constraints.length )
        {
            const constraint = this.constraints.pop()!;

            constraint.removeFrom(this.world); 
        }

        for (const [_obj, body] of this.obj2bod.entries()) {
            this.world.removeBody(body);
        } 

        this.obj2bod.clear(); 
    }

private addCompoundShapes(body: Body, compound: Object3D) {
  const boxes = compound.children;

  compound.updateMatrixWorld();

  const compoundWorldPos = compound.getWorldPosition(new Vector3());
  const compoundWorldQuat = compound.getWorldQuaternion(new Quaternion());
  const invCompoundQuat = compoundWorldQuat.clone().invert();

  for (const mesh of boxes) {
    mesh.updateMatrixWorld();

    const childWorldPos = mesh.getWorldPosition(new Vector3());
    const childWorldQuat = mesh.getWorldQuaternion(new Quaternion());
    const childScale = mesh.getWorldScale(new Vector3());

    // Offset in compound's local space
    const localOffset = childWorldPos.clone().sub(compoundWorldPos).applyQuaternion(invCompoundQuat);

    // Orientation in compound's local space
    const localQuat = invCompoundQuat.clone().multiply(childWorldQuat);

    const offset = new Vec3(localOffset.x, localOffset.y, localOffset.z);
    const orientation = new QuaternionCannon(localQuat.x, localQuat.y, localQuat.z, localQuat.w);
    const halfExtents = new Vec3(childScale.x, childScale.y, childScale.z);
    const shape = new Box(halfExtents);

    body.addShape(shape, offset, orientation);
  }

  body.position.copy(new Vec3(compoundWorldPos.x, compoundWorldPos.y, compoundWorldPos.z));
  body.quaternion.copy(new QuaternionCannon(compoundWorldQuat.x, compoundWorldQuat.y, compoundWorldQuat.z, compoundWorldQuat.w));

  return body;
}


    private createCustomConstraint( obj: Object3D, A?: Body, B?: Body ) {
        let group = obj.userData.threejscannones_cgroup ?? 1;
        let mask = obj.userData.threejscannones_cwith ?? 1;
        const customID = obj.userData.threejscannones_customId;

        if(!customID )
        {
            throw new Error(`A custom constraint MUST have an id...`);
        }

        const create = this.customId2ConstraintFactory.get(customID);

        if( !create )
        {
            throw new Error(`Custom constraint with id ${customID} not found. Dis you forgot to call registerCustomConstraint?`);
        }

        const constraint = create({
            obj,
            collisionGroup: group,
            collisionMask: mask,
            A,
            B
        });

        this.customConstraints.set( obj.userData.name, constraint ); 
    }


    /**
     * Creates a cable constraint between objects.
     * @param obj The Three.js object representing the cable.
     * @param stickToA (Optional) The body to attach the cable head to.
     * @param stickToB (Optional) The body to attach the cable tail to.
     */
    private createCable( obj: Object3D, stickToA?: Body, stickToB?: Body ) {
 
        let cableLength = 1;
        let hasChilds = false;
        let lootAt = new Vector3()

        if( obj.children.length>1 )
        {
            obj.children[0].getWorldPosition( vec );  
            obj.children[1].localToWorld( vec2 ); 
            cableLength = vec.distanceTo(vec2);
            hasChilds = true; 
            lootAt.copy(vec2)
 
            
        }

        const tube = new CannonTubeRig(
            cableLength, // length in world units 
            20, // resolution along the segment's length
            0.1, // radius of the tube
            8 // resolution along the radius
        ); //<- extends SkinnedMesh

        tube.material = obj instanceof Mesh? obj.material : new MeshNormalMaterial();
    

            obj.parent?.add( tube ) 

            //position
            if( hasChilds )
            {  
                tube.position.copy(vec);
                tube.lookAt( vec2); 
            }


            tube.addToPhysicalWorld( this.world );
            tube.syncRig()
            
            this.constraints.push(new CableConstraint( this.world, obj, tube, stickToA, stickToB ))

 
        

    }


    /**
     * Synchronizes a Three.js object with a Cannon body.
     * @param obj The Three.js object to sync.
     * @param body The Cannon body to sync with.
     */
    private createSyncBetween(obj: Object3D, body?: Body) {
        if (!body) {
            console.warn(`Object ${obj.name} points to a non existent collider for it's sync constrain.`);
            return;
        }
 
        const constraint = new SyncConstraint(obj, body);

        this.constraints.push( constraint ); 
    }

    /**
     * Creates a lock constraint between two bodies.
     * @param a The first body.
     * @param b The second body.
     * @returns The created LockConstraint.
     */
    private createLockConstraint(a: Body, b: Body) {
        // const groupA = a.collisionFilterGroup;
        // // make b avoid colliding with a
        // b.collisionFilterGroup = groupA;
        // b.collisionFilterMask = a.collisionFilterMask & ~groupA;

        const constraint = new LockConstraint(a, b); 
        constraint.collideConnected = false;
        this.world.addConstraint(constraint)
        return constraint;
    }

    /**
     * Creates a hinge constraint between two bodies.
     * @param a The first body.
     * @param b The second body.
     * @param o The Three.js object representing the hinge.
     * @returns The created HingeConstraint.
     */
    private createHingeConstraint(a: Body, b: Body, o: Object3D) {
        const pos = o.getWorldPosition(new Vector3());
        // World axis (local Z transformed by world quaternion)
        const worldAxis = new Vector3(0, 1, 0)
            .applyQuaternion(o.getWorldQuaternion(new Quaternion()))
            .normalize();

        // Convert to Cannon types
        const pivot = new Vec3(pos.x, pos.y, pos.z);
        const hingeAxis = new Vec3(worldAxis.x, worldAxis.y, worldAxis.z);

        // Local frames
        const pivotA = a.pointToLocalFrame(pivot);
        const pivotB = b.pointToLocalFrame(pivot);

        const axisA = a.vectorToLocalFrame(hingeAxis);
        const axisB = b.vectorToLocalFrame(hingeAxis);

        const constraint = new HingeConstraint(a, b, {
            pivotA,
            pivotB,
            axisA,
            axisB,
            collideConnected: false,
            //maxForce: 1e9,
        });

        this.world.addConstraint(constraint);
        return constraint;
    }

    /**
     * Creates a point-to-point constraint between two bodies.
     * @param a The first body.
     * @param b The second body.
     * @param o The Three.js object representing the constraint.
     * @returns The created PointToPointConstraint.
     */
    private createPointConstraint(a: Body, b: Body, o: Object3D) {
        const pos = o.getWorldPosition(new Vector3());
        const pivotA = a.pointToLocalFrame(new Vec3(pos.x, pos.y, pos.z));
        const pivotB = b.pointToLocalFrame(new Vec3(pos.x, pos.y, pos.z));

        const constraint = new PointToPointConstraint(a, pivotA, b, pivotB);
        this.world.addConstraint(constraint);
        return constraint;
    }

    /**
     * Creates a distance constraint between two bodies.
     * @param a The first body.
     * @param b The second body.
     * @returns The created DistanceConstraint.
     */
    private createDistanceConstraint(a: Body, b: Body) {
        const constraint = new DistanceConstraint(a, b);
        this.world.addConstraint(constraint);
        return constraint;
    }

    /**
     * Creates a Cannon body for a given Three.js object and shape.
     * @param shape The Cannon-es shape.
     * @param o The Three.js object.
     * @returns The created Cannon body.
     */
    private createCollider(shape: Shape|undefined, o: Object3D) {
        o.visible = false;

        let group = o.userData.threejscannones_cgroup ?? 1;
        let mask = o.userData.threejscannones_cwith ?? 1;

        //------- look for parents in case they override our defaults.
        // o.traverseAncestors(parent => { 

        //     if (group == 1 && parent.userData.threejscannones_cgroup > 1) {
        //         group = parent.userData.threejscannones_cgroup;
        //     }

        //     if (mask == 1 && parent.userData.threejscannones_cwith > 1) {
        //         mask = parent.userData.threejscannones_cwith;
        //     }

        // });

        const body = new Body({
            shape,
            mass: o.userData.threejscannones_mass ?? 0,
            collisionFilterMask: mask,
            collisionFilterGroup: group
        });

        const pos = o.getWorldPosition(new Vector3());

        body.position.set(pos.x, pos.y, pos.z);

        const rot = o.getWorldQuaternion(new Quaternion());

        body.quaternion.set(rot.x, rot.y, rot.z, rot.w);

        this.world.addBody(body);

        this.obj2bod.set(o, body);

        return body;
    }

    /**
     * Updates all constraints. Should be called every frame.
     * @param delta The time step.
     */
    update(delta: number) {

        for (let i = 0; i < this.constraints.length; i++) {
            this.constraints[i].update(delta)
        }

    }

}

export interface IConstraint {
    enable:VoidFunction
    disable:VoidFunction
    update:(delta:number)=>void
    removeFrom:(world:World)=>void
}

/**
 * Base class for all ThreeJsCannonEs constraints.
 */
export class ThreeJsCannonEsConstraint implements IConstraint {
    enable() { 
        this.cannonConstraint?.enable();
    }
    disable() { 
        this.cannonConstraint?.disable();
    } 
    update( _delta:number ) { }

    constructor( readonly obj:Object3D, readonly cannonConstraint?:Constraint ) {

    }
    get name():string {
        return this.obj.userData.name;
    }

    removeFrom( world:World )
    {
        if( this.cannonConstraint )
            world.removeConstraint( this.cannonConstraint );
    }
}

export class SyncConstraint extends ThreeJsCannonEsConstraint {
  private offsetPos = new Vector3();
  private offsetQuat = new Quaternion();
  private hasInit = false;

  constructor(obj: Object3D, readonly body: Body) {
    super(obj);
  }

  private initOffsets() {
    const bodyPos = new Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    const bodyQuat = new Quaternion(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);

    const objWorldPos = new Vector3();
    const objWorldQuat = new Quaternion();
    this.obj.getWorldPosition(objWorldPos);
    this.obj.getWorldQuaternion(objWorldQuat);

    this.offsetPos.copy(objWorldPos).sub(bodyPos).applyQuaternion(bodyQuat.clone().invert());
    this.offsetQuat.copy(bodyQuat.clone().invert().multiply(objWorldQuat));

    this.hasInit = true;
  }

  override update(): void {
    if (!this.hasInit) this.initOffsets();

    const bodyPos = new Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    const bodyQuat = new Quaternion(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);

    // Final world transform
    const worldQuat = bodyQuat.clone().multiply(this.offsetQuat);
    const worldPos = this.offsetPos.clone().applyQuaternion(bodyQuat).add(bodyPos);

    // Convert to local space of parent, considering rotation and scale
    if (this.obj.parent) {
      this.obj.parent.updateMatrixWorld(true);

      const mat = new Matrix4().compose(worldPos, worldQuat, new Vector3(1, 1, 1));
      const parentInv = new Matrix4().copy(this.obj.parent.matrixWorld).invert();

      mat.premultiply(parentInv);
      mat.decompose(this.obj.position, this.obj.quaternion, new Vector3());
    } else {
      this.obj.position.copy(worldPos);
      this.obj.quaternion.copy(worldQuat);
    }
  }
}

/**
 * Creates a cable ( a skinned mesh with a chain on bones that copies a chain of connected cannon-es bodies connected via point to point contraint )
 */
export class CableConstraint extends ThreeJsCannonEsConstraint {
    private lockToA:PointToPointConstraint|undefined;
    private lockToB:PointToPointConstraint|undefined;

    constructor(readonly world:World, obj: Object3D, readonly cable:CannonTubeRig, stickToA?: Body, stickToB?: Body ) {
        
        super(obj); 

        if( stickToA )
        { 
            this.lockHeadTo(stickToA);
        }

        if( stickToB )
        {
            this.lockTailTo(stickToB)
        } 
    }

    private lockXTo( old:PointToPointConstraint|undefined, X:Body, target:Body|undefined ) {
        let result:PointToPointConstraint|undefined;

        if( old )
        {
            this.world.removeConstraint(old);
        }

        if( target )
        {
            result = new PointToPointConstraint( X , new Vec3(), target, target.pointToLocalFrame(X.position) );
            result.collideConnected = false; 
            this.world.addConstraint(result); 
        }

        return result;
    }

    /**
     * Locks or Releases the head to or from a body. `PointToPointConstraint` will be used to lock.
     * @param body 
     */
    lockHeadTo( body:Body|undefined ) {
        this.lockToA = this.lockXTo(this.lockToA, this.cable.head, body); 
    }

    /**
     * Locks or Releases the tail to or from a body. `PointToPointConstraint` will be used to lock.
     * @param body 
     */
    lockTailTo( body:Body|undefined ) {
        this.lockToB = this.lockXTo(this.lockToB, this.cable.tail, body); 
        
    }

    override enable(): void { 
        this.lockToA?.enable();
        this.lockToB?.enable();
        this.cable.constraints.forEach(c=>c.enable()) 
    }

    override disable(): void {
        this.lockToA?.disable();
        this.lockToB?.disable();
        this.cable.constraints.forEach(c=>c.disable())
    }

    override update(): void {
        this.cable.syncRig();
    }

    override removeFrom(world: World): void {
        if(this.lockToA)
        {
            world.removeConstraint(this.lockToA);
            this.lockToA = undefined;
        }

        if(this.lockToB)
        {
            world.removeConstraint(this.lockToB);
            this.lockToA = undefined;
        }

        this.cable.removeFromPhysicalWorld(world)

        super.removeFrom(world);
    }
}