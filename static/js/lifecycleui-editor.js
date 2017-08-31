jQuery(function () {
    var STATUS_CIRCLE_RADIUS = 35;

    var templates = {};

    jQuery('script.lifecycle-inspector-template').each(function () {
        var type = jQuery(this).data('type');
        var template = jQuery(this).html();
        var fn = Handlebars.compile(template);
        templates[type] = fn;
    });

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

    var createArrowHead = function (svg) {
        var defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'marker_arrowhead')
            .attr('markerHeight', 5)
            .attr('markerWidth', 5)
            .attr('markerUnits', 'strokeWidth')
            .attr('orient', 'auto')
            .attr('refX', STATUS_CIRCLE_RADIUS + 5)
            .attr('refY', 0)
            .attr('viewBox', '-5 -5 10 10')
            .append('path')
              .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
              .attr('fill', 'black');
    };

    var createScale = function (size, padding) {
        return d3.scaleLinear()
                 .domain([0, 1])
                 .range([padding, size - padding]);
    };

    var initializeEditor = function (node) {
        var container = jQuery(node);
        var name = container.data('name');
        var config = RT.LifecycleConfig[name];
        var inspector = container.find('.inspector');

        var svg = d3.select(node)
                    .select('svg');

        var transitionContainer = svg.append('g').classed('transitions', true);
        var statusContainer = svg.append('g').classed('statuses', true);
        var decorationContainer = svg.append('g').classed('decorations', true);

        var width = svg.node().getBoundingClientRect().width;
        var height = svg.node().getBoundingClientRect().height;

        var lifecycle = new RT.Lifecycle();
        lifecycle.initializeFromConfig(config);

        var xScale = createScale(width, STATUS_CIRCLE_RADIUS * 2);
        var yScale = createScale(height, STATUS_CIRCLE_RADIUS * 2);

        createArrowHead(svg);

        var setInspectorContent = function (type, node) {
            var params = { lifecycle: lifecycle };
            params[type] = node;

            inspector.html(templates[type](params));
            inspector.find('sf-menu').supersubs().superfish({ dropShadows: false, speed: 'fast', delay: 0 }).supposition()

            inspector.find(':input').change(function () {
                var field = this.name;
                var value = jQuery(this).val();
                lifecycle.updateItem(node, field, value);
                refreshDisplay();
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
                    node.color = newColor;
                    refreshDisplay();
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

                        node.color = newColor;
                        refreshDisplay();
                    }
                });
                input.val(node.color);
            });

            inspector.find('button.delete').click(function (e) {
                e.preventDefault();
                lifecycle.deleteItemForKey(node._key);

                deselectAll(true);
                refreshDisplay();
            });

            inspector.find('a.add-transition').click(function (e) {
                e.preventDefault();
                var button = jQuery(this);
                var fromStatus = button.data('from');
                var toStatus   = button.data('to');

                lifecycle.addTransition(fromStatus, toStatus);

                button.closest('li').addClass('hidden');

                inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

                refreshDisplay();
                selectStatus(node.name);
            });
        };

        var deselectAll = function (inspectCanvas) {
            if (inspectCanvas) {
                setInspectorContent('canvas');
            }

            svg.classed('selection', false);
            svg.selectAll('.selected').classed('selected', false);
            svg.selectAll('.selected-source').classed('selected-source', false);
            svg.selectAll('.selected-sink').classed('selected-sink', false);
            svg.selectAll('.reachable').classed('reachable', false);
        };

        var selectStatus = function (name) {
            var d = lifecycle.statusObjectForName(name);
            setInspectorContent('status', d);

            deselectAll(false);

            svg.classed('selection', true);
            statusContainer.selectAll('*[data-key="'+d._key+'"]').classed('selected', true);

            jQuery.each(lifecycle.transitionsFrom(name), function (i, transition) {
                var key = lifecycle.keyForStatusName(transition.to);
                statusContainer.selectAll('*[data-key="'+key+'"]').classed('reachable', true);
                transitionContainer.selectAll('path[data-key="'+transition._key+'"]').classed('selected', true);
            });
        };

        var selectTransition = function (fromStatus, toStatus) {
            var d = lifecycle.hasTransition(fromStatus, toStatus);
            setInspectorContent('transition', d);

            deselectAll(false);

            svg.classed('selection', true);

            var fromKey = lifecycle.keyForStatusName(fromStatus);
            var toKey = lifecycle.keyForStatusName(toStatus);
            statusContainer.selectAll('*[data-key="'+fromKey+'"]').classed('selected-source', true);
            statusContainer.selectAll('*[data-key="'+toKey+'"]').classed('selected-sink', true);
            transitionContainer.select('path[data-key="'+d._key+'"]').classed('selected', true);
        };

        var selectDecoration = function (type, key) {
            var d = lifecycle.itemForKey(key);

            if (type == 'text') {
                setInspectorContent('text', d);
            }
            else {
                setInspectorContent('shape', d);
            }

            deselectAll(false);

            svg.classed('selection', true);
            decorationContainer.selectAll('*[data-key="'+key+'"]').classed('selected', true);
        };

        var refreshStatusNodes = function () {
            var statuses = statusContainer.selectAll("circle")
                                          .data(lifecycle.statusObjects(), function (d) { return d._key });

            statuses.exit()
                  .classed("removing", true)
                  .transition().duration(200)
                    .attr("r", STATUS_CIRCLE_RADIUS * .8)
                    .remove();

            statuses.enter().append("circle")
                            .attr("r", STATUS_CIRCLE_RADIUS)
                            .attr("data-key", function (d) { return d._key })
                            .on("click", function (d) {
                                d3.event.stopPropagation();
                                selectStatus(d.name);
                            })
                    .merge(statuses)
                            .attr("cx", function (d) { return xScale(d.x) })
                            .attr("cy", function (d) { return yScale(d.y) })
                            .attr("fill", function (d) { return d.color });
        };

        function truncateLabel () {
            var self = d3.select(this),
                textLength = self.node().getComputedTextLength(),
                text = self.text();
            while (textLength > STATUS_CIRCLE_RADIUS*1.8 && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + '…');
                textLength = self.node().getComputedTextLength();
            }
        };

        var refreshStatusLabels = function () {
            var labels = statusContainer.selectAll("text")
                                        .data(lifecycle.statusObjects(), function (d) { return d._key });

            labels.exit()
                .classed("removing", true)
                .transition().duration(200)
                  .remove();

            labels.enter().append("text")
                          .attr("data-key", function (d) { return d._key })
                          .on("click", function (d) {
                              d3.event.stopPropagation();
                              selectStatus(d.name);
                          })
                  .merge(labels)
                          .attr("x", function (d) { return xScale(d.x) })
                          .attr("y", function (d) { return yScale(d.y) })
                          .attr("fill", function (d) { return d3.hsl(d.color).l > 0.35 ? '#000' : '#fff' })
                          .text(function (d) { return d.name }).each(truncateLabel)
        };

        var linkArc = function (d) {
          var from = lifecycle.statusObjectForName(d.from);
          var to = lifecycle.statusObjectForName(d.to);
          var dx = xScale(to.x - from.x),
              dy = yScale(to.y - from.y),
              dr = Math.abs(dx*6) + Math.abs(dy*6);
          return "M" + xScale(from.x) + "," + yScale(from.y) + "A" + dr + "," + dr + " 0 0,1 " + xScale(to.x) + "," + yScale(to.y);
        };

        var refreshTransitions = function () {
            var paths = transitionContainer.selectAll("path")
                            .data(lifecycle.transitions, function (d) { return d._key });

            paths.exit()
                .classed("removing", true)
                .transition().duration(200)
                  .remove();

            paths.enter().append("path")
                         .attr("data-key", function (d) { return d._key })
                         .on("click", function (d) {
                             d3.event.stopPropagation();
                             selectTransition(d.from, d.to);
                         })
                  .merge(paths)
                          .attr("d", linkArc)
                          .classed("dashed", function (d) { return d.style == 'dashed' })
                          .classed("dotted", function (d) { return d.style == 'dotted' })
        };

        var refreshTextDecorations = function () {
            var labels = decorationContainer.selectAll("text")
                            .data(lifecycle.decorations.text, function (d) { return d._key });

            labels.exit()
                .classed("removing", true)
                .transition().duration(200)
                  .remove();

            labels.enter().append("text")
                         .attr("data-key", function (d) { return d._key })
                         .on("click", function (d) {
                             d3.event.stopPropagation();
                             selectDecoration('text', d._key);
                         })
                  .merge(labels)
                          .attr("x", function (d) { return xScale(d.x) })
                          .attr("y", function (d) { return yScale(d.y) })
                          .text(function (d) { return d.text });
        };

        var refreshDecorations = function () {
            refreshTextDecorations();
        };

        var refreshDisplay = function () {
            refreshTransitions();
            refreshStatusNodes();
            refreshStatusLabels();
            refreshDecorations();
        };

        inspector.on('click', 'a.select-status', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            selectStatus(statusName);
        });

        inspector.on('click', 'a.select-transition', function (e) {
            e.preventDefault();
            var button = jQuery(this);
            var fromStatus = button.data('from');
            var toStatus   = button.data('to');

            selectTransition(fromStatus, toStatus);
        });

        setInspectorContent('canvas');

        svg.on('click', function () { deselectAll(true) });

        jQuery('form[name=ModifyLifecycle]').submit(function (e) {
            var config = lifecycle.exportAsConfiguration();
            console.log(config);
            e.preventDefault();
            return false;
        });

        refreshDisplay();
    };

    jQuery(".lifecycle-ui").each(function () { initializeEditor(this) });
});

