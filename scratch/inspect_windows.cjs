const { execSync } = require('child_process');
try {
    const ps = `Get-Process | Where-Object { $_.MainWindowTitle.Length -gt 0 } | ForEach-Object { "$($_.Id) | $($_.ProcessName) | $($_.MainWindowTitle)" }`;
    const output = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log(output);
} catch (e) {
    console.error(e.message);
}
