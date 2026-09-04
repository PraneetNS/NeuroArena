const fs = require('fs');
let code = fs.readFileSync('web/app.js', 'utf8');
code = code.replace(/    document\.getElementById\("btn-menu-daily"\)\n        const objective = await fetchDailyObjective\(\);/g, '    document.getElementById("btn-menu-daily").addEventListener("click", async () => {\n        const objective = await fetchDailyObjective();');
code = code.replace(/    document\.getElementById\("btn-menu-daily"\)\.addEventListener\("click", async \(\) => \{\n        const objective = await fetchDailyObjective\(\);/g, '    document.getElementById("btn-menu-daily").addEventListener("click", async () => {\n        const objective = await fetchDailyObjective();');
fs.writeFileSync('web/app.js', code);
