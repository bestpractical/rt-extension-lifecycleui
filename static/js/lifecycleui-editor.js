jQuery(function () {
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
                        type: type
                    };
                });
            }
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

    var initializeEditor = function (node) {
        var container = jQuery(node);
        var name = container.data('name');
        var config = RT.LifecycleConfig[name];

        var svg = d3.select(node)
                    .select('svg');

        var state = initializeStateFromConfig(config);

        createArrowHead(svg);
    };

    jQuery(".lifecycle-ui").each(function () { initializeEditor(this) });
});

