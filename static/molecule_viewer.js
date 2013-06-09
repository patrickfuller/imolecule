/*global THREE, $, jQuery, console, window, requestAnimationFrame*/
"use strict";

/**
 * Methods pertaining to visualizing molecules and mofs.
 */
var viewer = {

    // Loads json files containing atom sizes and colors
    loadChemicalProperties: function () {
        var self = this;
        // Fills object with material primitives, rather than just colors
        $.getJSON("static/json/atom_colors.json", function (colors) {
            self.toonMaterials = {};
            var key;
            for (key in colors) {
                if (colors.hasOwnProperty(key)) {
                    colors[key] = parseInt(colors[key], 16);
                    self.toonMaterials[key] = self.makeMaterial(colors[key]);
                }
            }

            // Forcing sequential loading to avoid race condition on startup
            $.getJSON("static/json/atomic_radii_empirical.json", function (radii) {
                self.atomicRadii = radii;

                $.getJSON("static/json/caffeine.json", function (sample) {
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
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].mesh.setMaterial(this.bonds[i].mesh.atomMaterial);
                }
            } else if (type === "space filling") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.divideScalar(0.3);
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
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].mesh.setMaterial(this.toonMaterials.bond);
                }
            } else if (type === "space filling") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.divideScalar(0.3);
                    this.scene.add(this.atoms[i].mesh);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.remove(this.bonds[i].mesh);
                }
            }
        } else if (this.drawingType === "space filling") {
            if (type === "ball and stick") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.multiplyScalar(0.3);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].mesh.setMaterial(this.toonMaterials.bond);
                    this.scene.add(this.bonds[i].mesh);
                }
            } else if (type === "wireframe") {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].mesh.scale.multiplyScalar(0.3);
                    this.scene.remove(this.atoms[i].mesh);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].mesh.setMaterial(this.bonds[i].mesh.atomMaterial);
                    this.scene.add(this.bonds[i].mesh);
                }
            }
        }
        this.drawingType = type;
    },

    // Sets camera type (orthogonal, perspective)
    setCameraType: function (type) {
        if (type === "orthographic") {
            this.camera = this.orthographic;
            this.camera.position.copy(this.perspective.position);
        } else if (type === "perspective") {
            this.camera = this.perspective;
            this.camera.position.copy(this.orthographic.position);
        }
        this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
    },

    // Draws a molecule. Duh.
    drawMolecule: function (molecule) {

        var i, j, k, scale, vectors, atom, bond, material, mesh, mag, transY;

        this.current = molecule;
        scale = this.drawingType === "space filling" ? 1.0 : 0.3;

        // This is an object to hold geometric calculations
        vectors = {};
        $.each(["source", "target", "cent", "diff"], function (i, value) {
            vectors[value] = new THREE.Vector3();
        });

        if (molecule.hasOwnProperty("atoms")) {
            for (i = 0; i < molecule.atoms.length; i += 1) {
                atom = molecule.atoms[i];
                material = this.toonMaterials[atom.element];
                mesh = new THREE.Mesh(this.sphereGeometry, material);
                mesh.position.fromArray(atom.location);
                mesh.scale.x = mesh.scale.y = mesh.scale.z = scale * this.atomicRadii[atom.element] * 2;
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
                vectors.source.fromArray(molecule.atoms[bond.atoms[0]].location);
                vectors.target.fromArray(molecule.atoms[bond.atoms[1]].location);
                vectors.cent.addVectors(vectors.source, vectors.target).divideScalar(2);
                mag = vectors.diff.subVectors(vectors.target, vectors.source).length();

                // Skip bonds that are too small to visualize
                if (mag < 0.01) {
                    continue;
                }

                for (j = 0; j < bond.order; j += 1) {
                    if (bond.order === 2) {
                        transY = 0.5 * ((j === 1) ? 1 : -1);
                    } else if (bond.order === 3 && j !== 0) {
                        transY = ((j === 1) ? 1 : -1);
                    } else {
                        transY = 0;
                    }
                    for (k = 0; k < 2; k += 1) {
                        mesh = new THREE.Mesh(this.cylinderGeometry, this.toonMaterials.bond);
                        atom = molecule.atoms[bond.atoms[k]];
                        mesh.atomMaterial = this.toonMaterials[atom.element];
                        mesh.position.addVectors(vectors[k === 0 ? "source" : "target"],
                                vectors.cent).divideScalar(2);
                        mesh.lookAt(vectors.target);
                        mesh.scale.x = mesh.scale.y = 0.3 * this.atomicRadii.bond * 2;
                        mesh.scale.z = mag / 2.0;
                        mesh.translateY(0.3 * transY);

                        if (this.drawingType === "wireframe") {
                            mesh.material = mesh.atomMaterial;
                        }
                        if (this.drawingType !== "space filling") {
                            this.scene.add(mesh);
                        }
                        this.bonds.push({mesh: mesh, data: bond});
                    }
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
        this.perspective = new THREE.PerspectiveCamera(50, aspect);
        this.orthographic = new THREE.OrthographicCamera(-$element.width() / 32,
                $element.width() / 32, $element.height() / 32,
                -$element.height() / 32, -100, 1000);
        this.perspective.position.z = 15;
        this.camera = this.perspective;
        this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);

        this.orthographic.position = this.perspective.position;
        this.orthographic.rotation = this.perspective.rotation;

        // Loads a primitive sphere for atoms (radius, segments, rings)
        this.sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
        this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 3, false);

        // Creates a light source
        this.light = new THREE.HemisphereLight(0xffffff, 1.0);
        this.light.position = this.camera.position;

        // Uses ToonShader.js to create rules for a cel shader
        this.shader = THREE.ShaderToon.toon2;

        // This orients the cylinder primitive so THREE.lookAt() works properly
        vPreRotation = new THREE.Vector3(Math.PI / 2, Math.PI, 0);
        matrix = new THREE.Matrix4().makeRotationFromEuler(vPreRotation);
        this.cylinderGeometry.applyMatrix(matrix);

        this.atoms = [];
        this.bonds = [];

        this.drawingType = "ball and stick";
        this.visibleSites = "no sites";

        // Initializes a scene and appends objects to be drawn
        this.scene = new THREE.Scene();
        this.scene.add(this.perspective);
        this.scene.add(this.orthographic);
        this.scene.add(this.light);

        window.addEventListener("resize", function () {
            self.renderer.setSize($element.width(), $element.height());
            self.perspective.aspect = $element.width() / $element.height();
            self.perspective.updateProjectionMatrix();
            self.orthographic.left = -$element.width() / 32.0;
            self.orthographic.right = $element.width() / 32.0;
            self.orthographic.top = $element.height() / 32.0;
            self.orthographic.bottom = -$element.height() / 32.0;
            self.orthographic.updateProjectionMatrix();
        }, false);

        this.loadChemicalProperties();
        this.animateViewer();
    },

    // Runs the main window animation in an infinite loop
    animateViewer: function () {
        var self = this;
        window.requestAnimationFrame(function () {
            return self.animateViewer();
        });
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
};
