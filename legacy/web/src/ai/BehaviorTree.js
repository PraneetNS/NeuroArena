/**
 * BehaviorTree.js (Web Client)
 * Composable Behavior Tree system (Sequence, Selector, Inverter, Action, Condition)
 * for wildlife and tactical bot AI controllers.
 */

export const NodeStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  RUNNING: 'RUNNING'
};

export class BTNode {
  tick(context) {
    return NodeStatus.SUCCESS;
  }
}

export class Sequence extends BTNode {
  constructor(children = []) {
    super();
    this.children = children;
  }

  tick(context) {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== NodeStatus.SUCCESS) {
        return status;
      }
    }
    return NodeStatus.SUCCESS;
  }
}

export class Selector extends BTNode {
  constructor(children = []) {
    super();
    this.children = children;
  }

  tick(context) {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== NodeStatus.FAILURE) {
        return status;
      }
    }
    return NodeStatus.FAILURE;
  }
}

export class ActionNode extends BTNode {
  constructor(actionFn) {
    super();
    this.actionFn = actionFn;
  }

  tick(context) {
    return this.actionFn(context);
  }
}

export class ConditionNode extends BTNode {
  constructor(predicateFn) {
    super();
    this.predicateFn = predicateFn;
  }

  tick(context) {
    return this.predicateFn(context) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
