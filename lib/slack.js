import https from 'https'

exports.send = function (opts) {
  var options = {
    host: 'hooks.slack.com',
    port: 443,
    method: 'POST',
    path: '/services/' + process.env.SLACK_TOKEN,
    headers: {'Content-type': 'application/json'},
  }

  console.log('Sending message to slack:', options, opts)
  var req = https.request(options, function (res) {
    res.on('data', data => console.log('Slack said', data))
      .on('error', err => console.error(err))
    res.setEncoding('utf8')
    if (res.statusCode != 200) {
      console.error('Slack response was not 200', res.statusCode)
    }
  })
  req.on('error', err => console.error(err))

  req.write(JSON.stringify(opts))
  req.end()
}
