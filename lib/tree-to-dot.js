function treeToDot (tree) {
  const nodes = []
  const edges = []
  walk(tree, nodes, edges)

  return `digraph tree {
bgcolor="transparent";
node [fontsize=9,fontname=courier];
${nodes.join('\n')}
${edges.join('\n')}
}`
}

function makeLabel (node) {
  const lines = node.stack
    .split('\n')
    .map(line => {
      line = line.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<tr><td align="left" point-size="10">${line}</td></tr>`
    }).join('')

  return `<table border="0" cellborder="1" cellspacing="0" cellpadding="2">
<tr><td align="center"><b><u>${node.type}</u></b></td></tr>
${lines}
</table>`.split('\n').join('')
}

function walk (tree, nodes, edges) {
  nodes.push(`"${tree.stack}" [shape=plaintext,label=<${makeLabel(tree)}>];`)
  if (tree.children) {
    tree.children.forEach(child => {
      edges.push(`"${tree.stack}" -> "${child.stack}";`)
      walk(child, nodes, edges)
    })
  } else if (tree.child) {
    edges.push(`"${tree.stack}" -> "${tree.child.stack}";`)
    walk(tree.child, nodes, edges)
  }
}

module.exports = treeToDot
