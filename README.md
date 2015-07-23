# hubot-curate-links

This plugin is only compatible with Slack API.

When a link is shared, the bot stores it into the DB. When the publish time
comes, he checks if the link has received more :+1: than :-1: and mark it as
"approved". (More about 
[Slack reactions feature](http://slackhq.com/post/123561085920/reactions).)  
Then you can use the data to publish the links on an external website.

## Installation

In hubot project repo, run:

```
npm install hubot-curate-links --save
```

Then add **hubot-curate-links** to your `external-scripts.json`:

```json
[
  "hubot-curate-links"
]
```

## Configuration

### Environment variables

* `SLACK_API_TOKEN`: create a token [here](https://api.slack.com/web).
* `MYSQL_URL`: example `mysql://root:root@localhost:8889/hubot-curate-links`.
* `PUBLISH_TIME`: (default: `08:40`). Time when the bot will send the data to
  the DB.
* `TIMEZONE`: (default: `Europe/Stockholm`).
* `MIN_POSITIVE_VOTES`: number of :+1: the link needs to get in order to be
  "approved".

Currently the plugin only supports MySQL database. Feel free to submit a PR for
other DB.

## License

MIT
