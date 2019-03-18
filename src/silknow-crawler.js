process.on('unhandledRejection', err => {
  throw err;
});

const crawlers = require('./crawlers');

let crawler;
Object.values(crawlers).forEach(Crawler => {
  if (process.argv[2] === Crawler.id) {
    crawler = new Crawler();
  }
});

if (!crawler) {
  console.log(
    `No crawler selected. Available: ${Object.values(crawlers)
      .map(c => c.id)
      .join(', ')}`
  );
} else {
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
