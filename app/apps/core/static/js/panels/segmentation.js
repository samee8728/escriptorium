/*
TODO:
- integration
- help

- list of regions / lines (?)

*/

class SegmentationPanel extends Panel {
    constructor ($panel, $tools, opened) {
        super($panel, $tools, opened);
        this.seeBlocks = true;
        this.seeLines = true;
        this.$img = $('img', this.$container);
        this.zoomTarget = zoom.register(this.$img.get(0), {map: true});
        this.segmenter = new Segmenter(this.$img.get(0), {delayInit:true, idField:'pk'});
        this.segmenter.events.addEventListener('baseline-editor:update', function(event) {
            let data = event.detail;
            if (data.lines) data.lines.forEach(function(line, index) {
                this.save(line, 'lines');
            }.bind(this));
            if (data.regions) data.regions.forEach(function(region, index) {
                this.save(region, 'blocks');
            }.bind(this));
        }.bind(this));
        this.segmenter.events.addEventListener('baseline-editor:delete', function(event) {
            let data = event.detail;
            if (data.lines) data.lines.forEach(function(line, index) {
                this.delete(line, 'lines');
            }.bind(this));
            if (data.regions) data.regions.forEach(function(region, index) {
                this.delete(region, 'blocks');
            }.bind(this));
        }.bind(this));
    }

    init() {
        function init_() {
            this.segmenter.init();
            this.segmenter.load({
                lines: this.part.lines,
                regions: this.part.blocks
            });
            this.bindZoom();
        }

        if (this.$img.get(0).complete) init_.bind(this)();
        else this.$img.on('load', init_.bind(this));
    }
    
    load(part) {
        this.segmenter.reset();
        super.load(part);
        if (this.part.image.thumbnails) {
            this.$img.attr('src', this.part.image.thumbnails.large);
        } else {
            this.$img.attr('src', this.part.image.uri);
        }
        if (this.opened) this.init();
    }

    onShow() {
        this.init();
    }
    
    save(obj, type) {
        var post = {document_part: this.part.pk};
        if (type=='lines') {
            post['baseline'] = JSON.stringify(obj.baseline);
            post['mask'] = JSON.stringify(obj.mask);
            // post.block = this.block?this.block.pk:null; // todo
        } else if (type == 'blocks') {
            post['box'] = JSON.stringify(obj.polygon);
        }
        let uri = this.api + type + '/';
        let pk = obj.context.pk;
        if (pk) uri += pk+'/';
        var requestType = pk?'PUT':'POST';
        $.ajax({url: uri, type: requestType, data: post})
            .done($.proxy(function(data) {
                if (type == 'lines') {
                /* create corresponding transcription line */
                    if (!pk) {
                        panels['trans'].addLine(data);
                    } else {
                        var tl = panels['trans'].lines.find(l => l.pk==pk);
                        if (tl) tl.update(data);
                    }
                }
                obj.context.pk = data.pk;
            }, this))
            .fail(function(data){
                alert("Couldn't save block:", data);
            });
        this.changed = false;
    }

    delete(obj, type) {
        let uri = this.api + type + '/' + obj.context.pk;
        $.ajax({url: uri, type:'DELETE'});
        if (type == 'lines') {
            var tl = panels['trans'].lines.find(l => l.pk==obj.context.pk);
            if (tl) tl.delete();
        }
    }
    
    refresh() {
        super.refresh();
        if (this.opened) {
            this.segmenter.refresh();
        }
    }

    reset() {
        super.reset();
        this.segmenter.reset();
    }
    
    bindZoom() {
        // simulates wheelzoom for canvas
        zoom.refresh();
        var img = this.$img.get(0);
        zoom.events.addEventListener('wheelzoom.updated', function(e) {
            if (!this.opened) return;
            this.segmenter.canvas.style.top = zoom.pos.y + 'px';
            this.segmenter.canvas.style.left = zoom.pos.x + 'px';
            this.segmenter.canvas.style.width = img.width*zoom.scale + 'px';
            this.segmenter.canvas.style.height = img.height*zoom.scale + 'px';
            this.segmenter.refresh();
        }.bind(this));
    }
}
