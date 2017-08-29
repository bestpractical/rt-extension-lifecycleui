jQuery(function () {
    var STATUS_CIRCLE_RADIUS = 35;

    var _STATUS_KEY_SEQ = 0;

    var defaultColors = d3.scaleOrdinal(d3.schemeCategory10);

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

    var updateStatusName = function (state, oldValue, newValue) {
        // statusMeta key
        var oldMeta = state.statusMeta[oldValue];
        delete state.statusMeta[oldValue];
        state.statusMeta[newValue] = oldMeta;

        // statuses array value
        var index = state.statuses.indexOf(oldValue);
        state.statuses[index] = newValue;

        // defaults
        jQuery.each(state.defaults, function (key, statusName) {
            if (statusName == oldValue) {
                state.defaults[key] = newValue;
            }
        });

        // actions

        // transitions

        // rights
    };

    var deleteStatus = function (state, statusName) {
        // statusMeta key
        delete state.statusMeta[statusName];

        // statuses array value
        var index = state.statuses.indexOf(statusName);
        state.statuses.splice(index, 1);

        // defaults
        jQuery.each(state.defaults, function (key, value) {
            if (value == statusName) {
                delete state.defaults[key];
            }
        });

        // actions

        // transitions

        // rights
    };

    var createArrowHead = function (svg) {
        var defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'marker_arrowhead')
            .attr('markerHeight', 5)
            .attr('markerWidth', 5)
            .attr('markerUnits', 'strokeWidth')
            .attr('orient', 'auto')
            .attr('refX', 0)
            .attr('refY', 0)
            .attr('viewBox', '-5 -5 10 10')
            .append('path')
              .attr('d', 'M 0,0 m -5,-5 L 5,0 L -5,5 Z')
              .attr('fill', 'black');
    };

    var newState = function (clone) {
        return {
            statuses: [],
            defaults: {},
            transitions: {},
            rights: {},
            actions: [],

            statusMeta: {}
        };
    };

    var initializeStateFromConfig = function (config) {
        var state = newState();

        jQuery.each(['initial', 'active', 'inactive'], function (i, type) {
            if (config[type]) {
                state.statuses = state.statuses.concat(config[type]);
                jQuery.each(config[type], function (j, statusName) {
                    state.statusMeta[statusName] = {
                        _key: _STATUS_KEY_SEQ++,
                        name: statusName,
                        type: type
                    };
                });
            }
        });

        var statusCount = state.statuses.length;

        jQuery.each(state.statuses, function (i, statusName) {
            var meta = state.statusMeta[statusName];
            // arrange statuses evenly-spaced around a circle
            if (!meta.x) {
                meta.x = (Math.sin(2 * Math.PI * (i/statusCount)) + 1) / 2;
                meta.y = (Math.cos(2 * Math.PI * (i/statusCount)) + 1) / 2;
            };

            if (!meta.color) {
                meta.color = defaultColors(meta._key);
            };
        });

        if (config.defaults) {
            state.defaults = config.defaults;
        }

        if (config.transitions) {
            state.transitions = config.transitions;
        }

        if (config.rights) {
            state.rights = config.rights;
        }

        if (config.actions) {
            state.actions = config.actions;
        }

        return state;
    };

    var exportConfigFromState = function (state) {
        var config = {
            initial: [],
            active: [],
            inactive: [],
            defaults: state.defaults,
            actions: state.actions,
            rights: state.rights,
            transitions: state.transitions
        };

        jQuery.each(state.statuses, function (i, statusName) {
            var statusType = state.statusMeta[statusName].type;
            config[statusType].push(statusName);
        });

        return config;
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

        var width = svg.node().getBoundingClientRect().width;
        var height = svg.node().getBoundingClientRect().height;

        var state = initializeStateFromConfig(config);

        var xScale = createScale(width, STATUS_CIRCLE_RADIUS * 2);
        var yScale = createScale(height, STATUS_CIRCLE_RADIUS * 2);

        createArrowHead(svg);

        var setInspectorContent = function (type, node) {
            var params = { state: state };
            params[type] = node;

            inspector.html(templates[type](params));
            inspector.find('sf-menu').supersubs().superfish({ dropShadows: false, speed: 'fast', delay: 0 }).supposition()

            inspector.find(':input').change(function () {
                var key = this.name;
                var value = jQuery(this).val();

                var oldValue = node[key];

                node[key] = value;

                if (type == 'status' && key == 'name') {
                    updateStatusName(state, oldValue, value);
                }

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

                if (type == 'status') {
                    deleteStatus(state, node.name);
                }

                deselectAll();
                refreshDisplay();
            });
        };

        var deselectAll = function () {
            setInspectorContent('canvas');
            svg.selectAll('.selected').classed('selected', false);
        };

        var selectStatus = function (name) {
            var d = state.statusMeta[name];
            setInspectorContent('status', d);
            svg.selectAll('.selected').classed('selected', false);
            svg.select('circle[data-name="'+name+'"]').classed('selected', true);
        };

        var refreshStatusNodes = function () {
            var statuses = svg.selectAll("circle")
                              .data(Object.values(state.statusMeta), function (d) { return d._key });

            statuses.exit()
                  .transition()
                    .style("opacity", 1e-6)
                    .attr("r", STATUS_CIRCLE_RADIUS * .8)
                    .remove();

            statuses.enter().append("circle")
                            .attr("r", STATUS_CIRCLE_RADIUS)
                            .on("click", function (d) {
                                d3.event.stopPropagation();
                                selectStatus(d.name);
                            })
                    .merge(statuses)
                            .attr("cx", function (d) { return xScale(d.x) })
                            .attr("cy", function (d) { return yScale(d.y) })
                            .attr("fill", function (d) { return d.color })
                            .attr("data-name", function (d) { return d.name })
        };

        function truncateLabel () {
            var self = d3.select(this),
                textLength = self.node().getComputedTextLength(),
                text = self.text();
            while (textLength > STATUS_CIRCLE_RADIUS*1.9 && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + '…');
                textLength = self.node().getComputedTextLength();
            }
        };

        var refreshStatusLabels = function () {
            var labels = svg.selectAll("text")
                            .data(Object.values(state.statusMeta), function (d) { return d._key });

            labels.exit()
                .transition()
                  .style("opacity", 1e-6)
                  .remove();

            labels.enter().append("text")
                          .attr("text-anchor", "middle")
                          .attr("alignment-baseline", "middle")
                          .on("click", function (d) {
                              d3.event.stopPropagation();
                              selectStatus(d.name);
                          })
                  .merge(labels)
                          .attr("x", function (d) { return xScale(d.x) })
                          .attr("y", function (d) { return yScale(d.y) })
                          .text(function (d) { return d.name }).each(truncateLabel)
        };

        var refreshDisplay = function () {
            refreshStatusNodes();
            refreshStatusLabels();
        };

        jQuery('.inspector').on('click', 'a.select-status', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            selectStatus(statusName);
        });

        setInspectorContent('canvas');

        svg.on('click', function () { deselectAll() });

        jQuery('form[name=ModifyLifecycle]').submit(function (e) {
            var config = exportConfigFromState(state);
            console.log(config);
            e.preventDefault();
            return false;
        });

        refreshDisplay();
    };

    jQuery(".lifecycle-ui").each(function () { initializeEditor(this) });
});

