const https = require('https');

https.get('https://v6.olamovies.mov/_next/static/chunks/372hjk9djluav.css', res => {
  let cssData = '';
  res.on('data', d => { cssData += d; });
  res.on('end', () => {
    console.log('CSS length:', cssData.length);
    const fontFaces = cssData.match(/@font-face\s*\{[^}]+\}/g) || [];
    console.log('Font faces count:', fontFaces.length);
    fontFaces.forEach(f => console.log('Font face:', f));

    const logoMatches = cssData.match(/[^{}]*font-logo[^{]*\{[^}]+\}/gi) || [];
    console.log('font-logo CSS rules:', logoMatches);

    const logoVar = cssData.match(/--font-logo:[^;]+;/gi) || [];
    console.log('--font-logo var:', logoVar);

    const fontFamilies = cssData.match(/font-family:\s*[^;\}]+/gi) || [];
    console.log('Unique font families in CSS:', [...new Set(fontFamilies)]);
  });
});
