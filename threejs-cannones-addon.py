# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Pablo Bandinopla (https://x.com/bandinopla) 
# MIT License 

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

bl_info = {
    "name": "Three.js Cannon-es Rigger",
    "author": "Pablo Bandinopla",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "description": "Adds properties and panels for Three.js + Cannon-es GLB export",
    "category": "Object",
    "doc_url": "https://github.com/bandinopla/threejs-cannones-rigger",
}

import bpy


def on_type_change(self, context):
    value = self.threejscannones_type 
    if value == 'x': 
        props_to_delete = ["threejscannones_A", "threejscannones_B", "threejscannones_mass", 
                          "threejscannones_cgroup", "threejscannones_cwith", "threejscannones_customId", "threejscannones_syncSource" ]
        for prop in props_to_delete:
            try:
                del context.object[prop]
            except KeyError:
                pass 
    elif value == 'box' or value == 'sphere' or value== 'glue' or 'tube' or 'custom':
        if "threejscannones_cgroup" not in context.object:
            context.object.threejscannones_cgroup[0] = True
        if "threejscannones_cwith" not in context.object:
            context.object.threejscannones_cwith[0] = True
        

bpy.types.Object.threejscannones_layers = bpy.props.EnumProperty(
    name="Collision Group",
    description="Select collision layers",
    items=[
        ('1', "1", ""),
        ('2', "2", ""),
        ('4', "3", ""),
        ('8', "4", ""),
        ('16', "5", ""),
        ('32', "6", ""),
        ('64', "7", ""),
        ('128', "8", ""),
        ('256', "9", ""),
        ('512', "10", ""),
    ]
)  

bpy.types.Object.threejscannones_cgroup = bpy.props.BoolVectorProperty(
    name="I'm in group(s)...", 
    description="Groups in which this collider is in...",
    size=32,
    subtype='LAYER_MEMBER',  
    default=(True,) + (False,) * 31
)

bpy.types.Object.threejscannones_customId = bpy.props.StringProperty(name="Custom ID") 

bpy.types.Object.threejscannones_cwith = bpy.props.BoolVectorProperty(
    name="I collide with group(s)...",
    description="Groups that collide with us...",
    size=32,
    subtype='LAYER_MEMBER',  
    default=(True,) + (False,) * 31
) 

bpy.types.Object.threejscannones_mass = bpy.props.FloatProperty(name="Mass") 

bpy.types.Object.threejscannones_A = bpy.props.PointerProperty(
    name="A",
    type=bpy.types.Object, 
)
bpy.types.Object.threejscannones_B = bpy.props.PointerProperty(
    name="B",
    type=bpy.types.Object, 
) 
bpy.types.Object.threejscannones_syncSource = bpy.props.PointerProperty(
    name="Collider",
    type=bpy.types.Object, 
) 
bpy.types.Object.threejscannones_type = bpy.props.EnumProperty(
    name="Type",
    items=[ 
        ('x', "---", ""),
        ('box', "Box Collider", ""),
        ('sphere', "Sphere Collider", ""),
        ('glue',"Glue all my child colliders","Combines childs making them stick to each other"),
        ('lock',"Glue colliders","Glue two objects so they act like glued togheder."),
        ('hinge',"Hinge Constrain (on local Z axis)","Constrain that will hinge on the object's local z axis"),
        ('point',"Point Constrain","Connects 2 colliders via this point" ),
        ('dist',"Keep this distance", "Keeps the same distance between two bodies as they have right now"),
        ('sync', "Sync position & rotation", "this ThreeJs object will copy the position and rotation of the cannon's collider."),
        ('tube',"Tube / Cable", "Creates a cable from A to B. Must have 2 emoty childs, one representing the head, and the other the tail."),
        ('custom',"Custom Constraint", "Define your own custom constrain")
    ],
    update=on_type_change
)

class ThreeJsCannonEsRigger(bpy.types.Panel):
    bl_label = "ThreeJs / Cannon-es (Physics)"
    bl_idname = "OBJECT_PT_my_object_panel"
    bl_space_type = 'PROPERTIES'
    bl_region_type = 'WINDOW'
    bl_context = "object"

    def draw(self, context):
        layout = self.layout 
        obj = context.object
        layout.prop(context.object, "threejscannones_type") 

        layout.operator("wm.url_open", text="Open Docs (git repo)", icon='HELP').url = bl_info["doc_url"]

        if context.object.threejscannones_type == 'custom':
            layout.prop(context.object, "threejscannones_customId")  
        
        match context.object.threejscannones_type: 
            case 'box' | 'sphere':
                layout.prop(context.object, "threejscannones_mass")  
            case 'hinge' | 'point' | 'dist' | 'lock' | 'tube' | 'custom': 
                layout.prop(context.object, "threejscannones_A")
                layout.prop(context.object, "threejscannones_B")
            case 'glue':
                layout.separator()
                layout.label(text="Below you can define default values for childs if they are not set...", icon='PREFERENCES')
            case 'sync':
                layout.prop(obj,"threejscannones_syncSource")
                
        match context.object.threejscannones_type:  
            case 'box' | 'sphere' | 'glue' | 'tube' | 'custom':   
                layout.prop(context.object,"threejscannones_cgroup" )  
                layout.prop(context.object,"threejscannones_cwith" )

def register():
    bpy.utils.register_class(ThreeJsCannonEsRigger)

def unregister():
    bpy.utils.unregister_class(ThreeJsCannonEsRigger)

if __name__ == "__main__":
    register()
