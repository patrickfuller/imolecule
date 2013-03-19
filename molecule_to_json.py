#!/usr/bin/env python
"""
Converts any chemical datatype supported by openbabel to and from json.
"""

import re
import json

import pybel
from openbabel import OBMolBondIter

def generate_json(data, format, optimize=True, add_h=False):
    """Converts any supported OpenBabel format to json."""
    molecule = pybel.readstring(format, data)
    molecule.addh()
    if optimize:
        molecule.make3D(steps=500)
    if not add_h:
        molecule.removeh()
    return json.dumps(molecule_to_dictionary(molecule))


def molecule_to_dictionary(molecule):
    """Converts an OpenBabel molecule to a Python dictionary."""

    # Get centroid to center molecule at (0, 0, 0)
    centroid = [0, 0, 0]
    for atom in molecule.atoms:
        centroid = [c + a for c, a in zip(centroid, atom.coords)]
    centroid = [c / float(len(molecule.atoms)) for c in centroid]

    # Openbabel atom types have valence ints. Remove those.
    # There are other flags on common atoms (aromatic, .co, am, etc.)
    parse_type = lambda t: t[0] if len(t) > 2 else re.sub("(\d|\W)", "", t)

    # Save atom element type and 3D location.
    atoms = [{"element": parse_type(atom.type),
              "location": [a - c for a, c in zip(atom.coords, centroid)]}
             for atom in molecule.atoms]

    # Save number of bonds and indices of endpoint atoms
    # Switch from 1-index to 0-index counting
    bonds = [{"source": b.GetBeginAtom().GetIndex(),
              "target": b.GetEndAtom().GetIndex(),
              "order": b.GetBondOrder()}
             for b in OBMolBondIter(molecule.OBMol)]

    return {"atoms": atoms, "bonds": bonds}

# Handles using the json converter as a command-line tool
if __name__ == "__main__":
    from sys import argv, exit

    # Print help if needed
    if len(argv) < 3 or "--help" in argv:
        print ("USAGE: python molecule_to_json.py *type* *data* (--addh)\n"
               "    type: Type of input: smi, mol, cif, etc.\n"
               "    data: Chemical file or string\n"
               "    --no-optimize: generate structure coordinates\n"
               "    --add-h: add hydrogen atoms")
        exit()

    # "smi", "mol", "cif", etc.
    molecule_type = argv[1]

    # Support both files and strings.
    try:
        with open(argv[2]) as in_file:
            in_data = in_file.read()
    except:
        in_data = argv[2]

    print generate_json(in_data, molecule_type, "--no-optimize" not in argv,
                        "--add-h" in argv)
