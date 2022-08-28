import runChainOfActions from './orchestrator.js'
import { resolveProp } from './resolveProp.js'

export default {
  loop: async (step, ctx, localCtx, input, auth) => {
    const resolvedProps = {}
    const propsPromises = []
    for (const key of Object.keys(step.props)) {
      resolvedProps[key] =
                    step.props[key].type === 'template'
                      ? await resolveProp(step.props[key].value, input, auth, ctx)
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
      const iteration = runChainOfActions(resolvedProps.actions, ctxToPass, input, auth)
      promises.push(iteration)
      iterations.push(await (await iteration).localCtx)
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
                      ? await resolveProp(step.props[key].value, input, auth, ctx)
                      : step.props[key].value

      promises.push(resolvedProps[key])
    }

    await Promise.all(promises)

    const ctxToPass = {
      ...ctx
    }

    let result

    if (resolvedProps.if) {
      result = runChainOfActions(resolvedProps.then, ctxToPass, input, auth)
    } else {
      result = runChainOfActions(resolvedProps.otherwise, ctxToPass, input, auth)
    }

    localCtx.steps = {
      ...localCtx.steps,
      ...(await result).localCtx.steps
    }
    return await result
  }
}
