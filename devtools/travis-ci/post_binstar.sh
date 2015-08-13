echo $TRAVIS_PULL_REQUEST $TRAVIS_BRANCH

if [[ "$TRAVIS_PULL_REQUEST" != "false" ]]; then
    echo "This is a pull request. No deployment will be done."; exit 0
fi


if [[ "$TRAVIS_BRANCH" != "master" ]]; then
    echo "No deployment on BRANCH='$TRAVIS_BRANCH'"; exit 0
fi


if [[ "2.7 3.4" =~ "$python" ]]; then
    conda-server -t "$BINSTAR_TOKEN"  upload --force --user patrickfuller --package imolecule $HOME/miniconda/conda-bld/linux-64/imolecule-*
    conda convert $HOME/miniconda/conda-bld/linux-64/imolecule-* -p all
    ls
    conda-server -t "$BINSTAR_TOKEN"  upload --force --user patrickfuller --package imolecule linux-32/imolecule-*
    conda-server -t "$BINSTAR_TOKEN"  upload --force --user patrickfuller --package imolecule win-32/imolecule-*
    conda-server -t "$BINSTAR_TOKEN"  upload --force --user patrickfuller --package imolecule win-64/imolecule-*
    conda-server -t "$BINSTAR_TOKEN"  upload --force --user patrickfuller --package imolecule osx-64/imolecule-*
fi

if [[ "$python" != "2.7" ]]; then
    echo "No deploy on PYTHON_VERSION=${python}"; exit 0
fi


