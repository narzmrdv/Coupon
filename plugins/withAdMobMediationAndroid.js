const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Adds AdMob mediation adapter artifacts (AppLovin, ironSource) to android/app/build.gradle.
 * Versions follow Google's mediation integration pages; bump if prebuild fails.
 */
function withAdMobMediationAndroid(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      return mod;
    }
    let contents = mod.modResults.contents;
    if (contents.includes('admob-mediation-adapters')) {
      return mod;
    }
    if (!contents.includes('dependencies {')) {
      return mod;
    }
    contents = contents.replace(
      /dependencies\s*\{/,
      `dependencies {
    // admob-mediation-adapters (see doc.md — update versions if Gradle sync fails)
    implementation 'com.google.ads.mediation:applovin:13.6.2.0'
    implementation 'com.google.ads.mediation:ironsource:9.4.0.0'`
    );
    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withAdMobMediationAndroid;
