import axios from 'axios'
import ivm from 'isolated-vm'

class SinteFlow {
  constructor (chain, integrationResolver) {
    this.chain = chain
    this.integrationResolver = integrationResolver
    this.flow = {
      loop: async (step, ctx, localCtx, input, auth) => {
        const resolvedProps = {}
        const propsPromises = []
        for (const key of Object.keys(step.props)) {
          resolvedProps[key] =
            step.props[key].type === 'template'
              ? await this.resolveProp(step.props[key].value, input, auth, ctx)
              : step.props[key].value

          propsPromises.push(resolvedProps[key])
        }

        await Promise.all(propsPromises)

        const iterations = []
        const promises = []

        for (const item in resolvedProps.items) {
          const ctxToPass = {
            ...ctx
          }
          ctxToPass[resolvedProps.key] = resolvedProps.items[item]
          ctxToPass[resolvedProps.key + '_index'] = item
          const iteration = this.runChainOfActions(resolvedProps.actions, ctxToPass, input, auth)
          promises.push(iteration)
          iterations.push(await (await iteration).localCtx.steps)
          await iteration.localCtx
        }

        localCtx.steps[step.id] = iterations
        return await Promise.all(promises)
      },
      condition: async (step, ctx, localCtx, input, auth) => {
        const resolvedProps = {}

        const promises = []
        for (const key of Object.keys(step.props)) {
          resolvedProps[key] =
            step.props[key].type === 'template'
              ? await this.resolveProp(step.props[key].value, input, auth, ctx)
              : step.props[key].value

          promises.push(resolvedProps[key])
        }

        await Promise.all(promises)

        const ctxToPass = {
          ...ctx
        }

        let result

        if (resolvedProps.if) {
          result = this.runChainOfActions(resolvedProps.then, ctxToPass, input, auth)
        } else {
          result = this.runChainOfActions(resolvedProps.otherwise, ctxToPass, input, auth)
        }

        localCtx.steps = {
          ...localCtx.steps,
          ...(await result).localCtx.steps
        }
        return await result
      }
    }
  }

  async resolveProp (prop, inputs, auth, context) {
    const isolate = new ivm.Isolate({
      memoryLimit: 8
    })
    const vmcontext = await isolate.createContext()

    const result = await vmcontext.evalClosure(`
            let input = $0;
            let auth = $1;
            let ctx = $2;
    
            return ${prop}
        `, [inputs, auth, context], {
      arguments: {
        copy: true
      },
      result: {
        promise: true,
        copy: true
      }
    })

    return await result
  }

  async runInIsolatedEnvironment (provider, action, props) {
    const fn = await this.integrationResolver(provider, action)

    const isolate = new ivm.Isolate({
      memoryLimit: 8
    })
    const context = await isolate.createContext()

    const g = context.global
    await g.set('log', function (...args) {
      // Pass console.log as 'log' to the isolate
      console.log(...args)
    })

    await g.set('axios', axios)

    const module = await isolate.compileModule(fn)

    await module.instantiate(context, () => {
      throw new Error('Sinte does not allow module imports.')
    })

    await module.evaluate()

    const handler = await module.namespace.get('handler', {
      reference: true
    })

    return await handler?.apply(null, [props], {
      result: {
        promise: true,
        copy: true
      },
      arguments: {
        copy: true
      }
    })
  }

  async runStep (step, ctx, inputs, auth) {
    const {
      provider,
      action
    } = step
    const promises = []

    let resolvedProps = {}

    for (const key of Object.keys(step.props)) {
      resolvedProps[key] =
        step.props[key].type === 'template'
          ? await this.resolveProp(step.props[key].value, inputs, auth, ctx)
          : step.props[key].value

      promises.push(resolvedProps[key])
    }

    await Promise.all(promises)
    const localAuth = auth?.[step.id] || {}

    resolvedProps = {
      ...resolvedProps,
      auth: localAuth
    }

    const result = await this.runInIsolatedEnvironment(provider, action, resolvedProps)
    return result
  }

  async runChainOfActions (chain, ctx = {
    steps: {}
  }, input, auth) {
    const localCtx = {
      steps: {}
    }
    const promises = []

    for (const link in chain) {
      const step = chain[link]

      const ctxToPass = {
        ...ctx
      }

      ctxToPass.steps = {
        ...ctx.steps,
        ...localCtx.steps
      }

      if (step.provider === 'flow') {
        const result = this.flow[step.action](step, ctxToPass, localCtx, input, auth)
        promises.push(result)
        await result
      } else {
        const result = this.runStep(step, ctxToPass, input, auth)
        promises.push(result)
        localCtx.steps[step.id] = await result
      }
    }

    await Promise.all(promises)
    return {
      ctx,
      localCtx
    }
  }

  async run (input, auth) {
    return await this.runChainOfActions(this.chain, {
      steps: {}
    }, input, auth)
  }
}

export {
  SinteFlow
}
