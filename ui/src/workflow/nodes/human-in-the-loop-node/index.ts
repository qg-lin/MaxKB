import HumanInTheLoopNodeVue from './index.vue'
import { AppNode, AppNodeModel } from '@/workflow/common/app-node'

class HumanInTheLoopNode extends AppNode {
  constructor(props: any) {
    super(props, HumanInTheLoopNodeVue)
  }
}

export default {
  type: 'human-in-the-loop-node',
  model: AppNodeModel,
  view: HumanInTheLoopNode,
}
