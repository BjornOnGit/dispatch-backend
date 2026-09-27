const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});