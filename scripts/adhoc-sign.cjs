// electron-builder afterPack hook: ad-hoc sign the Mac app (no Apple Developer ID needed).
// Without any signature, macOS says the downloaded app "is damaged". With an ad-hoc signature it
// says the developer cannot be verified, and the user can open it from
// System Settings → Privacy & Security → "Open Anyway".
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('  • ad-hoc signing', app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--verbose=1', app], { stdio: 'inherit' });
};
