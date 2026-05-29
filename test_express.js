const express = require('express');
const path = require('path');
const app = express();
app.get('/tmo/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'non_existent.html'));
});
app.listen(3002, () => console.log('started'));
