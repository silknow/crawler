const fs = require('fs');
const path = require('path');

module.exports = {
  check: async (crawler) => {
    const recordsPath = path.join('data', crawler.constructor.id, 'records');

    const recordsFiles = (
      await new Promise((resolve, reject) => {
        fs.readdir(recordsPath, (err, files) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(files);
        });
      })
    )
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(recordsPath, f));

    for (const recordFile of recordsFiles) {
      let record;
      try {
        record = JSON.parse(fs.readFileSync(recordFile));
      } catch (e) {
        console.error(`Invalid JSON data for file ${recordFile}`);
        return;
      }

      for (const image of record.images.filter((img) => img.hasError)) {
        try {
          await crawler.downloadFile(image.url, image.localFilename);
          console.log('Downloaded', image.url);
          delete image.hasError;
          await crawler.writeRecord(
            record,
            path.basename(recordFile, path.extname(recordFile))
          );
        } catch (err) {
          /* noop */
        }
      }
    }
  },
};
