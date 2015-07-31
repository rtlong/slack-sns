exports.stackdriver = function (msg) {
  var event = msg.incident

  return {
    name: event.resource_name + ' incident ' + event.state,
    icon: (event.state == 'open') ? ':cloud:' : ':sunny:',
    text: event.summary + ' [<' + event.url + '|info>]',
  }
}

var cwIcons = {
  INSUFFICIENT_DATA: ':open_hands:',
  OK:                ':ok_hand:',
  ALARM:             ':wave:',
}
exports.cloudwatch = function (msg) {
  if (msg.OldStateValue == 'INSUFFICIENT_DATA' && msg.NewStateValue == 'OK') {
    return null // drop state changes that aren't useful/notable
  }

  return {
    icon: cwIcons[msg.NewStateValue],
    text: 'Description: ' + msg.AlarmDescription + '\r\n>' + msg.NewStateReason,
  }
}

var asIcons = {
  EC2_INSTANCE_TERMINATE:       ':heavy_minus_sign:',
  EC2_INSTANCE_LAUNCH:          ':heavy_plus_sign:',
  EC2_INSTANCE_TERMINATE_ERROR: ':no_entry:',
  EC2_INSTANCE_LAUNCH_ERROR:    ':no_entry:',
}
exports.autoscaling = function (msg) {
  var text = msg.Description

  if (msg.Details && msg.Details['Availability Zone']) {
    var zone = msg.Details['Availability Zone']
    text += ' (zone ' + zone + ')'
  }

  if (msg.Cause) {
    text += '\r\n>' + msg.Cause
  }

  return {
    icon: msg.Event ? asIcons[msg.Event.split(':')[1]] : ':question:',
    text: text,
  }
}

exports.plaintext = function (msg) {
  var text = msg.text
  var icon

  if (text.match(/(Writes|Reads): UP from/)) {
    icon = ':point_up_2:'
  } else if (text.match(/(Writes|Reads): DOWN from/)) {
    icon = ':point_down:'
  } else if (text.match(/Consumed (Write|Read) Capacity (\d+)% was greater than/)) {
    icon = ':information_desk_person:'
  }

  return {
    icon: icon || ':interrobang:',
    text: text,
  }
}

function subscribe (body, res, channel) {
  var subUrl = body.SubscribeURL
  console.log('Got subscription request, visiting', subUrl)

  https.get(subUrl, function (result) {
    console.log('Subscribed with ', result.statusCode)
    slack.send({text: 'FYI: I was subscribed to ' + body.TopicArn, chan: channel})
    res.send('i gotcha, amazon')

  }).on('error', function (e) {
    console.log('Error while subscribing:', e.message)
    res.send('sub error!?')
  })
}

function message (body, res, channel) {
  console.log('Got', body.Type, 'via', body.TopicArn, 'timestamped', body.Timestamp,
              'with', body.Message.length, 'bytes')

  var msg
  try {
    msg = JSON.parse(body.Message)
  } catch (ex) {
    try {
      parseAsLineDelimitedKVPairs(body.Message)
    } catch (ex) {
      msg = {text: body.Message}
    }
  }

  console.log('[ORIGINAL MESSAGE]', msg)

  var opts
  if (msg.incident) {
    opts = handlers.stackdriver(msg)
  } else if (msg.AlarmName) {
    opts = handlers.cloudwatch(msg)
  } else if (msg.AutoScalingGroupName) {
    opts = handlers.autoscaling(msg)
  } else if (msg.text) {
    opts = handlers.plaintext(msg)
  } else {
    opts = {
      icon: ':interrobang:',
      text: 'Unrecognized SNS message ```' + body.Message + '```',
    }
  }

  if (!opts) {
    console.info('Dropping message on behalf of handler')
    res.send('skipped')
    return
  }

  if (!opts.name) {
    opts.name = body.Subject || 'Amazon SNS bridge'
  }

  if (!opts.chan) {
    opts.chan = channel
  }

  slack.send(opts)
  res.send('ok')
}

function parseAsLineDelimitedKVPairs(message) {
  message.split("\n").map(function(line) { line.split("=") })
}
