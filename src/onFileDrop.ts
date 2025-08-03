export function onFileDrop(loadGLB:(url:string)=>void) {
// drag & drop events
    const dropzone = document.getElementById('dropzone')!; 
    const fileInput = document.getElementById('fileSelector')! as HTMLInputElement; 

    ['dragenter', 'dragover'].forEach(evt =>
      document.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.add('active');
      })
    );

    ['dragleave', 'drop'].forEach(evt =>
      document.addEventListener(evt, () => {
        dropzone.classList.remove('active');
      })
    );

    document.addEventListener('drop', e => {
      e.preventDefault();
      const files = [...e.dataTransfer!.files];
      const glb = files.find(f => /\.(glb|gltf)$/i.test(f.name));
      if (glb) loadGLB( URL.createObjectURL(glb) );
      console.log("Dropped", files)
    });

    // Trigger loadGLB on file input selection if it is a glb/gltf
    fileInput.addEventListener('change', () => {
        const files = [...fileInput.files!];
        const glb = files.find(f => /\.(glb|gltf)$/i.test(f.name));
        fileInput.value = ""; 
        if (glb) loadGLB(URL.createObjectURL(glb));
        console.log("Selected", files);
    });
}