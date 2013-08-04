imolecule
=========

An interactive 3D molecule visualizer and format converter for browsers. Check
out the embeddable demo [here](http://www.patrick-fuller.com/imolecule/example)
and the full functionality [here](http://www.patrick-fuller.com/imolecule.html).

![](http://i.imgur.com/af6X07k.png)

Usage
=====

```javascript
imolecule.create('my-selector');
imolecule.draw(myMolecule);
```

where `'my-selector'` is where you want to place imolecule, and `myMolecule` is
an object. See below for more on the object structure, or just check out the
included example. The `imolecule.create()` method takes a few optional parameters.
Read the source for more.

This embeds an interactive molecule into your site, but does not come with any
automatic format conversion. For that, read below.

Automatic format conversion
===========================

This requires the [Open Babel](http://openbabel.org/wiki/Main_Page) library
and Python bindings for chemical file format parsing. For the most up-to-date
version of this library, install the dev version and build from source.

```bash
git clone https://github.com/openbabel/openbabel
mkdir build && cd build
cmake ../openbabel -DPYTHON_BINDINGS=ON
make && make install
export PYTHONPATH=/usr/local/lib:$PYTHONPATH # Put in your ~/.bashrc
```

There are required dependencies (like eigen) and extra build options (like changing
install directory). For more, read through the
[open babel installation instructions](http://openbabel.org/docs/dev/Installation/install.html).

Additionally, running the browser as a server requires some socket infrastructure.

```bash
pip install pyzmq tornado tornadio
```

Once this is set up, run the full program with

```
python server.py
```

The site allows for loading molecules via a simple file drag-and-drop interface.
Drag a file to anywhere in the browser and drop to load. This interface
communicates with openbabel via websocket, so most file formats should work. Be
sure to set the extensions of your files to their data type (ie. "mol", "pdb",
etc.) for format inference to work properly.

If you are adding imolecule to a system with existing sockets, then you can
edit the client hooks in `imolecule.js` to work how you see fit.

IPython support
===============

The IPython notebook is an open-source tool poised to replace MATLAB in many
applications. As a scientist (of sorts), I'm all about it. Therefore, I made
handles to use imolecule with the notebook.

Open a new notebook with `ipython notebook` and make sure that the `imolecule`
directory is either in the directory you started the notebook or your
PYTHONPATH. You can test the setup by typing:

```python
import imolecule
imolecule.draw("CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C")
```

into a notebook cell. This should convert, optimize and draw the specified
SMILES structure (in this case, penicillin) into the notebook.

The drawer can handle any format specified [here](http://openbabel.org/docs/2.3.1/FileFormats/Overview.html),
and can be set up to better handle different use cases. Check out the docstrings
associated with the IPython interface for more.

Molecule Data Format
====================

At its core, imolecule takes input chemical structures as javascript objects.
As an example, consider benzene:

```json
{
    "atoms": [
        { "element": "C", "location": [ -0.762160, 1.168557, 0.022754 ] },
        { "element": "C", "location": [ 0.631044, 1.242862, -0.013022 ] },
        { "element": "C", "location": [ 1.391783, 0.076397, -0.012244 ] },
        { "element": "C", "location": [ 0.762101, -1.168506, 0.026080 ] },
        { "element": "C", "location": [ -0.631044, -1.242903, -0.011791 ] },
        { "element": "C", "location": [ -1.391806, -0.076430, -0.014083 ] },
    ],
    "bonds": [
        { "atoms": [ 0, 1 ], "order": 2 },
        { "atoms": [ 1, 2 ], "order": 1 },
        { "atoms": [ 2, 3 ], "order": 2 },
        { "atoms": [ 3, 4 ], "order": 1 },
        { "atoms": [ 4, 5 ], "order": 2 },
        { "atoms": [ 0, 5 ], "order": 1 }
    ]
}
```

If you want to make javascript objects, you can use either `format_converter.py`
or a running imolecule instance (like [this one](http://www.patrick-fuller.com/imolecule.html))
to convert any input data structure to JSON. From there, the file can be read
normally. See the included example for more.
