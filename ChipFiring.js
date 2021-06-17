const CAMERA_FOV = 75
const CAMERA_FRUSTUM_NEAR = 0.1
const CAMERA_FRUSTUM_FAR = 1000

const CAMERA_INITIAL_DISTANCE = 50
const AXIS_DRAW_DISTANCE = 50

const NODE_RADIUS = 0.25
const NODE_SEGMENTS = 6

const nodeMaterial = new THREE.MeshBasicMaterial( { color: 0x999999 } )
const nodeMaterial_selected = new THREE.MeshBasicMaterial( { color: 0x00cccc } )

const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x009999 })

const getClass = (object) => object.constructor.name

const range = (size) => [...Array(size).keys()]

const getScreenPosition = (renderer, object, camera) => {
  var vector = new THREE.Vector3()

  var widthHalf = 0.5 * renderer.context.canvas.width;
  var heightHalf = 0.5 * renderer.context.canvas.height;

  object.updateMatrixWorld()
  vector.setFromMatrixPosition(object.matrixWorld)
  vector.project(camera)

  vector.x = ( vector.x * widthHalf ) + widthHalf
  vector.y = - ( vector.y * heightHalf ) + heightHalf

  return { 
      x: vector.x,
      y: vector.y
  }
}

const calculateNodesOnPlane = (sigma) => {
  let nodes = []
  for (let alpha = 0; alpha <= sigma; alpha++) {
    for (let beta = 0; beta <= (sigma - alpha); beta++) {
      nodes = [...nodes, [alpha, beta, sigma - alpha - beta]]
    }
  }
  return nodes
}

const calculateEdges = (node) => {
  const isUnstable = (state, index) => state[index] >= 2
  const fireIndex = (state, index) => state.map((n, i) => i === index ? n - 2 : n + 1)
  return node.map((n, i) => isUnstable(node, i) ? fireIndex(node, i) : undefined).filter(s => s !== undefined)
}

const Store = class {
  constructor() {
    this.nodes = {}
  }
  // in order to use a map structure, the search key must be hashable - so we must convert from array -> string whenever we do a lookup
  serialize = (node) => JSON.stringify(node)
  deserialize = (node) => JSON.parse(node)
  hasTraversed = (node) => this.serialize(node) in this.nodes
  getEdges = (node) => this.hasTraversed(node) ? this.nodes[this.serialize(node)] : []
  addEdges = (node, edges) => this.nodes[this.serialize(node)] = edges
}

const Scene = class {
  constructor() {
    // create the underlying store
    this.store = new Store()

    // create the THREE.js scene
    this.scene = new THREE.Scene()

    // create and mount the THREE.js renderer
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    // create the camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, CAMERA_FRUSTUM_NEAR, CAMERA_FRUSTUM_FAR)
    this.camera.position.set(CAMERA_INITIAL_DISTANCE, CAMERA_INITIAL_DISTANCE, CAMERA_INITIAL_DISTANCE)
    this.camera.rotation.set(0, Math.PI / 2, 0) // pointed orthogonal to the planes formed by the constraint alpha + beta + gamma = constant
    
    // setup controls and rerender when controls changed
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
    this.controls.addEventListener('change', this.handleCameraMove.bind(this)) // we need to bind the render function to this context because JavaScript can be weird with namespaces

    // create raycaster for onClick selection
    this.raycaster = new THREE.Raycaster()

    // create and attach axes
    this.axesVisible = true
    this.axes = new Axes()
    this.axes.addToScene(this.scene)

    // create array for holding our currently displayed nodes
    this.nodes = []

    // create variables for holding our selected node and its immediate edges
    this.selectedNode = undefined
    this.selectedEdges = []

    // attach event listener to raycast on click
    this.renderer.domElement.addEventListener('click', (event) => this.handleClick(event))

    // render the initial scene
    this.render()
  }

  setAxesVisibility(shouldBeVisible) {
    if (shouldBeVisible === this.axesVisible) return

    this.axesVisible = shouldBeVisible
    if (shouldBeVisible) this.axes.addToScene(this.scene)
    else this.axes.removeFromScene(this.scene)
    this.render()
  }
  toggleAxesVisibility() {
    this.setAxesVisibility(!this.axesVisible)
  }

  clearNodes() {
    this.deselectNode()
    this.nodes.forEach(n => n.removeFromScene(this.scene))
    this.nodes = []
  }
  addNode(node) {
    node.addToScene(this.scene)
    this.nodes = [...this.nodes, node]
  }
  drawPlane(sigma) {
    this.clearNodes()
    const nodesOnPlane = calculateNodesOnPlane(sigma)
    for (let index in nodesOnPlane) {
      const node = nodesOnPlane[index]
      if (!this.store.hasTraversed(node)) {
        const edges = calculateEdges(node)
        this.store.addEdges(node, edges)
      }
      this.addNode(new Node(node))
    }
    this.render()
  }

  deselectNode() {
    if (this.selectedNode === undefined) return
  
    this.deselectEdges()
    this.relabelSelectedNodeHUD()

    this.selectedNode.setSelected(false)
    this.selectedNode = undefined
  }
  deselectEdges() {
    if (this.selectedEdges.length === 0) return

    this.selectedEdges.forEach(edge => edge.removeFromScene(this.scene))
    this.selectedEdges = []
  }
  selectNode(node) {
    if (this.selectedNode !== undefined) this.deselectNode()

    node.setSelected(true)
    this.selectedNode = node

    // reselect edges when node changed
    const edges = this.store.getEdges(node.position)
    this.selectedEdges = edges.map(next => new Edge(node.position, next))
    this.selectedEdges.forEach(edge => edge.addToScene(this.scene))

    // change the label to match the selected node
    this.relabelSelectedNodeHUD()

    this.render()
  }
  getSelectedScreenPosition() {
    if (this.selectedNode === undefined) return

    const screenPosition = getScreenPosition(this.renderer, this.selectedNode.mesh, this.camera)
    return screenPosition
  }
  relabelSelectedNodeHUD() {
    const hud = document.getElementById('label-selectedNode')
    hud.innerText = JSON.stringify(this.selectedNode?.position)
    this.updateSelectedNodeHUD()
  }
  updateSelectedNodeHUD() {
    const hud = document.getElementById('label-selectedNode')
    const screenPosition = this.getSelectedScreenPosition()
    if (screenPosition === undefined) return
    hud.style.left = `${screenPosition.x}px`
    hud.style.top = `${screenPosition.y}px`
  }

  handleCameraMove() {
    this.updateSelectedNodeHUD()
    this.render()
  }
  handleClick(event) {
    const pointer = new THREE.Vector2()
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1  
    this.raycaster.setFromCamera(pointer, this.camera)
    const intersects = this.raycaster.intersectObjects(this.scene.children)
    if (intersects.length > 0) {
      const object = intersects[0].object
      if (object.name) {
        const type = getClass(object.name)
        if (type === 'Node') {
          // we clicked on a node
          const node = object.name
          this.selectNode(node)
          this.render()
        }
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}

const Axes = class {
  constructor() {
    const axisDefinitions = [
      {
        name: 'alpha',
        color: 0x00ff00,
        direction: new THREE.Vector3(1, 0, 0),
      },
      {
        name: 'beta',
        color: 0xff0000,
        direction: new THREE.Vector3(0, 1, 0),
      },
      {
        name: 'gamma',
        color: 0x0000ff,
        direction: new THREE.Vector3(0, 0, 1),
      }
    ]
    this.axes = axisDefinitions.map(definition => {
      const points = [new THREE.Vector3(), definition.direction.clone().multiplyScalar(AXIS_DRAW_DISTANCE)]
      console.log(points)
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({ color: definition.color })
      const line = new THREE.Line(geometry, material)
      line.name = definition.name
      return line
    })
  }
  addToScene(scene) {
    this.axes.forEach(a => scene.add(a))
  }
  removeFromScene(scene) {
    this.axes.forEach(a => scene.remove(a))
  }
}

const Node = class {
  constructor(position) {
    const geometry = new THREE.SphereGeometry(NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS)
    this.mesh = new THREE.Mesh(geometry, nodeMaterial)
    this.mesh.name = this
    this.mesh.position.set(position[0], position[1], position[2])
    this.position = position
    this.selected = false
    this.edges = []
  }
  addToScene(scene) {
    scene.add(this.mesh)
  }
  removeFromScene(scene) {
    scene.remove(this.mesh)
  }
  setSelected(shouldBeSelected) {
    if (shouldBeSelected === this.selected) return

    this.selected = shouldBeSelected
    this.mesh.material = shouldBeSelected ? nodeMaterial_selected : nodeMaterial
  }
}

const Edge = class {
  constructor(start, end) {
    const points = [new THREE.Vector3(start[0], start[1], start[2]), new THREE.Vector3(end[0], end[1], end[2])]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    this.line = new THREE.Line(geometry, edgeMaterial)
    this.line.name = this
  }
  addToScene(scene) {
    scene.add(this.line)
  }
  removeFromScene(scene) {
    scene.remove(this.line)
  }
}

const scene = new Scene()

// Attach event listeners for DOM elements
document.getElementById('button-generateState').addEventListener('click', () => {
  const sigma = document.getElementById('input-constant').value
  scene.drawPlane(sigma)
})

document.getElementById('button-toggleAxes').addEventListener('click', () => {
  scene.toggleAxesVisibility()
})