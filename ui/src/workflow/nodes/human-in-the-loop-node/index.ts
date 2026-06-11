import HumanInTheLoopNodeVue from './index.vue'
import { AppNode, AppNodeModel } from '@/workflow/common/app-node'

class HumanInTheLoopNode extends AppNode {
  constructor(props: any) {
    super(props, HumanInTheLoopNodeVue)
  }
}

const getBranchId = (action: any) => action.branch_id || action.value
const CONFIRMATION_ACTION_ANCHOR_TOP = 300
const TEXT_SUBMIT_ANCHOR_TOP = 365
const ACTION_ROW_SPACING = 32

const getBranchAnchorTop = (nodeData: any) => {
  return nodeData?.mode === 'text' ? TEXT_SUBMIT_ANCHOR_TOP : CONFIRMATION_ACTION_ANCHOR_TOP
}

const getActionAnchorTop = (
  actionAnchorList: Array<any> = [],
  branchId: string,
  index: number,
  nodeData: any,
) => {
  const actionAnchor = actionAnchorList.find(
    (item) => item.branch_id === branchId || item.index === index,
  )
  return actionAnchor?.anchor_top || getBranchAnchorTop(nodeData) + index * ACTION_ROW_SPACING
}

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
      properties: { node_data, action_anchor_list },
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

    const startY = y - nodeHeight / 2 + getBranchAnchorTop(node_data)
    const spacing = node_data?.mode === 'text' ? 0 : ACTION_ROW_SPACING
    branchIds.forEach((branchId: string, index: number) => {
      anchors.push({
        x: x + width / 2 - 10,
        y:
          showNode && node_data?.mode === 'confirmation'
            ? y - nodeHeight / 2 + getActionAnchorTop(action_anchor_list, branchId, index, node_data)
            : showNode
              ? startY + index * spacing
              : y - 15,
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
