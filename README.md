# async-break-finder

This is a testing tool to help ensure that you've preserved asynchronous context
between two points in your code flow. Preserving asynchronous context allows
things like `AsyncLocalStorage` to work correctly across asynchronous
boundaries, and is cruicial for higher-level tools like APM tools.

## Usage

```js
import asyncBreakFinder from 'async-break-finder'

/* And then, somewhere in your code flow... */
const start = asyncBreakFinder()

doSomethingAsynchronous(() => {
  asyncBreakFinder(start)
})
```

Upon the second call to `asyncBreakFinder()`, it will search along the
asynchronous causation chain from that point. If it finds the initial call to
`asyncBreakFinder()`, then it will silently succeed. If it can't find the
initial call, it will throw an error. The error message shows the call stacks at
each initialization of an `AsyncResource` starting at the initial call, and also
the chain of call stacks leading up to the second call. This should give enough
information to figure out where the chain breaks in order to fix the context.

In general, it's best to avoid putting the initial call at the top level async
context, otherwise your async tree will always contain everything in the entire
process, and so a path will always be able to be found. This makes it impossible
to find any errors with this tool. Instead, try to do the initial call as close
as possible to the asynchronous operating you're trying to test. If the
operation happens at the top level asynchronous scope, try wrapping the
invocation in a `setImmediate` to get a fresh async context.

By default, stack frames coming from Node.js internals are hidden. To show all
stack frames, set the environment variable `ABF_KEEP_INTERNALS` to anything.

To render the data as a graph using graphviz in an HTML file, set the
environment variable `ABF_HTML` to anything.

## What to do when your context is broken

Eventually when looking through the data provided by error messages from this
library, you'll find that asynchronous context is broken at some kind of async
operation. By moving your start and end points, you should be able to narrow it
down to a single operation, like in the usage example above. If the example
above fails, then one easy fix might be the following.

```js
import { AsyncResource } from 'async_hooks'

/* Somewhere in the code flow... */
doSomethingAsynchronous(AsyncResource.bind(() => {
  // Now we have the same async context as before this async call
}))
```

Please read the documentation for `AsyncResource` for more information.

## License

The MIT License. See LICENSE.txt
