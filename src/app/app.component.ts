import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import printingPlane from "./../common/printingPlane";
import transformOperator from "./../common/transformOperator";
import instanceOperator from "./../common/instanceOperator";
import syncHelper from "./../common/syncHelper";
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  _viewerList!: Communicator.WebViewer[];
  _modelList!: string[];
  _printSurfaces!: printingPlane[];
  _transformOp!: transformOperator;
  _transformHandle!: Communicator.OperatorId;
  _viewSync!: syncHelper;
  _instanceOp!: instanceOperator;
  _instanceHandle!: Communicator.OperatorId;
  // public _viewerList:any;
  // public _modelList:any;
  // public _printSurfaces:any;
  @ViewChild('modelFileName') modelFileName!: ElementRef;
  @ViewChild('modelFileType') modelFileType!: ElementRef;
  @ViewChild('nodeId') nodeId!: ElementRef;
  @ViewChild('nodeName') nodeName!: ElementRef;
  // @ViewChild('handlesButton') handlesButton!: ElementRef;
  // @ViewChild('instanceButton') instanceButton!: ElementRef;
  // @ViewChild('arrangeButton') arrangeButton!: ElementRef;
  // @ViewChild('openModelButton') openModelButton !: ElementRef;


  constructor() {
  }
  ngOnInit(): void {
    const mainViewer = new Communicator.WebViewer({
      containerId: "viewer",
      empty: true
    });
    const overheadViewer = new Communicator.WebViewer({
      containerId: "subviewer",
      empty: true
    });

    this._viewerList = [mainViewer, overheadViewer];
    this._viewSync = new syncHelper(this._viewerList);
    this._modelList = [];
    this._printSurfaces = [];

    this._viewerList.map((viewer: any) => {
      viewer.start();
      viewer.setCallbacks({
        modelStructureReady: () => {
          // Create Printing Plane
          this._printSurfaces.push(new printingPlane(viewer, 300, 10));
          // Load Model
          this.loadModel("microengine", viewer);
          // Set initial cameras
          let camPos: any | undefined, target: any | undefined, upVec: any | undefined;
          switch (viewer) {
            case mainViewer:
              camPos = new Communicator.Point3(-1000, -1000, 1000);
              target = new Communicator.Point3(0, 0, 0);
              upVec = new Communicator.Point3(0, 0, 1);
              break;
            case overheadViewer:
              camPos = new Communicator.Point3(0, 0, 1000);
              target = new Communicator.Point3(0, 0, 0);
              upVec = new Communicator.Point3(0, 1, 0);
              break;
            default:
              alert('Error: No WebViewer Objects Detected. Report to TS3D.');
          }
          // let camPos: Communicator.Point3 | undefined;
          const defaultCam = Communicator.Camera.create(camPos, target, upVec, 1, 720, 720, 0.01);
          viewer.view.setCamera(defaultCam);
          // Background color for viewers
          viewer.view.setBackgroundColor(new Communicator.Color(0, 153, 220), new Communicator.Color(218, 220, 222));
          // Set viewer backgrounds
        }
      }); // End Callbacks on Both Viewers
    }); // End map
    mainViewer.setCallbacks({
      modelStructureReady: () => {
        // Additional options for modelStructureReady that we did not want in both viewers
        mainViewer.view.getAxisTriad().enable();
        mainViewer.view.getNavCube().enable();
        mainViewer.view.getNavCube().setAnchor(Communicator.OverlayAnchor.LowerRightCorner);
      },
      selectionArray: (selectionEvents) => {
        // Do Not Want the Build Plate as a Part of any Model Selection Events
        const ppNodeId = this._printSurfaces[0].getNodeId();  // Node Id of the build plate

        // Return the selection IDs for the current selections, check if the printing plane
        // was selected in the results - if so, remove it
        const selectionIds = selectionEvents.map(sEvent => sEvent.getSelection().getNodeId());
        const foundIndex = selectionIds.indexOf(ppNodeId);
        if (foundIndex != -1) {
          let temp: any = selectionEvents[foundIndex].getSelection();
          mainViewer.selectionManager.remove(temp);
          selectionEvents.splice(foundIndex, 1);
        }

        // If the printing plane was the only result, no other selections fired
        // this callback, so exit
        if (selectionEvents.length == 0) return;

        // Otherwise, display node information for the first node in the selection array
        const nodeId: any = selectionEvents[0].getSelection().getNodeId();
        const modelFileName = mainViewer.model.getModelFileNameFromNode(nodeId);
        const modelFileFormat: any = mainViewer.model.getModelFileTypeFromNode(nodeId);
        this.modelFileName.nativeElement.innerHTML = modelFileName || "N/A";
        this.modelFileType.nativeElement.innerHTML = Communicator.FileType[modelFileFormat] || "N/A";
        this.nodeId.nativeElement.innerHTML = nodeId.toString() || "Unknown";
        this.nodeName.nativeElement.innerHTML = nodeId.toString() || "Unknown";
        transformOperator.setMatrixText(mainViewer.model.getNodeNetMatrix(nodeId));
      }
    }); // End Callbacks
    // this._transformOp = new transformOperator(mainViewer);
    // this._transformHandle = mainViewer.registerCustomOperator(this._transformOp);
    // Disable Default Handle Operator - overwriting with custom one that inherits its functionality
    mainViewer.operatorManager.remove(Communicator.OperatorId.Handle);
    this._instanceOp = new instanceOperator(this._viewSync);
    this._instanceHandle = mainViewer.registerCustomOperator(this._instanceOp);
    this._transformOp = new transformOperator(this._viewSync);
    this._transformHandle = mainViewer.registerCustomOperator(this._transformOp);

    this.setEventListeners();
  }
  loadModel(modelName: string, viewer: Communicator.WebViewer) {
    const modelNum = viewer.model.getNodeChildren(viewer.model.getAbsoluteRootNode()).length;
    const nodeName = "Model-" + (modelNum + 1);
    const modelNodeId = viewer.model.createNode(null, nodeName);
    this._modelList.push(modelName);
    viewer.model.loadSubtreeFromScsFile(modelNodeId, "/assets/data/" + modelName + ".scs")
      .then(() => {
        let loadMatrix = viewer.model.getNodeNetMatrix(modelNodeId);
        viewer.model.getNodeRealBounding(modelNodeId)
          .then((box: Communicator.Box) => {
            loadMatrix.setTranslationComponent(box.min.x * -1, box.min.y * -1, box.min.z * -1);
            viewer.model.setNodeMatrix(modelNodeId, loadMatrix, true);
          });
      });
  }

  setEventListeners() {
    // We will use the main viewer to gather scene information
    let mainViewer = this._viewerList[0];
    // this.arrangeButton?.nativeElement.click(()=>{
    //   console.log("arrange");
    // })
    const openModelBtton :HTMLElement=document.getElementById("open-model-button") as HTMLElement
    openModelBtton.onclick = () => {
      // Proxy to override the default behavior of file input type
      const fileInput1:any= document.getElementById('file-input');
      fileInput1.click();
      console.log("open");
  };
  const fileInput:HTMLElement=document.getElementById("file-input") as HTMLElement ;
  fileInput.onchange = (e:any) => {
    console.log("tesst");
      // Once a file has been selected by the user, use the file information to 
      // gather the associated relevant data like thumbnails
      let fileChoice = e.target.value;
      let fileName = fileChoice.replace(/^.*[\\\/]/, '');
      let modelThumbnail = document.createElement('a');
      let modelName = fileName.split(".", 1)[0];
      modelThumbnail.id = modelName;
      modelThumbnail.href = "";
      modelThumbnail.className = "model-thumb";
      modelThumbnail.setAttribute("model", modelName);
      let imgPath = "/assets/data/thumbnails/" + modelName + ".png";
      // Check to see if the selected model has a corresponding thumbnail made
      fetch(imgPath)
          .then((resp) => {
          if (resp.ok) {
              let modelImg = document.createElement('img');
              modelImg.src = imgPath;
              modelThumbnail.appendChild(modelImg);
              console.log("true");
          }
          else {
              modelThumbnail.innerHTML = modelName;
              console.log("false");
              console.log("No Image for this Model was found.");
          }
      });
      const modelScroller:HTMLElement=document.getElementById("models-scroller") as HTMLElement;
      modelScroller.appendChild(modelThumbnail);
      const thumbnailElements:any = document.getElementsByClassName("model-thumb");
      // Now update the event callbacks for the thumbnails
      for (let thumbnail of thumbnailElements) {
          let thumbnailElement = thumbnail;
          thumbnailElement.onclick = (e:any) => {
            console.log("loadModel");
              e.preventDefault();
              let elem = e.currentTarget;
              let modelToLoad = elem.getAttribute("model");
              // Load the model into the scene when clicked
              this._viewerList.map((viewer) => {
                  this.loadModel(modelToLoad, viewer);
              });
          };
      }
      ;
  };
  } // End setting event handlers 
  arrangeButton() {
    this._transformOp.arrangeOnPlane(this._printSurfaces[0].getDimensions().planeSize)
      .then((results) => this._viewSync.syncNodeTransforms());
  }
  handleButton() {
    let mainViewer = this._viewerList[0];
    console.log("handleButton")
    let nodeIds: number[] = [];
    const selectionItems = mainViewer.selectionManager.getResults();
    selectionItems.map((selectionItem) => {
      nodeIds.push(selectionItem.getNodeId());
    });
    // Ensure the user has made a selection before trying to add handles
    if (selectionItems.length !== 0) {
      this._transformOp.addHandles(nodeIds);
      this._transformOp.showHandles();
      mainViewer.operatorManager.push(this._transformHandle);
    }
    else {
      alert("Try Again. Please first select nodes from the model to transform!");
    }
  }
  instanceButton() {
    let mainViewer = this._viewerList[0];
    let elem: HTMLElement = document.getElementById("instance-button") as HTMLElement;
    if (elem.innerHTML === "Instance Part") {
      // Gather nodes to be instanced
      let nodeIds: number[] = [];
      const selectionItems = mainViewer.selectionManager.getResults();
      selectionItems.map((selection) => {
        nodeIds.push(selection.getNodeId());
      });
      if (selectionItems.length !== 0) {
        elem.innerHTML = "Disable Instancing";
        this._instanceOp.setNodesToInstance(nodeIds);
        // Remove the selection operator from the stack while instancing
        mainViewer.operatorManager.push(this._instanceHandle);
        mainViewer.operatorManager.remove(Communicator.OperatorId.Select);
        mainViewer.selectionManager.setHighlightNodeSelection(false);
        mainViewer.selectionManager.setHighlightFaceElementSelection(false);
        mainViewer.selectionManager.setPickTolerance(0);
      }
      else {
        alert("Try Again. Please first select nodes from the model to instance!")
      }
    }
    else {
      elem.innerHTML = "Instance Part";
      // Remove the instance operator from the stack and reenable selection and highlighting
      mainViewer.selectionManager.clear();
      mainViewer.operatorManager.remove(this._instanceHandle);
      mainViewer.operatorManager.push(Communicator.OperatorId.Select);
      mainViewer.selectionManager.setHighlightNodeSelection(true);
      mainViewer.selectionManager.setHighlightFaceElementSelection(true);
    }
  }
}
