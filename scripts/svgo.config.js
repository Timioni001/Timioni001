// Keep <style>, ids and classes intact: the animations depend on them.
module.exports = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          inlineStyles: false,
          minifyStyles: false,
          cleanupIds: false,
          removeUnknownsAndDefaults: false,
          convertShapeToPath: false,
          mergePaths: false,
          removeHiddenElems: false,
          convertTransform: false,
          collapseGroups: false,
          moveGroupAttrsToElems: false,
          moveElemsAttrsToGroup: false,
        },
      },
    },
  ],
};
