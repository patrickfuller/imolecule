imolecule
=========

An interactive 3D molecule viewer for the IPython notebook and
[browsers](http://www.patrick-fuller.com/imolecule.html).

![](http://www.patrick-fuller.com/wp-content/uploads/2013/04/collagen_imolecule.png)

Usage
=====

###Dependency

This requires the [Open Babel](http://openbabel.org/wiki/Main_Page) library
and Python bindings for chemical file format parsing. which can be installed
via apt-get/macports (the pip repository doesn't work).

```bash
apt-get/port install openbabel-python
```

In the case of OSX + homebrew, the default installer doesn't include python
bindings. Instead, use

```bash
brew install https://raw.github.com/rwest/homebrew/open-babel-new/Library/Formula/eigen2.rb
brew install https://raw.github.com/rwest/homebrew/open-babel-new/Library/Formula/open-babel.rb
```

If you have problems, refer to the Open Babel website.

Additionally, running the browser as a server requires some socket infrastructure

```bash
pip install pyzmq tornado tornadio
```

###IPython notebook

Open a new notebook with `ipython notebook` and make sure that the `imolecule`
directory is either in the directory you started the notebook or your
PYTHONPATH. You can test the setup by typing:

```python
import imolecule
imolecule.draw("CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C")
```

into a notebook cell. You should get the output:

![](http://www.patrick-fuller.com/wp-content/uploads/2013/04/imolecule_penicillin.png)

The drawer can handle any format specified [here](http://openbabel.org/docs/2.3.1/FileFormats/Overview.html),
and can be set up to better handle different use cases. For example, to view a
crystallographic structure with pre-generated coordinates, you can increase the size of the visualizer.

![](http://www.patrick-fuller.com/wp-content/uploads/2013/04/imolecule_nu100.png)

###Full Browser

A version of the browser can be found at http://www.patrick-fuller.com/imolecule.html.
To start your own local version, cd to the `imolecule` directory and start a
server with:

```bash
python server.py
```

Navigate a browser to http://localhost:8000/, and you're done.

The site allows for loading molecules via a simple file drag-and-drop interface.
Drag a file to anywhere in the browser and drop to load. This interface
communicates with openbabel via websocket, so most file formats should work. Be
sure to set the extensions of your files to their data type (ie. "mol", "pdb",
etc.)
