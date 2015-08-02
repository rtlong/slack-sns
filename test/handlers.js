import { assert } from 'chai'

import {
  parseIncoming,
  parseAsLineDelimitedKVPairs
} from '../lib/handlers'

var messages = {
  cloudformation: {
    real: 'StackId=\'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a\'\nTimestamp=\'2015-07-29T23:41:28.277Z\'\nEventId=\'55351f20-364b-11e5-8a00-5001a7da7436\'\nLogicalResourceId=\'InternalToolsTest\'\nNamespace=\'394453120661\'\nPhysicalResourceId=\'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a\'\nPrincipalId=\'AIDAIDOWE7O3X7JLV2LRY\'\nResourceProperties=\'{"foo": "bar"}\n\'\nResourceStatus=\'DELETE_COMPLETE\'\nResourceStatusReason=\'\'\nResourceType=\'AWS::CloudFormation::Stack\'\nStackName=\'InternalToolsTest\'\n',
  },
  lineDelimited: {
    foo: "foo='bar'\nbiz='fizz bang'\n",
  },
  json: {
    foo: JSON.stringify({ foo: 'bar', biz: 'fizz bang' }),
  },
  plain: {
    foo: 'this is plain text and should not be parsed',
    bar: 'key=\'value\'\nthis is plain text and should not be parsed',
  },
}

describe('handlers', () => {
  describe('parseIncoming', () => {
    it('parses line-delimited stuff correctly', () => {
      let msg = messages.lineDelimited.foo
      let parsed = parseIncoming(msg)
      assert.equal(parsed[0], 'line-delimited')
      assert.deepEqual(parsed[1], {
        foo: 'bar',
        biz: 'fizz bang',
      })
    })

    it('parses JSON stuff correctly', () => {
      let msg = messages.json.foo
      let parsed = parseIncoming(msg)
      assert.equal(parsed[0], 'json')
      assert.deepEqual(parsed[1], {
        foo: 'bar',
        biz: 'fizz bang',
      })
    })

    it('falls back to plain text', () => {
      let msg = messages.plain.foo
      let parsed = parseIncoming(msg)
      assert.equal(parsed[0], 'text')
      assert.equal(parsed[1], messages.plain.foo)
    })

    it('falls back to plain text even if it looks a bit like key-value', () => {
      let msg = messages.plain.bar
      let parsed = parseIncoming(msg)
      assert.equal(parsed[0], 'text')
      assert.equal(parsed[1], messages.plain.bar)
    })
  })

  describe('parseAsLineDelimitedKVPairs', () => {
    it('parses line-delimited stuff correctly', () => {
      let msg = messages.lineDelimited.foo
      let parsed = parseAsLineDelimitedKVPairs(msg)
      assert.deepEqual(parsed, {
        foo: 'bar',
        biz: 'fizz bang',
      })
    })

    it('parses line-delimited stuff correctly', () => {
      let msg = messages.cloudformation.real
      let parsed = parseAsLineDelimitedKVPairs(msg)
      assert.deepEqual(parsed, {
        StackId: 'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a',
        Timestamp: '2015-07-29T23:41:28.277Z',
        EventId: '55351f20-364b-11e5-8a00-5001a7da7436',
        LogicalResourceId: 'InternalToolsTest',
        Namespace: '394453120661',
        PhysicalResourceId: 'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a',
        PrincipalId: 'AIDAIDOWE7O3X7JLV2LRY',
        ResourceProperties: '{"foo": "bar"}\n',
        ResourceStatus: 'DELETE_COMPLETE',
        ResourceStatusReason: '',
        ResourceType: 'AWS::CloudFormation::Stack',
        StackName: 'InternalToolsTest',
      })
    })
  })
})
