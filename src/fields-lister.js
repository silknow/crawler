const fs = require('fs');
const path = require('path');

module.exports = {
  list: (crawlerId, argv) => {
    const recordsPath = path.join('data', crawlerId, 'records');
    fs.readdir(recordsPath, (err, files) => {
      if (err) throw err;

      const uniqueFields = [];

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
          if (fileFields.filter(f => f.label === field.label).length > 0) {
            console.error(
              `Field "${field.label}" appears more than once for file ${recordFile}, this should not happen!`
            );
            return;
          }
          fileFields.push(field);
        });

        fileFields.forEach(field => {
          // If the currently stored unique field has an empty value
          // then we try to replace it with another value that's not empty
          const existingField = uniqueFields
            .filter(f => f.label === field.label)
            .pop();
          if (existingField) {
            if (
              (typeof existingField.value === 'string' &&
                existingField.value === '') ||
              (existingField.values && existingField.values.length === 0)
            ) {
              if (typeof field.value === 'string' && field.value !== '') {
                existingField.value = field.value;
              } else if (field.values && field.values.length > 0) {
                existingField.values = field.values;
              }
            }
          } else {
            field.recordFile = recordFile;
            uniqueFields.push(field);
          }
        });
      });

      let output;
      const format = (argv.format || 'json').trim().toLowerCase();
      if (['md', 'markdown'].includes(format)) {
        output =
          '| Label | Sample Value | Sample File |\n| ----- | ------------ | ------------|\n';
        uniqueFields.forEach(field => {
          let value = JSON.stringify(
            Array.isArray(field.values) ? field.values : field.value
          );
          if (value.length > 600) {
            value = `${value.substr(0, 600)}…`;
          }
          output += `| ${field.label.replace('|', '&#124;')} | ${value.replace(
            '|',
            '&#124;'
          )} | ${field.recordFile.replace('|', '&#124;')} |\n`;
        });
      } else {
        // json by default
        output = JSON.stringify(uniqueFields, null, 2);
      }
      console.log(`Parsed ${recordsFiles.length} files`);
      console.log(`Fields in ${crawlerId}:`);
      console.log(output);

      if (argv.output) {
        fs.writeFile(path.resolve(argv.output), output, error => {
          if (error) {
            throw error;
          }
        });
      }
    });
  }
};
