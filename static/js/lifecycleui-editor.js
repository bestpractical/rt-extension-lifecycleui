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

    var initializeEditor = function (node) {
        var container = jQuery(node);
        var name = container.data('name');
        var config = RT.LifecycleConfig[name];

        var svg = d3.select(node)
                    .select('svg');

        console.log(config);

        createArrowHead(svg);
    };

    jQuery(".lifecycle-ui").each(function () { initializeEditor(this) });
});

