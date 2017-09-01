jQuery(function () {
    function Viewer (container) {
        this.statusCircleRadius = 35;
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

    Viewer.prototype.renderStatusNodes = function () {
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
                .merge(statuses)
                        .attr("cx", function (d) { return self.xScale(d.x) })
                        .attr("cy", function (d) { return self.yScale(d.y) })
                        .attr("fill", function (d) { return d.color });

        return statuses;
    };

    Viewer.prototype.clickedStatus = function (d) { };
    Viewer.prototype.clickedTransition = function (d) { };
    Viewer.prototype.clickedDecoration = function (d) { };

    Viewer.prototype.truncateLabel = function (element) {
        var node = d3.select(element),
            textLength = node.node().getComputedTextLength(),
            text = node.text();
        while (textLength > this.statusCircleRadiuds*1.8 && text.length > 0) {
            text = text.slice(0, -1);
            node.text(text + '…');
            textLength = node.node().getComputedTextLength();
        }
    };

    Viewer.prototype.renderStatusLabels = function () {
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
              .merge(labels)
                      .attr("x", function (d) { return self.xScale(d.x) })
                      .attr("y", function (d) { return self.yScale(d.y) })
                      .attr("fill", function (d) { return d3.hsl(d.color).l > 0.35 ? '#000' : '#fff' })
                      .text(function (d) { return d.name }).each(function () { self.truncateLabel(this) })

        return labels;
    };

    Viewer.prototype.transitionArc = function (d) {
      var from = this.lifecycle.statusObjectForName(d.from);
      var to = this.lifecycle.statusObjectForName(d.to);
      var dx = this.xScale(to.x - from.x),
          dy = this.yScale(to.y - from.y),
          dr = Math.abs(dx*6) + Math.abs(dy*6);
      return "M" + this.xScale(from.x) + "," + this.yScale(from.y) + "A" + dr + "," + dr + " 0 0,1 " + this.xScale(to.x) + "," + this.yScale(to.y);
    };

    Viewer.prototype.renderTransitions = function () {
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
              .merge(paths)
                      .attr("d", function (d) { return self.transitionArc(d) })
                      .classed("dashed", function (d) { return d.style == 'dashed' })
                      .classed("dotted", function (d) { return d.style == 'dotted' })

        return paths;
    };

    Viewer.prototype.renderTextDecorations = function () {
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
              .merge(labels)
                      .attr("x", function (d) { return self.xScale(d.x) })
                      .attr("y", function (d) { return self.yScale(d.y) })
                      .text(function (d) { return d.text });

        return labels;
    };

    Viewer.prototype.renderDecorations = function () {
        this.renderTextDecorations();
    };

    Viewer.prototype.renderDisplay = function () {
        this.renderTransitions();
        this.renderStatusNodes();
        this.renderStatusLabels();
        this.renderDecorations();
    };

    Viewer.prototype.initializeViewer = function (node, config) {
        var self = this;

        self.container = jQuery(node);
        self.svg       = d3.select(node).select('svg');

        self.transitionContainer = self.svg.select('g.transitions');
        self.statusContainer     = self.svg.select('g.statuses');
        self.decorationContainer = self.svg.select('g.decorations');

        self.width  = self.svg.node().getBoundingClientRect().width;
        self.height = self.svg.node().getBoundingClientRect().height;

        self.xScale = self.createScale(self.width, self.padding);
        self.yScale = self.createScale(self.height, self.padding);

        self.lifecycle = new RT.Lifecycle();
        self.lifecycle.initializeFromConfig(config);

        self.createArrowHead();

        self.renderDisplay();
    };

    RT.LifecycleViewer = Viewer;
});

