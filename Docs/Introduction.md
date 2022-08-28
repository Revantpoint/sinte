# Introduction
![Sinte](./src/sinteHeader.png)
Sinte is a simple tool which allows you to create "flows"— running blocks of Javascript code, defined by a JSON configuration object. Each step of a flow is executed inside a V8 isolate (using [isolated-vm](https://www.npmjs.com/package/isolated-vm)), similar to the way Cloudflare Workers are run.

This sandboxes code into its own environment, so that—
- it's possible to control the data each step sees
- malicious code (for instance, untrusted user-defined code) can't impact the orchestration of the flow (or other flows)

> **Note on sandboxing**
>
> It's worth noting this is **not** the safest way of isolating code, especially untrusted user-defined code. The safest way would be to run each untrusted piece of code in its own kernel. This can be achieved using tools like AWS's Firecracker (used for AWS Lambda).
>
> This approach is also not entirely unsafe. Again, V8 isolates are used by Cloudflare for their Workers product.
>
> Please keep in mind that this was created as a hobby project, and I am by no means an expert in cybersecurity— that's part of the reason I decided to make this project public (and open-source in the future). If you are interested in contributing/expanding upon the project, please get in touch (find my contact details on my [profile](http://github.com/chrisyalamov))!

## Basic concepts
Sinte runs **flows**. A flow is a set of steps (which can include branching and looping). These steps translate to chunks of code, using something called a **provider**. This code is then executed by the Sinte orchestrator.

For example:

1. Retrieve some items from Airtable
2. `IF` there are less than 3 items, 
    - `THEN` 
        1. send me an email
    - `OTHERWISE`
        1. send a message to a Microsoft Teams channel

For step 1, we would use a provider like `airtable/getItems`. This is a predefined piece of code that takes some parameters and, in this case, requests data from an API.

For step 2, we would use the `flow/condition` provider. This is a built-in provider, which takes a condition, a `THEN` block (a **block** is simply a set of steps) and an `OTHERWISE` block. It executes a particular block, depending on whether the condition was met.

For the outcome of each branch, we would use a provider like `twilio/sendEmail` and `office365/sendTeamsMessage`.

Any providers which are not built have to be either written or plugged in by you.

In code, this flow would have the following JSON configuration:

```json
[
    {
        "id": "getItemsFromAirtable",
        "provider": "airtable",
        "action": "getItems",
        "props": {
            "baseID": "aadvd8903Bm15Oin",
            "tableID": "df92331oifnQ9Fdhw"
        }
    },
    {
        "id": "condition1",
        "provider": "flow",
        "action": "condition",
        "props": {
            "if": "ctx.steps.getItemsFromAirtable.result.length < 3",
            "then": [
                {
                    "id": "sendEmail",
                    "provider": "twilio",
                    "action": "sendEmail",
                    "props": {
                        "recipient": "john.doe@example.com",
                        "subject": "Items in Airtable",
                        "body": "ALERT! There are less than 3 items in Airtable"
                    } 
                }
            ],
            "otherwise": [
                {
                    "id": "informTeam",
                    "provider": "office365",
                    "action": "sendTeamsMessage",
                    "props": {
                        "message": "'There are ' + ctx.steps.getItemsFromAirtable.result.length + ' items in Airtable'"
                    }
                }
            ]
        }
    }
]
```

or for better readability, the same can be expressed in YAML:

```yaml
- id: getItemsFromAirtable
  provider: airtable
  action: getItems
  props:
    baseID: aadvd8903Bm15Oin
    tableID: df92331oifnQ9Fdhw
- id: condition1
  provider: flow
  action: condition
  props:
    if: ctx.steps.getItemsFromAirtable.result.length < 3
    then:
    - id: sendEmail
      provider: twilio
      action: sendEmail
      props:
        recipient: john.doe@example.com
        subject: Items in Airtable
        body: ALERT! There are less than 3 items in Airtable
    otherwise:
    - id: informTeam
      provider: office365
      action: sendTeamsMessage
      props:
        message: "'There are ' + ctx.steps.getItemsFromAirtable.result.length + 'items in Airtable'"
```

To see examples of providers, have a look at the [tests](../test/flow.test.js).