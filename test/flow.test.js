import { describe, it, expect } from '@jest/globals'
import external from '../external.js'
import { SinteFlow } from '../orchestrator'
import yaml from 'js-yaml'

const integrationResolver = async (provider, action) => {
  return external[provider][action]
}

const yamlToJson = y => yaml.load(y)
const setup = (config, input, auth) => {
  const cf = yamlToJson(config)
  return new SinteFlow(cf, integrationResolver)
}

describe('flow orchestrator', () => {
  it('should be able to run a single action', async () => {
    const config = `
    - id: logMessage1
      provider: test
      action: log
      props:
        message:
          type: template
          value: '''Hello world!'''
`
    const input = {}
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.logMessage1.result).toEqual('Hello world!')
  })

  it('should be able to run a chain of actions', async () => {
    const config = `
    - id: logMessage1
      provider: test
      action: log
      props:
        message:
          type: template
          value: '''Hello world!'''
    - id: logMessage2
      provider: test
      action: log
      props:
        message:
          type: template
        value: '''Hello again!'''
`
    const input = {}
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(Object.keys(result.localCtx.steps)).toEqual(['logMessage1', 'logMessage2'])
  })
})

describe('template prop', () => {
  it('should have access to the results of previous steps', async () => {
    const config = `
    - id: logMessage1
      provider: test
      action: log
      props:
        message:
          type: template
          value: '''Hello world!'''
    - id: logMessage2
      provider: test
      action: log
      props:
        message:
          type: template
          value: '''The result of step 1 was: '' + ctx.steps.logMessage1.result'
  `
    const input = {}
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.logMessage2.result).toEqual('The result of step 1 was: Hello world!')
  })

  it('should have access to the input', async () => {
    const config = `
    - id: logMessage1
      provider: test
      action: log
      props:
        message:
          type: template
          value: '''Provided input: '' + input.message'
  `
    const input = {
      message: 'test'
    }
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.logMessage1.result).toEqual('Provided input: test')
  })
})

describe('flow control', () => {
  it('should be able to carry out a loop', async () => {
    const config = `
    - id: query1
      provider: test
      action: query
      props: {}
    - id: loop1
      provider: flow
      action: loop
      props:
        items:
          type: template
          value: 'ctx.steps.query1.result'
        key:
          type: template
          value: '''currentItem'''
        actions:
          type: block
          value:
            - id: logMessage1
              provider: test
              action: log
              props:
                message:
                  type: template
                  value: '''current item is: '' + ctx.currentItem.id'
  `
    const input = {}
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.loop1[0].logMessage1.result).toEqual('current item is: 1')
  })

  it('should be able to run conditional code', async () => {
    const config = `
    - id: condition1
      provider: flow
      action: condition
      props:
        if:
          type: template
          value: '1 > 2'
        then:
          type: block
          value:
            - id: logMessage1
              provider: test
              action: log
              props:
                message:
                  type: template
                  value: '''1 is greater than 2'''
        otherwise:
          type: block
          value:  
            - id: logMessage2
              provider: test
              action: log
              props:
                message:
                  type: template
                  value: '''1 is not greater than 2'''
  `
    const input = {}
    const auth = {}

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps?.logMessage1?.result).toBeUndefined()
    expect(result.localCtx.steps?.logMessage2?.result).toEqual('1 is not greater than 2')
  })
})

describe('step', () => {
  it('should have access to its own auth tokens', async () => {
    const config = `
    - id: auth1
      provider: test
      action: auth
      props: {}
  `
    const input = {}
    const auth = {
      auth1: {
        test: 'token'
      }
    }

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.auth1.result).toBeTruthy()
  })

  it('should NOT have access to the auth tokens of other steps', async () => {
    const config = `
    - id: auth1
      provider: test
      action: auth
      props: {}
    - id: auth2
      provider: test
      action: auth
      props: {}
  `
    const input = {}
    const auth = {
      auth1: {
        test: 'token'
      }
    }

    const s = setup(config, input, auth)
    const result = await s.run(input, auth)

    expect(result.localCtx.steps.auth1.result).toBeTruthy()
    expect(result.localCtx.steps.auth2.result).toBeFalsy()
  })
})
