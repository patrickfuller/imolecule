"""
Methods to interconvert between json and other (cif, mol, smi, etc.) files
"""

import pybel
ob = pybel.ob

import json_formatter as json

table = ob.OBElementTable()


def convert(data, in_format, out_format, filename=None, pretty=False):
    """Converts between two inputted chemical formats.

    Args:
        data: A string representing the chemical file to be converted. If the
            `in_format` is "json", this can also be a Python object
        in_format: The format of the `data` string. Can be "json" or any format
            recognized by Open Babel
        out_format: The format to convert to. Can be "json" or any format
            recognized by Open Babel
        filename: (Optional) The name of the file containing `data`. This is
            used primarily to encode data saved in the file naming scheme of
            the old building-block format
        pretty: (Optional) If True and `out_format` is "json", will pretty-
            print the output for human readability
    Returns:
        A string representing the inputted `data` in the specified `out_format`
    """

    # Decide on a json formatter depending on desired prettiness
    dumps = json.dumps if pretty else json.compress

    # If it's a json string, load it
    if in_format == "json" and isinstance(data, basestring):
        data = json.loads(data)

    # A little "hack" to format inputted json
    if in_format == "json" and out_format == "json":
        return json.dumps(data)

    # These use the open babel library to interconvert, with additions for json
    mol = (json_to_pybel(data) if in_format == "json" else
           pybel.readstring(in_format.encode("ascii"),
                            "".join(i for i in data if ord(i) < 128)
                            .encode("ascii")))

    # Infer structure in cases where the input format has no specification
    if not mol.OBMol.HasNonZeroCoords():
        mol.make3D()
    mol.OBMol.Center()

    return (dumps(pybel_to_json(mol, name=filename)) if out_format == "json"
            else mol.write(out_format.encode("ascii")))


def json_to_pybel(data, center=True):
    """Converts python data structure to pybel.Molecule.

    This will infer bond data if not specified.

    Args:
        data: The loaded json data of a molecule, as a Python object
        center: (Optional) Centers the coordinates of the outputted molecule
    Returns:
        An instance of `pybel.Molecule`
    """
    obmol = ob.OBMol()
    obmol.BeginModify()
    for atom in data["atoms"]:
        obatom = obmol.NewAtom()
        obatom.SetAtomicNum(table.GetAtomicNum(str(atom["element"])))
        obatom.SetVector(*atom["location"])
    # If there is no bond data, try to infer them
    if "bonds" not in data or not data["bonds"]:
        obmol.ConnectTheDots()
        obmol.PerceiveBondOrders()
    # Otherwise, use the bonds in the data set
    else:
        for bond in data["bonds"]:
            if "atoms" not in bond:
                continue
            obmol.AddBond(bond["atoms"][0] + 1, bond["atoms"][1] + 1,
                          bond["order"])
    obmol.EndModify()
    if center:
        obmol.Center()
    return pybel.Molecule(obmol)


def pybel_to_json(molecule, name=None):
    """Converts a pybel molecule to json.

    Args:
        molecule: An instance of `pybel.Molecule`
    Returns:
        A Python dictionary containing atom and bond data
    """
    # Save atom element type and 3D location.
    atoms = [{"element": table.GetSymbol(atom.atomicnum),
              "location": atom.coords}
             for atom in molecule.atoms]
    # Save number of bonds and indices of endpoint atoms
    bonds = [{"atoms": [b.GetBeginAtom().GetIndex(),
                        b.GetEndAtom().GetIndex()],
              "order": b.GetBondOrder()}
             for b in ob.OBMolBondIter(molecule.OBMol)]
    output = {"atoms": atoms, "bonds": bonds}

    # If there's unit cell data, save it to the json output
    if hasattr(molecule, "unitcell"):
        uc = molecule.unitcell
        output["periodic_connections"] = [[v.GetX(), v.GetY(), v.GetZ()]
                                          for v in uc.GetCellVectors()]
    if name:
        output["name"] = name
    return output


if __name__ == "__main__":
    # Lazy converter to test this out
    import sys
    in_data, in_format, out_format = sys.argv[1:]
    try:
        with open(in_data) as in_file:
            data = in_file.read()
    except IOError:
        data = in_data
    print(convert(data, in_format, out_format, pretty=True))
