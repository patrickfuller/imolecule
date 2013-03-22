var camera, scene, renderer, controls, light;
var sphereGeometry, cylinderGeometry, toonMaterials, sizes;
var atoms, bonds;

init();
animate();

/**
 * Contains parameters pertaining to camera rotating, zooming, and panning.
 */
function addControls() {
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1;
    controls.zoomSpeed = 0.25;
    controls.panSpeed = 1;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.3;

    controls.minDistance = 1;
    controls.maxDistance = 200;

    controls.keys = [65, 83, 68];
}

function arrayToVector(array, vector) {
    return new THREE.Vector3(array[0], array[1], array[2]);
}

/**
 * Loads json files containing atom sizes and colors
 */
function loadChemicalProperties() {
    // Fills object with material primitives, rather than just colors
    $.getJSON("json/atom_colors.json", function(json) {
        toonMaterials = {};
        transparentMaterials = {};
        for (var key in json) {
            if (json.hasOwnProperty(key)) {
                json[key] = parseInt(json[key], 16);
                toonMaterials[key] = makeMaterial(json[key]);
            }
         }
    });
    $.getJSON("json/atom_diameters.json", function(json) {
        sizes = json;
    });

    $.getJSON("json/nu_100.json", function(json) {
        drawMolecule(json);
    });
}

/**
 * Makes a toon-shaded material
 */
function makeMaterial(color) {
    var material = new THREE.ShaderMaterial({
                         uniforms: THREE.UniformsUtils.clone(shader.uniforms),
                         vertexShader: shader.vertexShader,
                         fragmentShader: shader.fragmentShader});
    material.uniforms.uDirLightPos.value.set(camera.position.z,
                       camera.position.z, camera.position.z);
    color = new THREE.Color(color);
    material.uniforms.uDirLightColor.value = color;
    material.uniforms.uBaseColor.value = color;
    return material;
}

/**
 * Deletes any existing molecules.
 */
function clear() {
    for (var i = 0; i < atoms.length; i++) {
        scene.remove(atoms[i]);
    }
    atoms = [];
    for (var i = 0; i < bonds.length; i++) {
        scene.remove(bonds[i]);
    }
    bonds = [];
}

function drawMolecule(molecule) {

    var SCALE = 0.5;
    var mesh, atom, bond, mag, transY;
    var vSource, vTarget, vCent, vDiff;
    vCent = new THREE.Vector3();
    vDiff = new THREE.Vector3();

    for (var i = 0; i < molecule.atoms.length; i++) {
        atom = molecule.atoms[i];
        mesh = new THREE.Mesh(sphereGeometry, toonMaterials[atom.element]);
        mesh.position.copy(arrayToVector(atom.location));
        mesh.scale.x = mesh.scale.y = mesh.scale.z = SCALE * sizes[atom.element];
        scene.add(mesh);
    }

    for (var i = 0; i < molecule.bonds.length; i++) {
        bond = molecule.bonds[i];
        vSource = arrayToVector(molecule.atoms[bond.source].location);
        vTarget = arrayToVector(molecule.atoms[bond.target].location);

        vCent.addVectors(vSource, vTarget).divideScalar(2);
        vDiff.subVectors(vTarget, vSource);
        mag = vDiff.length();

        for (var j = 0; j < bond.order; j++) {
            mesh = new THREE.Mesh(cylinderGeometry, toonMaterials.bond);

            if (bond.order === 2) {
                transY = 0.275 * ((j === 1)? 1 : -1);
            }
            else if (bond.order === 3 && j !== 0) {
                transY = 0.55 * ((j === 1)? 1 : -1);
            }
            else {
                transY = 0;
            }

            mesh.position.copy(vCent);
            mesh.lookAt(vTarget);
            mesh.scale.x = mesh.scale.y = SCALE * sizes.bond;
            mesh.scale.z = mag;
            mesh.translateY(SCALE * transY);

            scene.add(mesh);
        }
    }
}

/**
 * Fires when a file is dropped onto the load-files div
 */
function onFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    fileReader.onload = (function(file) {
        return function(loaded) {
            clear();
            var json = $.parseJSON(loaded.target.result);
            clear();
            drawMolecule(json);
        };
    })(files[0]);
    fileReader.readAsText(files[0]);
}

/**
 * Fires when the load-files div is being hovered
 */
function onDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
}

/**
 * Adjusts drawing surface when browser is resized
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Sets up WebGL and scene variables
 */
function init() {

    fileReader = new FileReader();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Sets a camera with (view angle, aspect, near, far) and moves up z
    var aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(70, aspect, 1, 3000);
    camera.position.z = 50;
    addControls();

    // Loads a primitive sphere for atoms (radius, segments, rings)
    sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
    cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 16, false);

    // Creates a light source
    light = new THREE.HemisphereLight(0xffffff, 1.0);
    light.position = camera.position;

    // Uses ToonShader.js to create rules for a cel shader
    shader = THREE.ShaderToon.toon2;

    // This orients the cylinder primitive so THREE.lookAt() works properly
    vPreRotation = new THREE.Vector3(Math.PI / 2, Math.PI, 0);
    matrix = new THREE.Matrix4().setRotationFromEuler(vPreRotation);
    cylinderGeometry.applyMatrix(matrix);

    atoms = [];
    bonds = [];

    // Initializes a scene and appends objects to be drawn
    scene = new THREE.Scene();
    scene.add(camera);
    scene.add(light);

    window.addEventListener("resize", onWindowResize, false);

    // Set up the drag-and-drop listeners.
    var dropZone = document.getElementById("drop_zone");
    dropZone.addEventListener("dragover", onDragOver, false);
    dropZone.addEventListener("drop", onFileSelect, false);

    loadChemicalProperties();
}

/**
 * Looped calls to allow interactivity
 */
function animate() {
    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );
}
