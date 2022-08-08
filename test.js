'use strict'

const pitesti = require('pitesti')
const assert = require('assert')
const path = require('path')
const fs = require('fs')
const asyncBreakFinder = require('./async-break-finder')

const queue = []
const interval = setInterval(() => {
  if (queue.length) {
    queue.shift()()
  } else {
    interval.unref()
  }
}, 10)
function enqueue (cb) {
  interval.ref()
  queue.push(cb)
}

function doThing (cb) {
  setImmediate(() => {
    enqueue(() => {
      setImmediate(() => {
        cb()
      })
    })
    setImmediate(() => { /* nothing */ })
  })
  setImmediate(() => { /* nothing */ })
}

function breakExample (done) {
  setImmediate(() => {
    const start = asyncBreakFinder()
    doThing(() => {
      try {
        asyncBreakFinder(start)
        done()
      } catch (e) {
        done(e)
      }
    })
  })
}

function example (done) {
  setImmediate(() => {
    const start = asyncBreakFinder()
    process.nextTick(() => {
      try {
        asyncBreakFinder(start)
        done()
      } catch (e) {
        done(e)
      }
    })
  })
}

function cleanTree (node) {
  if (node.id !== null) {
    assert.ok(typeof node.id === 'number')
    assert.ok(Number.isInteger(node.id))
    assert.ok(node.id > 0)
  }
  delete node.id
  if (node.children) {
    node.children.forEach(cleanTree)
  }
  if (node.child) {
    cleanTree(node.child)
  }
  Object.setPrototypeOf(node, Object.prototype)
  return node
}

function assertTreeEqual (tree, expected) {
  assert.deepStrictEqual(cleanTree(tree), expected)
}

const test = pitesti()

test`does not throw if async context unbroken`(done => {
  example(done)
})

test`throws if async context is broken`(done => {
  /* eslint-disable node/no-path-concat */
  breakExample(e => {
    assert.ok(e)
    const expectedMessage = `No path found! There is no async context chain between the two pieces of code you've identified.

\u001b[35mHere is the async tree starting at the first point you identified.
In one of the edges, asynchronous context is lost probably due to userland scheduling.\u001b[0m
╔══════════════
║ \u001b[33m### Immediate ###\u001b[0m
║ │ breakExample (${__dirname}/test.js:35:3)
║ │ ${__dirname}/test.js:91:3
║ │ ${__dirname}/node_modules/create-test-promise/index.js:12:36
║ │ promisify (${__dirname}/node_modules/create-test-promise/index.js:12:3)
║ │ p (${__dirname}/node_modules/create-test-promise/index.js:25:17)
║ │ safeWrap (${__dirname}/node_modules/create-test-promise/index.js:23:32)
║ │ Array.<anonymous> (${__dirname}/node_modules/create-test-promise/index.js:39:15)
║ │ PitestiSuite.runTest (${__dirname}/node_modules/pitesti/index.js:67:18)
║ │ ${__dirname}/node_modules/pitesti/index.js:79:22
║ ├─┬ \u001b[33m### Immediate ###\u001b[0m
║ │ │ doThing (${__dirname}/test.js:23:3)
║ │ │ Immediate._onImmediate (${__dirname}/test.js:37:5)
║ │ └── \u001b[33m### Immediate ###\u001b[0m
║ │     Immediate._onImmediate (${__dirname}/test.js:29:5)
║ └── \u001b[33m### Immediate ###\u001b[0m
║     doThing (${__dirname}/test.js:31:3)
║     Immediate._onImmediate (${__dirname}/test.js:37:5)
╚══════════════

\u001b[35mHere is the async branch that leads to the second point you identified.
Somewhere, you'll need to bind the two together.\u001b[0m
╔══════════════
║ \u001b[33m### Timeout ###\u001b[0m
║ │ Object.<anonymous> (${__dirname}/test.js:10:18)
║ └─┬ \u001b[33m### Immediate ###\u001b[0m
║   │ ${__dirname}/test.js:25:7
║   │ Timeout._onTimeout (${__dirname}/test.js:12:18)
║   └── \u001b[33m### descendant ###\u001b[0m
║       ${__dirname}/test.js:39:9
║       Immediate._onImmediate (${__dirname}/test.js:26:9)
╚══════════════`
    assert.strictEqual(e.message, expectedMessage)
    assertTreeEqual(e.subtree, {
      type: 'Immediate',
      children: [
        {
          type: 'Immediate',
          children: [
            {
              type: 'Immediate',
              children: [],
              stack: `Immediate._onImmediate (${__dirname}/test.js:29:5)`
            }
          ],
          stack: `doThing (${__dirname}/test.js:23:3)\n` +
          `Immediate._onImmediate (${__dirname}/test.js:37:5)`
        },
        {
          type: 'Immediate',
          children: [],
          stack: `doThing (${__dirname}/test.js:31:3)\n` +
          `Immediate._onImmediate (${__dirname}/test.js:37:5)`
        }
      ],
      stack: `breakExample (${__dirname}/test.js:35:3)\n` +
      `${__dirname}/test.js:91:3\n` +
      `${__dirname}/node_modules/create-test-promise/index.js:12:36\n` +
      `promisify (${__dirname}/node_modules/create-test-promise/index.js:12:3)\n` +
      `p (${__dirname}/node_modules/create-test-promise/index.js:25:17)\n` +
      `safeWrap (${__dirname}/node_modules/create-test-promise/index.js:23:32)\n` +
      `Array.<anonymous> (${__dirname}/node_modules/create-test-promise/index.js:39:15)\n` +
      `PitestiSuite.runTest (${__dirname}/node_modules/pitesti/index.js:67:18)\n` +
      `${__dirname}/node_modules/pitesti/index.js:79:22`
    })
    assertTreeEqual(e.list, {
      type: 'Timeout',
      stack: `Object.<anonymous> (${__dirname}/test.js:10:18)`,
      child: {
        type: 'Immediate',
        stack: `${__dirname}/test.js:25:7\n` +
        `Timeout._onTimeout (${__dirname}/test.js:12:18)`,
        child: {
          type: 'descendant',
          stack: `${__dirname}/test.js:39:9\n` +
          `Immediate._onImmediate (${__dirname}/test.js:26:9)`,
          child: undefined
        }
      }
    })
    done()
  })
  /* eslint-enable node/no-path-concat */
})

test`keeps internal frames if flag is present`(done => {
  process.env.ABF_KEEP_INTERNALS = true
  breakExample(e => {
    delete process.env.ABF_KEEP_INTERNALS
    assert.ok(e)
    assert.match(e.subtree.stack, /async_hooks/)
    done()
  })
})

test`generates html if flag is present`(done => {
  process.env.ABF_HTML = 'true'
  breakExample(e => {
    let file
    try {
      delete process.env.ABF_HTML
      assert.ok(e)
      assert.ok(e.message.startsWith('No path found! See '))
      file = e.message.split('See ')[1]
      assert.strictEqual(path.dirname(file), process.cwd())
      assert.match(path.basename(file), /^\d+\.async-break\.html$/)
      done()
    } catch (e) {
      done(e)
    } finally {
      if (file) {
        fs.unlinkSync(file)
      }
    }
  })
})

const { AsyncResource } = require('async_hooks')

test`promises just work`(() => {
  let promise = new Promise((resolve, reject) => {
    setImmediate(() => {
      new AsyncResource('inside-promise').runInAsyncScope(() => {
        resolve()
      })
    })
  })
  setImmediate(() => {
    const start = asyncBreakFinder()
    for (let i = 0; i < promise.then.length; i++) {
      const args = new Array(i + 1)

      args[i] = () => {
        asyncBreakFinder(start)
      }

      promise = promise.then.apply(promise, args)
    }
  })
  return promise
})

test()
