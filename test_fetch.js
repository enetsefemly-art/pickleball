const https = require('https');

https.get('https://script.google.com/macros/s/AKfycbxmlwOwE0mOIoZMznr3-nqTTJNEwtek0zhBYTVjYm8fE8TZCNY9Ejs7RghiZDkNXnnD/exec', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data.substring(0, 1000));
    console.log("...");
    console.log(data.substring(data.length - 1000));
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
