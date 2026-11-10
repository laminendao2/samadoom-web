const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withIosDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      const marker = '# fix-pods-deployment-target-v6';
      if (!podfileContent.includes(marker)) {
        const fixCode = `
  ${marker}

  # Fix 1: Deployment target minimum 16.4
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_config|
      current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if current && current.to_f < 16.4
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
      end
    end
  end

  # Fix 2: PaywallColor.swift - prevent Swift 6 memberwise init synthesis conflict
  #
  # In Swift 6 / Xcode 26, properties with leading _ are excluded from the
  # memberwise init. So _underlyingColor is excluded and Swift synthesizes
  # init(stringRepresentation:) which conflicts with the explicit extension init.
  # Fix: add fileprivate init() { fatalError() } to the struct BODY.
  # Having any init in the struct body prevents memberwise init synthesis.
  # fatalError() returns Never so Swift does not require property initialization.
  #
  pods_root = installer.sandbox.root.to_s
  Dir.glob("#{pods_root}/**/PaywallColor.swift").each do |file_path|
    content = File.read(file_path)
    next if content.include?('swift6fix')
    target_line = 'public struct PaywallColor {'
    if content.include?(target_line)
      fix_line = target_line + "\\n    fileprivate init() { fatalError() } // swift6fix"
      patched = content.sub(target_line, fix_line)
      File.write(file_path, patched)
      puts "[SamaDoom] Patched PaywallColor.swift: suppressed Swift 6 memberwise init synthesis"
    else
      puts "[SamaDoom] WARNING: 'public struct PaywallColor {' not found in #{file_path}"
    end
  end

  puts "[SamaDoom] v6 complete."
`;

        if (podfileContent.includes('post_install do |installer|')) {
          podfileContent = podfileContent.replace(
            'post_install do |installer|',
            'post_install do |installer|' + fixCode
          );
        } else {
          podfileContent += `\npost_install do |installer|\n${fixCode}\nend\n`;
        }

        fs.writeFileSync(podfilePath, podfileContent);
        console.log('[SamaDoom] withIosDeploymentTarget v6 applied.');
      }
      return cfg;
    },
  ]);
};
