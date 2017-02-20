/*
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// scrollbar as high as the table is

var scrollbarManager = {

    scrollbarEl : {},
    subsamplingNum: 0,
    thumbWidth: 2,
    thumbHeight: 20,
    scale: 1,
    scrollThumb: $("#scrollthumb"),

    init : function(sessionData, scrollbarEl, subsamplingNum){

        console.time("scrollbar init");

        this.scrollbarEl = scrollbarEl;
        //this.subsamplingNum = subsamplingNum;

        // check for active column
        // check if any code has colour set

        var scrollContext = scrollbarEl.getContext('2d');
        var scrollContext2 = document.getElementById("scrollthumb").getContext('2d');
        $("body").show(); // todo this is nasty
        scrollContext.canvas.height = $("#table-col").height()
            - parseInt(messageViewerManager.messageContainer.css("margin-bottom"))
            - parseInt(messageViewerManager.messageContainer.css("margin-top"));
        scrollContext.canvas.width = $("#scrollbar-col").width();

        scrollContext2.canvas.height = scrollContext.canvas.height;
        scrollContext2.canvas.width = scrollContext.canvas.width;

        $("#scrollthumb").css({position: 'absolute', top: '0px', left: $(scrollbarEl).position().left + 'px'});

        $("body").hide();

        this.subsamplingNum = Math.floor(newDataset.eventCount/(scrollbarEl.height-4));


        $("#scrollbar").drawRect({
            //strokeStyle: '#ddd',
            strokeStyle: 'black',
            strokeWidth: 1, // same as panel border width
            x: 9.5, y: 0.5,
            width: scrollContext.canvas.width-20, height: scrollContext.canvas.height-1,
            cornerRadius: 2,
            layer: true,
            groups: ['scrollbar'],
            fromCenter: false
        });


        // todo make schemes an array not object so there is a concept of order

        this.redraw(newDataset, Object.keys(newDataset.schemes)[0]);

        // todo check if no schemes are loaded in - if not, then dont draw the lines!
        console.timeEnd("scrollbar init");

    },

    redraw : function (dataset, activeSchemeId, loadedPages) {

        var colors = [];
        var sessionData = dataset.sessions;
        if (this.subsamplingNum > 0) {
            colors = this.subsample(dataset, activeSchemeId);
        } else {

            for (event of newDataset.events) {
                if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code != null) {
                    colors.push(event.decorations.get(activeSchemeId).code.color);
                } else {
                    colors.push("#ffffff");
                }
            }
        }

        $(this.scrollbarEl).removeLayerGroup('scrollbarlines');

        var strokeWidth = Math.floor((this.scrollbarEl.height-4)/colors.length);

        $(this.scrollbarEl).scaleCanvas({ // scale it in case the stroke width doesn't fill the full element
            x: 10, y: 1.5,
            scaleX: 1, scaleY: (this.scrollbarEl.height-4)/colors.length,
            layer: true
        });

        for (let c = 0; c < colors.length; c++) { // todo: fix this

            $(this.scrollbarEl).drawLine({
                strokeStyle: colors[c] != undefined ? colors[c] : "#ffffff",
                strokeWidth: strokeWidth + 0.5,
                x1: 10, y1: c * strokeWidth + 1.5,
                x2: this.scrollbarEl.width - 11.5, y2: c * strokeWidth + 1.5,
                layer: true,
                groups: ['scrollbarlines'],
                fromCenter: false
                //scaleY : this.scale
            });

        }

        $(this.scrollbarEl).restoreCanvas({
            layer: true
        });


        var context = this.scrollbarEl.getContext('2d');
        var scrollThumb = $("#scrollthumb");
        scrollThumb.removeLayer('scrollthumb');
        scrollThumb.drawRect({
            strokeStyle: '#black',
            strokeWidth: 1.5,
            x: 2, y: loadedPages ? loadedPages[0] == 0 ? 2 : this.height * (loadedPages[0]/messageViewerManager.tablePages.length) : 2,
            width: context.canvas.width-4, height: scrollbarManager.thumbHeight, // set height according to dataset size vs elems on screen
            cornerRadius: 0,
            layer: true,
            name: 'scrollthumb',
            groups: ['scrollbar'],
            draggableGroups: ['scrollthumb'],
            fromCenter: false,
            draggable: true,
            restrictDragToAxis: 'y',
            dragstop: function(layer) {

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = 2; // todo connect to stroke width of the grey border
                }

                else if (layer.dy + layer.y + layer.height + layer.strokeWidth > context.canvas.height) {
                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = context.canvas.height - layer.height - 2; // todo connect to stroke width of the grey border
                }

                scrollbarManager.scrolling(layer);
                $(this).drawLayers();

            },

            dragcancel: function(layer) {

                console.log("DRAGCANCEL");
                // want to prevent dragging layer out of canvas element
                // check if layer coordinates are out of bounds

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = 2; // todo connect to stroke width of the grey border
                }

                //else if (layer.dy + layer.y + layer.height + layer.strokeWidth > context.canvas.height) {
                else if (layer.dy + layer.y + layer.height + layer.strokeWidth > $("#scrollbar").getLayerGroup('scrollbar')[0].height) {

                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = context.canvas.height - layer.height - 2; // todo connect to stroke width of the grey border
                }

                scrollbarManager.scrolling(layer);
                $(this).drawLayers();


            },
            cursors: {
                // show move cursor when dragging
                mouseover: 'pointer',
                mousedown: 'move',
                mouseup: 'pointer'
            }
        });

        $(this.scrollbarEl).drawLayers(); // todo do i need to do this? - yes you do, e.g. when changing active scheme
        scrollThumb.drawLayers();
    },

    subsample : function(dataset, activeSchemeId) {

        // make sure activeSchemeId is a string
        activeSchemeId = activeSchemeId + "";

        var sessionData = dataset.sessions;
        var sampleColours = [];

        // divide dataset into datasetSize / numSamples subarrays
        // pick one from each subarray at random!
        // sadly need to loop because sessions have different numbers of events... oh yeah
        // sad times

        // CHECK IF IT FITS INTO SCROLLBAR PX OF SUBSAMPLING NEEDED!

        var colors = [];

        for (event of newDataset.events) {
            if (colors.length == this.subsamplingNum) {
                sampleColours.push(colors[UIUtils.randomInteger(0, colors.length-1)]);
                colors = [];
            } else {
                if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code != null) {
                    colors.push(event.decorations.get(activeSchemeId).code.color);
                } else {
                    colors.push("#ffffff");
                }
            }
        }

        return sampleColours;
    },


    scrolling : function(scrollthumbLayer) {

        var thumbMid = scrollthumbLayer.y + scrollbarManager.thumbWidth + Math.floor(scrollbarManager.thumbHeight/2); // for stroke width of the scrollthumb
        var pageSize = messageViewerManager.rowsInTable;
        var rowsPerPixel = scrollbarManager.subsamplingNum;

        // todo need to take scaling into account
        let percentage = scrollthumbLayer.y + scrollbarManager.thumbWidth == 6 ? 0 : Math.round(((thumbMid - 10) / (scrollbarManager.scrollbarEl.height-20) * 100 )) / 100; // force it to 0 if top is 6px displaced, 2px for border, 4px for scrollthumb
        let eventIndexToLoad = scrollthumbLayer.y > 2 ? Math.floor(newDataset.events.length * percentage) : 0;
        const halfPage = Math.floor(messageViewerManager.rowsInTable/2);
        let pagesToLoad = Math.floor(eventIndexToLoad / halfPage);

        if ((pagesToLoad * halfPage + halfPage) >= newDataset.events.length) {
            pagesToLoad = pagesToLoad-2;
        }

        messageViewerManager.lastLoadedPageIndex = [];

        var page1 = messageViewerManager.createPageHTML(pagesToLoad);
        var page2 = messageViewerManager.createPageHTML(pagesToLoad+1);
        messageViewerManager.lastLoadedPageIndex = pagesToLoad + 1;

        var tbodyElement = messageViewerManager.table.find("tbody");
        tbodyElement.empty();
        tbodyElement.append(page1);
        tbodyElement.append(page2);

        messageViewerManager.messageContainer.scrollTop(0);

    },

    redrawThumb : function(ycoord) {
        let scrollthumbLayer = this.scrollThumb.getLayer(0);
        if (ycoord < 2) ycoord = 2;
        if (ycoord > scrollbarManager.scrollbarEl - scrollbarManager.thumbHeight -2) ycoord = scrollbarManager.scrollbarEl - scrollbarManager.thumbHeight -2;


        scrollthumbLayer.y = ycoord;
        this.scrollThumb.drawLayers();
    },

    getThumbPosition: function() {
        const layer = this.scrollThumb.getLayer(0);
        return layer ? layer.y : 0;
    }

}