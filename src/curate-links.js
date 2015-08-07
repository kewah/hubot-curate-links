// Description:
//   Save shared links on Slack into a DB
//
// Dependencies:
//   None
//
// Configuration:
//   SLACK_API_TOKEN
//   TIMEZONE
//   PUBLISH_TIME
//   MIN_POSITIVE_VOTES
//   MYSQL_URL
//
// Commands:
//   None
//
// Author:
//   Antoine Lehurt

var debug = require('debug')('curate-links');
var async = require('async');
var urlNorm = require('url-norm');
var CronJob = require('cron').CronJob;
var adapterFactory = require('../lib/adapter-factory');
var regexUrl = require('regex-url');

var client = getDbClient();

var SLACK_API_TOKEN = process.env.SLACK_API_TOKEN;
if (!SLACK_API_TOKEN) {
  throw new Error('SLACK_API_TOKEN have to be defined. See https://api.slack.com/web');
}

var TIMEZONE = process.env.TIMEZONE || 'Europe/Stockholm';
var PUBLISH_TIME = process.env.PUBLISH_TIME || '08:40';
var MIN_POSITIVE_VOTES = process.env.MIN_POSITIVE_VOTES || 1;

function getDbClient() {
  if (process.env.MYSQL_URL) {
    return adapterFactory('mysql', {url: process.env.MYSQL_URL});
  }

  console.error('You need to specify a database');
}

function cronFactory(onTick) {
  var time = PUBLISH_TIME.split(':');

  return new CronJob({
    cronTime: '00 ' + time[1] + ' ' + time[0] + ' * * *',
    onTick: onTick,
    start: false,
    timeZone: TIMEZONE
  });
}

module.exports = function(robot) {
  var job = cronFactory(publishNewLinks);
  job.start();

  // Detect when a link is posted, save it into the robot brain.
  robot.hear(regexUrl, function(res) {
    var url = urlNorm(res.match[0]);
    var msg = res.message;

    client.findByUrl(url, findByUrlComplete);

    /**
     * Check if the link has already been shared.
     * Then save the link into the DB.
     */
    function findByUrlComplete(err, data) {
      if (err) {
        console.error(err);
        return;
      }

      if (data[0]) return;

      var link = {
        url: url,
        timestamp: msg.rawMessage.ts,
        channelId: msg.rawMessage.channel,
        channelName: msg.room,
        userId: msg.user.id,
        userName: msg.user.name
      };

      client.save(link, saveComplete);
    }

    function saveComplete(err) {
      if (err) {
        console.error(err);
        return;
      }

      debug('new link', url, 'inserted.');
    }
  });

  function publishNewLinks() {
    client.findRecentLinks(findRecentLinksComplete);

    /**
     * List of links that are 1 day old.
     */
    function findRecentLinksComplete(err, links) {
      if (err) {
        console.error(err);
        return;
      }

      extractApprovedLinks(links, extractApprovedLinksComplete);
    }

    /**
     * List of links that have recived +1 reactions.
     */
    function extractApprovedLinksComplete(err, links) {
      if (err) {
        console.error(err);
        return;
      }

      client.update(links, updateComplete);
    }

    function updateComplete(err, links) {
      if (err) {
        console.error(err);
        return;
      }

      links.forEach(function(link) {
        debug(link.url, ' has been approved.');
      });
    }
  }

  function extractApprovedLinks(links, callback) {
    // Create an array of functions to call `getReactions`
    // asynchronously for each link.
    var fns = links.map(function(link) {
      return function(cb) {
        getReactions(link, cb);
      };
    });

    async.parallel(fns, function(err, res) {
      if (err) {
        callback(err, null);
        return;
      }

      var approved = res.filter(function(v) {
        return v.isApproved === 1;
      });

      callback(null, approved);
    });
  }

  /**
   * Call Slack API to get the reactions data for a link.
   */
  function getReactions(data, callback) {
    robot.http(
      'https://slack.com/api/reactions.get?'
      + 'token=' + SLACK_API_TOKEN
      + '&channel=' + data.channelId
      + '&timestamp=' + data.messageTimestamp
    ).get()(function(err, res, body) {
      if (err) {
        callback(err, null);
        return;
      }

      var reactions = JSON.parse(body).message.reactions;
      if (!reactions) {
        callback(null, data);
        return;
      }

      var upVoteValue = reactions.reduce(function(sum, reaction) {
        if (reaction.name === '+1') {
          sum += reaction.count;
        }
        if (reaction.name === '-1') {
          sum -= reaction.count;
        }

        return sum;
      }, 0);

      data.isApproved = upVoteValue >= MIN_POSITIVE_VOTES ? 1 : 0;

      callback(null, data);
    });
  }
};
