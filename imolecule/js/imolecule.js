/*global THREE, $, jQuery, console, window, requestAnimationFrame, document, WebSocket, alert, Blob, saveAs*/
/* jshint globalstrict: true */
'use strict';

var imolecule = {

    // Creates a new instance of imolecule
    create: function (selector, options) {
        var $s = $(selector), self = this, hasCanvas, hasWebgl;
        options = options || {};
        this.$s = $s;

        this.shader = options.hasOwnProperty('shader') ? options.shader : 'lambert';
        this.drawingType = options.hasOwnProperty('drawingType') ? options.drawingType : 'ball and stick';
        this.cameraType = options.hasOwnProperty('cameraType') ? options.cameraType : 'perspective';
        this.updateCamera = (this.cameraType === 'orthographic');
        this.showSave = options.hasOwnProperty('showSave') ? options.showSave : false;
        this.saveImage = false;

        // Adapted from http://japhr.blogspot.com/2012/07/fallback-from-webgl-to-canvas-in-threejs.html
        hasCanvas = !!window.CanvasRenderingContext2D;
        hasWebgl = (function () {
            try {
                return !!window.WebGLRenderingContext &&
                       !!document.createElement('canvas').getContext('experimental-webgl');
            } catch (e) {
                return false;
            }
        }());

        if (hasWebgl) {
            this.renderMode = 'webgl';
            this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
        } else if (hasCanvas) {
            $s.append('<p class="alert alert-warning" align="center">Your web browser ' +
                      'does not support WebGL. Using Canvas as a fallback.</p>');
            this.renderMode = 'canvas';
            if (this.shader === 'toon') {
                this.shader = 'basic';
            }
            this.renderer = new THREE.CanvasRenderer();
            this.renderer.setClearColor(0xffffff, 0);
        } else {
            $s.append('<p class="alert alert-danger" align="center">Your web browser ' +
                      'does not support either WebGL or Canvas. Please upgrade.</p>');
            return;
        }
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize($s.width(), $s.height());
        $s.append(this.renderer.domElement);

        this.perspective = new THREE.PerspectiveCamera(50, $s.width() / $s.height());
        this.orthographic = new THREE.OrthographicCamera(-$s.width() / 32,
                $s.width() / 32, $s.height() / 32, -$s.height() / 32, -100, 1000);
        this.orthographic.z = 10;

        this.sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
        this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 3, false);

        // This orients the cylinder primitive so THREE.lookAt() works properly
        this.cylinderGeometry.applyMatrix(new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0)));

        this.light = new THREE.HemisphereLight(0xffffff, 0.5);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.directionalLight.position.set(1, 1, 1);

        this.atoms = [];
        this.bonds = [];

        // Initializes a scene and appends objects to be drawn
        this.scene = new THREE.Scene();
        this.scene.add(this.perspective);
        this.scene.add(this.orthographic);

        this.setCameraType('perspective');
        this.makeMaterials();

        $(window).resize(function () {
            self.renderer.setSize($s.width(), $s.height());
            self.perspective.aspect = $s.width() / $s.height();
            self.perspective.updateProjectionMatrix();
            self.orthographic.left = -$s.width() / 32.0;
            self.orthographic.right = $s.width() / 32.0;
            self.orthographic.top = $s.height() / 32.0;
            self.orthographic.bottom = -$s.height() / 32.0;
            self.orthographic.updateProjectionMatrix();
            self.render();
        });

        if (this.showSave) {
            $s.prepend('<p class="imolecule-save" style="position: absolute; z-index: 10; opacity: 0.5; ' +
                       'bottom: 10px; right: 28px; cursor: pointer; font-size: 36px">&#x1f4be;</p>');
            $s.find('.imolecule-save').click(function () { self.save(); });
        }

        this.render();
        this.animate();
    },

    // Makes a material for highlighting atoms and bonds
    makeHighlight: function (color) {
        return new THREE.MeshBasicMaterial({color: color, emissive: color, specular: color,
                                            transparent: true, opacity: 0.3, shininess: 100,
                                            depthWrite: false});
    },

    // Makes materials according to specified shader
    makeMaterials: function () {
        var self = this, threeMaterial, overdraw;

        // If a different shader is specified, use uncustomized materials
        if ($.inArray(self.shader, ['basic', 'phong', 'lambert']) !== -1) {
            threeMaterial = 'Mesh' + self.shader.charAt(0).toUpperCase() +
                            self.shader.slice(1) + 'Material';
            overdraw = this.renderMode === 'canvas' ? 0.5 : 0;
            $.each(self.data, function (key, value) {
                value.material = new THREE[threeMaterial]({color: value.color,
                                                           overdraw: overdraw});
            });

        // If toon, use materials with some shader edits
        } else if (this.shader === 'toon') {
            $.each(this.data, function (key, value) {
                var shader, material;
                shader = THREE.ShaderToon.toon2;
                material = new THREE.ShaderMaterial({
                    uniforms: THREE.UniformsUtils.clone(shader.uniforms),
                    vertexShader: shader.vertexShader,
                    fragmentShader: shader.fragmentShader
                });
                material.uniforms.uDirLightPos.value.set(1, 1, 1)
                                 .multiplyScalar(15);
                value.color = new THREE.Color(value.color);
                material.uniforms.uDirLightColor.value = value.color;
                material.uniforms.uBaseColor.value = value.color;
                value.material = material;
            });
        } else {
            throw new Error(this.shader + " shader does not exist. Use " +
                            "'toon', 'basic', 'phong', or 'lambert'.");
        }
    },

    // Draws a molecule. Duh.
    draw: function (molecule, resetCamera) {
        var mesh, self, a, scale, j, k, dy, cent, data, v, vectors, points,
            trans, geometry, material, maxHeight, maxZ, cameraZ, highlightedMesh;
        self = this;
        cent = new THREE.Vector3();
        this.current = molecule;

        scale = this.drawingType === 'space filling' ? 1.0 : 0.3;

        // Don't hate on formats without bond information
        if (!molecule.hasOwnProperty('bonds')) { molecule.bonds = []; }

        // Draws atoms and saves references
        maxHeight = 0;
        maxZ = 0;
        $.each(molecule.atoms, function (i, atom) {
            data = self.data[atom.element] || self.data.unknown;
            mesh = new THREE.Mesh(self.sphereGeometry, data.material);
            mesh.position.fromArray(atom.location);
            mesh.scale.set(1, 1, 1).multiplyScalar(scale * data.radius * 2);

            // We set the color and material to be the highlighted one
            if (atom.hasOwnProperty('color')) {
                highlightedMesh = new THREE.Mesh(self.sphereGeometry.clone(), self.makeHighlight(atom.color));
                highlightedMesh.position.copy(mesh.position);
                highlightedMesh.scale.set(1, 1, 1).multiplyScalar(scale * data.radius * 2 * 1.2);
                self.scene.add(highlightedMesh);
                mesh.highlightedMaterial = highlightedMesh.material;
            }

            if (self.drawingType !== 'wireframe') {
                self.scene.add(mesh);
            }
            mesh.element = atom.element;
            self.atoms.push(mesh);

            maxHeight = Math.max(maxHeight, Math.abs(atom.location[0]), Math.abs(atom.location[1]));
            maxZ = Math.max(maxZ, atom.location[2]);
        });

        // Sets camera position to view whole molecule in bounds with some buffer
        if (typeof resetCamera === 'undefined' || resetCamera) {
            cameraZ = (maxHeight / Math.tan(Math.PI * self.camera.fov / 360) + maxZ) / 0.8;
            self.perspective.position.z = cameraZ;
        }

        // Bonds require some basic vector math
        $.each(molecule.bonds, function (i, bond) {
            a = [self.atoms[bond.atoms[0]], self.atoms[bond.atoms[1]]];
            for (j = 0; j < bond.order; j += 1) {
                if (bond.order === 2) {
                    dy = 0.5 * ((j === 1) ? 1 : -1);
                } else if (bond.order === 3 && j !== 0) {
                    dy = ((j === 1) ? 1 : -1);
                } else {
                    dy = 0;
                }

                for (k = 0; k < 2; k += 1) {
                    mesh = new THREE.Mesh(self.cylinderGeometry, self.data.bond.material);
                    cent.addVectors(a[0].position, a[1].position).divideScalar(2);
                    if(self.data[a[k].element] === undefined) {
                        mesh.atomMaterial = self.data.unknown.material;
                    }
                    else {
                        mesh.atomMaterial = self.data[a[k].element].material;
                    }
                    mesh.position.addVectors(cent, a[k].position).divideScalar(2);
                    mesh.lookAt(a[1].position);
                    mesh.scale.x = mesh.scale.y = 0.3 * self.data.bond.radius * 2;
                    mesh.scale.z = a[1].position.distanceTo(a[0].position) / 2.0;
                    mesh.translateY(0.3 * dy);

                    if (a[0].hasOwnProperty('highlightedMaterial') && a[1].hasOwnProperty('highlightedMaterial')) {
                        highlightedMesh = new THREE.Mesh(self.cylinderGeometry, a[0].highlightedMaterial);
                        cent.addVectors(a[0].position, a[1].position).divideScalar(2);
                        if(self.data[a[k].element] === undefined) {
                            highlightedMesh.atomMaterial = self.data.unknown.material;
                        }
                        else {
                            highlightedMesh.atomMaterial = self.data[a[k].element].material;
                        }
                        highlightedMesh.position.addVectors(cent, a[k].position).divideScalar(2);
                        highlightedMesh.lookAt(a[1].position);
                        highlightedMesh.scale.x = highlightedMesh.scale.y = 0.3 * self.data.bond.radius * 2 * 1.2; // 1.2 is the highlight ratio
                        highlightedMesh.scale.z = a[1].position.distanceTo(a[0].position) / 2.0;
                        highlightedMesh.translateY(0.3 * dy);
                        self.scene.add(highlightedMesh);
                    }

                    if (self.drawingType === 'wireframe') {
                        mesh.material = mesh.atomMaterial;
                    }
                    if (self.drawingType !== 'space filling') {
                        self.scene.add(mesh);
                    }
                    self.bonds.push(mesh);
                }
            }
        });

        // If we're dealing with a crystal structure, draw the unit cell
        if (molecule.hasOwnProperty('unitcell')) {
            // Some basic conversions to handle math via THREE.Vector3
            v = new THREE.Vector3(0, 0, 0);
            vectors = [
                v.clone().fromArray(molecule.unitcell[0]),
                v.clone().fromArray(molecule.unitcell[1]),
                v.clone().fromArray(molecule.unitcell[2])
            ];
            // The eight corners of the unit cell are linear combinations of above
            points = [
                v.clone(), vectors[0], vectors[1], vectors[2],
                v.clone().add(vectors[0]).add(vectors[1]).add(vectors[2]),
                v.clone().add(vectors[1]).add(vectors[2]),
                v.clone().add(vectors[0]).add(vectors[2]),
                v.clone().add(vectors[0]).add(vectors[1])
            ];
            // Translate unit cell to center around mof + origin
            trans = points[4].clone().multiplyScalar(0.5);
            for (j = 0; j < points.length; j += 1) {
                points[j].sub(trans);
            }
            // Draw the box line-by-line
            geometry = new THREE.Geometry();
            $.each([0, 1, 0, 2, 0, 3, 6, 1, 7, 2, 5, 3, 5, 4, 6, 4, 7], function (index, value) {
                geometry.vertices.push(points[value]);
            });
            material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 3});
            this.corners = new THREE.Line(geometry, material);
            this.scene.add(this.corners);
        }

        // If drawing in orthographic, controls need to be initialized *after*
        // building the molecule. This should be triggered at most once, and only
        // when imolecule.create($d, {cameraType: 'orthographic'}) is used.
        if (this.updateCamera) {
            this.setCameraType('orthographic');
            this.updateCamera = false;
        }
        this.render();
    },

    // Deletes any existing molecules.
    clear: function () {
        var self = this;
        $.each(this.atoms.concat(this.bonds), function (i, value) {
            self.scene.remove(value);
        });
        this.atoms = [];
        this.bonds = [];
        this.scene.remove(this.corners);
    },

    // Request to save a screenshot of the current canvas.
    save: function () {
        this.saveImage = true;
    },

    // Sets molecule drawing types ( ball and stick, space filling, wireframe )
    setDrawingType: function (type) {
        // Some case-by-case logic to avoid clearing and redrawing the canvas
        var i;
        if (this.drawingType === 'ball and stick') {
            if (type === 'wireframe') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.scene.remove(this.atoms[i]);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].material = this.bonds[i].atomMaterial;
                }
            } else if (type === 'space filling') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].scale.divideScalar(0.3);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.remove(this.bonds[i]);
                }
            }
        } else if (this.drawingType === 'wireframe') {
            if (type === 'ball and stick') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.scene.add(this.atoms[i]);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].material = this.data.bond.material;
                }
            } else if (type === 'space filling') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].scale.divideScalar(0.3);
                    this.scene.add(this.atoms[i]);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.scene.remove(this.bonds[i]);
                }
            }
        } else if (this.drawingType === 'space filling') {
            if (type === 'ball and stick') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].scale.multiplyScalar(0.3);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].material = this.data.bond.material;
                    this.scene.add(this.bonds[i]);
                }
            } else if (type === 'wireframe') {
                for (i = 0; i < this.atoms.length; i += 1) {
                    this.atoms[i].scale.multiplyScalar(0.3);
                    this.scene.remove(this.atoms[i]);
                }
                for (i = 0; i < this.bonds.length; i += 1) {
                    this.bonds[i].material = this.bonds[i].atomMaterial;
                    this.scene.add(this.bonds[i]);
                }
            }
        }
        this.drawingType = type;
        this.render();
    },

    // Sets camera type (orthogonal, perspective)
    setCameraType: function (type) {
        var self = this;
        this.cameraType = type;
        if (type === 'orthographic') {
            this.camera = this.orthographic;
            if (this.perspective.position.length() > 1) {
                this.camera.position.copy(this.perspective.position);
            }
        } else if (type === 'perspective') {
            this.camera = this.perspective;
            if (this.orthographic.position.length() > 1) {
                this.camera.position.copy(this.orthographic.position);
            }
        }
        this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
        this.controls.addEventListener('change', function () { self.render(); });
        this.camera.add(this.light);
        this.camera.add(this.directionalLight);
        this.render();
    },

    // Sets shader (toon, basic, phong, lambert) and redraws
    setShader: function (shader) {
        if (this.renderMode !== 'webgl' && shader === 'toon') {
            throw new Error("Toon shading requires webGL.");
        }
        this.shader = shader;
        this.makeMaterials();
        this.clear();
        this.draw(this.current, false);
    },

    // Runs the main window animation in an infinite loop
    animate: function () {
        var self = this, link, w, h, renderWidth;
        window.requestAnimationFrame(function () {
            return self.animate();
        });
        if (this.saveImage) {
            renderWidth = 2560 / (window.devicePixelRatio || 1);
            w = this.$s.width(); h = this.$s.height();
            this.renderer.setSize(renderWidth, renderWidth * h / w);
            this.render();
            link = document.createElement('a');
            link.download = 'imolecule.png';
            link.href = this.renderer.domElement.toDataURL('image/png');
            link.click();
            this.renderer.setSize(w, h);
            this.saveImage = false;
        }
        this.render();
        this.controls.update();
    },

    render: function () {
        this.renderer.render(this.scene, this.camera);
    },

    // Either shows or hides the unit cell
    showUnitCell: function (toggle) {
        this.scene[toggle ? 'add' : 'remove'](this.corners);
        this.render();
    },

    // Connects to Python via a socketio-zeromq bridge. Ignore everything below
    // if you're not using the client-server functionality
    connect: function (port) {
        var self = this;
        this.socket = new WebSocket('ws://' + window.location.hostname + ':' + port + '/websocket');
        this.queue = {};

        this.socket.onopen = function () {
            console.log("Connected!");
        };

        this.socket.onmessage = function (messageEvent) {
            var router, jsonRpc, name;

            jsonRpc = $.parseJSON(messageEvent.data);
            router = self.queue[jsonRpc.id];
            delete self.queue[jsonRpc.id];
            self.result = jsonRpc.result;

            if (jsonRpc.error) {
                alert(jsonRpc.result);

            } else if (router === 'draw') {
                self.clear();
                self.draw(jsonRpc.result);

            } else if (router === 'save') {
                name = (jsonRpc.result.hasOwnProperty('name') && jsonRpc.result.name !== '') ?
                        jsonRpc.result.name : self.filename;
                saveAs(new Blob([self.result], {type: 'text/plain'}),
                        name + '.' + self.outFormat);

            } else {
                alert("Unsupported function: " + router);
            }
        };
    },

    // Standardizes chemical drawing formats and draws
    convertAndDraw: function (data, inFormat) {
        // Skips a socket call if not needed
        if (inFormat === 'json') {
            this.clear();
            this.draw($.parseJSON(data));
            return;
        }

        var uuid = this.uuid();
        this.socket.send(JSON.stringify({method: 'convert', id: uuid,
                          params: {data: data, in_format: inFormat,
                                   out_format: 'object', pretty: false}
                         }));
        this.queue[uuid] = 'draw';
    },

    // Converts and saves output
    convertAndSave: function (data, outFormat) {
        var uuid = this.uuid();
        this.socket.send(JSON.stringify({method: 'convert', id: uuid,
                          params: {data: data, in_format: 'json',
                                   out_format: outFormat, pretty: true}
                         }));
        this.outFormat = outFormat;
        this.queue[uuid] = 'save';
    },

    // Generates a unique identifier for request ids
    // Code from http://stackoverflow.com/questions/105034/
    // how-to-create-a-guid-uuid-in-javascript/2117523#2117523
    uuid: function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

    // Add elements to data object
    addElements: function(elementObj) {
        for(var key in elementObj) {
            if(elementObj.hasOwnProperty(key)) {
                this.data[key] = elementObj[key];
            }
        }
        this.makeMaterials();
        this.render();
    },

    data: { Ac: { color: 0x70aaf9, radius: 1.95 },
            Ag: { color: 0xbfbfbf, radius: 1.6 },
            Al: { color: 0xbfa5a5, radius: 1.25 },
            Am: { color: 0x545bf2, radius: 1.75 },
            Ar: { color: 0x80d1e2, radius: 0.71 },
            As: { color: 0xbc80e2, radius: 1.15 },
            Au: { color: 0xffd123, radius: 1.35 },
            B: { color: 0xffb5b5, radius: 0.85 },
            Ba: { color: 0x00c800, radius: 2.15 },
            Be: { color: 0xc1ff00, radius: 1.05 },
            Bi: { color: 0x9e4fb5, radius: 1.6 },
            Br: { color: 0xa52828, radius: 1.15 },
            C: { color: 0x909090, radius: 0.7 },
            Ca: { color: 0x3dff00, radius: 1.8 },
            Cd: { color: 0xffd88e, radius: 1.55 },
            Ce: { color: 0xffffc6, radius: 1.85 },
            Cl: { color: 0x1fef1f, radius: 1.0 },
            Co: { color: 0xef90a0, radius: 1.35 },
            Cr: { color: 0x8999c6, radius: 1.4 },
            Cs: { color: 0x56178e, radius: 2.6 },
            Cu: { color: 0xc88033, radius: 1.35 },
            Dy: { color: 0x1fffc6, radius: 1.75 },
            Er: { color: 0x00e675, radius: 1.75 },
            Eu: { color: 0x60ffc6, radius: 1.85 },
            F: { color: 0x90df4f, radius: 0.5 },
            Fe: { color: 0xdf6633, radius: 1.4 },
            Ga: { color: 0xc18e8e, radius: 1.3 },
            Gd: { color: 0x44ffc6, radius: 1.8 },
            Ge: { color: 0x668e8e, radius: 1.25 },
            H: { color: 0xeeeeee, radius: 0.25 },
            Hf: { color: 0x4dc1ff, radius: 1.55 },
            Hg: { color: 0xb8b8cf, radius: 1.5 },
            Ho: { color: 0x00ff9c, radius: 1.75 },
            I: { color: 0x930093, radius: 1.4 },
            In: { color: 0xa57572, radius: 1.55 },
            Ir: { color: 0x175487, radius: 1.35 },
            K: { color: 0x8e3fd4, radius: 2.2 },
            La: { color: 0x70d4ff, radius: 1.95 },
            Li: { color: 0xcc80ff, radius: 1.45 },
            Lu: { color: 0x00aa23, radius: 1.75 },
            Mg: { color: 0x89ff00, radius: 1.5 },
            Mn: { color: 0x9c79c6, radius: 1.4 },
            Mo: { color: 0x54b5b5, radius: 1.45 },
            N: { color: 0x2f4ff7, radius: 0.65 },
            Na: { color: 0xaa5bf2, radius: 1.8 },
            Nb: { color: 0x72c1c8, radius: 1.45 },
            Nd: { color: 0xc6ffc6, radius: 1.85 },
            Ni: { color: 0x4fcf4f, radius: 1.35 },
            Np: { color: 0x0080ff, radius: 1.75 },
            O: { color: 0xff0d0d, radius: 0.6 },
            Os: { color: 0x266695, radius: 1.3 },
            P: { color: 0xff8000, radius: 1.0 },
            Pa: { color: 0x00a1ff, radius: 1.8 },
            Pb: { color: 0x565960, radius: 1.8 },
            Pd: { color: 0x006985, radius: 1.4 },
            Pm: { color: 0xa3ffc6, radius: 1.85 },
            Po: { color: 0xaa5b00, radius: 1.9 },
            Pr: { color: 0xd8ffc6, radius: 1.85 },
            Pt: { color: 0xcfcfdf, radius: 1.35 },
            Pu: { color: 0x006bff, radius: 1.75 },
            Ra: { color: 0x007c00, radius: 2.15 },
            Rb: { color: 0x702daf, radius: 2.35 },
            Re: { color: 0x267caa, radius: 1.35 },
            Rh: { color: 0x0a7c8c, radius: 1.35 },
            Ru: { color: 0x238e8e, radius: 1.3 },
            S: { color: 0xffff2f, radius: 1.0 },
            Sb: { color: 0x9e62b5, radius: 1.45 },
            Sc: { color: 0xe6e6e6, radius: 1.6 },
            Se: { color: 0xffa100, radius: 1.15 },
            Si: { color: 0xefc8a0, radius: 1.1 },
            Sm: { color: 0x8effc6, radius: 1.85 },
            Sn: { color: 0x668080, radius: 1.45 },
            Sr: { color: 0x00ff00, radius: 2.0 },
            Ta: { color: 0x4da5ff, radius: 1.45 },
            Tb: { color: 0x2fffc6, radius: 1.75 },
            Tc: { color: 0x3b9e9e, radius: 1.35 },
            Te: { color: 0xd47900, radius: 1.4 },
            Th: { color: 0x00baff, radius: 1.8 },
            Ti: { color: 0xbfc1c6, radius: 1.4 },
            Tl: { color: 0xa5544d, radius: 1.9 },
            Tm: { color: 0x00d452, radius: 1.75 },
            U: { color: 0x008eff, radius: 1.75 },
            V: { color: 0xa5a5aa, radius: 1.35 },
            W: { color: 0x2193d6, radius: 1.35 },
            Y: { color: 0x93ffff, radius: 1.8 },
            Yb: { color: 0x00bf38, radius: 1.75 },
            Zn: { color: 0x7c80af, radius: 1.35 },
            Zr: { color: 0x93dfdf, radius: 1.55 },
            bond: { color: 0x0c0c0c, radius: 0.18 },
            unknown: { color: 0x000000, radius: 0.8 }
        }
};
