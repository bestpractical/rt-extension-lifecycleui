jQuery(function () {
    jQuery(".lifecycle-ui").each(function () {
        var container = jQuery(this);
        var name = container.data('name');
        var config = RT.LifecycleConfig[name];
        var stateOutput = container.find('.state');
        stateOutput.text(JSON.stringify(config));

    });
});

