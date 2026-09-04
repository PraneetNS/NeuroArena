const fs = require('fs');
let code = fs.readFileSync('web/tests/ml-engine.test.js', 'utf8');

code = code.replace(
  'const path = `Assets/Scenes/${sceneName}`;',
  'const path = `../Assets/Scenes/${sceneName}`;'
);

fs.writeFileSync('web/tests/ml-engine.test.js', code);
