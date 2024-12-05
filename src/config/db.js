const mongoose = require('mongoose');
const settings = require('./settings');

module.exports = async () => {
  await mongoose.connect(settings.dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};