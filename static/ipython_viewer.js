/*global $, jQuery, THREE*/
"use strict";
var camera, scene, renderer, controls, light, shader;
var sphereGeometry, cylinderGeometry, materials, sizes;

init();
animate();

function arrayToVector(array) {
    return new THREE.Vector3(array[0], array[1], array[2]);
}

function drawMolecule(molecule) {

    var SCALE = 0.3, mesh, atom, bond, mag, transY, vSource, vTarget, vCent, vDiff, i, j;
    vCent = new THREE.Vector3();
    vDiff = new THREE.Vector3();

    for (i = 0; i < molecule.atoms.length; i += 1) {
        atom = molecule.atoms[i];
        mesh = new THREE.Mesh(sphereGeometry, materials[atom.element]);
        mesh.position.copy(arrayToVector(atom.location));
        mesh.scale.x = mesh.scale.y = mesh.scale.z = SCALE * sizes[atom.element] * 2;
        scene.add(mesh);
    }

    for (i = 0; i < molecule.bonds.length; i += 1) {
        bond = molecule.bonds[i];
        vSource = arrayToVector(molecule.atoms[bond.atoms[0]].location);
        vTarget = arrayToVector(molecule.atoms[bond.atoms[1]].location);
        vCent.addVectors(vSource, vTarget).divideScalar(2);
        vDiff.subVectors(vTarget, vSource);
        mag = vDiff.length();

        for (j = 0; j < bond.order; j += 1) {
            mesh = new THREE.Mesh(cylinderGeometry, materials.bond);
            if (bond.order === 2) {
                transY = 0.5 * ((j === 1) ? 1 : -1);
            } else if (bond.order === 3 && j !== 0) {
                transY = ((j === 1) ? 1 : -1);
            } else {
                transY = 0;
            }
            mesh.position.copy(vCent);
            mesh.lookAt(vTarget);
            mesh.scale.x = mesh.scale.y = SCALE * sizes.bond * 2;
            mesh.scale.z = mag;
            mesh.translateY(SCALE * transY);
            scene.add(mesh);
        }
    }
}

function makeToonMaterial(color) {
    var mat, col;
    mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(shader.uniforms),
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader
    });
    mat.uniforms.uDirLightPos.value.set(camera.position.z, camera.position.z,
                                        camera.position.z);
    mat.uniforms.uAmbientLightColor.value = new THREE.Color(parseInt("0x222222", 16));
    col = new THREE.Color(color);
    mat.uniforms.uDirLightColor.value = col;
    mat.uniforms.uBaseColor.value = col;
    return mat;
}

function init() {
    camera = new THREE.PerspectiveCamera( 40, #(w) / #(h), 1, 3000 );
    camera.position.z = 15;
    scene = new THREE.Scene();

    // Atoms are spheres, bonds are cylinders
    sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
    cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 3, false);

    var vPreRotation = new THREE.Vector3(Math.PI / 2, Math.PI, 0);
    var matrix = new THREE.Matrix4().makeRotationFromEuler(vPreRotation);
    cylinderGeometry.applyMatrix(matrix);

    sizes = #(sizes);

    light = new THREE.HemisphereLight(0xffffff, 1.0);
    light.position = camera.position;
    shader = THREE.ShaderToon["toon2"];

    materials = #(colors);
    for (var key in materials) {
        var col = {color: parseInt(materials[key], 16)};
        materials[key] = #(toon)? makeToonMaterial(col.color) :
                                  new THREE.MeshLambertMaterial(col);
    }

    scene.add(camera);
    scene.add(light);

    drawMolecule( #(molecule) );

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize( #(w), #(h) );
    controls = new THREE.TrackballControls(camera, renderer.domElement);

    // Use IPython handles to create a div below the current line
    container.show();
    var div = $("<div/>").attr("id", "molecule_" + utils.uuid());
    div.html(renderer.domElement);
    element.append(div);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
