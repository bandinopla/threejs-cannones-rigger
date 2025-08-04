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
import gpu
from gpu_extras.batch import batch_for_shader

if 'draw_handler' not in globals():
    draw_handler = None

def on_type_change(self, context):
    obj = context.object
    value = self.threejscannones_type  # current type

    # === Cleanup based on type ===

    # Remove sync source if not 'sync'
    if value != 'sync':
        if hasattr(obj, "threejscannones_syncSource"):
            obj.threejscannones_syncSource = None

    # If 'x', clear physics-related props
    if value == 'x':
        props_to_clear = [
            "threejscannones_A",
            "threejscannones_B",
            "threejscannones_mass",
            "threejscannones_cgroup",
            "threejscannones_cwith",
            "threejscannones_customId"
        ]
        for prop in props_to_clear:
            if hasattr(obj, prop):
                # Clear based on type
                attr = getattr(obj, prop)
                if isinstance(attr, bpy.types.Object):
                    setattr(obj, prop, None)
                elif isinstance(attr, str):
                    setattr(obj, prop, "")
                elif isinstance(attr, (int, float)):
                    setattr(obj, prop, 0)
                elif isinstance(attr, bool):
                    setattr(obj, prop, False)

    # If 'sync', clear A and B
    elif value == 'sync':
        if hasattr(obj, "threejscannones_A"):
            obj.threejscannones_A = None
        if hasattr(obj, "threejscannones_B"):
            obj.threejscannones_B = None

    # For shape types: ensure cgroup and cwith are initialized
    elif value in {'box', 'sphere', 'compound', 'tube', 'custom'}:
        if hasattr(obj, "threejscannones_cgroup") and not obj.threejscannones_cgroup:
            obj.threejscannones_cgroup = True
        if hasattr(obj, "threejscannones_cwith") and not obj.threejscannones_cwith:
            obj.threejscannones_cwith = True

# === Draw functions (your code, slightly cleaned) ===
def draw_line_to(obj, toPropName, color=(0.0, 1.0, 0.0, 0.8)):
 
    if not getattr(bpy.context.scene, "show_debug_lines", True):
        return  # Skip drawing if disabled

    if not obj or not hasattr(obj, toPropName):
        return

    target = getattr(obj, toPropName, None)
    if not target or target == obj:
        print(f".debugLine: {toPropName} not set or self-reference")  # Debug
        return

    start = obj.matrix_world.translation
    end = target.matrix_world.translation
    direction = end - start
    length = direction.length
    if length == 0:
        return
    direction.normalize()

    segment_length = 0.1
    gap_length = 0.15
    step = segment_length + gap_length
    num_segments = int(length / step) + 1

    vertices = []
    for i in range(num_segments):
        seg_start = start + direction * (i * step)
        seg_end = seg_start + direction * segment_length
        if (seg_start - start).length > length:
            break
        seg_end = start + direction * min((seg_end - start).length, length)
        vertices.append(seg_start)
        vertices.append(seg_end)

    if not vertices:
        return

    shader = gpu.shader.from_builtin('UNIFORM_COLOR')
    batch = batch_for_shader(shader, 'LINES', {"pos": vertices})

    gpu.state.blend_set('ALPHA')
    gpu.state.line_width_set(2.0)
    shader.bind()
    shader.uniform_float("color", color)
    batch.draw(shader)
    gpu.state.blend_set('NONE')
    gpu.state.line_width_set(1.0)

def draw_line_to_target():
    obj = bpy.context.active_object
    if not obj:
        return

    # Draw multiple lines with different colors
    draw_line_to(obj, "threejscannones_A", (1.0, 0.0, 0.0, 0.8))      # Red
    draw_line_to(obj, "threejscannones_B", (0.0, 0.0, 1.0, 0.8))      # Blue
    draw_line_to(obj, "threejscannones_syncSource", (1.0, 1.0, 0.0, 0.8))  # Yellow

bpy.types.Scene.show_debug_lines = bpy.props.BoolProperty(
    name=".debugLine Lines",
    description="Show debug lines to A, B, and Sync Source targets",
    default=True 
)

def draw_debug_lines_overlay(self, context):
    layout = self.layout
    scene = context.scene

    # Add a separator and a clear label
    col = layout.column()
    col.separator()
    col.prop(scene, "show_debug_lines", text="ThreeJs/Cannon-es Lines", icon='RESTRICT_VIEW_OFF') 
    col.separator()

def remove_debug_lines_overlay():
    bpy.types.VIEW3D_PT_overlay.remove(draw_debug_lines_overlay)

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
        ('compound',"Compound shape (from child boxes)","Children are boxes, combines them into one single body/collider."),
        ('lock',"Glue/Lock colliders","Glue two objects so they act like glued togheder."),
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
            case 'box' | 'sphere' | 'compound':
                layout.prop(context.object, "threejscannones_mass")  
            case 'hinge' | 'point' | 'dist' | 'lock' | 'tube' | 'custom': 
                row = layout.row()
                layout.prop(context.object, "threejscannones_A")
                layout.prop(context.object, "threejscannones_B") 
            case 'sync':
                layout.prop(obj,"threejscannones_syncSource")
                
        match context.object.threejscannones_type:  
            case 'box' | 'sphere' | 'compound' | 'tube' | 'custom':   
                layout.prop(context.object,"threejscannones_cgroup" )  
                layout.prop(context.object,"threejscannones_cwith" )

def register():
    global draw_handler
    bpy.utils.register_class(ThreeJsCannonEsRigger)
    draw_handler = bpy.types.SpaceView3D.draw_handler_add(
        draw_line_to_target, (), 'WINDOW', 'POST_VIEW'
    )
    bpy.types.VIEW3D_PT_overlay.append(draw_debug_lines_overlay)

def unregister():
    global draw_handler
    bpy.utils.unregister_class(ThreeJsCannonEsRigger)
    remove_debug_lines_overlay()
    # Remove draw handler if it exists
    if draw_handler is not None:
        try:
            bpy.types.SpaceView3D.draw_handler_remove(draw_handler, 'WINDOW')
            print("🧹 Removed old draw handler")
        except (AttributeError, KeyError, TypeError):
            print("⚠️  Draw handler was already removed")
        draw_handler = None

if __name__ == "__main__":
    register()
