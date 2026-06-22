const fs = require('fs');

const dirs = ['components/SearchList', 'app/(', 'fix-form', 'fixm', 'lib/med'];

for (const d of dirs) {
  try {
    const stat = fs.statSync(d);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(d);
      console.log(d + ' contains: ' + files.length + ' files - ' + (files.join(', ') || '(empty)'));
      if (files.length === 0) {
        fs.rmdirSync(d);
        console.log('  -> Deleted empty dir: ' + d);
      } else {
        console.log('  -> SKIPPED (not empty): ' + d);
      }
    } else {
      fs.unlinkSync(d);
      console.log('  -> Deleted file: ' + d);
    }
  } catch (e) {
    console.log(d + ' - does not exist (already clean)');
  }
}
console.log('Done');