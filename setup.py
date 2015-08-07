from setuptools import setup
from imolecule import __version__

setup(
    name="imolecule",
    version=__version__,
    description="View molecules in the IPython notebook.",
    url="http://github.com/patrickfuller/imolecule/",
    license="MIT",
    author="Patrick Fuller",
    author_email="patrickfuller@gmail.com",
    package_dir={"imolecule": "imolecule",
                 "imolecule.server": "imolecule/server",
                 "imolecule.js": "imolecule/js"},
    package_data={"imolecule.js": ["imolecule/js/build/imolecule.min.js"],
                  "imolecule.server": ["imolecule/server/data/*.json",
                                       "imolecule/server/js/*.js",
                                       "imolecule/server/css/*.css",
                                       "imolecule/server/*.template",
                                       "imolecule/*.template"]},
    include_package_data=True,
    packages=["imolecule", "imolecule.server", "imolecule.js"],
    install_requires=["ipython", "tornado"],
    entry_points={
        "console_scripts": [
            "imolecule = imolecule.server:start_server"
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "Natural Language :: English",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.4",
        "Framework :: IPython",
        "Topic :: Education :: Computer Aided Instruction (CAI)",
        "Topic :: Scientific/Engineering :: Bio-Informatics",
        "Topic :: Scientific/Engineering :: Chemistry",
        "Topic :: Scientific/Engineering :: Visualization"
    ]
)
