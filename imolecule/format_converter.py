"""
Methods to interconvert between json and other (cif, mol, smi, etc.) files
"""
import imolecule.json_formatter as json

from collections import Counter
from fractions import gcd
from functools import reduce

try:
    import pybel
    ob = pybel.ob
    table = ob.OBElementTable()
    has_ob = True
except ImportError:
    has_ob = False


def convert(data, in_format, out_format, name=None, pretty=False):
    """Converts between two inputted chemical formats.

    Args:
        data: A string representing the chemical file to be converted. If the
            `in_format` is "json", this can also be a Python object
        in_format: The format of the `data` string. Can be "json" or any format
            recognized by Open Babel
        out_format: The format to convert to. Can be "json" or any format
            recognized by Open Babel
        name: (Optional) If `out_format` is "json", will save the specified
            value in a "name" property
        pretty: (Optional) If True and `out_format` is "json", will pretty-
            print the output for human readability
    Returns:
        A string representing the inputted `data` in the specified `out_format`
    """
    # Decide on a json formatter depending on desired prettiness
    dumps = json.dumps if pretty else json.compress

    # Shortcut for avoiding pybel dependency
    if not has_ob and in_format == 'json' and out_format == 'json':
        return dumps(json.loads(data) if is_string(data) else data)
    elif not has_ob:
        raise ImportError("Chemical file format conversion requires pybel.")

    # These use the open babel library to interconvert, with additions for json
    if in_format == 'json':
        mol = json_to_pybel(json.loads(data) if is_string(data) else data)
    elif in_format == 'pybel':
        mol = data
    else:
        mol = pybel.readstring(in_format, data)

    # Infer structure in cases where the input format has no specification
    if not mol.OBMol.HasNonZeroCoords():
        mol.make3D()

    # Make P1 if that's a thing, recalculating bonds in process
    if in_format == 'mmcif' and hasattr(mol, 'unitcell'):
        mol.unitcell.FillUnitCell(mol.OBMol)
        mol.OBMol.ConnectTheDots()
        mol.OBMol.PerceiveBondOrders()

    mol.OBMol.Center()

    if out_format == 'pybel':
        return mol
    elif out_format == 'object':
        return pybel_to_json(mol, name)
    elif out_format == 'json':
        return dumps(pybel_to_json(mol, name))
    else:
        return mol.write(out_format)


def json_to_pybel(data, infer_bonds=False):
    """Converts python data structure to pybel.Molecule.

    This will infer bond data if not specified.

    Args:
        data: The loaded json data of a molecule, as a Python object
        infer_bonds (Optional): If no bonds specified in input, infer them
    Returns:
        An instance of `pybel.Molecule`
    """
    obmol = ob.OBMol()
    obmol.BeginModify()
    for atom in data['atoms']:
        obatom = obmol.NewAtom()
        obatom.SetAtomicNum(table.GetAtomicNum(str(atom['element'])))
        obatom.SetVector(*atom['location'])
        if 'label' in atom:
            pd = ob.OBPairData()
            pd.SetAttribute('_atom_site_label')
            pd.SetValue(atom['label'])
            obatom.CloneData(pd)

    # If there is no bond data, try to infer them
    if 'bonds' not in data or not data['bonds']:
        if infer_bonds:
            obmol.ConnectTheDots()
            obmol.PerceiveBondOrders()
    # Otherwise, use the bonds in the data set
    else:
        for bond in data['bonds']:
            if 'atoms' not in bond:
                continue
            obmol.AddBond(bond['atoms'][0] + 1, bond['atoms'][1] + 1,
                          bond['order'])

    # Check for unit cell data
    if 'unitcell' in data:
        uc = ob.OBUnitCell()
        uc.SetData(*(ob.vector3(*v) for v in data['unitcell']))
        uc.SetSpaceGroup('P1')
        obmol.CloneData(uc)
    obmol.EndModify()

    mol = pybel.Molecule(obmol)

    # Add partial charges
    if 'charge' in data['atoms'][0]:
        mol.OBMol.SetPartialChargesPerceived()
        for atom, pyatom in zip(data['atoms'], mol.atoms):
            pyatom.OBAtom.SetPartialCharge(atom['charge'])

    return mol


def pybel_to_json(molecule, name=None):
    """Converts a pybel molecule to json.

    Args:
        molecule: An instance of `pybel.Molecule`
        name: (Optional) If specified, will save a "name" property
    Returns:
       A Python dictionary containing atom and bond data
    """
    # Save atom element type and 3D location.
    atoms = [{'element': table.GetSymbol(atom.atomicnum),
              'location': list(atom.coords)}
             for atom in molecule.atoms]
    # Recover auxiliary data, if exists
    for json_atom, pybel_atom in zip(atoms, molecule.atoms):
        if pybel_atom.partialcharge != 0:
            json_atom['charge'] = pybel_atom.partialcharge
        if pybel_atom.OBAtom.HasData('_atom_site_label'):
            obatom = pybel_atom.OBAtom
            json_atom['label'] = obatom.GetData('_atom_site_label').GetValue()
        if pybel_atom.OBAtom.HasData('color'):
            obatom = pybel_atom.OBAtom
            json_atom['color'] = obatom.GetData('color').GetValue()

    # Save number of bonds and indices of endpoint atoms
    bonds = [{'atoms': [b.GetBeginAtom().GetIndex(),
                        b.GetEndAtom().GetIndex()],
              'order': b.GetBondOrder()}
             for b in ob.OBMolBondIter(molecule.OBMol)]
    output = {'atoms': atoms, 'bonds': bonds, 'units': {}}

    # If there's unit cell data, save it to the json output
    if hasattr(molecule, 'unitcell'):
        uc = molecule.unitcell
        output['unitcell'] = [[v.GetX(), v.GetY(), v.GetZ()]
                              for v in uc.GetCellVectors()]
        density = (sum(atom.atomicmass for atom in molecule.atoms) /
                   (uc.GetCellVolume() * 0.6022))
        output['density'] = density
        output['units']['density'] = 'kg / L'

    # Save the formula to json. Use Hill notation, just to have a standard.
    element_count = Counter(table.GetSymbol(a.atomicnum) for a in molecule)
    hill_count = []
    for element in ['C', 'H']:
        if element in element_count:
            hill_count += [(element, element_count[element])]
            del element_count[element]
    hill_count += sorted(element_count.items())

    # If it's a crystal, then reduce the Hill formula
    div = (reduce(gcd, (c[1] for c in hill_count))
           if hasattr(molecule, 'unitcell') else 1)

    output['formula'] = ''.join(n if c / div == 1 else '%s%d' % (n, c / div)
                                for n, c in hill_count)
    output['molecular_weight'] = molecule.molwt / div
    output['units']['molecular_weight'] = 'g / mol'

    # If the input has been given a name, add that
    if name:
        output['name'] = name

    return output


def is_string(obj):
    """Wraps Python2.x and 3.x ways to test if string."""
    try:
        return isinstance(obj, basestring)
    except NameError:
        return isinstance(obj, str)


if __name__ == '__main__':
    # Lazy converter to test this out
    import sys
    in_data, in_format, out_format = sys.argv[1:]
    try:
        with open(in_data) as in_file:
            data = in_file.read()
    except IOError:
        data = in_data
    print(convert(data, in_format, out_format, pretty=True))
