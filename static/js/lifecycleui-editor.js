jQuery(function () {
    var STATUS_CIRCLE_RADIUS = 15;

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
        var yScale = createScale(height, STATUS_CIRCLE_RADIUS * 4);

        createArrowHead(svg);

        var setInspectorContent = function (type, node) {
            inspector.html(templates[type](node));
            inspector.attr('data-type', type);
        };

        var addStatusNodes = function () {
            var statuses = svg.selectAll("circle")
                              .data(Object.values(state.statusMeta), function (d) { return d._key });

            statuses.exit().remove();

            statuses.enter().append("circle")
                            .attr("r", STATUS_CIRCLE_RADIUS)
                            .on("click", function (d) {
                                setInspectorContent('status', d);
                            })
                    .merge(statuses)
                            .attr("cx", function (d) { return xScale(d.x) })
                            .attr("cy", function (d) { return yScale(d.y) })
                            .attr("fill", function (d) { return d.color })

        };

        setInspectorContent('canvas');

        addStatusNodes();
    };

    jQuery(".lifecycle-ui").each(function () { initializeEditor(this) });
});

