/*
Baseline editor
a javascript based baseline segmentation editor,
requires paper.js and colorThief is optional.

Usage:
var segmenter = new Segmenter(img, options);
segmenter.load([{baseline: [[0,0],[10,10]], mask: null}]);

Options:
  lengthTreshold=15
  mainColor
  secondaryColor
  lengthTreshold=15,
  delayInit=false,
  deletePointBtn=null,
  deleteSelectionBtn=null,
  toggleMasksBtn=null,
  splitBtn=null,
  mergeBtn=null,
  upperLineHeight=15,
  lowerLineHeight=5

*/
var id = 0;
function generateUniqueId() { return id++; };

function polyEq(poly1, poly2) {
    return poly1 && poly2 && poly1.length === poly2.length && poly1.every((pt, index) => pt[0] === poly2[index][0] && pt[1] === poly2[index][1]);
}

function isRightClick(event) {
    return event.which === 3 || event.button === 2;
}

class SegmenterRegion {
    constructor(polygon, context, segmenter_) {
        this.id = generateUniqueId();
        this.segmenter = segmenter_;
        this.polygon = polygon;
        this.context = context;
        this.selected = false;
        this.polygonPath = new Path({
            closed: true,
            opacity: 0.2,
            strokeColor: this.segmenter.mainColor,
            strokeWidth: 1,
            fillColor: this.segmenter.mode == 'regions' ? this.segmenter.secondaryColor : null,
            // selectedColor: this.segmenter.secondaryColor,
            visible: true,
            segments: this.polygon
        });
    }

    select() {
        if (this.selected) return;
        this.polygonPath.selected = true;
        this.polygonPath.bringToFront();
        this.segmenter.addToSelection(this);
        this.selected = true;
    }

    unselect() {
        if (!this.selected) return;
        this.polygonPath.selected = false;
        this.segmenter.removeFromSelection(this);
        this.selected = false;
    }

    toggleSelect() {
        if (this.selected) this.unselect();
        else this.select();
    }
    
    updateDataFromCanvas() {
        this.polygon = this.polygonPath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
    }
    
    remove() {
        this.polygonPath.remove();
    }

    delete() {
        this.unselect();
        this.remove();
        this.segmenter.trigger('baseline-editor:delete-region', this);
    }
}

class SegmenterLine {
    constructor(order, baseline, mask, textDirection, context, segmenter_) {
        this.id = generateUniqueId();
        this.order = order;
        this.segmenter = segmenter_;
        this.mask = mask;
        this.context = context;
        this.selected = false;
        this.textDirection = textDirection;
        this.directionHint = null;
        
        if (baseline) {
            if(baseline.segments) {  // already a paperjs.Path
                this.baselinePath = baseline;
            } else {
                this.baseline = baseline.map(pt=>[Math.round(pt[0]), Math.round(pt[1])]);
                this.baselinePath = new Path({
                    strokeColor: segmenter_.mainColor,
                    strokeWidth: Math.max(3, 7/this.segmenter.scale),
                    strokeCap: 'butt',
                    selectedColor: 'black',
                    opacity: 0.5,
                    segments: this.baseline,
                    selected: false,
                    visible: true
                });
            }
        } else {
            // No baseline !
            this.baseline = null;
        }

        if (this.mask) {
            this.makeMaskPath();
        } else {
            this.maskPath = null;
        }
        
        this.refresh();
    }

    fixOrdering() {
        // if (this.baselinePath) this.baselinePath.reorient(true, false);
        // if (this.maskPath) this.maskPath.reorient(true, false);
        if (this.baselinePath && this.baselinePath.firstSegment.point.x > this.baselinePath.lastSegment.point.x) {
            this.baselinePath.reverse();
        }
    }
    
    refresh() {
        this.fixOrdering();
        this.setLineHeight();
        this.showOrdering();
        this.showDirection();
    }
    
    makeMaskPath() {
        this.maskPath = new Path({
            closed: true,
            opacity: 0.1,
            fillColor: this.segmenter.mainColor,
            selectedColor: this.segmenter.secondaryColor,
            visible: (this.baseline && this.baseline.length==0) || this.segmenter.showMasks,
            segments: this.mask
        });
    }
    
    createPolygonEdgeForBaselineSegment(segment) {
        let pt = segment.point;
        let vector = segment.path.getNormalAt(segment.index);
        if (Math.sin(vector.angle/180*Math.PI) > 0) vector = vector.rotate(180);  // right to left
        
        vector.length = this.segmenter.upperLineHeight;
        let up = this.maskPath.insert(segment.index, pt.add(vector));
        
        vector.length = this.segmenter.lowerLineHeight;
        let low = this.maskPath.insert(this.maskPath.segments.length-segment.index, pt.subtract(vector));
        return [up, low];
    }
    deletePolygonsEdgeForBaselineSegment(segment) {
        this.maskPath.removeSegment(this.maskPath.segments.length-segment.index-1);
        this.maskPath.removeSegment(segment.index);
    }
    
    createMask() {
        for (let i in this.baselinePath.segments) {
            this.createPolygonEdgeForBaselineSegment(this.baselinePath.segments[i]);
        }
    }
    
    dragPolyEdges(j, delta) {
        let poly = this.maskPath;
        if (poly && poly.segments.length) {
            let top = poly.segments[this.baselinePath.segments.length*2 - j - 1].point;
            let bottom = poly.segments[j].point;
            this.segmenter.movePointInView(top, delta);
            this.segmenter.movePointInView(bottom, delta);
        }
    }
    
    select() {
        if (this.selected) return;
        if (this.maskPath && this.maskPath.visible) {
            this.maskPath.selected = true;
            this.maskPath.bringToFront();
        }
        if (this.baselinePath) {
            this.baselinePath.selected = true;
            this.baselinePath.bringToFront();
            this.baselinePath.strokeColor = this.segmenter.secondaryColor;
        }
        this.segmenter.addToSelection(this);
        this.selected = true;
        if (this.orderDisplay) this.orderDisplay.bringToFront();
    }

    unselect() {
        if (!this.selected) return;
        // also unselects any selected segments
        if (this.maskPath) {
            this.maskPath.selected = false;
            for (let i=0; i<this.maskPath.segments.length; i++) {
                if (this.maskPath.segments[i].point.selected) {
                    this.segmenter.removeFromSelection(this.maskPath.segments[i]);
                }
            }
        }
        if (this.baselinePath) {
            this.baselinePath.selected = false;
            this.baselinePath.strokeColor = this.segmenter.mainColor;
            for (let i=0; i<this.baselinePath.segments; i++) {
                this.segmenter.removeFromSelection(this.baselinePath.segments[i]); 
            }
        }
        this.segmenter.removeFromSelection(this);
        this.selected = false;
    }
    
    toggleSelect() {
        if (this.selected) this.unselect();
        else this.select();
    }
    
    update(baseline, mask) {
        if (baseline && baseline.length) {
            this.baseline = baseline;
            this.baselinePath.removeSegments();
            this.baselinePath.addSegments(baseline);
            this.segmenter.bindLineEvents(this);
        }
        if (mask && mask.length) {
            if (! this.maskPath) {
                this.makeMaskPath();
            }
            this.mask = mask;
            this.maskPath.removeSegments();
            this.maskPath.addSegments(mask);
            this.segmenter.bindMaskEvents(this);
        }
        this.setLineHeight();
    }
    
    updateDataFromCanvas() {
        let previous = {baseline: this.baseline, mask: this.mask};
        if (this.baselinePath) {
            this.baselinePath.reduce();  // removes unecessary segments
            this.baseline = this.baselinePath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
        }
        if (this.maskPath) {
            this.maskPath.reduce();
            this.mask = this.maskPath.segments.map(s => [Math.round(s.point.x), Math.round(s.point.y)]);
        }
        if (!polyEq(previous.baseline, this.baseline) || !polyEq(previous.mask, this.mask)) {
            this.segmenter.trigger('baseline-editor:update-line', {line: this, previous:previous});
        }
    }
    
    extend(point) {
        return this.baselinePath.add(point);
    }
    
    remove() {
        this.unselect();
        if(this.baselinePath) this.baselinePath.remove();
        if(this.maskPath) this.maskPath.remove();
        if(this.directionHint) this.directionHint.remove();
        if(this.orderDisplay) this.orderDisplay.remove();
        this.segmenter.lines.splice(this.segmenter.lines.findIndex(e => e.id == this.id), 1);
    }
    
    delete() {
        this.unselect();
        this.remove();
        this.segmenter.trigger('baseline-editor:delete-line', this);
    }

    reverse() {
        if (this.baselinePath) {
            let previous = {baseline: this.baseline, mask: this.mask};
            this.baselinePath.reverse();
            this.refresh();
            this.updateDataFromCanvas();
        }
    }

    showOrdering() {
        let anchorPath = this.baselinePath?this.baselinePath:this.maskPath;
        let anchor = (this.textDirection == 'lr' ?
                      anchorPath.firstSegment.point :
                      anchorPath.lastSegment.point);
        let offset = 10, circle, text;
        if (!this.orderDisplay) {
            circle = new Shape.Circle(anchor, offset);
            circle.fillColor = 'yellow';
            circle.strokeColor = 'black';
            text = new PointText(anchor);
            text.fillColor = 'black';
            text.fontSize = offset;
            text.fontWeight = 'bold';
            text.justification = 'center';
            text.content = parseInt(this.order)+1;
            this.orderDisplay = new Group({
                children: [circle, text]
            });
            this.orderDisplay.scale(1/this.segmenter.scale);
            // for some reason we need to reposition it after scaling
            text.position = anchor;
        } else {
            let circle = this.orderDisplay.children[0], text = this.orderDisplay.children[1];
            circle.position = anchor;
            text.position = anchor;
        }
        this.orderDisplay.visible = this.segmenter.showLineNumbers;
        this.orderDisplay.bringToFront();
    }

    showDirection() {
        if (this.baselinePath && this.baselinePath.segments.length > 1) {
            if (this.directionHint === null) {
                this.directionHint =  new Path({
                    visible: true,
                    strokeWidth: Math.max(2, 4 / this.segmenter.scale),
                    opacity: 0.5,
                    strokeColor: this.segmenter.mainColor
                });
            }
            let start;
            if (this.textDirection == 'lr') {
                start = this.baselinePath.firstSegment.point;
            } else {
                start = this.baselinePath.lastSegment.point;
            }
            let vector = this.baselinePath.getNormalAt(0);
            if (vector) {
                if (!this.lineHeight) this.setLineHeight();
                vector.length = this.lineHeight / 3;
                this.directionHint.sendToBack();
                this.directionHint.segments = [start.subtract(vector), start.add(vector)];
            }
        }
    }
    
    setLineHeight() {
        if (this.baselinePath) {
            if (this.maskPath) {
                // area implementation
                this.lineHeight = Math.round(Math.abs(this.maskPath.area) / this.baselinePath.length);
            } else if (this.segmenter.lines.length >= 2) {
                // distance avg implementation
                this.lineHeight = this.segmenter.getAverageLineHeight();
            }
        }
    }
}

class Segmenter {
    constructor(image, {lengthTreshold=10,
                        // scale = real coordinates to image coordinates
                        // for example if drawing on a 1000px wide thumbnail for a 'real' 3000px wide image,
                        // the scale would be 1/3, the container (DOM) width is irrelevant here.
                        scale=1,
                        delayInit=false,
                        deletePointBtn=null,
                        deleteSelectionBtn=null,
                        toggleMasksBtn=null,
                        toggleRegionModeBtn=null,
                        toggleOrderingBtn=null,
                        splitBtn=null,
                        mergeBtn=null,
                        reverseBtn=null,
                        disableBindings=false,
                        mainColor=null,
                        secondaryColor=null,
                        upperLineHeight=20,
                        lowerLineHeight=10,
                        // when creating a line, which direction should it take.
                        defaultTextDirection='lr',
                        // field to store and reuse in output from loaded data
                        // can be set to null to disable behavior
                        idField='id'
                       } = {}) {
        this.img = image;
        this.mode = 'lines'; // | 'regions'
        this.lines = [];
        this.regions = [];
        this.selection = {lines:[], segments:[], regions:[]};
        this.defaultTextDirection = defaultTextDirection;
        
        this.scale = scale;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = 0;
        this.canvas.style.left = 0;
        this.canvas.style.width = this.img.width;
        this.canvas.style.height = this.img.height;
        // this.canvas.className += 'resize';

        this.idField = idField;
        this.disableBindings = disableBindings;
        
        // create a dummy tag for event bindings
        this.events = document.createElement('div');
        this.events.setAttribute('id', 'baseline-editor-events');
        document.body.appendChild(this.events);
        
        // this.raster = null;
        // insert after..
        this.img.parentNode.insertBefore(this.canvas, this.img);
        this.mainColor = null;
        this.secondaryColor = null;
        this.upperLineHeight = upperLineHeight;
        this.lowerLineHeight = lowerLineHeight;

        // the minimal length in pixels below which the line will be removed automatically
        this.lengthThreshold = lengthTreshold; 
        this.showMasks = false;
        this.showLineNumbers = false;

        this.selecting = null;
        this.spliting = false;
        this.copy = null;
        
        this.deletePointBtn = deletePointBtn || document.getElementById('delete-point');
        // this.deletePointBtn.style.zIndex = 3;
        this.toggleMasksBtn = toggleMasksBtn || document.getElementById('toggle-masks');
        this.splitBtn = splitBtn || document.getElementById('split-lines');
        this.toggleOrderingBtn = toggleOrderingBtn || document.querySelector('button#toggle-order');
        this.toggleRegionModeBtn = toggleRegionModeBtn || document.getElementById('toggle-regions');
        this.deleteSelectionBtn = deleteSelectionBtn || document.getElementById('delete-selection');
        this.mergeBtn = mergeBtn || document.getElementById('merge-selection');
        this.reverseBtn = reverseBtn || document.getElementById('reverse-selection');
        // create a menu for the context buttons
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'context-menu';
        this.contextMenu.style.position = 'fixed';
        this.contextMenu.style.display = 'none';
        this.contextMenu.style.zIndex = 3;
        this.contextMenu.style.border = '1px solid grey';
        this.contextMenu.style.borderRadius = '5px';
        this.deleteSelectionBtn.parentNode.insertBefore(this.contextMenu, this.deleteSelectionBtn);
        if (this.mergeBtn) this.contextMenu.appendChild(this.mergeBtn);

        // doesn't do anything anymore..
        // if (this.reverseBtn) this.contextMenu.appendChild(this.reverseBtn);
        if (this.deletePointBtn) this.contextMenu.appendChild(this.deletePointBtn);
        if (this.deleteSelectionBtn) this.contextMenu.appendChild(this.deleteSelectionBtn);
        
        this.bindButtons();
        
        // init paperjs
        if (!delayInit) {
            this.init();
        }
    }

    reset() {
        this.empty();
    }
    
    deleteSelectedLines() {
        for (let i=this.selection.lines.length-1; i >= 0; i--) {    
            this.selection.lines[i].delete();
        }
        this.showContextMenu();
    }
    deleteSelectedSegments() {
        for (let i=this.selection.segments.length-1; i >= 0; i--) {
            let segment = this.selection.segments[i];
            if (segment.path && (
                (segment.path.closed && segment.path.segments.length > 3) ||
                    segment.path.segments.length > 2)) {
                this.selection.segments[i].remove();
                this.selection.segments.pop();
            }
        }
        
        // using the fact that selecting a segment also selects its line
        for (let i=0; i < this.selection.lines.length; i++) {    
            this.selection.lines[i].updateDataFromCanvas();
        }
        this.showContextMenu();
    }
    
    bindButtons() {
        this.deleteSelectionBtn.addEventListener('click', function(event) {
            this.deleteSelectedLines();
        }.bind(this));

        this.deletePointBtn.addEventListener('click', function() {
            this.deleteSelectedSegments();
        }.bind(this));

        if (this.toggleRegionModeBtn) this.toggleRegionModeBtn.addEventListener('click', function(event) {
            this.toggleRegionMode();
        }.bind(this));
        
        if (this.toggleMasksBtn) {
            this.toggleMasksBtn.addEventListener('click', function(event) {
                this.toggleMasks();
            }.bind(this));
        }

        if (this.splitBtn) this.splitBtn.addEventListener('click', function(event) {
            this.spliting = !this.spliting;
            this.splitBtn.classList.toggle('btn-info');
            this.splitBtn.classList.toggle('btn-success');
            this.setCursor();
        }.bind(this));
        if (this.mergeBtn) this.mergeBtn.addEventListener('click', function(event) {
            this.mergeSelection();
        }.bind(this));
        if (this.reverseBtn) this.reverseBtn.addEventListener('click', function(event) {
            this.reverseSelection();
        }.bind(this));

        if (this.toggleOrderingBtn) this.toggleOrderingBtn.addEventListener('click', function(ev) {
            this.toggleOrdering();
        }.bind(this));
        
        document.addEventListener('keyup', function(event) {
            if (this.disableBindings) return;
            if (event.keyCode == 27) { // escape
                this.purgeSelection();
            } else if (event.keyCode == 46) { // supr
                if (event.ctrlKey) {
                    this.deleteSelectedSegments();
                } else {
                    this.deleteSelectedLines();
                }
            } else if (event.keyCode == 67) { // C
                this.spliting = !this.spliting;
                this.splitBtn.classList.toggle('btn-info');
                this.splitBtn.classList.toggle('btn-success');
                this.setCursor();
            } else if (event.keyCode == 77) { // M
                this.toggleMasks();
            } else if (event.keyCode == 82) { // R
                this.toggleRegionMode();
            } else if (event.keyCode == 65 && event.ctrlKey) { // Ctrl+A
                event.preventDefault();
                event.stopPropagation();
                // select all
                if (this.mode == 'lines') {
                    for (let i in this.lines) this.lines[i].select();
                } else if (this.mode == 'regions') {
                    for (let i in this.regions) this.regions[i].select();
                }
                return false;
            }
            
            // } else if (event.keyCode == 67 && event.ctrlKey) {  // Ctrl+C
            //     this.copy = this.selection.map(a => [
            //         a.baselinePath.exportJSON({asString: false})[1].segments,
            //         a.maskPath.exportJSON({asString: false})[1].segments
            //     ]);
            // } else if (event.keyCode == 86 && event.ctrlKey) {  // Ctrl+V
            //     if (this.copy && this.copy.length) {
            //         var vector, lastPt, beforeLastPt;
            //         if (this.lines.length >= 2) {
            //             lastPt = this.lines[this.lines.length-1].baselinePath.segments[0].point;
            //             beforeLastPt = this.lines[this.lines.length-2].baselinePath.segments[0].point;
            //             vector = new Point(lastPt - beforeLastPt);
            //         } else {
            //             vector = { x: 0, y: 30 };
            //         }
                        
            //         for (let i in this.copy) {
            //             let newLine = this.createLine(this.copy[i][0], this.copy[i][1]);
            //             newLine.changed = true;
            //             if (lastPt) {
            //                 let newLastPt = this.lines[this.lines.length-1].baselinePath.segments[0].point;
            //                 vector = new Point(
            //                     (newLastPt.x - newLine.baseline[0][0]) + vector.x,
            //                     (newLastPt.y - newLine.baseline[0][1]) + vector.y
            //                 );
            //             }
            //             newLine.baselinePath.translate(vector);
            //             newLine.maskPath.translate(vector);
            //         }
            //     }
            
        }.bind(this));
        
        document.addEventListener('mousedown', function(event) {
            if (event.target != this.canvas && !this.contextMenu.contains(event.target)) {
                this.purgeSelection();
            }
        }.bind(this));
    }
    
    init() {
        paper.settings.handleSize = 10;
        paper.settings.hitTolerance = 0;  // Note: doesn't work?
        paper.install(window);
        paper.setup(this.canvas);
        this.refresh();
        
        // make sure we capture clicks before the img
        this.canvas.style.zIndex = this.img.style.zIndex + 1;
        
        var tool = new Tool();
        this.setColors(this.img);
        this.setCursor();

        // this.raster = new Raster(this.img);  // Note: this seems to slow down everything significantly
        // this.raster.position = view.center;
        // this.img.style.display = 'hidden';
        
        // context follows top right, width can only be calculated once shown
        this.contextMenu.style.top = (this.img.getBoundingClientRect().top+10)+'px';
        this.contextMenu.style.margin = '10px';
        
        tool.onMouseDown = this.onMouseDown.bind(this);
        
        this.tool = tool;
        this.tool.activate();
        return tool;
    }
    
    createLine(order, baseline, mask, context, postponeEvents) {
        if (this.idField) {
            if (context === undefined || context === null) {
                context = {};
            }
            if (context[this.idField] === undefined) {
                // make sure the client receives a value for its id, even if it's null for a new line
                context[this.idField] = null;
            }
        }
        
        if (!order) order = parseInt(this.getMaxOrder()) + 1;
        var line = new SegmenterLine(order, baseline, mask, this.defaultTextDirection, context, this);
        line.fixOrdering();
        if (!postponeEvents) {
            this.bindLineEvents(line);
            this.bindMaskEvents(line);
        }
        this.lines.push(line);
        return line;
    }
    
    finishLine(line) {
        // the line direction of the baseline should always be from left to right
        // the text direction can be opposite of that (rtl).
        line.fixOrdering();
        if (line.baselinePath.length < this.lengthThreshold) {
            line.remove();
        } else {
            this.bindLineEvents(line);
            line.updateDataFromCanvas();
        }
        line.setLineHeight();
        this.resetToolEvents();  // unregistering
    }

    createRegion(polygon, context, postponeEvents) {
        if (this.idField) {
            if (context === undefined || context === null) {
                context = {};
            }
            if (context[this.idField] === undefined) {
                // make sure the client receives a value for its id, even if it's null for a new region
                context[this.idField] = null;
            }
        }
        var region = new SegmenterRegion(polygon, context, this);
        if (!postponeEvents) this.bindRegionEvents(region);
        this.regions.push(region);
        return region;
    }

    finishRegion(region) {
        this.bindRegionEvents(region);
        this.resetToolEvents();
        region.updateDataFromCanvas();
        this.trigger('baseline-editor:update', {regions: [region]});
    }

    bindRegionEvents(region) {
        region.polygonPath.onMouseDown = function(event) {
            if (event.event.ctrlKey ||
                this.selecting ||
                isRightClick(event.event) ||
                this.mode != 'regions') return;
            this.selecting = region;
            
            var dragging = region.polygonPath.getNearestLocation(event.point).segment;
            this.tool.onMouseDrag = function(event) {
                if (!event.event.shiftKey) {
                    this.movePointInView(dragging.point, event.delta);
                }
            }.bind(this);

            var hit = region.polygonPath.hitTest(event.point, {
	            segments: true,
	            tolerance: 20
            });
            if (hit && hit.type=='segment') {
                if (this.selection.segments.findIndex(
                    e => e.path.id == hit.segment.path.id && e.index == hit.segment.index) == -1) {
                    this.addToSelection(hit.segment);
                } else {
                    this.removeFromSelection(hit.segment);
                }
            }
            this.tool.onMouseUp = function(event) {
                this.resetToolEvents();
                let changes = this.updateRegionsFromCanvas();
                if (changes) this.trigger('baseline-editor:update', {regions: [region]});
            }.bind(this);
        }.bind(this);

        region.polygonPath.onDoubleClick = function(event) {
            // Creates a new control point in the region
            if (event.event.ctrlKey || this.mode != 'regions') return;
            let location = region.polygonPath.getNearestLocation(event.point);
            let newSegment = region.polygonPath.insert(location.index+1, location);
        }.bind(this);
    }
    
    bindLineEvents(line) {
        if (line.baselinePath) {
            line.baselinePath.onMouseDown = function(event) {
                if (event.event.ctrlKey ||
                    isRightClick(event.event) ||
                    this.mode != 'lines' ||
                    this.selecting) return;
                this.selecting = line;
                var hit = line.baselinePath.hitTest(event.point, {
	                segments: true,
	                tolerance: 20
                });
                
                if (hit && hit.type=='segment') {
                    if (this.selection.segments.findIndex(
                        e => e.path && e.path.id == hit.segment.path.id && e.index == hit.segment.index) == -1) {
                        this.addToSelection(hit.segment);
                    } else {
                        this.removeFromSelection(hit.segment);
                    }
                }
                var dragging = line.baselinePath.getNearestLocation(event.point).segment;
                this.tool.onMouseDrag = function(event) {
                    if (!event.event.shiftKey) {
                        this.movePointInView(dragging.point, event.delta);
                        this.setCursor('move');
                        line.refresh();
                        // line.dragPolyEdges(dragging.index, event.delta);
                    }
                }.bind(this);
                
                this.tool.onMouseUp = function(event) {
                    this.resetToolEvents();
                    line.updateDataFromCanvas();
                }.bind(this);
                
            }.bind(this);

            line.baselinePath.onDoubleClick = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                let location = line.baselinePath.getNearestLocation(event.point);
                let newSegment = line.baselinePath.insert(location.index+1, location);
                // line.baselinePath.smooth({ type: 'catmull-rom', 'factor': 0.2 });
                // line.createPolygonEdgeForBaselineSegment(newSegment);
            }.bind(this);
            
            line.baselinePath.onMouseMove = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                if (line.selected) this.setCursor('grab');
                else this.setCursor('pointer');
                var hit = line.baselinePath.hitTest(event.point, {
	                segments: true,
	                tolerance: 5
                });
                if (hit && hit.type=='segment') {
                    this.setCursor('pointer');
                }
            }.bind(this);
            
            line.baselinePath.onMouseLeave = function(event) {
                this.setCursor();
            }.bind(this);
            
            // line.baselinePath.onMouseDrag = function(event) {
            //     if (event.event.ctrlKey || this.mode != 'lines') return;
            //     this.setCursor('move');
            // }.bind(this);
        }
    }
    
    bindMaskEvents(line) {   
        // same for the masks
        if (line.maskPath) {
            line.maskPath.onMouseDown = function(event) {
                if (event.event.ctrlKey ||
                    isRightClick(event.event) ||
                    this.selecting ||
                    this.mode != 'lines') return;
                this.selecting = line;

                var hit = line.maskPath.hitTest(event.point, {
	                segments: true,
	                tolerance: 20
                });
                if (hit && hit.type=='segment') {
                    if (this.selection.segments.findIndex(
                        e => e.path && e.path.id == hit.segment.path.id && e.index == hit.segment.index) == -1) {
                        this.addToSelection(hit.segment);
                    } else {
                        this.removeFromSelection(hit.segment);
                    }
                }
                var dragging = line.maskPath.getNearestLocation(event.point).segment;
                this.tool.onMouseDrag = function(event) {
                    if (event.event.ctrlKey) {
                        this.multiMove(event);
                    } else  if (!event.event.shiftKey) {
                        this.movePointInView(dragging.point, event.delta);
                    }
                }.bind(this);
                
                this.tool.onMouseUp = function(event) {
                    this.resetToolEvents();
                    line.updateDataFromCanvas();
                }.bind(this);
            }.bind(this);
            line.maskPath.onMouseMove = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                if (line.selected) this.setCursor('grab');
                else this.setCursor('pointer');
            }.bind(this);
            line.maskPath.onMouseLeave = function(event) {
                this.setCursor();
            }.bind(this);
            line.maskPath.onMouseDrag = function(event) {
                if (event.event.ctrlKey || this.mode != 'lines') return;
                this.setCursor('move');
            }.bind(this);
        }        
    }
    
    resetToolEvents() {
        this.tool.onMouseDown = this.onMouseDown.bind(this);
        this.tool.onMouseDrag = this.onMouseDrag.bind(this);
        this.tool.onMouseMove = null;
        this.tool.onMouseUp = null;
    }

    multiMove(event) {
        var delta = event.delta;
        if (this.selection.segments.length) {
            for (let i in this.selection.segments) {
                this.movePointInView(this.selection.segments[i].point, delta);
                this.movePointInView(this.selection.segments[i].point, delta);
            }
            for (let i in this.selection.lines) {
                this.selection.lines[i].refresh();
            }
        } else {
            for (let i in this.selection.lines) {
                let l = this.selection.lines[i];
                if(l.baselinePath) this.movePointInView(l.baselinePath.position, delta);
                if(l.maskPath) this.movePointInView(l.maskPath.position, delta);
                l.refresh();
            }
        }
    }
    
    onMouseDrag(event) {
        if (event.event.ctrlKey) {
            this.multiMove(event);
            this.tool.onMouseUp = function(event) {
                this.resetToolEvents();
                for (let i in this.selection.lines) {
                    this.selection.lines[i].updateDataFromCanvas();
                }
            }.bind(this);
        }
    }
    
    onMouseDown(event) {
        if (isRightClick(event.event)) return;
        
        if (this.selecting) {
            // selection
            if (event.event.shiftKey) {
                this.selecting.toggleSelect();
                this.startLassoSelection(event);
            } else {
                this.selecting.select();
                this.purgeSelection(this.selecting);
            }
            this.trigger('baseline-editor:selection', {target: this.selecting, selection: this.selection});
            this.selecting = null;
        } else {
            if (event.event.ctrlKey) return;
            if (this.spliting) {
                this.startCuter(event);
            } else if (this.mode == 'regions') {
                this.startNewRegion(event);
            } else if (event.event.shiftKey) {
                // lasso selection tool
                this.startLassoSelection(event);
            } else if (this.hasSelection()) {
                this.purgeSelection();
            } else {  // mode = 'lines'
                // create a new line
                this.startNewLine(event);
            }
        }
    }

    startNewLine(event) {
        this.purgeSelection();
        let newLine = this.createLine(null, [[event.point.x, event.point.y]], null, null, true);
        let point = newLine.extend(event.point).point;  // the point that we move around

        // adds all the events bindings 
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                newLine.remove();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        
        this.tool.onMouseDown = function(event) {
            if (isRightClick(event.event)) {
                point = newLine.extend(event.point).point;
            } else {
                this.finishLine(newLine);
                newLine.unselect();
                document.removeEventListener('keyup', onCancel);
            }
        }.bind(this);
        
        this.tool.onMouseMove = function(event) {
            this.tool.onMouseDrag = null; // manually disable free drawing now to avoid having both
            // follow the mouse cursor with the last created point
            this.movePointInView(point, event.delta);
            newLine.showDirection();
            newLine.select();  // select it to make drawing more precise
        }.bind(this);
        this.tool.onMouseDrag = function(event) {
            // adding points to current line
            this.tool.onMouseMove = null; // we don't want the first point to move around
            point = newLine.extend(event.point).point;
            this.tool.onMouseUp = function(event) {
                newLine.baselinePath.simplify(10);
                this.finishLine(newLine);
                document.removeEventListener('keyup', onCancel);
            }.bind(this);
        }.bind(this);
        document.addEventListener('keyup', onCancel, {once: true});
    }
    
    startNewRegion(event) {
        this.purgeSelection();
        var originPoint = event.point;
        let newRegion = this.createRegion([
            [event.point.x, event.point.y],
            [event.point.x, event.point.y+1],
            [event.point.x+1, event.point.y+1],
            [event.point.x+1, event.point.y]
        ], null);
        
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                newRegion.remove();
                this.resetToolEvents();
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        let onRegionDraw = function(event) {
            newRegion.polygonPath.segments[1].point.y = event.point.y;
            newRegion.polygonPath.segments[2].point.x = event.point.x;
            newRegion.polygonPath.segments[2].point.y = event.point.y;
            newRegion.polygonPath.segments[3].point.x = event.point.x;
        }.bind(this);
        
        this.tool.onMouseDown = function(event) {
            this.finishRegion(newRegion);
            document.removeEventListener('keyup', onCancel);
        }.bind(this);
        this.tool.onMouseMove = onRegionDraw;
        this.tool.onMouseDrag = function(event) {
            this.tool.onMouseUp = function(event) {
                this.finishRegion(newRegion);
                document.removeEventListener('keyup', onCancel);
            }.bind(this);
            onRegionDraw(event);
        }.bind(this);
        document.addEventListener('keyup', onCancel, {once: true});
    }
    
    startCuter(event) {
        // rectangle cutter
        let clip = this.makeSelectionRectangle(event);
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                clip.remove();
                this.resetToolEvents();
                document.removeEventListener('mouseup', finishCut);
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        let finishCut = function(event) {
            this.splitByPath(clip);
            clip.remove();
            
            this.resetToolEvents();
            document.removeEventListener('mouseUp', finishCut);
            document.removeEventListener('keyup', onCancel);
        }.bind(this);
        
        this.tool.onMouseDrag = function(event) {
            this.updateSelectionRectangle(clip, event);
            this.splitHelper(clip, event);
        }.bind(this);
        document.addEventListener('mouseup', finishCut, {once: true});
        document.addEventListener('keyup', onCancel, {once: true});
    }
    
    startLassoSelection(event) {
        let clip = this.makeSelectionRectangle(event);
        let onCancel = function(event) {
            if (event.keyCode == 27) {  // escape
                clip.remove();
                this.purgeSelection();
                this.resetToolEvents();
                document.removeEventListener('mouseup', finishSelection);
                document.removeEventListener('keyup', onCancel);
                return false;
            }
            return null;
        }.bind(this);
        let finishSelection = function(event) {
            clip.remove();
            this.resetToolEvents();
            document.removeEventListener('mouseup', finishSelection);
            document.removeEventListener('keyup', onCancel);
            this.trigger('baseline-editor:selection', {target: this.selecting, selection: this.selection});
        }.bind(this);

        let allLines = this.selection.lines.length && this.selection.lines || this.lines;
        let tmpSelected = [];
        this.tool.onMouseDrag = function(event) {
            this.updateSelectionRectangle(clip, event);
            this.lassoSelection(clip, allLines, tmpSelected);
        }.bind(this);

        document.addEventListener('mouseup', finishSelection);
        document.addEventListener('keyup', onCancel);
    }
    
    movePointInView(point, delta) {
        point.x += delta.x;
        point.y += delta.y;
        if (point.x < 0) point.x = 0;
        if (point.x > this.img.naturalWidth/this.scale) point.x = this.img.naturalWidth/this.scale;
        if (point.y < 0) point.y = 0;
        if (point.y > this.img.naturalHeight/this.scale) point.y = this.img.naturalHeight/this.scale;
    }
    
    empty() {
        for (let i=this.lines.length-1; i>=0; i--) { this.lines[i].remove(); }
        this.lines = [];
        for (let i=this.regions.length-1; i>=0; i--) { this.regions[i].remove(); }
        this.regions = [];
    }
    
    refresh() {
        /*
          Call when either the available space or the source image size changed.
        */
        if (paper.view) {
            let bounds = this.img.getBoundingClientRect();
            let imgRatio = (bounds.width / this.img.naturalWidth);
            let ratio = imgRatio/paper.view.zoom*this.scale;
            this.canvas.style.width = bounds.width + 'px';
            this.canvas.style.height = bounds.height + 'px';
            if (paper.view.viewSize[0] != bounds.width &&
                paper.view.viewSize[1] != bounds.height) {
                paper.view.viewSize = [bounds.width, bounds.height];
                paper.view.scale(ratio, [0, 0]);
            }
        }
    }
    
    load(data) {
        /* Loads a list of lines containing each a baseline polygon and a mask polygon
         * [{baseline: [[x1, y1], [x2, y2], ..], mask:[[x1, y1], [x2, y2], ]}, {..}] */
        for (let i in data.lines) {
            let line = data.lines[i];
            let context = {};
            if (this.idField) context[this.idField] = line[this.idField];
            if (!line.baseline) this.toggleMasks(true);
            let newLine = this.createLine(i, line.baseline, line.mask, context);
        }
        for (let i in data.regions) {
            let region = data.regions[i];
            let context = {};
            if (this.idField) context[this.idField] = region[this.idField];
            let newRegion = this.createRegion(region.order, region.box, context);
        }
        // once everything is loaded we can calculate line heights etc
        for (let i in this.lines) {
            this.lines[i].setLineHeight();
        }
    }
    
    exportJSON() {
        /* Returns a list of lines containing each a baseline polygon and a mask polygon
         * {
              regions: [[[xr1, yr1], [xr2, yr2], [xr3, yr3]], [..]],
              lines:[{baseline: [[x1, y1], [x2, y2], ..], mask:[[x1, y1], [x2, y2], ]}, {..}] 
           }
        */
        return {
            regions: this.regions.map(region => region.polygon),
            lines: this.lines.map(function(line) {
                return {
                    baseline: line.baseline,
                    mask: line.mask
                };
            }.bind(this))
        };
    }

    trigger(eventName, data) {
        var event = new CustomEvent(eventName, {detail:data});
        this.events.dispatchEvent(event);
    }
    
    updateLinesFromCanvas() {
        for (let i in this.lines) {
            this.lines[i].updateDataFromCanvas();
        }
    }
    
    updateRegionsFromCanvas() {
        for (let i in this.regions) {
            this.regions[i].updateDataFromCanvas();
        }
    }
    
    toggleMasks(force) {
        this.showMasks = force || !this.showMasks;
        if (this.showMasks) {
            this.toggleMasksBtn.classList.add('btn-success');
            this.toggleMasksBtn.classList.remove('btn-info');
        } else {
            this.toggleMasksBtn.classList.add('btn-info');
            this.toggleMasksBtn.classList.remove('btn-success');
        }
        for (let i in this.lines) {
            let poly = this.lines[i].maskPath;
            if (poly) {
                poly.visible = this.showMasks;
                // paperjs shows handles for invisible items :(
                // TODO: use layers?
                if (!poly.visible && poly.selected) poly.selected = false;
                if (poly.visible && this.lines[i].selected) poly.selected = true;
            }
        }
    }

    toggleOrdering() {
        this.showLineNumbers = !this.showLineNumbers;
        for (let i in this.lines) {
            let line = this.lines[i];
            line.orderDisplay.visible = this.showLineNumbers;
        }
        if (this.showLineNumbers) {
            this.toggleOrderingBtn.classList.add('btn-success');
            this.toggleOrderingBtn.classList.remove('btn-info');
        } else {
            this.toggleOrderingBtn.classList.add('btn-info');
            this.toggleOrderingBtn.classList.remove('btn-success');
        }

    }
    
    toggleRegionMode() {
        this.purgeSelection();
        this.mode = this.mode == 'lines' ? 'regions' : 'lines';
        this.toggleRegionModeBtn.classList.toggle('btn-info');
        this.toggleRegionModeBtn.classList.toggle('btn-success');
        this.regions.forEach(function(region) {
            if (this.mode == 'lines') {
                region.polygonPath.fillColor = null;
            } else {
                region.polygonPath.fillColor = this.secondaryColor;
            }
        }.bind(this));
    }
    
    showContextMenu() {
        if (!this.hasSelection()) {
            this.contextMenu.style.display = 'none';
            return;
        }
        if (this.deletePointBtn) {
            if (this.selection.segments.length) {
                this.deletePointBtn.style.display = 'block';
            } else {
                this.deletePointBtn.style.display = 'none';
            }
        }
        if (this.selection.lines.length) {
            if (this.reverseBtn) this.reverseBtn.style.display = 'block';
            if (this.deleteSelectionBtn) this.deleteSelectionBtn.style.display = 'block';
        }
        if (this.selection.lines.length > 1) {
            // we can only merge if all lines contain a baseline
            if (this.selection.lines.filter(sel => sel.baseline === null).length == 0) {
                 this.mergeBtn.style.display = 'block';
            }
        } else {
            this.mergeBtn.style.display = 'none';
        }
        this.contextMenu.style.display = 'block';
    }

    hasSelection() {
        return (this.selection.lines.length > 0 ||
                this.selection.segments.length > 0 ||
                this.selection.regions.length > 0);
    }
    
    addToSelection(obj) {
        if (obj instanceof SegmenterLine) {
            if (this.selection.lines.findIndex(e => e.id == obj.id) == -1) this.selection.lines.push(obj);
        } else if (obj instanceof SegmenterRegion) {
            if (this.selection.regions.findIndex(e => e.id == obj.id) == -1) this.selection.regions.push(obj);
        } else {
            // must be a segment
            if (this.selection.segments.findIndex(
                e => e.path && e.path.id == obj.path.id && e.index == obj.index) == -1) {
                this.selection.segments.push(obj);
                obj.selected = true;
            }
        }
        this.showContextMenu();
    }

    removeFromSelection(obj) {
        if (obj instanceof SegmenterLine) {
            this.selection.lines.splice(this.selection.lines.findIndex(e => e.id == obj.id), 1);
        } else if (obj instanceof SegmenterRegion) {
            this.selection.regions.splice(this.selection.regions.findIndex(e => e.id == obj.id), 1);
        } else {
            // must be a segment
            let fi = this.selection.segments.findIndex(e => e.path && obj.path && e.path.id == obj.path.id && e.index == obj.index);
            if (fi !== -1) {
                this.selection.segments.splice(fi, 1);
                obj.point.selected = false;
            }
        }
        this.showContextMenu();
    }
    
    purgeSelection(except) {
        for (let i=this.selection.lines.length-1; i >= 0; i--) {
            if (!except || except != this.selection.lines[i]) {
                this.selection.lines[i].unselect();
            }
        }
        for (let i=this.selection.regions.length-1; i >= 0; i--) {
            if (!except || except != this.selection.regions[i]) {
                this.selection.regions[i].unselect();
            }
        }
        for (let i=this.selection.segments.length-1; i >= 0; i--) {
            if (this.selection.segments[i].path == null){
                // clean up any remaining references (paperjs bug?)
                this.selection.segments.splice(i);
            } else if (!except || except.baselinePath != this.selection.segments[i].path) {
                this.removeFromSelection(this.selection.segments[i]);
            }
        }
        this.showContextMenu();
    }
    
    makeSelectionRectangle(event) {
        let shape = new Rectangle([event.point.x, event.point.y], [1, 1]);
        var clip = new Path.Rectangle(shape, 0);
        clip.opacity = 1;
        clip.strokeWidth = Math.max(2, 2/this.scale);
        clip.strokeColor = 'grey';
        clip.dashArray = [10, 4];
        clip.originalPoint = event.point;
        return clip;
    }

    updateSelectionRectangle(clip, event) {
        clip.bounds.width = Math.max(1, Math.abs(clip.originalPoint.x - event.point.x));
        if (event.point.x > clip.originalPoint.x) {
            clip.bounds.x = clip.originalPoint.x;
        } else {
            clip.bounds.x = event.point.x;
        }
        clip.bounds.height = Math.max(1, Math.abs(clip.originalPoint.y - event.point.y));
        if (event.point.y > clip.originalPoint.y) {
            clip.bounds.y = clip.originalPoint.y;
        } else {
            clip.bounds.y = event.point.y;
        }
    }
    
    lassoSelection(clip, allLines, tmpSelected) {
        // draws a rectangle lasso selection tool that selects every segment it crosses
        for (let i in allLines) {
            let allSegments;
            let line = allLines[i];
            if (this.showMasks && line.maskPath) {
                allSegments = line.baselinePath.segments.concat(line.maskPath.segments);
            } else {
                allSegments = line.baselinePath.segments;
            }
            for (let j in allSegments) {
                let segment = allSegments[j];
                if (segment.point.isInside(clip.bounds)) {
                    this.addToSelection(segment);
                    tmpSelected.push(segment);
                } else {
                    let fi = tmpSelected.findIndex(s=>s.path && s.path.id == segment.path.id
                                                   && s.index==segment.index);
                    if (fi !== -1) {
                        tmpSelected.slice(fi);
                        this.removeFromSelection(segment);
                    }
                }
            }
            if (line.baselinePath.intersects(clip) || line.baselinePath.isInside(clip.bounds)) line.select();
            else if (allLines.length == this.lines.length) line.unselect();
        }
    }
    
    splitHelper(clip, event) {
        this.lines.forEach(function(line) {
            if (!line.baselinePath) return;
            let intersections = line.baselinePath.getIntersections(clip);
            for (var i = 0; i < intersections.length; i++) {
                new Path.Circle({
                    center: intersections[i].point,
                    radius: 5,
                    fillColor: 'red'
                }).removeOnDrag().removeOnUp();

                if (intersections.length) {
                    // show what is going to be cut
                    let cut = new Path({strokeColor: 'red', strokeWidth: 2}).removeOnDrag().removeOnUp();
                    intersections.forEach(location => cut.add(location));
                    cut.bringToFront();
                    line.baselinePath.segments.forEach(function(segment) {
                        if (clip.contains(segment.point)) {
                            cut.insert(segment.index, segment);
                        }
                    }.bind(this));
                }
            }
        }.bind(this));
    }

    getMaxOrder() {
        if (!this.lines.length) return -1;
        return this.lines.map(l=>l.order).reduce((a,b)=>Math.max(a, b));
    }
    
    splitByPath(path) {
        this.lines.forEach(function(line) {
            if (line.baseline !== null) {
                let intersections = line.baselinePath.getIntersections(path);
                for (var i = 0; i < intersections.length; i += 2) {
                    if (i+1 >= intersections.length) {  // one intersection remaining
                        // remove everything in the selection rectangle
                        let location = intersections[i];
                        let newSegment = line.baselinePath.insert(location.index+1, location);
                        if (path.contains(line.baselinePath.firstSegment.point)) {
                            line.baselinePath.removeSegments(0, newSegment.index);
                        } else if (path.contains(line.baselinePath.lastSegment.point)) {
                            line.baselinePath.removeSegments(newSegment.index+1);
                        }
                        if (line.maskPath) {
                            let normal = line.baselinePath.getNormalAt(intersections[i].offset);
                            normal.length = line.maskPath.bounds.height;
                            let anchor = intersections[i].point;
                            let p = new Path.Line(anchor.subtract(normal), anchor.add(normal));
                            let its = line.maskPath.getIntersections(p);
                            line.maskPath.splitAt(its[1]);
                            let mask2 = line.maskPath.splitAt(its[0]);
                            if (mask2.interiorPoint.isInside(path.bounds)) {
                                mask2.remove();
                            } else {
                                line.update(null, mask2.segments);
                            }
                        }
                    } else {
                        let newMask = null;
                        
                        // projects the intersections into the mask to cut it as well.
                        if (line.maskPath !== null) {
                            let normal1 = line.baselinePath.getNormalAt(intersections[i].offset);
                            let normal2 = line.baselinePath.getNormalAt(intersections[i+1].offset);
                            // extends the normals to the image boundaries
                            normal1.length = normal2.length = line.maskPath.bounds.height;
                            let anchor1 = intersections[i].point;
                            let anchor2 = intersections[i+1].point;
                            let clip = new Path({
                                segments:[anchor1.add(normal1),
                                          anchor1.subtract(normal1),
                                          anchor2.subtract(normal2),
                                          anchor2.add(normal2)],
                                fillColor: 'red'});
                            clip.removeOnDown();
                            let ng = line.maskPath.divide(clip, {insert: false});
                            console.log(ng);
                            if (ng.children && ng.children.length == 3) {
                                line.maskPath.remove();
                                ng.children[0].segments.forEach(s=>line.maskPath.add(s));
                                newMask = ng.children[1];
                            }
                        }
                        let split = line.baselinePath.splitAt(intersections[i+1]);
                        let trash = line.baselinePath.splitAt(intersections[i]);
                        trash.remove();
                        let newLine = this.createLine(null, split, newMask && newMask.segments || null, null);
                        newLine.updateDataFromCanvas();
                    }

                    line.refresh();
                    line.updateDataFromCanvas();
                }
            }
        }.bind(this));
    }
    
    reverseSelection() {
        for (let i=0; i < this.selection.lines.length; i++) {
            this.selection.lines[i].reverse();
        }
    }
    
    mergeSelection() {
        /* strategy is:
          1) order the lines by their position,
             line direction doesn't matter since .join() can merge from start or end points
          2) join the lines 2 by 2 setting tolerance to the shortest distance between
             the starting and ending points of both lines.
          3) Delete the left over
        */

        if (this.selection.lines.filter(sel => sel.baselinePath === null).length > 0) {
            return;
        }
        
        this.selection.lines.sort(function(first, second) {
            // let vector = first.baselinePath.segments[1].point.subtract(first.baselinePath.firstSegment.point);
            // let rightToLeft = Math.cos(vector.angle/180*Math.PI) < 0;  // right to left
            // // if (vertical) return first.baselinePath.position.y - second.baselinePath.position.y; // td
            // if (rightToLeft) return second.baselinePath.position.x - first.baselinePath.position.x;
            // else 
            return first.baselinePath.position.x - second.baselinePath.position.x;
        });
        
        while (this.selection.lines.length > 1) {
            let l1 = this.selection.lines[0], l2 = this.selection.lines[1];
            if (l1.baselinePath !== null && l2.baselinePath != null) {
                let seg1 = l1.baselinePath.getNearestLocation(l2.baselinePath.firstPoint);  // assuming the line direction is rtl
                let seg2 = l2.baselinePath.getNearestLocation(l1.baselinePath.lastPoint);
                l1.baselinePath.addSegments(l2.baselinePath.segments);
            }
            if (l1.maskPath != null && l2.maskPath != null) {
                let closeSeg = l1.maskPath.getNearestLocation(l2.maskPath.interiorPoint);
                l1.maskPath.insertSegments(closeSeg.index+1, l2.maskPath.segments.slice(0, -1));
            }

            this.selection.lines[1].delete();
        }
        if (this.selection.lines.length) {
            this.selection.lines[0].refresh();
            this.selection.lines[0].updateDataFromCanvas();
        }
    }

    getAverageLineHeight() {
        if (this.averageLineHeight) return this.averageLineHeight;
        this.averageLineHeight = this.lines.map(l=>l.baseline[0][0]).reduce((a,b)=>b-a)/this.lines.length;
        return this.averageLineHeight;
    }
    
    setCursor(style) {
        if (style) {
            this.canvas.style.cursor = style;
        } else {
            this.canvas.style.cursor = this.spliting?'crosshair':'copy';
        }
    }
    
    setColors() {
        // Attempt to choose the best color for highlighting
        
        function isGrey_(color) {
            return (
                Math.abs(color[0] - color[1]) < 30 &&
                Math.abs(color[0] - color[2]) < 30 &&
                Math.abs(color[1] - color[2]) < 30
            );
        }
        
        function hasColor_(pal, channel) {
            for (let i in pal) {
                if (isGrey_(pal[i])) {continue;}
                if (pal[i][channel] == Math.max.apply(null, pal[i]) && pal[i][channel] > 100) {
                    // the channel is dominant in this color
                    return true;
                }
            }
            return false;
        }
        
        function chooseColors(pal, depth=0) {
            if (hasColor_(pal, 2)) {
                // has blue
                if (hasColor_(pal, 0)) {
                    // has red
                    if (hasColor_(pal, 1)) {
                        // has green; the document is quite rich, start again with only the 2 main colors
                        pal = pal.slice(0, 2);
                        if (depth < 1) return chooseColors(pal, depth=depth+1);
                        else return ['blue', 'teal']; // give up
                    } else {
                        return ['green', 'yellow'];
                    }
                } else {
                    return ['red', 'orange'];
                }
            } else {
                return ['blue', 'teal'];
            }
        }
        
        const rgbToHex = (c) => '#' + [c[0], c[1], c[2]]
              .map(x => x.toString(16).padStart(2, '0')).join('');

        if (ColorThief !== undefined && !this.mainColor) {
            var colorThief = new ColorThief();
            let palette = colorThief.getPalette(this.img, 5);
            let choices = chooseColors(palette);
            this.mainColor = choices[0];
            this.secondaryColor = choices[1];
        } else {
            this.mainColor = 'blue';
            this.secondaryColor = 'teal';
        }
    }
}
