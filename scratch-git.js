const { execSync } = require('child_process');
const path = require('path');

const repoPath = 'C:\\Users\\lenovo\\Documents\\GitHub\\TGRBATKSEBORDARSTOR';

function runCmd(cmd) {
    console.log(`Running: ${cmd}`);
    try {
        const stdout = execSync(cmd, { cwd: repoPath, encoding: 'utf8' });
        console.log('Output:\n', stdout);
        return true;
    } catch (error) {
        console.error('Error executing command:\n', error.message);
        if (error.stdout) console.log('Stdout:', error.stdout);
        if (error.stderr) console.error('Stderr:', error.stderr);
        return false;
    }
}

console.log('=== Starting Git Operations ===');
runCmd('git status');
runCmd('git add .');
runCmd('git commit -m "اصلاح نظام التنبيه القوي وتحديث روابط السيرفر في التطبيقات الويب وأندرويد وبنائها بنجاح"');
runCmd('git push');
console.log('=== Finished Git Operations ===');
