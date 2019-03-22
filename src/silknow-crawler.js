const crawlers = require('./crawlers');

process.on('unhandledRejection', err => {
  throw err;
});

const Crawler = Object.values(crawlers)
  .filter(c => process.argv[2] === c.id)
  .pop();

if (!Crawler) {
  console.log(
    `No crawler selected. Crawlers available: ${Object.values(crawlers)
      .map(c => c.id)
      .join(', ')}`
  );
} else {
  const crawler = new Crawler();

  console.log(`Running crawler "${crawler.constructor.id}"`);
  crawler
    .start()
    .then(() => {
      console.log('DONE!');
    })
    .catch(err => {
      console.error('Error:', err);
    });
}
