var camera, scene, renderer, controls, light;
var sphereGeometry, cylinderGeometry, materials, sizes;

init();
animate();

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

function drawMolecule(molecule) {

    var SCALE = 0.5;
    var mesh, atom, bond, mag, transY;
    var vSource, vTarget, vCent, vDiff;
    vCent = new THREE.Vector3();
    vDiff = new THREE.Vector3();

    for (var i = 0; i < molecule.atoms.length; i++) {
        atom = molecule.atoms[i];
        mesh = new THREE.Mesh(sphereGeometry, materials[atom.element]);
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
            mesh = new THREE.Mesh(cylinderGeometry, materials.bond);

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

function init() {

    camera = new THREE.PerspectiveCamera( 40, #(w) / #(h), 1, 3000 );
    camera.position.z = 15;

    scene = new THREE.Scene();

    // Atoms are spheres, bonds are cylinders
    sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
    cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 16, false);

    var vPreRotation = new THREE.Vector3(Math.PI / 2, Math.PI, 0);
    var matrix = new THREE.Matrix4().setRotationFromEuler(vPreRotation);
    cylinderGeometry.applyMatrix(matrix);

    sizes = #(sizes);

    materials = #(colors);
    for (var key in materials) {
        materials[key] = new THREE.MeshLambertMaterial(
                             { color: parseInt(materials[key], 16) } );
    }

    light = new THREE.HemisphereLight(0xffffff, 1.0);
    light.position = camera.position;

    scene.add( camera );
    scene.add( light );

    drawMolecule( #(molecule) );

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( #(w), #(h) );

    addControls();

    // Use IPython handles to create a div below the current line
    container.show();
    var div = $("<div/>").attr("id", "molecule_" + utils.uuid());
    div.html(renderer.domElement);
    element.append(div);

}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );

}
