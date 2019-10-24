const fs = require('fs');
const path = require('path');

module.exports = {
  list: crawlerId => {
    const recordsPath = path.join('data', crawlerId, 'records');
    fs.readdir(recordsPath, (err, files) => {
      if (err) throw err;

      const uniqueFields = new Set();

      const recordsFiles = files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(recordsPath, f));

      recordsFiles.forEach(recordFile => {
        let data;
        try {
          data = JSON.parse(fs.readFileSync(recordFile));
        } catch (e) {
          console.error(`Invalid JSON data for file ${recordFile}`);
          return;
        }
        const fileFields = [];
        data.fields.forEach(field => {
          if (!field.label) {
            console.error(
              `File ${recordFile} contains a field with no label, this should not happen!`
            );
          }
          if (fileFields.includes(field.label)) {
            console.error(
              `Field "${
                field.label
              }" appears more than once, this should not happen!`
            );
            return;
          }
          fileFields.push(field.label);
        });
        fileFields.forEach(label => {
          uniqueFields.add(label);
        });
      });

      console.log(`Parsed ${recordsFiles.length} files`);
      console.log(`Fields in ${crawlerId}:`);
      console.log(JSON.stringify(Array.from(uniqueFields), null, 2));
    });
  }
};
