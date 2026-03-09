const { execSync } = require('child_process');

function checkCommand(command, name, args = '--version') {
  try {
    const output = execSync(`${command} ${args}`, { stdio: 'pipe' }).toString().trim();
    // Only show the first line of output for brevity
    const shortOutput = output.split('\n')[0];
    console.log(`✅ ${name}: Found (${shortOutput})`);
    return true;
  } catch (e) {
    // Some tools might exit with non-zero on -h or --version (though rare)
    // Or the error might contain output we want
    if (e.stdout) {
        const output = e.stdout.toString().trim();
        const shortOutput = output.split('\n')[0];
        console.log(`✅ ${name}: Found (${shortOutput})`);
        return true;
    }
    console.log(`❌ ${name}: Not found or error executing.`);
    return false;
  }
}

console.log('--- HarmonyOS Environment Check ---');

const node = checkCommand('node', 'Node.js');
const ohpm = checkCommand('ohpm', 'ohpm', '-v');
const hvigor = checkCommand('hvigorw', 'Hvigor Wrapper', '-v');
const codelinter = checkCommand('codelinter', 'CodeLinter', '-h');

if (!hvigor) {
    console.log('⚠️  Hvigor Wrapper (hvigorw) missing. Trying local node_modules...');
    try {
        const local = execSync('node_modules\\.bin\\hvigor --version', { stdio: 'pipe' }).toString().trim();
        console.log(`✅ Local Hvigor: Found (${local.split('\n')[0]})`);
    } catch (e) {
        console.log('❌ Local Hvigor: Not found.');
    }
}

console.log('--- End Check ---');
