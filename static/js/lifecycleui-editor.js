jQuery(function () {
    var STATUS_CIRCLE_RADIUS = 35;

    var _ELEMENT_KEY_SEQ = 0;

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

    Handlebars.registerHelper('canAddTransition', function(fromStatus, toStatus, state) {
        if (fromStatus == toStatus) {
            return false;
        }

        var hasTransition = false;
        jQuery.each(state.transitions, function (i, transition) {
            if (transition.from == fromStatus && transition.to == toStatus) {
                hasTransition = true;
            }
        });

        return !hasTransition;
    });

    Handlebars.registerHelper('canSelectTransition', function(fromStatus, toStatus, state) {
        if (fromStatus == toStatus) {
            return false;
        }

        var hasTransition = false;
        jQuery.each(state.transitions, function (i, transition) {
            if (transition.from == fromStatus && transition.to == toStatus) {
                hasTransition = true;
            }
        });

        return hasTransition;
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
        jQuery.each(state.transitions, function (i, transition) {
            if (transition.from == oldValue) {
                transition.from = newValue;
            }
            if (transition.to == oldValue) {
                transition.to = newValue;
            }
        });

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
        state.transitions = jQuery.grep(state.transitions, function (transition) {
            if (transition.from == statusName || transition.to == statusName) {
                return false;
            }
            return true;
        });

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
            .attr('refX', STATUS_CIRCLE_RADIUS + 5)
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
            transitions: [],
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
                        _key: _ELEMENT_KEY_SEQ++,
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
            jQuery.each(config.transitions, function (fromStatus, toList) {
                if (fromStatus == "") {
                }
                else {
                    jQuery.each(toList, function (i, toStatus) {
                        var transition = {
                            _key  : _ELEMENT_KEY_SEQ++,
                            from  : fromStatus,
                            to    : toStatus,
                            style : 'solid'
                        };
                        state.transitions.push(transition);
                    });
                }
            });
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

        var transitions = {};
        jQuery.each(state.transitions, function (i, transition) {
            var from = transition.from;
            var to = transition.to;
            if (!transitions[from]) {
                transitions[from] = [];
            }
            transitions[from].push(to);
            config.transitions = transitions;
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

        var transitionContainer = svg.append('g').classed('transitions', true);

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

                deselectAll(true);
                refreshDisplay();
            });

            inspector.find('a.add-transition').click(function (e) {
                e.preventDefault();
                var button = jQuery(this);
                var fromStatus = button.data('from');
                var toStatus   = button.data('to');

                var transition = {
                    _key  : _ELEMENT_KEY_SEQ++,
                    from  : fromStatus,
                    to    : toStatus,
                    style : 'solid'
                };
                state.transitions.push(transition);

                button.closest('li').addClass('hidden');

                inspector.find('a.select-transition[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').closest('li').removeClass('hidden');

                refreshDisplay();
                selectStatus(node.name);
            });

            inspector.find('a.select-transition').click(function (e) {
                e.preventDefault();
                var button = jQuery(this);
                var fromStatus = button.data('from');
                var toStatus   = button.data('to');

                selectTransition(fromStatus, toStatus);
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
            var d = state.statusMeta[name];
            setInspectorContent('status', d);

            deselectAll(false);

            svg.classed('selection', true);
            svg.selectAll('circle[data-name="'+name+'"], text[data-name="'+name+'"]').classed('selected', true);
            transitionContainer.selectAll('path[data-from="'+name+'"]').classed('selected', true);

            jQuery.each(state.transitions, function (i, transition) {
                if (transition.from == name) {
                    svg.selectAll('circle[data-name="'+transition.to+'"], text[data-name="'+transition.to+'"]').classed('reachable', true);
                }
            });
        };

        var selectTransition = function (fromStatus, toStatus) {
            var d;
            jQuery.each(state.transitions, function (i, transition) {
                if (transition.from == fromStatus && transition.to == toStatus) {
                    d = transition;
                }
            });
            setInspectorContent('transition', d);

            deselectAll(false);

            svg.classed('selection', true);
            svg.selectAll('circle[data-name="'+fromStatus+'"], text[data-name="'+fromStatus+'"]').classed('selected-source', true);
            svg.selectAll('circle[data-name="'+toStatus+'"], text[data-name="'+toStatus+'"]').classed('selected-sink', true);
            transitionContainer.select('path[data-from="'+fromStatus+'"][data-to="'+toStatus+'"]').classed('selected', true);
        };

        var refreshStatusNodes = function () {
            var statuses = svg.selectAll("circle")
                              .data(Object.values(state.statusMeta), function (d) { return d._key });

            statuses.exit()
                  .classed("removing", true)
                  .transition().duration(200)
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
            while (textLength > STATUS_CIRCLE_RADIUS*1.8 && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + '…');
                textLength = self.node().getComputedTextLength();
            }
        };

        var refreshStatusLabels = function () {
            var labels = svg.selectAll("text")
                            .data(Object.values(state.statusMeta), function (d) { return d._key });

            labels.exit()
                .classed("removing", true)
                .transition().duration(200)
                  .remove();

            labels.enter().append("text")
                          .on("click", function (d) {
                              d3.event.stopPropagation();
                              selectStatus(d.name);
                          })
                  .merge(labels)
                          .attr("x", function (d) { return xScale(d.x) })
                          .attr("y", function (d) { return yScale(d.y) })
                          .attr("fill", function (d) { return d3.hsl(d.color).l > 0.35 ? '#000' : '#fff' })
                          .attr("data-name", function (d) { return d.name })
                          .text(function (d) { return d.name }).each(truncateLabel)
        };

        var linkArc = function (d) {
          var from = state.statusMeta[d.from];
          var to = state.statusMeta[d.to];
          var dx = xScale(to.x - from.x),
              dy = yScale(to.y - from.y),
              dr = Math.abs(dx*6) + Math.abs(dy*6);
          return "M" + xScale(from.x) + "," + yScale(from.y) + "A" + dr + "," + dr + " 0 0,1 " + xScale(to.x) + "," + yScale(to.y);
        };

        var refreshTransitions = function () {
            var paths = transitionContainer.selectAll("path")
                            .data(state.transitions, function (d) { return d._key });

            paths.exit()
                .classed("removing", true)
                .transition().duration(200)
                  .remove();

            paths.enter().append("path")
                         .on("click", function (d) {
                             d3.event.stopPropagation();
                             selectTransition(d.from, d.to);
                         })
                  .merge(paths)
                          .attr("d", linkArc)
                          .attr("data-from", function (d) { return d.from })
                          .attr("data-to", function (d) { return d.to })
                          .classed("dashed", function (d) { return d.style == 'dashed' })
                          .classed("dotted", function (d) { return d.style == 'dotted' })
        };

        var refreshDisplay = function () {
            refreshTransitions();
            refreshStatusNodes();
            refreshStatusLabels();
        };

        jQuery('.inspector').on('click', 'a.select-status', function (e) {
            e.preventDefault();
            var statusName = jQuery(this).data('name');
            selectStatus(statusName);
        });

        setInspectorContent('canvas');

        svg.on('click', function () { deselectAll(true) });

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

