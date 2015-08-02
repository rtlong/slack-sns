import R from 'ramda'
import https from 'https'
import slack from './slack'

function stackdriver (msg) {
  if (msg.type != 'json' || !msg.payload.incident) { return }

  let event = msg.payload.incident

  slack.send({
    name: event.resource_name + ' incident ' + event.state,
    icon: (event.state == 'open') ? ':cloud:' : ':sunny:',
    text: event.summary + ' [<' + event.url + '|info>]',
    channel: msg.channel,
  })
  msg.response.send('ok')
  return true
}

let cwIcons = {
  INSUFFICIENT_DATA: ':open_hands:',
  OK:                ':ok_hand:',
  ALARM:             ':wave:',
}

function cloudwatch (msg) {
  if (msg.type != 'json' || !msg.payload.AlarmName) { return }

  if (msg.payload.OldStateValue == 'INSUFFICIENT_DATA' && msg.payload.NewStateValue == 'OK') {
    return // drop state changes that aren't useful/notable
  }

  slack.send({
    icon: cwIcons[msg.payload.NewStateValue],
    text: 'Description: ' + msg.payload.AlarmDescription + '\r\n>' + msg.payload.NewStateReason,
    channel: msg.channel,
  })
  msg.response.send('ok')
  return true
}

let asIcons = {
  EC2_INSTANCE_TERMINATE:       ':heavy_minus_sign:',
  EC2_INSTANCE_LAUNCH:          ':heavy_plus_sign:',
  EC2_INSTANCE_TERMINATE_ERROR: ':no_entry:',
  EC2_INSTANCE_LAUNCH_ERROR:    ':no_entry:',
}

function autoscaling (msg) {
  if (msg.type != 'json' || !msg.payload.AutoScalingGroupName) { return }

  let text = msg.payload.Description

  if (msg.payload.Details && msg.payload.Details['Availability Zone']) {
    let zone = msg.payload.Details['Availability Zone']
    text += ' (zone ' + zone + ')'
  }

  if (msg.payload.Cause) {
    text += '\r\n>' + msg.payload.Cause
  }

  slack.send({
    icon: msg.payload.Event ? asIcons[msg.payload.Event.split(':')[1]] : ':question:',
    text: text,
    channel: msg.channel,
  })
  msg.response.send('ok')
  return true
}

function plaintext (msg) {
  if (msg.type != 'text') { return }

  let text = msg.payload
  let icon

  if (text.match(/(Writes|Reads): UP from/)) {
    icon = ':point_up_2:'
  } else if (text.match(/(Writes|Reads): DOWN from/)) {
    icon = ':point_down:'
  } else if (text.match(/Consumed (Write|Read) Capacity (\d+)% was greater than/)) {
    icon = ':information_desk_person:'
  }

  slack.send({
    icon: icon || ':interrobang:',
    text: text,
    channel: msg.channel,
  })
  msg.response.send('ok')
  return true
}

function unknown (msg) {
  let payload = msg.payload
  if (msg.type != 'text') {
    payload = JSON.stringify(payload)
  }
  slack.send({
    icon: ':interrobang:',
    text: 'Unrecognized SNS message ```' + payload + '```',
    channel: msg.channel,
  })
  msg.response.send('ok')
  return true
}

function cloudformation(msg) {
  if (msg.type != 'line-delimited') { return }
  if (msg.body.Subject != 'AWS CloudFormation Notification') { return }

  let e = msg.payload

  let notification = {
    channel: msg.channel,
    icon_url: 'https://raw.githubusercontent.com/rtlong/aws-icons/master/icons/cloudformation.png',
    username: 'CloudFormation',
    attachments: [
      {
        fallback: msg.body.Message,
        fields: [
          {
            title: 'Stack Name',
            value: e.StackName,
            short: true,
          },
          {
            title: 'Resource Type',
            value: e.ResourceType,
            short: true,
          },
          {
            title: 'Resource Logical ID',
            value: e.LogicalResourceId,
            short: true,
          },
          {
            title: 'Resource Status',
            value: e.ResourceStatus,
            short: true,
          },
          {
            title: 'Resource Physical ID',
            value: e.PhysicalResourceId,
            short: true,
          },
          {
            title: 'Reason',
            value: e.ResourceStatusReason,
            short: true,
          },
          {
            title: 'Resource Properties',
            value: '```' + e.ResourceProperties + '```',
          },
        ],
        mrkdwn_in: ['fields'],
      },
    ],
  }

  slack.send(notification)
  msg.response.send('ok')
  return true
}

function subscribe (msg) {
  let subUrl = msg.body.SubscribeURL
  if (!subUrl) { return }
  console.log('Got subscription request, visiting', subUrl)

  https.get(subUrl, function (result) {
    console.log('Subscribed with ', result.statusCode)
    slack.send({
      text: 'FYI: I was subscribed to ' + msg.body.TopicArn,
      channel: msg.channel,
    })
    msg.response.send('ok')
  }).on('error', function (e) {
    console.log('Error while subscribing:', e.message)
    msg.response.send('error')
  })
  return true
}

let handlers = [
  subscribe,
  stackdriver,
  cloudwatch,
  cloudformation,
  autoscaling,
  plaintext,
  unknown,
]

export function handleMessage (body, res, channel) {
  console.log('Got', body.Type, 'via', body.TopicArn, 'timestamped', body.Timestamp, 'with', body.Message.length, 'bytes')

  let type, payload
  if (body.Message) {
    [type, payload] = parseIncoming(body.Message)
    console.log('[ORIGINAL MESSAGE]', type, payload)
  }

  let message = {
    type,
    payload,
    body,
    channel,
    response: res,
  }

  R.find(handler => handler(message), handlers)
}

export function parseIncoming(message) {
  try {
    return ['json', JSON.parse(message)]
  } catch (ex) {}

  try {
    return ['line-delimited', parseAsLineDelimitedKVPairs(message)]
  } catch (ex) {}

  return ['text', message]
}

export function parseAsLineDelimitedKVPairs(message) {
  let kvRegex = /^(\w+)='((.|\n)*?)'$/gm
  let retVal = {}
  let match
  let lastMatchEndIdx = 0
  while ((match = kvRegex.exec(message)) !== null) {
    if (match.index - lastMatchEndIdx > 2) {
      throw new Error('Parse error: does not appear to match line-delimited format')
    }

    let [fullMatch, key, value] = match
    retVal[key] = value

    lastMatchEndIdx = kvRegex.lastIndex + fullMatch.length
  }

  if (message.length - lastMatchEndIdx > 2) {
    throw new Error('Parse error: does not appear to match line-delimited format')
  }

  return retVal
}
