const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;
    if (!contents.includes('splits {')) {
      const splitsBlock = `
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include "armeabi-v7a", "arm64-v8a", "x86_64"
        }
    }
`;
      contents = contents.replace(/android\s*\{/, `android {${splitsBlock}`);
      gradleConfig.modResults.contents = contents;
    }
    return gradleConfig;
  });
};
