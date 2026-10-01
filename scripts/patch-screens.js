const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-screens',
  'android',
  'src',
  'main',
  'java',
  'com',
  'swmansion',
  'rnscreens',
  'ScreensModule.kt'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  const targetCode = `    private fun setupFabric() {
        val fabricUIManager =
            UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as FabricUIManager
        proxy?.apply {
            nativeAddMutationsListener(fabricUIManager)
        }
    }`;

  const replacementCode = `    private fun setupFabric() {
        val fabricUIManager =
            UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as? FabricUIManager
        if (fabricUIManager != null) {
            proxy?.apply {
                nativeAddMutationsListener(fabricUIManager)
            }
        }
    }`;

  if (content.includes(targetCode)) {
    content = content.replace(targetCode, replacementCode);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-screens] Successfully patched ScreensModule.kt for FabricUIManager NPE fix.');
  } else {
    console.log('[patch-screens] ScreensModule.kt already patched or target code not found.');
  }
} else {
  console.log('[patch-screens] react-native-screens not installed yet.');
}
