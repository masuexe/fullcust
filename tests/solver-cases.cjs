function solverCases(data) {
    const solid = 0;
    const plus = data.parts.findIndex(p => !p.isSolid);
    const req = (partIndex, changes = {}) => ({
        partIndex,
        constraint: {
            compressed: true,
            onCommandLine: null,
            minBugLevel: 0,
            maxBugLevel: 0,
            ...changes,
        },
    });
    return [
        ...[0, 1, 2].map(expansion => ({
            name: `grid-${expansion}`,
            expansion,
            spin: true,
            requirements: [req(solid, { onCommandLine: true }), req(plus)],
        })),
        { name: "no-spinner", expansion: 2, spin: false, requirements: [req(solid), req(plus)] },
        { name: "compression-choice", expansion: 2, spin: true, requirements: [req(solid, { compressed: null })] },
        { name: "same-color-no-bugs", expansion: 2, spin: true, requirements: [req(plus), req(plus)] },
        { name: "same-color-one-bug", expansion: 2, spin: true, requirements: [req(plus, { minBugLevel: 1, maxBugLevel: 1 }), req(plus, { minBugLevel: 1, maxBugLevel: 1 })] },
        { name: "uncompressed-bug", expansion: 2, spin: false, requirements: [req(solid, { compressed: false, minBugLevel: 1, maxBugLevel: 1 })] },
    ];
}

module.exports = { solverCases };
