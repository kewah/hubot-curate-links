var mysql = require('mysql');
var _ = require('lodash');
var async = require('async');

module.exports = function(config) {
  setup();

  function createConnection() {
    var db = mysql.createConnection(config.url);

    db.on('error', function(err) {
      console.error('hubot-curate-links: ERROR', err);
    });

    return db;
  }

  function setup() {
    var db = createConnection();
    db.query(
      'CREATE TABLE IF NOT EXISTS `links` ('
      + '`id` INT(11) NOT NULL AUTO_INCREMENT,'
      + '`datetime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,'
      + '`messageTimestamp` VARCHAR(50) NOT NULL,'
      + '`url` VARCHAR(500) NOT NULL,'
      + '`channelId` VARCHAR(50) NOT NULL,'
      + '`channelName` VARCHAR(100) NOT NULL,'
      + '`userId` VARCHAR(50) NOT NULL,'
      + '`userName` VARCHAR(100) NOT NULL,'
      + '`isApproved` TINYINT(1) NOT NULL DEFAULT "0",'
      + 'PRIMARY KEY (`id`)'
      + ') ENGINE = innoDB;'
    );
    db.end();
  }

  function findByUrl(url, callback) {
    var db = createConnection();
    db.query('SELECT * FROM links WHERE url = ?', [url], callback);
    db.end();
  }

  function findRecentLinks(callback) {
    var db = createConnection();
    db.query('SELECT * FROM links WHERE datetime >= NOW() - INTERVAL 1 DAY', callback);
    db.end();
  }

  function save(links, callback) {
    if (!_.isArray(links)) {
      links = [links];
    }

    var sql = 'INSERT INTO `links` (??) VALUES ?';
    var values = links.reduce(function(res, item) {
      res.push([
        item.timestamp, item.url, item.channelId,
        item.channelName, item.userId, item.userName
      ]);

      return res;
    }, []);
    var inserts = [
      ['messageTimestamp', 'url', 'channelId', 'channelName', 'userId', 'userName'],
      values
    ];

    var db = createConnection();
    db.query(mysql.format(sql, inserts), callback);
    db.end();
  }

  function update(links, callback) {
    if (!_.isArray(links)) {
      links = [links];
    }

    var db = createConnection();
    var sql = 'UPDATE `links` SET `isApproved` = ? WHERE `id` = ?';

    async.each(links, function(link, cb) {
      db.query(mysql.format(sql, [link.isApproved, link.id]), cb);
    }, function(err) {
      db.end();
      callback(err, links);
    });
  }

  return {
    findByUrl: findByUrl,
    findRecentLinks: findRecentLinks,
    save: save,
    update: update
  };
};
