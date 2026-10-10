const fs = require('fs');
const path = require('path');

const genres = ['Action', 'Sci-Fi', 'Drama', 'Comedy', 'Thriller', 'Animation'];
const qualities = ['4K UHD', '1080p', '720p'];
const audios = ['Dual Audio (Hindi-English)', 'English', 'Hindi'];
const items = [];

for (let i = 1; i <= 1000; i++) {
  const year = 2000 + (i % 25);
  items.push({
    id: 10000 + i,
    mediaType: i % 4 === 0 ? 'tv' : 'movie',
    title: 'Benchmark Film #' + i + ' (' + year + ')',
    overview: 'Synthetic benchmark synopsis for deterministic test item ' + i + '.',
    posterPath: '/fixtures/poster_' + (i % 20) + '.jpg',
    backdropPath: '/fixtures/backdrop_' + (i % 20) + '.jpg',
    voteAverage: Number((5 + (i % 50) / 10).toFixed(1)),
    releaseDate: year + '-05-15',
    quality: qualities[i % qualities.length],
    audio: audios[i % audios.length],
    genre: genres[i % genres.length],
    uploadedAt: new Date(1700000000000 + i * 86400000).toISOString(),
    hasCustomLinks: i % 3 === 0,
    customLinksCount: i % 3 === 0 ? (i % 4) + 1 : 0
  });
}

const outPath = path.join(__dirname, '..', 'fixtures', 'catalog-fixtures.json');
fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
console.log('Successfully generated 1000 catalog fixtures at', outPath);
