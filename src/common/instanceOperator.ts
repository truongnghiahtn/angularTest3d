import syncHelper from "./syncHelper";


export default class instanceOperator implements Communicator.Operator.Operator {
    _mainViewer: Communicator.WebViewer;
    _ptDown: Communicator.Point2;
    _currentNodes: number[];
    _nodePosZ: number;
    _attachedViewers: Communicator.WebViewer[];
    _viewSync: syncHelper;

    constructor(viewSync: syncHelper) {
        this._viewSync = viewSync;
        this._mainViewer = viewSync.getMainViewer();
        this._attachedViewers = viewSync.getAttachedViewers();
        this._ptDown = Communicator.Point2.zero();
        this._currentNodes = [];
        this._nodePosZ = 0;
    }

    setNodesToInstance(nodeIds: number[]): void {
        this._currentNodes = this._gatherChildLeafNodes(nodeIds);
        this._mainViewer.model.getNodesBounding(this._currentNodes).then(box => {
            this._nodePosZ = box.max.z - box.min.z;
        });
    }

    onMouseDown(event: Communicator.Event.MouseInputEvent): void {
        this._ptDown.assign(event.getPosition());
    };

    onMouseUp(event: Communicator.Event.MouseInputEvent): void {
        const position = event.getPosition();
        if (position.equals(this._ptDown)) {
            this._insertModeMouseUp(position);
        }
    };

    onMouseMove(event: Communicator.Event.MouseInputEvent): void { };
    onMousewheel(event: Communicator.Event.MouseWheelInputEvent): void { };

    onTouchStart(event: Communicator.Event.TouchInputEvent): void { };
    onTouchMove(event: Communicator.Event.TouchInputEvent): void { };
    onTouchEnd(event: Communicator.Event.TouchInputEvent): void { };

    onKeyDown(event: Communicator.Event.KeyInputEvent): void { };
    onKeyUp(event: Communicator.Event.KeyInputEvent): void { };

    onDeactivate(): void { };
    onActivate(): void { };
    onViewOrientationChange(): void { };

    stopInteraction(): void { };

    _insertModeMouseUp(ePosition: Communicator.Point2): void {
        const config = new Communicator.PickConfig(Communicator.SelectionMask.Face);
        this._mainViewer.view.pickFromPoint(ePosition, config).then((selectionItem) => {
          let temp:any =selectionItem.getNodeId()
            if (selectionItem.isEntitySelection() &&
                this._mainViewer.model.getNodeName(temp) === "printingPlane") {
                this._insertGeometry(selectionItem.getPosition());
            }
            else {
                alert("Please select a point on the Printing Plane")
            }
        });
    };

    _gatherChildLeafNodes(startNodes: number[]): number[] {
        const model = this._mainViewer.model;
        let nodes = startNodes.slice();
        let leaves = [];
        for (let i = 0; i < nodes.length; ++i) {
            let node = nodes[i];
            let kids = model.getNodeChildren(node);
            if (kids.length === 0) {
                leaves.push(node);
            }
            for (let j = 0; j < kids.length; j++) {
                let kid = kids[j];
                nodes.push(kid);
            }
        }
        return leaves;
    };

    _insertGeometry(position: Communicator.Point3): void {
        this._mainViewer.model.getMeshIds(this._currentNodes).then(meshIds => {
            meshIds.forEach((meshId, index) => {
                this._mainViewer.model.getNodeEffectiveFaceColor(this._currentNodes[index], 0).then(color => {
                    let netMatrix = this._mainViewer.model.getNodeNetMatrix(this._currentNodes[index]);
                    netMatrix.m[12] = position.x; // Add translation to the X-axis.
                    netMatrix.m[13] = position.y; // Add translation to the Y-axis.
                    netMatrix.m[14] = this._nodePosZ;
                    let mid:any = [];
                    let numInstances = this._attachedViewers.length + 1
                    for (let i = 0; i < numInstances; ++i) {
                        mid.push(new Communicator.MeshInstanceData(meshId, netMatrix, "Node " + this._currentNodes + " Instance", color, Communicator.Color.black()));
                    }
                    this._mainViewer.model.createMeshInstance(mid.pop())
                    .then( nodeId => {
                        this._viewSync.setNeedsUpdate(true);
                    });
                    this._attachedViewers.map(viewer => {
                        viewer.model.createMeshInstance(mid.pop())
                        .then( nodeId => {
                            this._viewSync.setNeedsUpdate(true);
                        });
                    });
                });
            });
        });
    };

}
