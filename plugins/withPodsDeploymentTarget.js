const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// React Native's post_install only raises the deployment target of regular pod
// targets. The separate resource-bundle targets CocoaPods generates (for example
// SDWebImage-SDWebImage at 9.0 and RNCAsyncStorage_resources at 13.4) keep their
// old value, and recent Xcode versions reject anything below their minimum.
// Raise every Pods target to the app's own minimum.
const MIN_IOS = "15.1";
const MARKER = "# colorpicker: raise deployment target of every Pods target";
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_IOS}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
`;

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const podfile = fs.readFileSync(file, "utf8");
      if (podfile.includes(MARKER)) return cfg;

      const hook = /^(\s*post_install do \|installer\|\s*\n)/m;
      if (!hook.test(podfile)) {
        throw new Error("withPodsDeploymentTarget: could not find `post_install do |installer|` in the Podfile");
      }
      fs.writeFileSync(file, podfile.replace(hook, `$1${SNIPPET}\n`));
      return cfg;
    },
  ]);
};
