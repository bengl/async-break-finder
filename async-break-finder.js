const ah = require('async_hooks')
const treeToDot = require('./lib/tree-to-dot')
const fs = require('fs')
const path = require('path')
const archy = require('archy')

const template = fs.readFileSync(path.join(__dirname, 'lib/template.html'), 'utf8')

const idToNode = new Map()

function frameIsInternal (frame) {
  if (frame.includes(' (')) {
    frame = frame.split(' (')[1].split(')')[0]
  }
  return !frame.startsWith('/') || frame.includes(__filename)
}

function getStack () {
  const oldLimit = Error.stackTraceLimit
  Error.stackTraceLimit = Infinity
  const stack = new Error().stack
  Error.stackTraceLimit = oldLimit
  const frames = stack.split('\n')
  frames.shift() // Error
  frames.shift() // getStack
  const result = []
  for (let frame of frames) {
    frame = frame.replace('    at ', '')
    if (process.env.ABF_KEEP_INTERNALS || !frameIsInternal(frame)) {
      result.push(frame)
    }
  }
  return result.join('\n')
}

function renderHtml (tree, list) {
  const treeDot = treeToDot(tree)
  const listDot = treeToDot(list)
  const html = template
    .replace('{{tree}}', treeDot)
    .replace('{{list}}', listDot)
  const filename = path.join(process.cwd(), Date.now() + '.async-break.html')
  fs.writeFileSync(filename, html)
  return filename
}

function archify (node) {
  const nodes = node.children
    ? node.children.map(archify)
    : node.child ? [archify(node.child)] : []
  return {
    label: '\u001b[33m### ' + node.type + ' ###\u001b[0m\n' + node.stack,
    nodes
  }
}

class AsyncBreakError extends Error {
  constructor (subtree, list) {
    super('No path found! ' +
      (process.env.ABF_HTML
        ? 'See ' + renderHtml(subtree, list)
        : 'There is no async context chain between the two pieces of code you\'ve identified.\n\n' +
        '\u001b[35mHere is the async tree starting at the first point you identified.\n' +
        'In one of the edges, asynchronous context is lost probably due to userland scheduling.\u001b[0m\n' +
        '╔══════════════\n' +
        archy(archify(subtree)).trim().split('\n').map(l => '║ ' + l).join('\n') + '\n' +
        '╚══════════════\n\n' +
        '\u001b[35mHere is the async branch that leads to the second point you identified.\n' +
        'Somewhere, you\'ll need to bind the two together.\u001b[0m\n' +
        '╔══════════════\n' +
        archy(archify(list)).trim().split('\n').map(l => '║ ' + l).join('\n') + '\n' +
        '╚══════════════'))
    Error.captureStackTrace(this, AsyncBreakError)

    Object.defineProperty(this, 'subtree', { value: subtree })
    Object.defineProperty(this, 'list', { value: list })
  }
}

class AsyncNode {
  constructor (id, type) {
    this.id = id
    this.type = type
    const parent = ah.executionAsyncId()
    this.parent = idToNode.get(parent) || undefined
    if (this.parent) {
      this.parent.children.push(this)
    }
    this.children = []
    this.stack = getStack()
    idToNode.set(id, this)
  }

  pathTo (child) {
    const pathNode = { id: this.id, type: this.type, stack: this.stack, child }

    return this.parent ? this.parent.pathTo(pathNode) : pathNode.child
  }

  removeParents () {
    delete this.parent
    this.children.forEach(child => child.removeParents())
  }

  validatePathFrom (ancestor) {
    let current = this
    while (current.parent) {
      if (current.parent === ancestor) {
        return
      }
      current = current.parent
    }
    ancestor.removeParents()
    throw new AsyncBreakError(ancestor, this.pathTo())
  }

  static create (id, type) {
    return new AsyncNode(id, type)
  }
}

AsyncNode.create(1, 'root')

ah.createHook({ init: AsyncNode.create }).enable()

module.exports = function asyncBreakFinder (ancestor) {
  if (ancestor) {
    return AsyncNode.create(null, 'descendant').validatePathFrom(ancestor)
  }
  return idToNode.get(ah.executionAsyncId())
}
