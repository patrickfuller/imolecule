/*global THREE, $, jQuery*/
"use strict";

/**
 * Binds an animation loop to the outside world
 */
function animateViewer() {
    requestAnimationFrame(animateViewer);
    viewer.controls.update();
    viewer.renderer.render(viewer.scene, viewer.camera);
}

/**
 * Methods pertaining to visualizing molecules and mofs.
 */
var viewer = {

    // Contains parameters pertaining to camera rotating, zooming, and panning.
    addControls: function (camera) {
        this.controls = new THREE.TrackballControls(camera,
                                                   this.renderer.domElement);
        this.controls.rotateSpeed = 1;
        this.controls.zoomSpeed = 0.25;
        this.controls.panSpeed = 1;
        this.controls.noZoom = false;
        this.controls.noPan = false;
        this.controls.staticMoving = false;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 200;
        this.controls.keys = [65, 83, 68];
    },

    // Loads json files containing atom sizes and colors
    loadChemicalProperties: function () {
        var self = this;
        // Fills object with material primitives, rather than just colors
        $.getJSON("json/atom_colors.json", function (colors) {
            self.toonMaterials = {};
            var key;
            for (key in colors) {
                if (colors.hasOwnProperty(key)) {
                    colors[key] = parseInt(colors[key], 16);
                    self.toonMaterials[key] = viewer.makeMaterial(colors[key]);
                }
            }

            // Forcing sequential loading to avoid race condition on startup
            $.getJSON("json/atom_diameters.json", function (diameters) {
                self.atomDiameters = diameters;

                $.getJSON("json/nu_100.json", function (sample) {
                    self.drawMolecule(sample);
                });
            });
        });
    },

    // Makes a toon-shaded material
    makeMaterial: function (color) {
        var material = new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(this.shader.uniforms),
                vertexShader: this.shader.vertexShader,
                fragmentShader: this.shader.fragmentShader
            });
        material.uniforms.uDirLightPos.value.set(this.camera.position.z,
                           this.camera.position.z, this.camera.position.z);
        color = new THREE.Color(color);
        material.uniforms.uDirLightColor.value = color;
        material.uniforms.uBaseColor.value = color;
        return material;
    },

    // Deletes any existing molecules.
    clear: function () {
        var i;
        for (i = 0; i < this.atoms.length; i += 1) {
            this.scene.remove(this.atoms[i].mesh);
        }
        this.atoms = [];
        for (i = 0; i < this.bonds.length; i += 1) {
            this.scene.remove(this.bonds[i].mesh);
        }
        this.bonds = [];
    },

    // Sets molecule drawing types ( ball and stick, space filling, wireframe )
    setDrawingType: function (type) {

        // Some case-by-case logic to avoid clearing and redrawing the canvas
        var i;
        if (this.drawingType === "ball and stick") {
            if (type === "wireframe") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.scene.remove(this.atoms[i].mesh);
                }
            } else if (type === "space filling") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.multiplyScalar(2);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.remove(this.bonds[i].mesh);
                }
            }
        } else if (this.drawingType === "wireframe") {
            if (type === "ball and stick") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.scene.add(this.atoms[i].mesh);
                }
            } else if (type === "space filling") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.multiplyScalar(2);
                    this.scene.add(this.atoms[i].mesh);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.remove(this.bonds[i].mesh);
                }
            }
        } else if (this.drawingType === "space filling") {
            if (type === "ball and stick") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.divideScalar(2);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.add(this.bonds[i].mesh);
                }
            } else if (type === "wireframe") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.divideScalar(2);
                    this.scene.remove(this.atoms[i].mesh);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.add(this.bonds[i].mesh);
                }
            }
        }
        this.drawingType = type;
    },

    // Sets camera type (orthogonal, perspective)
    setCameraType: function (type) {
        if (type === "orthographic") {
            this.addControls(this.orthographic);
            this.orthographic.position = this.perspective.position;
            this.orthographic.roation = this.perspective.rotation;
            this.camera = this.orthographic;
        } else if (type === "perspective") {
            this.addControls(this.perspective);
            this.camera = this.perspective;
        }
    },

    // Creates a new THREE.Vector3 from an array
    arrayToVector: function (array) {
        return new THREE.Vector3(array[0], array[1], array[2]);
    },

    // Draws a molecule. Duh.
    drawMolecule: function (molecule) {

        var mesh, material, atom, bond, site, line, ortho, mag,
            axis, angle, transY, lineGeometry, vSource, vTarget, vOrtho, vCent,
            vDiff, vY, vAxis, SCALE, i, j;

        SCALE = this.drawingType === "space filling" ? 1.0 : 0.5;
        vSource = new THREE.Vector3();
        vTarget = new THREE.Vector3();
        vOrtho = new THREE.Vector3();
        vCent = new THREE.Vector3();
        vDiff = new THREE.Vector3();
        vY = new THREE.Vector3(0, 1, 0);
        vAxis = new THREE.Vector3();

        if (molecule.hasOwnProperty("atoms")) {
            for (i = 0; i < molecule.atoms.length; i += 1) {
                atom = molecule.atoms[i];
                material = this.toonMaterials[atom.element];
                mesh = new THREE.Mesh(this.sphereGeometry, material);
                mesh.position.copy(this.arrayToVector(atom.location));
                mesh.scale.x = mesh.scale.y = mesh.scale.z = SCALE * this.atomDiameters[atom.element];
                if (this.drawingType !== "wireframe") {
                    this.scene.add(mesh);
                }
                this.atoms.push({mesh: mesh, data: atom});
            }
        }

        // If the input file specifies bonds, draw them
        if (molecule.hasOwnProperty("bonds")) {
            for (i = 0; i < molecule.bonds.length; i += 1) {
                bond = molecule.bonds[i];

                // New bond change. Warn users in the console (TODO remove this eventually)
                if (bond.hasOwnProperty("source")) {
                    console.log("Received an outdated .json format. Converting...");
                    bond.atoms = [bond.source, bond.target];
                }

                vSource = this.arrayToVector(molecule.atoms[bond.atoms[0]].location);
                vTarget = this.arrayToVector(molecule.atoms[bond.atoms[1]].location);

                vCent.addVectors(vSource, vTarget).divideScalar(2);
                vDiff.subVectors(vTarget, vSource);
                mag = vDiff.length();

                for (j = 0; j < bond.order; j += 1) {
                    mesh = new THREE.Mesh(this.cylinderGeometry, this.toonMaterials.bond);

                    if (bond.order === 2) {
                        transY = 0.275 * ((j === 1) ? 1 : -1);
                    } else if (bond.order === 3 && j !== 0) {
                        transY = 0.55 * ((j === 1) ? 1 : -1);
                    } else {
                        transY = 0;
                    }

                    mesh.position.copy(vCent);
                    mesh.lookAt(vTarget);
                    mesh.scale.x = mesh.scale.y = SCALE * this.atomDiameters.bond;
                    mesh.scale.z = mag;
                    mesh.translateY(SCALE * transY);

                    if (this.drawingType !== "space filling") {
                        this.scene.add(mesh);
                    }
                    this.bonds.push({mesh: mesh, data: bond});
                }
            }
        }
    },

    // Initializes the three.js scene.
    initialize: function (selector) {
        var $element, aspect, vPreRotation, matrix, self;
        self = this;

        $element = $(selector);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize($element.width(), $element.height());
        $element.append(this.renderer.domElement);

        // Sets a camera with (view angle, aspect, near, far) and moves up z
        aspect = $element.width() / $element.height();
        this.perspective = new THREE.PerspectiveCamera(70, aspect, 1, 3000);
        this.orthographic = new THREE.OrthographicCamera(-$element.width() / 16, $element.width() / 16,
                                                         $element.height() / 16, -$element.height() / 16,
                                                         1, 100);
        this.perspective.position.z = 50;
        this.addControls(this.perspective);
        this.camera = this.perspective;

        // Loads a primitive sphere for atoms (radius, segments, rings)
        this.sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
        this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 16, false);

        // Creates a light source
        this.light = new THREE.HemisphereLight(0xffffff, 1.0);
        this.light.position = this.camera.position;

        // Low-poly line materials for sites and ionic bonds
        this.RED = new THREE.LineBasicMaterial({color: 0xff0000});
        this.GREEN = new THREE.LineBasicMaterial({color: 0x00ff00});

        // Uses ToonShader.js to create rules for a cel shader
        this.shader = THREE.ShaderToon.toon2;

        // This orients the cylinder primitive so THREE.lookAt() works properly
        vPreRotation = new THREE.Vector3(Math.PI / 2, Math.PI, 0);
        matrix = new THREE.Matrix4().setRotationFromEuler(vPreRotation);
        this.cylinderGeometry.applyMatrix(matrix);

        this.atoms = [];
        this.bonds = [];
        this.sites = [];

        this.drawingType = "ball and stick";
        this.visibleSites = "no sites";

        // Initializes a scene and appends objects to be drawn
        this.scene = new THREE.Scene();
        this.scene.add(this.perspective);
        this.scene.add(this.orthographic);
        this.scene.add(this.light);

        window.addEventListener("resize", function () {
            self.camera.aspect = $element.width() / $element.height();
            self.renderer.setSize($element.width(), $element.height());
            self.camera.updateProjectionMatrix();
        }, false);

        this.loadChemicalProperties();
        animateViewer(this);
    }
};
