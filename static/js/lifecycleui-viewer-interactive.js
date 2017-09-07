jQuery(function () {
    var Super = RT.LifecycleViewer;

    function Interactive (container) {
        Super.call(this);
    };
    Interactive.prototype = Object.create(Super.prototype);

    Interactive.prototype.clickedStatus = function (d) {
    };

    Interactive.prototype.initializeViewer = function (node, name, config, focusStatus) {
         Super.prototype.initializeViewer.call(this, node, name, config, focusStatus);
    };

    RT.LifecycleViewerInteractive = Interactive;
});

