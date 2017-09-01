jQuery(function () {
    function Viewer (container) {
        this.statusCircleRadius = 35;
    };

    Viewer.prototype._initializeTemplates = function (container) {
        var self = this;

        Handlebars.registerHelper('select', function(value, options) {
            var node = jQuery('<select />').html( options.fn(this) );
            node.find('[value="' + value + '"]').attr({'selected':'selected'});
            return node.html();
        });

        Handlebars.registerHelper('canAddTransition', function(fromStatus, toStatus, lifecycle) {
            return !lifecycle.hasTransition(fromStatus, toStatus);
        });

        Handlebars.registerHelper('canSelectTransition', function(fromStatus, toStatus, lifecycle) {
            return lifecycle.hasTransition(fromStatus, toStatus);
        });

        var templates = {};
        self.container.find('script.lifecycle-inspector-template').each(function () {
            var type = jQuery(this).data('type');
            var template = jQuery(this).html();
            var fn = Handlebars.compile(template);
            templates[type] = fn;
        });
        return templates;
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

    Viewer.prototype.setInspectorContent = function (node) {
        var self = this;
        var lifecycle = self.lifecycle;
        var inspector = self.inspector;

        var type = node ? node._type : 'canvas';

        var params = { lifecycle: lifecycle };
        params[type] = node;

        inspector.html(self.templates[type](params));
        inspector.find('sf-menu').supersubs().superfish({ dropShadows: false, speed: 'fast', delay: 0 }).supposition()

        inspector.find(':input').change(function () {
            var field = this.name;
            var value = jQuery(this).val();
            lifecycle.updateItem(node, field, value);
            self.refreshDisplay();
        });

        inspector.find('button.change-color').click(function (e) {
            e.preventDefault();
            var picker = jQuery('<div class="color-picker"></div>');
            jQuery(this).replaceWith(picker);

            var skipUpdateCallback = 0;
            var farb = jQuery.farbtastic(picker, function (newColor) {
                if (skipUpdateCallback) {
                    return;
                }
                inspector.find('.status-color').val(newColor);
                lifecycle.updateItem(node, 'color', newColor);
                self.refreshDisplay();
            });
            farb.setColor(node.color);

            var input = jQuery('<input class="status-color" size=8 maxlength=7>');
            inspector.find('.status-color').replaceWith(input);
            input.on('input', function () {
                var newColor = input.val();
                if (newColor.match(/^#[a-fA-F0-9]{6}$/)) {
                    skipUpdateCallback = 1;
                    farb.setColor(newColor);
                    skipUpdateCallback = 0;

                    lifecycle.updateItem(node, 'color', newColor);
                    self.refreshDisplay();
                }
            });
            input.val(node.color);
        });

        inspector.find('button.delete').click(function (e) {
            e.preventDefault();
            lifecycle.deleteItemForKey(node._key);

            self.deselectAll(true);
            self.refreshDisplay();
        });

        inspector.find('a.add-transition').click(function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            lifecycle.addTransition(fromStatus, toStatus);

            button.closest('li').addClass('hidden');

            inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

            self.refreshDisplay();
            self.selectStatus(node.name);
        });

        inspector.find('a.select-status').on('click', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            self.selectStatus(statusName);
        });

        inspector.find('a.select-transition').on('click', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            self.selectTransition(fromStatus, toStatus);
        });
    };

    Viewer.prototype.deselectAll = function (inspectCanvas) {
        if (inspectCanvas) {
            this.setInspectorContent(null);
        }

        var svg = this.svg;
        svg.classed('selection', false);
        svg.selectAll('.selected').classed('selected', false);
        svg.selectAll('.selected-source').classed('selected-source', false);
        svg.selectAll('.selected-sink').classed('selected-sink', false);
        svg.selectAll('.reachable').classed('reachable', false);
    };

    Viewer.prototype.selectStatus = function (name) {
        var self = this;
        var d = self.lifecycle.statusObjectForName(name);
        self.setInspectorContent(d);

        self.deselectAll(false);

        self.svg.classed('selection', true);
        self.statusContainer.selectAll('*[data-key="'+d._key+'"]').classed('selected', true);

        jQuery.each(self.lifecycle.transitionsFrom(name), function (i, transition) {
            var key = self.lifecycle.keyForStatusName(transition.to);
            self.statusContainer.selectAll('*[data-key="'+key+'"]').classed('reachable', true);
            self.transitionContainer.selectAll('path[data-key="'+transition._key+'"]').classed('selected', true);
        });
    };

    Viewer.prototype.selectTransition = function (fromStatus, toStatus) {
        var self = this;
        var d = self.lifecycle.hasTransition(fromStatus, toStatus);
        self.setInspectorContent(d);

        self.deselectAll(false);

        self.svg.classed('selection', true);

        var fromKey = self.lifecycle.keyForStatusName(fromStatus);
        var toKey = self.lifecycle.keyForStatusName(toStatus);
        self.statusContainer.selectAll('*[data-key="'+fromKey+'"]').classed('selected-source', true);
        self.statusContainer.selectAll('*[data-key="'+toKey+'"]').classed('selected-sink', true);
        self.transitionContainer.select('path[data-key="'+d._key+'"]').classed('selected', true);
    };

    Viewer.prototype.selectDecoration = function (key) {
        var d = this.lifecycle.itemForKey(key);
        this.setInspectorContent(d);

        this.deselectAll(false);

        this.svg.classed('selection', true);
        this.decorationContainer.selectAll('*[data-key="'+key+'"]').classed('selected', true);
    };

    Viewer.prototype.refreshStatusNodes = function () {
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
                            self.selectStatus(d.name);
                        })
                .merge(statuses)
                        .attr("cx", function (d) { return self.xScale(d.x) })
                        .attr("cy", function (d) { return self.yScale(d.y) })
                        .attr("fill", function (d) { return d.color });
    };

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

    Viewer.prototype.refreshStatusLabels = function () {
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
                          self.selectStatus(d.name);
                      })
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

    Viewer.prototype.refreshTransitions = function () {
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
                         self.selectTransition(d.from, d.to);
                     })
              .merge(paths)
                      .attr("d", function (d) { return self.transitionArc(d) })
                      .classed("dashed", function (d) { return d.style == 'dashed' })
                      .classed("dotted", function (d) { return d.style == 'dotted' })
    };

    Viewer.prototype.refreshTextDecorations = function () {
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
                         self.selectDecoration(d._key);
                     })
              .merge(labels)
                      .attr("x", function (d) { return self.xScale(d.x) })
                      .attr("y", function (d) { return self.yScale(d.y) })
                      .text(function (d) { return d.text });
    };

    Viewer.prototype.refreshDecorations = function () {
        this.refreshTextDecorations();
    };

    Viewer.prototype.refreshDisplay = function () {
        this.refreshTransitions();
        this.refreshStatusNodes();
        this.refreshStatusLabels();
        this.refreshDecorations();
    };

    Viewer.prototype.initializeEditor = function (node, config) {
        var self = this;

        self.container = jQuery(node);
        self.svg       = d3.select(node).select('svg');
        self.templates = self._initializeTemplates(self.container);
        self.inspector = self.container.find('.inspector');

        self.transitionContainer = self.svg.select('g.transitions');
        self.statusContainer     = self.svg.select('g.statuses');
        self.decorationContainer = self.svg.select('g.decorations');

        self.width  = self.svg.node().getBoundingClientRect().width;
        self.height = self.svg.node().getBoundingClientRect().height;

        self.xScale = self.createScale(self.width, self.statusCircleRadius * 2);
        self.yScale = self.createScale(self.height, self.statusCircleRadius * 2);

        self.lifecycle = new RT.Lifecycle();
        self.lifecycle.initializeFromConfig(config);

        self.createArrowHead();

        self.setInspectorContent(null);

        self.svg.on('click', function () { self.deselectAll(true) });

        jQuery('form[name=ModifyLifecycle]').submit(function (e) {
            var config = lifecycle.exportAsConfiguration();
            e.preventDefault();
            return false;
        });

        self.refreshDisplay();
    };

    RT.LifecycleViewer = Viewer;
});

