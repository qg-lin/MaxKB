import HumanInTheLoopNodeVue from './index.vue'
import { AppNode, AppNodeModel } from '@/workflow/common/app-node'

class HumanInTheLoopNode extends AppNode {
  constructor(props: any) {
    super(props, HumanInTheLoopNodeVue)
  }
}

const getBranchId = (action: any) => action.branch_id || action.value

class HumanInTheLoopNodeModel extends AppNodeModel {
  refreshBranch() {
    this.incoming.edges.forEach((edge: any) => {
      edge.updatePathByAnchor()
    })
    this.outgoing.edges.forEach((edge: any) => {
      edge.updatePathByAnchor()
    })
  }

  getDefaultAnchor() {
    const {
      id,
      x,
      y,
      width,
      height,
      properties: { node_data },
    } = this
    const nodeHeight = height || this.properties.height || 260
    const showNode = this.properties.showNode === undefined ? true : this.properties.showNode
    const anchors: any = [
      {
        x: x - width / 2 + 10,
        y: showNode ? y : y - 15,
        id: `${id}_left`,
        edgeAddable: false,
        type: 'left',
      },
    ]

    const branchIds =
      node_data?.mode === 'text'
        ? [node_data.branch_id || 'submit']
        : (node_data?.actions || [])
            .map((action: any) => getBranchId(action))
            .filter((branchId: string) => branchId)

    const anchorCount = Math.max(branchIds.length, 1)
    const startY = y - nodeHeight / 2 + 170
    const spacing = 42
    branchIds.forEach((branchId: string, index: number) => {
      anchors.push({
        x: x + width / 2 - 10,
        y: showNode ? startY + index * spacing - ((anchorCount - 1) * spacing) / 2 : y - 15,
        id: `${id}_${branchId}_right`,
        type: 'right',
      })
    })

    return anchors
  }
}

export default {
  type: 'human-in-the-loop-node',
  model: HumanInTheLoopNodeModel,
  view: HumanInTheLoopNode,
}
