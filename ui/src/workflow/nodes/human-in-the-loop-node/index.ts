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
const TEXT_REJECT_ANCHOR_TOP = 455
const ACTION_ROW_SPACING = 32

const getBranchAnchorTop = (nodeData: any) => {
  return nodeData?.mode === 'text' ? TEXT_SUBMIT_ANCHOR_TOP : CONFIRMATION_ACTION_ANCHOR_TOP
}

const getTextAnchorTop = (
  textAnchorList: Array<any> = [],
  branchId: string,
  index: number,
) => {
  const textAnchor = textAnchorList.find(
    (item) => item.branch_id === branchId || item.index === index,
  )
  return textAnchor?.anchor_top || (index === 0 ? TEXT_SUBMIT_ANCHOR_TOP : TEXT_REJECT_ANCHOR_TOP)
}

const getTextBranchList = (nodeData: any, textAnchorList: Array<any> = []) => {
  const branchList = [
    {
      branchId: nodeData?.branch_id || 'submit',
      anchorTop: getTextAnchorTop(textAnchorList, nodeData?.branch_id || 'submit', 0),
    },
  ]
  if (nodeData?.allow_reject) {
    branchList.push({
      branchId: nodeData?.reject_branch_id || 'reject',
      anchorTop: getTextAnchorTop(textAnchorList, nodeData?.reject_branch_id || 'reject', 1),
    })
  }
  return branchList
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
      properties: { node_data, action_anchor_list, text_anchor_list },
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

    const branchList =
      node_data?.mode === 'text'
        ? getTextBranchList(node_data, text_anchor_list)
        : (node_data?.actions || [])
            .map((action: any) => getBranchId(action))
            .filter((branchId: string) => branchId)
            .map((branchId: string, index: number) => ({
              branchId,
              anchorTop: getActionAnchorTop(action_anchor_list, branchId, index, node_data),
            }))

    branchList.forEach((branch: any) => {
      anchors.push({
        x: x + width / 2 - 10,
        y:
          showNode && node_data?.mode === 'confirmation'
            ? y - nodeHeight / 2 + branch.anchorTop
            : showNode
              ? y - nodeHeight / 2 + branch.anchorTop
              : y - 15,
        id: `${id}_${branch.branchId}_right`,
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
