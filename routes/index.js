var express = require('express');
var router = express.Router();

var debug = require('debug')('index');

router.get('/', function(req, res, next) {
  debug("/ requested");
  res.send('INDEX PAGE');
});

module.exports = router;
