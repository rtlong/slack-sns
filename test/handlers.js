import { assert } from 'chai'

var cloudformationMessage = 'StackId=\'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a\'\nTimestamp=\'2015-07-29T23:41:28.277Z\'\nEventId=\'55351f20-364b-11e5-8a00-5001a7da7436\'\nLogicalResourceId=\'InternalToolsTest\'\nNamespace=\'394453120661\'\nPhysicalResourceId=\'arn:aws:cloudformation:us-east-1:394453120661:stack/InternalToolsTest/1ec91b30-35bf-11e5-bc32-5001b34a4a0a\'\nPrincipalId=\'AIDAIDOWE7O3X7JLV2LRY\'\nResourceProperties=\'null\'\nResourceStatus=\'DELETE_COMPLETE\'\nResourceStatusReason=\'\'\nResourceType=\'AWS::CloudFormation::Stack\'\nStackName=\'InternalToolsTest\'\n'

describe('foo', () => {
  it('foos', () => {
    assert.equal(cloudformationMessage, cloudformationMessage)
    assert.equal(cloudformationMessage, true)
  })
})
