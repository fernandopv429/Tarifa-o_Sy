const express = require('express');
const app = express();
const path = require('path');
const distPath = path.join(process.cwd(), 'dist');
app.use('/tmo', express.static(distPath));
app.get('/tmo/*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
app.listen(3002, () => console.log('Listening on 3002'));
