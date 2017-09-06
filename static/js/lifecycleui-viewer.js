jQuery(function () {
    function Viewer (container) {
        this.statusCircleRadius = 35;
        this.gridSize = 25;
        this.padding = this.statusCircleRadius;
    };

    Viewer.prototype.createArrowHead = function () {
        var defs = this.svg.append('defs');
        defs.append('marker')
            .attr('id', 'marker_arrowhead')
            .attr('markerHeight', 5)
            .attr('markerWidth', 5)
            .attr('markerUnits', 'strokeWidth')
            .attr('orient', 'auto')
            .attr('refX', this.statusCircleRadius + 5)
            .attr('refY', 0)
            .attr('viewBox', '-5 -5 10 10')
            .append('path')
              .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
              .attr('fill', 'black');
    };

    Viewer.prototype.createScale = function (size, padding) {
        return d3.scaleLinear()
                 .domain([0, 1])
                 .range([padding, size - padding]);
    };

    Viewer.prototype.gridScale = function (v) { return Math.round(v/this.gridSize) * this.gridSize };
    Viewer.prototype.xScale = function (x) { return this.gridScale(this._xScale(x)) };
    Viewer.prototype.yScale = function (y) { return this.gridScale(this._yScale(y)) };
    Viewer.prototype.xScaleInvert = function (x) { return this._xScale.invert(x) };
    Viewer.prototype.yScaleInvert = function (y) { return this._yScale.invert(y) };

    Viewer.prototype.addZoomBehavior = function () {
        var self = this;
        self._zoom = d3.zoom()
                       .scaleExtent([.3, 2])
                       .on("zoom", function () { self.didZoom() });
        self.svg.call(self._zoom);
    };

    Viewer.prototype.didZoom = function () {
        this.svg.selectAll("g").attr("transform", d3.event.transform);
    };

    Viewer.prototype.resetZoom = function () {
        this.svg.selectAll("g")
                .transition()
                .duration(750)
                .call(self._zoom.transform, d3.zoomIdentity);
    };

    Viewer.prototype.didEnterStatusNodes = function (statuses) { };
    Viewer.prototype.didEnterStatusLabels = function (labels) { };
    Viewer.prototype.didEnterTransitions = function (paths) { };
    Viewer.prototype.didEnterTextDecorations = function (labels) { };
    Viewer.prototype.didEnterPolygonDecorations = function (polygons) { };

    Viewer.prototype.renderStatusNodes = function (initial) {
        var self = this;
        var statuses = self.statusContainer.selectAll("circle")
                                           .data(self.lifecycle.statusObjects(), function (d) { return d._key });

        statuses.exit()
              .classed("removing", true)
              .transition().duration(200)
                .attr("r", self.statusCircleRadius * .8)
                .remove();

        statuses.enter().append("circle")
                        .attr("r", self.statusCircleRadius)
                        .attr("data-key", function (d) { return d._key })
                        .on("click", function (d) {
                            d3.event.stopPropagation();
                            self.clickedStatus(d);
                        })
                        .call(function (statuses) { self.didEnterStatusNodes(statuses) })
                .merge(statuses)
                        .attr("cx", function (d) { return self.xScale(d.x) })
                        .attr("cy", function (d) { return self.yScale(d.y) })
                        .attr("fill", function (d) { return d.color });
    };

    Viewer.prototype.clickedStatus = function (d) { };
    Viewer.prototype.clickedTransition = function (d) { };
    Viewer.prototype.clickedDecoration = function (d) { };

    Viewer.prototype.truncateLabel = function (element) {
        var node = d3.select(element),
            textLength = node.node().getComputedTextLength(),
            text = node.text();
        while (textLength > this.statusCircleRadius*1.8 && text.length > 0) {
            text = text.slice(0, -1);
            node.text(text + '…');
            textLength = node.node().getComputedTextLength();
        }
    };

    Viewer.prototype.renderStatusLabels = function (initial) {
        var self = this;
        var labels = self.statusContainer.selectAll("text")
                                         .data(self.lifecycle.statusObjects(), function (d) { return d._key });

        labels.exit()
            .classed("removing", true)
            .transition().duration(200)
              .remove();

        labels.enter().append("text")
                      .attr("data-key", function (d) { return d._key })
                      .on("click", function (d) {
                          d3.event.stopPropagation();
                          self.clickedStatus(d);
                      })
                     .call(function (labels) { self.didEnterStatusLabels(labels) })
              .merge(labels)
                      .attr("x", function (d) { return self.xScale(d.x) })
                      .attr("y", function (d) { return self.yScale(d.y) })
                      .attr("fill", function (d) { return d3.hsl(d.color).l > 0.35 ? '#000' : '#fff' })
                      .text(function (d) { return d.name }).each(function () { self.truncateLabel(this) })
    };

    Viewer.prototype.transitionArc = function (d) {
      var from = this.lifecycle.statusObjectForName(d.from);
      var to = this.lifecycle.statusObjectForName(d.to);
      var dx = this.xScale(to.x - from.x),
          dy = this.yScale(to.y - from.y),
          dr = Math.abs(dx*6) + Math.abs(dy*6);
      return "M" + this.xScale(from.x) + "," + this.yScale(from.y) + "A" + dr + "," + dr + " 0 0,1 " + this.xScale(to.x) + "," + this.yScale(to.y);
    };

    Viewer.prototype.renderTransitions = function (initial) {
        var self = this;
        var paths = self.transitionContainer.selectAll("path")
                        .data(self.lifecycle.transitions, function (d) { return d._key });

        paths.exit()
            .classed("removing", true)
            .transition().duration(200)
              .remove();

        paths.enter().append("path")
                     .attr("data-key", function (d) { return d._key })
                     .on("click", function (d) {
                         d3.event.stopPropagation();
                         self.clickedTransition(d);
                     })
                     .call(function (paths) { self.didEnterTransitions(paths) })
              .merge(paths)
                      .attr("d", function (d) { return self.transitionArc(d) })
                      .classed("dashed", function (d) { return d.style == 'dashed' })
                      .classed("dotted", function (d) { return d.style == 'dotted' })
    };

    Viewer.prototype.renderTextDecorations = function (initial) {
        var self = this;
        var labels = self.decorationContainer.selectAll("text")
                         .data(self.lifecycle.decorations.text, function (d) { return d._key });

        labels.exit()
            .classed("removing", true)
            .transition().duration(200)
              .remove();

        labels.enter().append("text")
                     .attr("data-key", function (d) { return d._key })
                     .on("click", function (d) {
                         d3.event.stopPropagation();
                         self.clickedDecoration(d);
                     })
                     .call(function (labels) { self.didEnterTextDecorations(labels) })
              .merge(labels)
                      .attr("x", function (d) { return self.xScale(d.x) })
                      .attr("y", function (d) { return self.yScale(d.y) })
                      .text(function (d) { return d.text });
    };

    Viewer.prototype.renderPolygonDecorations = function (initial) {
        var self = this;
        var polygons = self.decorationContainer.selectAll("polygon")
                           .data(self.lifecycle.decorations.polygon, function (d) { return d._key });

        polygons.exit()
            .classed("removing", true)
            .transition().duration(200)
              .remove();

        polygons.enter().append("polygon")
                     .attr("data-key", function (d) { return d._key })
                     .on("click", function (d) {
                         d3.event.stopPropagation();
                         self.clickedDecoration(d);
                     })
                     .call(function (polygons) { self.didEnterPolygonDecorations(polygons) })
              .merge(polygons)
                     .attr("stroke", function (d) { return d.renderStroke ? d.stroke : 'none' })
                      .classed("dashed", function (d) { return d.strokeStyle == 'dashed' })
                      .classed("dotted", function (d) { return d.strokeStyle == 'dotted' })
                     .attr("fill", function (d) { return d.renderFill ? d.fill : 'none' })
                     .attr("transform", function (d) { return "translate(" + self.xScale(d.x) + ", " + self.yScale(d.y) + ")" })
                     .attr("points", function (d) {
                         return jQuery.map(d.points, function(p) {
                             return [self.xScale(p.x),self.yScale(p.y)].join(",");
                         }).join(" ");
                     });
    };

    Viewer.prototype.renderDecorations = function (initial) {
        this.renderPolygonDecorations(initial);
        this.renderTextDecorations(initial);
    };

    Viewer.prototype.renderDisplay = function (initial) {
        this.renderTransitions(initial);
        this.renderStatusNodes(initial);
        this.renderStatusLabels(initial);
        this.renderDecorations(initial);
    };

    Viewer.prototype.centerOnItem = function (item) {
        var x = this.xScale(item.x);
        var y = this.yScale(item.y);
        this.svg.selectAll("g")
                .call(this._zoom.translateTo, x, y);
    };

    Viewer.prototype.focusOnStatus = function (statusName) {
        if (!statusName) {
            return;
        }

        var meta = this.lifecycle.statusObjectForName(statusName);
        this.centerOnItem(meta);
    };

    Viewer.prototype.initializeViewer = function (node, config, focusStatus) {
        var self = this;

        self.container = jQuery(node);
        self.svg       = d3.select(node).select('svg');

        self.transitionContainer = self.svg.select('g.transitions');
        self.statusContainer     = self.svg.select('g.statuses');
        self.decorationContainer = self.svg.select('g.decorations');

        self.width  = self.svg.node().getBoundingClientRect().width;
        self.height = self.svg.node().getBoundingClientRect().height;

        self._xScale = self.createScale(self.width, self.padding);
        self._yScale = self.createScale(self.height, self.padding);

        self.lifecycle = new RT.Lifecycle();
        self.lifecycle.initializeFromConfig(config);

        self.createArrowHead();
        self.addZoomBehavior();

        self.focusOnStatus(focusStatus);

        self.renderDisplay(true);
    };

    RT.LifecycleViewer = Viewer;
});

